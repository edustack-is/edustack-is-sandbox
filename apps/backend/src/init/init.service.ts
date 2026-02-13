import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client';

export class SetupDto {
    adminFirstName: string;
    adminLastName: string;
    adminEmail: string;
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
