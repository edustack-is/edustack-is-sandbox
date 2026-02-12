import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import { CreateSchoolDto } from './dto/create-school.dto';
import * as crypto from 'crypto';

@Injectable()
export class SystemAdminService {
    constructor(private prisma: PrismaService) { }

    async createSchool(dto: CreateSchoolDto) {
        const { schoolName, address, admin } = dto;

        if (admin.type === 'EXISTING') {
            // Verify user exists
            const user = await this.prisma.user.findUnique({ where: { id: admin.userId } });
            if (!user) {
                throw new NotFoundException(`User with id ${admin.userId} not found`);
            }

            // Create school and membership in a transaction
            return this.prisma.$transaction(async (tx: any) => {
                const school = await tx.school.create({
                    data: { name: schoolName, address },
                });

                await tx.schoolMembership.create({
                    data: {
                        userId: user.id,
                        schoolId: school.id,
                        role: UserRole.ADMIN,
                        status: UserStatus.ACTIVE,
                    },
                });

                return school;
            });
        }

        if (admin.type === 'NEW') {
            // Check if email is already taken
            const existingUser = await this.prisma.user.findUnique({ where: { email: admin.email } });
            if (existingUser) {
                throw new BadRequestException(`User with email ${admin.email} already exists. Use type EXISTING instead.`);
            }

            const invitationToken = crypto.randomBytes(32).toString('hex');
            const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            return this.prisma.$transaction(async (tx: any) => {
                const user = await tx.user.create({
                    data: {
                        email: admin.email,
                        firstName: admin.firstName,
                        lastName: admin.lastName,
                        invitationToken,
                        invitationExpires,
                    },
                });

                const school = await tx.school.create({
                    data: { name: schoolName, address },
                });

                await tx.schoolMembership.create({
                    data: {
                        userId: user.id,
                        schoolId: school.id,
                        role: UserRole.ADMIN,
                        status: UserStatus.PENDING,
                    },
                });

                return { school, invitationToken };
            });
        }

        throw new BadRequestException("Invalid admin type");
    }

    async getSchools() {
        return this.prisma.school.findMany({
            include: {
                members: {
                    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
                    where: { role: UserRole.ADMIN },
                },
            },
        });
    }

    async getDashboardStats() {
        const [schoolCount, userCount, activeUserCount, recentLogins] = await Promise.all([
            this.prisma.school.count(),
            this.prisma.user.count(),
            this.prisma.schoolMembership.count({ where: { status: UserStatus.ACTIVE } }),
            this.prisma.auditLog.findMany({
                where: { action: 'LOGIN_SUCCESS' },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    createdAt: true,
                    newValues: true,
                    actor: {
                        select: { id: true, email: true, firstName: true, lastName: true },
                    },
                },
            }),
        ]);

        return {
            schoolCount,
            userCount,
            activeUserCount,
            recentLogins,
        };
    }

    async updateSchoolSettings(schoolId: string, aiConfig?: any, ssoConfig?: any) {
        const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
        if (!school) throw new NotFoundException('School not found');

        return this.prisma.school.update({
            where: { id: schoolId },
            data: {
                aiConfig: aiConfig ?? undefined,
                ssoConfig: ssoConfig ?? undefined,
            },
        });
    }

    async assignSchoolAdmin(schoolId: string, email: string, firstName: string, lastName: string) {
        const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
        if (!school) throw new NotFoundException('School not found');

        let user = await this.prisma.user.findUnique({ where: { email } });

        if (!user) {
            user = await this.prisma.user.create({
                data: { email, firstName, lastName },
            });
        }

        const membership = await this.prisma.schoolMembership.findUnique({
            where: { userId_schoolId: { userId: user.id, schoolId } },
        });

        if (membership) {
            return this.prisma.schoolMembership.update({
                where: { id: membership.id },
                data: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
            });
        } else {
            return this.prisma.schoolMembership.create({
                data: {
                    userId: user.id,
                    schoolId,
                    role: UserRole.ADMIN,
                    status: UserStatus.ACTIVE,
                },
            });
        }
    }
}
