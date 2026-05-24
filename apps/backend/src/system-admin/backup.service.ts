import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import {
  DatabaseService,
  hasSqliteMagic,
  quickCheckSqliteFile,
} from '../database/database.service';

const BACKUP_DIR =
  process.env.BACKUP_DIR || path.resolve(process.cwd(), 'data', 'backups');

// Restore staging lives in its own dir so the cached R2 download is never
// surfaced by listBackups (the previous behaviour duplicated every R2 file
// as a LOCAL row after the first restore).
const RESTORE_CACHE_DIR = path.join(BACKUP_DIR, '.restore-cache');

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private s3Client: S3Client | null = null;

  constructor(private readonly db: DatabaseService) {
    // Local dir is still needed as a staging area: createBackup uses it for
    // the online-backup snapshot before uploading, restoreBackup caches the
    // R2 download here so the atomic-swap operates on a regular file.
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    if (!fs.existsSync(RESTORE_CACHE_DIR)) {
      fs.mkdirSync(RESTORE_CACHE_DIR, { recursive: true });
    }

    // Initialize S3 Client for R2 if configured
    if (
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_ENDPOINT
    ) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      });
      this.logger.log('R2 Backup Storage initialized');
    }
  }

  /**
   * R2 is the canonical store when configured. When it isn't (typical for
   * local dev), backups stay on disk. The key invariant is "no silent
   * fallback" — once R2 env vars are set, any failure to write to R2 is a
   * hard error, never a quiet downgrade to LOCAL.
   */
  private r2Configured(): boolean {
    return !!(this.s3Client && process.env.R2_BUCKET_NAME);
  }

  private getR2() {
    if (!this.r2Configured()) {
      throw new ServiceUnavailableException(
        'R2 backup storage is not configured.',
      );
    }
    return {
      client: this.s3Client!,
      bucket: process.env.R2_BUCKET_NAME!,
    };
  }

  /**
   * Create a database backup.
   * - If R2 is configured, push to R2 and remove the local staging file.
   *   R2 failure is fatal — no silent downgrade to LOCAL.
   * - Otherwise (typical local dev) keep the backup on disk.
   */
  async createBackup(
    customName?: string,
  ): Promise<{ filename: string; size: number; storage: 'R2' | 'LOCAL' }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let filename = customName
      ? `${customName}.sqlite`
      : `backup-${timestamp}.sqlite`;

    // Ensure extension is exactly .sqlite once
    if (filename.endsWith('.sqlite.sqlite'))
      filename = filename.replace('.sqlite.sqlite', '.sqlite');
    if (!filename.endsWith('.sqlite')) filename += '.sqlite';

    // Snapshot the live DB via SQLite's online backup API into the local
    // backup directory. fs.copyFileSync on a hot DB can yield a torn file
    // (half-written header, WAL pages outside the main file) that the
    // consumer then rejects with SQLITE_NOTADB.
    const localStagePath = path.join(BACKUP_DIR, filename);
    await this.db.backupTo(localStagePath);
    const fileContent = fs.readFileSync(localStagePath);

    if (this.r2Configured()) {
      const { client, bucket } = this.getR2();
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: `backups/${filename}`,
            Body: fileContent,
          }),
        );
        this.logger.log(`Backup uploaded to R2: ${filename}`);
      } catch (err: any) {
        this.logger.error(`Failed to upload backup ${filename} to R2`, err);
        this.safeUnlink(localStagePath);
        throw new InternalServerErrorException(
          `Backup upload to R2 failed: ${err.message ?? err}`,
        );
      }
      // R2 owns the canonical copy — staging file would otherwise pollute
      // listBackups as a LOCAL duplicate.
      this.safeUnlink(localStagePath);
      return { filename, size: fileContent.length, storage: 'R2' };
    }

    this.logger.log(
      `Backup created locally: ${filename} (${fileContent.length} bytes)`,
    );
    return { filename, size: fileContent.length, storage: 'LOCAL' };
  }

  /** List all existing backups. */
  async listBackups(): Promise<
    Array<{
      filename: string;
      size: number;
      createdAt: string;
      storage: 'R2' | 'LOCAL';
    }>
  > {
    const byFilename = new Map<
      string,
      {
        filename: string;
        size: number;
        createdAt: string;
        storage: 'R2' | 'LOCAL';
      }
    >();

    if (this.s3Client && process.env.R2_BUCKET_NAME) {
      try {
        const data = await this.s3Client.send(
          new ListObjectsV2Command({
            Bucket: process.env.R2_BUCKET_NAME,
            Prefix: 'backups/',
          }),
        );

        if (data.Contents) {
          for (const item of data.Contents) {
            const filename = path.basename(item.Key!);
            byFilename.set(filename, {
              filename,
              size: item.Size ?? 0,
              createdAt: item.LastModified?.toISOString() ?? '',
              storage: 'R2',
            });
          }
        }
      } catch (err) {
        this.logger.error('Failed to list backups from R2:', err);
      }
    }

    // Local files remain visible (legacy installs, dev mode without R2) but
    // R2 wins on filename collision so the restore cache never appears as a
    // duplicate row. The cache dir itself is hidden (dotfile).
    if (fs.existsSync(BACKUP_DIR)) {
      const localFiles = fs
        .readdirSync(BACKUP_DIR, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.sqlite'));
      for (const entry of localFiles) {
        if (byFilename.has(entry.name)) continue;
        const stat = fs.statSync(path.join(BACKUP_DIR, entry.name));
        byFilename.set(entry.name, {
          filename: entry.name,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
          storage: 'LOCAL',
        });
      }
    }

    return [...byFilename.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  /** Delete a backup file */
  async deleteBackup(filename: string): Promise<void> {
    // Try delete from R2
    if (this.s3Client && process.env.R2_BUCKET_NAME) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: `backups/${filename}`,
          }),
        );
        this.logger.log(`Backup deleted from R2: ${filename}`);
      } catch (e) {}
    }

    // Try delete from Local
    const localPath = path.join(BACKUP_DIR, filename);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      this.logger.log(`Backup deleted from Local: ${filename}`);
    }
  }

  /**
   * Handle manual backup file upload. Behaves like createBackup: R2 when
   * configured (fatal on failure), local disk otherwise.
   */
  async uploadBackup(
    file: Express.Multer.File,
  ): Promise<{ filename: string; storage: 'R2' | 'LOCAL' }> {
    if (!hasSqliteMagic(file.buffer)) {
      throw new InternalServerErrorException(
        'Uploaded file is not a SQLite database (magic header missing).',
      );
    }

    const filename = `upload-${new Date().getTime()}-${file.originalname}`;

    if (this.r2Configured()) {
      const { client, bucket } = this.getR2();
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: `backups/${filename}`,
            Body: file.buffer,
          }),
        );
      } catch (err: any) {
        this.logger.error(`Failed to upload ${filename} to R2`, err);
        throw new InternalServerErrorException(
          `Backup upload to R2 failed: ${err.message ?? err}`,
        );
      }
      return { filename, storage: 'R2' };
    }

    const destPath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(destPath, file.buffer);
    return { filename, storage: 'LOCAL' };
  }

  /** Get a backup file for download. Falls back to R2 if not on local disk. */
  async getBackupFile(filename: string): Promise<Buffer> {
    // 1. Try local
    const localPath = path.join(BACKUP_DIR, filename);
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }

    // 2. Try R2 — fetch object and collect the streaming body into a Buffer.
    if (this.s3Client && process.env.R2_BUCKET_NAME) {
      try {
        const response = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: `backups/${filename}`,
          }),
        );
        const body = response.Body as AsyncIterable<Uint8Array> | undefined;
        if (!body) {
          throw new Error('R2 returned an empty response body');
        }
        const chunks: Buffer[] = [];
        for await (const chunk of body) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      } catch (err: any) {
        this.logger.error(
          `Failed to fetch backup ${filename} from R2: ${err.message}`,
        );
        throw new Error(
          `Backup file ${filename} not found locally; R2 fetch failed: ${err.message}`,
        );
      }
    }

    throw new Error(
      `Backup file ${filename} not found locally and R2 is not configured.`,
    );
  }

  /**
   * Restore database from a backup file (local disk or R2).
   * The R2 download is cached into a hidden sibling dir (not BACKUP_DIR)
   * so listBackups never reports the cached copy as a separate row.
   */
  async restoreBackup(filename: string): Promise<void> {
    const localPath = path.join(BACKUP_DIR, filename);
    const cachePath = path.join(RESTORE_CACHE_DIR, filename);
    let stagedFromR2: string | null = null;

    let sourcePath: string;
    if (fs.existsSync(localPath)) {
      sourcePath = localPath;
    } else {
      const buffer = await this.getBackupFile(filename);
      fs.writeFileSync(cachePath, buffer);
      stagedFromR2 = cachePath;
      sourcePath = cachePath;
      this.logger.log(
        `Cached R2 backup ${filename} into restore cache (${buffer.length} bytes)`,
      );
    }

    const dbPath = this.db.getLocalDatabasePath();
    if (!dbPath) {
      if (stagedFromR2) this.safeUnlink(stagedFromR2);
      throw new Error(
        'Restore is only supported on local SQLite, not on managed backends.',
      );
    }

    // 1. Validate the backup file BEFORE touching the live DB. Without this
    // a corrupted backup (e.g. a torn snapshot from the pre-online-backup
    // era) overwrites /data/edustack.db and crashloops the backend on the
    // next query.
    const header = Buffer.alloc(16);
    const fd = fs.openSync(sourcePath, 'r');
    try {
      fs.readSync(fd, header, 0, 16, 0);
    } finally {
      fs.closeSync(fd);
    }
    if (!hasSqliteMagic(header)) {
      if (stagedFromR2) this.safeUnlink(stagedFromR2);
      throw new Error(
        `Backup file ${filename} is not a SQLite database (magic header missing).`,
      );
    }
    if (!quickCheckSqliteFile(sourcePath)) {
      if (stagedFromR2) this.safeUnlink(stagedFromR2);
      throw new Error(
        `Backup file ${filename} failed integrity check (quick_check).`,
      );
    }

    // 2. Stage to a sibling temp path and atomically swap in. Reload the
    // live connection so subsequent queries read from the new inode rather
    // than the stale file handle.
    const tmpPath = `${dbPath}.restore-${Date.now()}`;
    fs.copyFileSync(sourcePath, tmpPath);
    try {
      fs.renameSync(tmpPath, dbPath);
      await this.db.reload();
      this.logger.log(`Restored system from backup: ${filename} -> ${dbPath}`);
    } catch (err: any) {
      this.safeUnlink(tmpPath);
      this.logger.error('Failed to restore database:', err);
      throw new Error(`Restore failed: ${err.message}`);
    } finally {
      if (stagedFromR2) this.safeUnlink(stagedFromR2);
    }
  }

  private safeUnlink(p: string) {
    try {
      fs.unlinkSync(p);
    } catch {
      /* best-effort cleanup */
    }
  }
}
