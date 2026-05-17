import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private s3Client: S3Client | null = null;

  constructor(private readonly db: DatabaseService) {
    // Ensure local backup directory exists (fallback)
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
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

  /** Create a database backup */
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

    // Push to R2 if configured, falling back to keeping the local copy.
    if (this.s3Client && process.env.R2_BUCKET_NAME) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: `backups/${filename}`,
            Body: fileContent,
          }),
        );
        this.logger.log(`Backup uploaded to R2: ${filename}`);
        // R2 succeeded — we no longer need the local copy.
        try {
          fs.unlinkSync(localStagePath);
        } catch {
          /* best-effort cleanup */
        }
        return { filename, size: fileContent.length, storage: 'R2' };
      } catch (err) {
        this.logger.error(
          'Failed to upload backup to R2; keeping local copy:',
          err,
        );
      }
    }

    this.logger.log(
      `Backup created locally: ${filename} (${fileContent.length} bytes)`,
    );
    return { filename, size: fileContent.length, storage: 'LOCAL' };
  }

  /** List all existing backups */
  async listBackups(): Promise<
    Array<{
      filename: string;
      size: number;
      createdAt: string;
      storage: 'R2' | 'LOCAL';
    }>
  > {
    const backups: any[] = [];

    // List from R2
    if (this.s3Client && process.env.R2_BUCKET_NAME) {
      try {
        const data = await this.s3Client.send(
          new ListObjectsV2Command({
            Bucket: process.env.R2_BUCKET_NAME,
            Prefix: 'backups/',
          }),
        );

        if (data.Contents) {
          data.Contents.forEach((item) => {
            backups.push({
              filename: path.basename(item.Key!),
              size: item.Size,
              createdAt: item.LastModified?.toISOString(),
              storage: 'R2',
            });
          });
        }
      } catch (err) {
        this.logger.error('Failed to list backups from R2:', err);
      }
    }

    // List from Local
    if (fs.existsSync(BACKUP_DIR)) {
      const localFiles = fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.endsWith('.sqlite'))
        .map((filename) => {
          const stat = fs.statSync(path.join(BACKUP_DIR, filename));
          return {
            filename,
            size: stat.size,
            createdAt: stat.mtime.toISOString(),
            storage: 'LOCAL' as const,
          };
        });
      backups.push(...localFiles);
    }

    return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  /** Handle manual backup file upload */
  async uploadBackup(
    file: Express.Multer.File,
  ): Promise<{ filename: string; storage: 'R2' | 'LOCAL' }> {
    const filename = `upload-${new Date().getTime()}-${file.originalname}`;

    if (this.s3Client && process.env.R2_BUCKET_NAME) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: `backups/${filename}`,
          Body: file.buffer,
        }),
      );
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

  /** Restore database from a backup file (local disk or R2). */
  async restoreBackup(filename: string): Promise<void> {
    const localPath = path.join(BACKUP_DIR, filename);

    // Cache to local disk if the backup lives on R2, so validation and the
    // atomic swap operate on a regular file regardless of storage tier.
    if (!fs.existsSync(localPath)) {
      const buffer = await this.getBackupFile(filename);
      fs.writeFileSync(localPath, buffer);
      this.logger.log(
        `Cached R2 backup ${filename} locally for restore (${buffer.length} bytes)`,
      );
    }

    const dbPath = this.db.getLocalDatabasePath();
    if (!dbPath) {
      throw new Error(
        'Restore is only supported on local SQLite, not on managed backends.',
      );
    }

    // 1. Validate the backup file BEFORE touching the live DB. Without this
    // a corrupted backup (e.g. a torn snapshot from the pre-online-backup
    // era) overwrites /data/edustack.db and crashloops the backend on the
    // next query.
    const header = Buffer.alloc(16);
    const fd = fs.openSync(localPath, 'r');
    try {
      fs.readSync(fd, header, 0, 16, 0);
    } finally {
      fs.closeSync(fd);
    }
    if (!hasSqliteMagic(header)) {
      throw new Error(
        `Backup file ${filename} is not a SQLite database (magic header missing).`,
      );
    }
    if (!quickCheckSqliteFile(localPath)) {
      throw new Error(
        `Backup file ${filename} failed integrity check (quick_check).`,
      );
    }

    // 2. Stage to a sibling temp path and atomically swap in. Reload the
    // live connection so subsequent queries read from the new inode rather
    // than the stale file handle.
    const tmpPath = `${dbPath}.restore-${Date.now()}`;
    fs.copyFileSync(localPath, tmpPath);
    try {
      fs.renameSync(tmpPath, dbPath);
      await this.db.reload();
      this.logger.log(`Restored system from backup: ${filename} -> ${dbPath}`);
    } catch (err: any) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* best-effort cleanup */
      }
      this.logger.error('Failed to restore database:', err);
      throw new Error(`Restore failed: ${err.message}`);
    }
  }
}
