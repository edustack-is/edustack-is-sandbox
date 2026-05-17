import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import Database from 'better-sqlite3';
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
    // The SQLite file format header is the 15-byte string "SQLite format 3"
    // followed by a single NUL byte (16 bytes total); written as hex here so
    // the NUL doesn't have to live inside a string literal.
    const SQLITE_MAGIC = Buffer.from('53514c69746520666f726d6174203300', 'hex');
    if (
      file.buffer.length < SQLITE_MAGIC.length ||
      !file.buffer.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC)
    ) {
      throw new Error('Uploaded file is not a SQLite database.');
    }

    // Stage to a sibling temp path so a partial or corrupt upload never
    // becomes the live file.
    const tmpPath = `${dbPath}.uploaded-${Date.now()}`;
    fs.writeFileSync(tmpPath, file.buffer);

    try {
      // Probe with the same driver the runtime uses. quick_check forces a
      // real page scan (cheaper than full integrity_check) and returns "ok"
      // on a healthy DB.
      const probe = new Database(tmpPath, {
        readonly: true,
        fileMustExist: true,
      });
      let pragmaResult: unknown;
      try {
        pragmaResult = probe.pragma('quick_check', { simple: true });
      } finally {
        probe.close();
      }
      if (pragmaResult !== 'ok') {
        throw new Error(`quick_check returned: ${String(pragmaResult)}`);
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
