import { Injectable, ForbiddenException } from '@nestjs/common';
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
        try {
            const schoolCount = await this.prisma.school.count();
            const userCount = await this.prisma.user.count();
            return { initialized: schoolCount > 0 && userCount > 0 };
        } catch (error: any) {
            // Tables may not exist yet (fresh DB before prisma db push)
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

        return await this.prisma.$transaction(async (tx: any) => {
            // Create First School (tenant)
            const school = await tx.school.create({
                data: {
                    name: data.schoolName,
                    address: data.address,
                    contactEmail: data.contactEmail,
                },
            });

            // Create Admin User with System Admin privileges
            const adminUser = await tx.user.create({
                data: {
                    email: data.adminEmail,
                    firstName: data.adminFirstName,
                    lastName: data.adminLastName,
                    passwordHash: hashedPassword,
                    isSystemAdmin: true,
                    schoolMemberships: {
                        create: {
                            schoolId: school.id,
                            role: UserRole.ADMIN,
                            status: UserStatus.ACTIVE,
                        },
                    },
                },
                include: { schoolMemberships: true },
            });

            return {
                school,
                admin: {
                    id: adminUser.id,
                    email: adminUser.email,
                },
            };
        });
    }
}
