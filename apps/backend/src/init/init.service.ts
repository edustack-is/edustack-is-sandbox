import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
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
}
