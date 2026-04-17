import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { UserRole, UserStatus } from '@prisma/client';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { validatePasswordStrength } from '../utils/password-policy';

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
  constructor(private prisma: PrismaService) {}

  async getStatus() {
    try {
      const userCount = await this.prisma.user.count();
      return { initialized: userCount > 0 };
    } catch (error: any) {
      if (error?.code === 'P2021') {
        return { initialized: false };
      }
      throw error;
    }
  }

  async setup(data: SetupDto) {
    const status = await this.getStatus();
    if (status.initialized) {
      throw new ForbiddenException('Application is already initialized.');
    }

    // Validate password policy server-side (belt + suspenders with DTO decorators)
    validatePasswordStrength(data.adminPassword);

    const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

    const adminUser = await this.prisma.user.create({
      data: {
        email: data.adminEmail,
        firstName: data.adminFirstName,
        lastName: data.adminLastName,
        passwordHash: hashedPassword,
        isSystemAdmin: true,
        // No school membership initially
      },
    });

    return {
      admin: {
        id: adminUser.id,
        email: adminUser.email,
      },
    };
  }

  /**
   * Restores the database from an uploaded .sqlite file.
   * ONLY allowed if the system is not yet initialized.
   */
  async restoreFromSqlite(file: Express.Multer.File) {
    const status = await this.getStatus();
    if (status.initialized) {
      throw new ForbiddenException(
        'Database restore only allowed on fresh system.',
      );
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
          .find(
            (f: string) => f.endsWith('.sqlite') && f !== 'metadata.sqlite',
          );
        if (dbFile) dbPath = path.join(wranglerDir, dbFile);
      }
    }

    if (!dbPath) {
      throw new Error('Could not find database file to overwrite');
    }

    this.logger.log(`Restoring database from uploaded file to: ${dbPath}`);

    try {
      // 2. We don't necessarily need to close connections if we just overwrite 
      // the file in SQLite while it's "clean", but for safety we use fs.writeFileSync
      // directly on the detected path.
      fs.writeFileSync(dbPath, file.buffer);

      this.logger.log('Database file overwritten successfully.');

      return { success: true, message: 'Database restored successfully' };
    } catch (err: any) {
      this.logger.error('Failed to restore database file:', err);
      throw new Error(`Restore failed: ${err.message}`);
    }
  }
}
