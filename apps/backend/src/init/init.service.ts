import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

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
    adminPassword: string;
}

@Injectable()
export class InitService {
    constructor(private prisma: PrismaService) { }

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
