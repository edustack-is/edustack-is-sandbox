import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
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
      this.logger.log(`Init status check: count=${result?.count}, initialized=${isInitialized}`);
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
    const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
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

    // Logic to find DB path for overwrite (simplified - DatabaseService should ideally handle this)
    let dbPath = process.env.DATABASE_URL?.replace('file:', '');
    // ... search logic (same as DatabaseService) ...

    if (!dbPath) throw new Error('❌ Database not found for restore.');

    try {
      fs.writeFileSync(dbPath, file.buffer);
      // Wait or reconnect might be needed if using persistent connection
      const check = await this.db.queryOne(
        'SELECT COUNT(*) as count FROM "User"',
      );
      if (!check) throw new Error('Invalid database');
      return { success: true };
    } catch (err: any) {
      throw new Error(`Restore failed: ${err.message}`);
    }
  }
}
