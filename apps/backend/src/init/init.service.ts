import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client';

export class SetupDto {
    schoolName: string;
    address: string;
    contactEmail: string;
    adminFirstName: string;
    adminLastName: string;
    adminEmail: string;
    adminPassword: string;
}

@Injectable()
export class InitService {
    constructor(private prisma: PrismaService) { }

    async getStatus() {
        const config = await this.prisma.schoolConfig.findFirst();
        return { initialized: config?.isInitialized ?? false };
    }

    async setup(data: SetupDto) {
        const status = await this.getStatus();
        if (status.initialized) {
            throw new ForbiddenException('Application is already initialized.');
        }

        const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

        return await this.prisma.$transaction(async (tx) => {
            // Create School Config
            const schoolConfig = await tx.schoolConfig.create({
                data: {
                    schoolName: data.schoolName,
                    address: data.address,
                    contactEmail: data.contactEmail,
                    isInitialized: true,
                },
            });

            // Create Admin User
            const adminUser = await tx.user.create({
                data: {
                    email: data.adminEmail,
                    firstName: data.adminFirstName,
                    lastName: data.adminLastName,
                    passwordHash: hashedPassword,
                    role: UserRole.ADMIN,
                    status: UserStatus.ACTIVE,
                },
            });

            return {
                school: schoolConfig,
                admin: {
                    id: adminUser.id,
                    email: adminUser.email,
                },
            };
        });
    }
}
