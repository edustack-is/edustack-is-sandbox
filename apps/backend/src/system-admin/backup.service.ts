import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);
const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(process.cwd(), 'data', 'backups');

@Injectable()
export class BackupService {
    private readonly logger = new Logger(BackupService.name);

    constructor() {
        // Ensure backup directory exists
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
    }

    /** Create a database backup using pg_dump */
    async createBackup(): Promise<{ filename: string; size: number }> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${timestamp}.sql`;
        const filepath = path.join(BACKUP_DIR, filename);

        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error('DATABASE_URL is not set');

        try {
            await execFileAsync('pg_dump', [dbUrl, '--file', filepath, '--clean', '--if-exists']);
        } catch (err: any) {
            this.logger.error(`pg_dump failed: ${err.stderr || err.message}`);
            throw new Error('Database backup failed');
        }

        const stat = fs.statSync(filepath);
        this.logger.log(`Backup created: ${filename} (${stat.size} bytes)`);
        return { filename, size: stat.size };
    }

    /** List all existing backups */
    listBackups(): Array<{ filename: string; size: number; createdAt: string }> {
        if (!fs.existsSync(BACKUP_DIR)) return [];

        return fs
            .readdirSync(BACKUP_DIR)
            .filter((f) => f.endsWith('.sql'))
            .map((filename) => {
                const stat = fs.statSync(path.join(BACKUP_DIR, filename));
                return {
                    filename,
                    size: stat.size,
                    createdAt: stat.mtime.toISOString(),
                };
            })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    /** Get the absolute path for a backup file (validates it exists) */
    getBackupPath(filename: string): string {
        // Prevent path traversal
        const sanitized = path.basename(filename);
        const filepath = path.join(BACKUP_DIR, sanitized);
        if (!fs.existsSync(filepath)) {
            throw new Error(`Backup file not found: ${sanitized}`);
        }
        return filepath;
    }

    /** Restore database from a backup file */
    async restoreBackup(filename: string): Promise<void> {
        const filepath = this.getBackupPath(filename);
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error('DATABASE_URL is not set');

        this.logger.warn(`Restoring database from: ${filename}`);

        try {
            await execFileAsync('psql', [dbUrl, '--file', filepath]);
        } catch (err: any) {
            this.logger.error(`psql restore failed: ${err.stderr || err.message}`);
            throw new Error('Database restore failed');
        }

        this.logger.log(`Database restored from: ${filename}`);
    }

    /** Delete a backup file */
    deleteBackup(filename: string): void {
        const filepath = this.getBackupPath(filename);
        fs.unlinkSync(filepath);
        this.logger.log(`Backup deleted: ${filename}`);
    }
}
