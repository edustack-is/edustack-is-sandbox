import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR =
  process.env.BACKUP_DIR || path.resolve(process.cwd(), 'data', 'backups');

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private s3Client: S3Client | null = null;

  constructor(@Inject('CLOUDFLARE_DB') private readonly d1: any) {
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

    // 1. Get database path
    let sourcePath = process.env.DATABASE_URL?.replace('file:', '');

    // Auto-detect if not set
    if (!sourcePath) {
      const wranglerDir = path.join(
        process.cwd(),
        '.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
      );
      if (fs.existsSync(wranglerDir)) {
        const files = fs.readdirSync(wranglerDir);
        const dbFile = files.find(
          (f: string) => f.endsWith('.sqlite') && f !== 'metadata.sqlite',
        );
        if (dbFile) sourcePath = path.join(wranglerDir, dbFile);
      }
    }

    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new Error('Could not find database file to backup');
    }

    // 2. Upload to R2 if available
    if (this.s3Client && process.env.R2_BUCKET_NAME) {
      try {
        const fileContent = fs.readFileSync(sourcePath);
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: `backups/${filename}`,
            Body: fileContent,
          }),
        );

        this.logger.log(`Backup uploaded to R2: ${filename}`);
        return { filename, size: fileContent.length, storage: 'R2' };
      } catch (err) {
        this.logger.error('Failed to upload backup to R2:', err);
        // Fallback to local
      }
    }

    // 3. Fallback to Local Storage
    const destPath = path.join(BACKUP_DIR, filename);
    fs.copyFileSync(sourcePath, destPath);

    const stat = fs.statSync(destPath);
    this.logger.log(`Backup created locally: ${filename} (${stat.size} bytes)`);
    return { filename, size: stat.size, storage: 'LOCAL' };
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

  /** Get a backup file for download */
  async getBackupFile(filename: string): Promise<Buffer> {
    // 1. Try local
    const localPath = path.join(BACKUP_DIR, filename);
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }

    // 2. Try R2 (not implemented yet for simplicity, but could be added here)
    throw new Error('Backup file not found');
  }

  /** Restore database from a backup file */
  async restoreBackup(filename: string): Promise<void> {
    const localPath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Backup file ${filename} not found locally.`);
    }

    // 1. Resolve DB path (Wrangler local storage)
    let dbPath = process.env.DATABASE_URL?.replace('file:', '');
    if (!dbPath) {
      const wranglerDir = path.join(
        process.cwd(),
        '.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
      );
      if (fs.existsSync(wranglerDir)) {
        const dbFile = fs
          .readdirSync(wranglerDir)
          .find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
        if (dbFile) dbPath = path.join(wranglerDir, dbFile);
      }
    }

    if (!dbPath) {
      throw new Error('Could not find active database file to overwrite');
    }

    this.logger.log(`Restoring system from backup: ${filename} -> ${dbPath}`);

    try {
      // 2. Overwrite active DB
      fs.copyFileSync(localPath, dbPath);
      this.logger.log(
        'System restored successfully. Application might need restart to clear cache if using better-sqlite3 pooled connections.',
      );
    } catch (err: any) {
      this.logger.error('Failed to restore database:', err);
      throw new Error(`Restore failed: ${err.message}`);
    }
  }
}
