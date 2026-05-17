import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import {
  DatabaseService,
  hasSqliteMagic,
  quickCheckSqliteFile,
} from '../database/database.service';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { validatePasswordStrength } from '../utils/password-policy';
import * as crypto from 'crypto';

export class SetupDto {
  @IsString()
  @IsNotEmpty()
  adminFirstName: string;

  @IsString()
  @IsNotEmpty()
  adminLastName: string;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @MaxLength(72, { message: 'Password must not exceed 72 characters.' })
  @Matches(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter.',
  })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter.',
  })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number.' })
  adminPassword: string;
}

@Injectable()
export class InitService {
  private readonly logger = new Logger(InitService.name);
  constructor(private db: DatabaseService) {}

  async getStatus() {
    try {
      const result = await this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "User"',
      );
      const isInitialized = (result?.count || 0) > 0;
      this.logger.log(
        `Init status check: count=${result?.count}, initialized=${isInitialized}`,
      );
      return { initialized: isInitialized };
    } catch (error: any) {
      this.logger.warn(`Status check failed: ${error.message}`);
      return { initialized: false };
    }
  }

  async setup(data: SetupDto) {
    const status = await this.getStatus();
    if (status.initialized)
      throw new ForbiddenException('Application is already initialized.');

    validatePasswordStrength(data.adminPassword);
    const hashedPassword = await bcrypt.hash(data.adminPassword, 12);
    const id = crypto.randomUUID();

    await this.db.execute(
      'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, isSystemAdmin, createdAt) VALUES (?, ?, ?, ?, ?, 1, ?)',
      [
        id,
        data.adminEmail,
        data.adminFirstName,
        data.adminLastName,
        hashedPassword,
        new Date().toISOString(),
      ],
    );

    return { admin: { id, email: data.adminEmail } };
  }

  async restoreFromSqlite(file: Express.Multer.File) {
    const status = await this.getStatus();
    if (status.initialized)
      throw new ForbiddenException(
        'Database restore only allowed on fresh system.',
      );

    const dbPath = this.db.getLocalDatabasePath();
    if (!dbPath) {
      throw new Error(
        'Database restore is only supported on local SQLite, not on managed backends.',
      );
    }

    // Reject up front if the magic header doesn't match. Without this an
    // accidental .csv/.json/whatever upload would clobber the live DB and
    // crashloop the backend on the next query - exactly the failure mode
    // .github/workflows/reset-database.yml was written to recover from.
    if (!hasSqliteMagic(file.buffer)) {
      throw new Error('Uploaded file is not a SQLite database.');
    }

    // Stage to a sibling temp path so a partial or corrupt upload never
    // becomes the live file.
    const tmpPath = `${dbPath}.uploaded-${Date.now()}`;
    fs.writeFileSync(tmpPath, file.buffer);

    try {
      // quick_check forces a real page scan, returns "ok" on a healthy DB.
      if (!quickCheckSqliteFile(tmpPath)) {
        throw new Error('Uploaded backup failed quick_check.');
      }

      // Atomic swap into place, then reload our live connection so subsequent
      // queries read from the new inode.
      fs.renameSync(tmpPath, dbPath);
      await this.db.reload();

      // Sanity check: the restored DB has the schema this app expects.
      const check = await this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "User"',
      );
      if (!check) throw new Error('Restored DB is missing required schema.');

      return { success: true };
    } catch (err: any) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* swallow cleanup failure - tmp file may already be renamed */
      }
      throw new Error(`Restore failed: ${err.message}`);
    }
  }
}
