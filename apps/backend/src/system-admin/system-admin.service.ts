import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import { CreateSchoolDto } from './dto/create-school.dto';
import * as crypto from 'crypto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class SystemAdminService {
    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
    ) { }

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

                // Send invitation email in background (don't await to avoid blocking transaction/response)
                this.mailService.sendInvitation(user.email, `${user.firstName} ${user.lastName}`, invitationToken)
                    .catch(e => console.error('Failed to send invitation email', e));

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

    async updateSchool(
        schoolId: string,
        data: {
            name?: string;
            address?: string;
            admin?: { type: 'EXISTING'; userId: string } | { type: 'NEW'; firstName: string; lastName: string; email: string };
        },
        actorId: string
    ) {
        const school = await this.prisma.school.findUnique({
            where: { id: schoolId },
            include: { members: { where: { role: UserRole.ADMIN }, include: { user: true } } }
        });
        if (!school) throw new NotFoundException('School not found');

        const oldValues: any = {
            name: school.name,
            address: school.address,
            primaryAdmin: school.members[0]?.user?.email || null,
        };

        const newValues: any = {};
        if (data.name !== undefined && data.name !== school.name) newValues.name = data.name;
        if (data.address !== undefined && data.address !== school.address) newValues.address = data.address;

        return this.prisma.$transaction(async (tx: any) => {
            // Update basic info
            if (Object.keys(newValues).length > 0) {
                await tx.school.update({
                    where: { id: schoolId },
                    data: newValues,
                });
            }

            // Handle Admin Update
            if (data.admin) {
                let adminUser;
                if (data.admin.type === 'EXISTING') {
                    adminUser = await tx.user.findUnique({ where: { id: data.admin.userId } });
                    if (!adminUser) throw new NotFoundException('Admin user not found');
                } else {
                    // Create new user (similar to createSchool)
                    const existing = await tx.user.findUnique({ where: { email: data.admin.email } });
                    if (existing) {
                        adminUser = existing;
                    } else {
                        const invitationToken = crypto.randomBytes(32).toString('hex');
                        const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                        adminUser = await tx.user.create({
                            data: {
                                email: data.admin.email,
                                firstName: data.admin.firstName,
                                lastName: data.admin.lastName,
                                invitationToken,
                                invitationExpires,
                            }
                        });

                        // Send invitation email
                        this.mailService.sendInvitation(adminUser.email, `${adminUser.firstName} ${adminUser.lastName}`, invitationToken)
                            .catch(e => console.error('Failed to send invitation email', e));
                    }
                }

                // Assign role (ensure it's the only ADMIN if we want a single primary, or just add him)
                // For simplicity, we make this user an ADMIN.
                await tx.schoolMembership.upsert({
                    where: { userId_schoolId: { userId: adminUser.id, schoolId } },
                    create: {
                        userId: adminUser.id,
                        schoolId,
                        role: UserRole.ADMIN,
                        status: adminUser.passwordHash ? UserStatus.ACTIVE : UserStatus.PENDING,
                    },
                    update: {
                        role: UserRole.ADMIN,
                        status: adminUser.passwordHash ? UserStatus.ACTIVE : UserStatus.PENDING,
                    }
                });

                newValues.primaryAdmin = adminUser.email;
            }

            if (Object.keys(newValues).length === 0) return school;

            await tx.auditLog.create({
                data: {
                    actorId,
                    action: 'UPDATE_SCHOOL_INFO',
                    entity: 'School',
                    entityId: schoolId,
                    oldValues,
                    newValues,
                },
            });

            return tx.school.findUnique({
                where: { id: schoolId },
                include: {
                    members: {
                        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
                        where: { role: UserRole.ADMIN },
                    },
                },
            });
        });
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

    async deleteSchool(schoolId: string) {
        const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
        if (!school) throw new NotFoundException('School not found');

        // Cascade delete all related data in a transaction
        return this.prisma.$transaction(async (tx: any) => {
            // Delete grades (depend on studentProfile, subjectInstance, teacherProfile)
            await tx.grade.deleteMany({ where: { schoolId } });

            // Delete attendance
            await tx.attendance.deleteMany({ where: { schoolId } });

            // Delete schedule events
            await tx.scheduleEvent.deleteMany({ where: { schoolId } });

            // Delete subject instances (depend on subjectTemplate, academicYear, gradeLevel)
            await tx.subjectInstance.deleteMany({ where: { schoolId } });

            // Delete subject templates
            await tx.subjectTemplate.deleteMany({ where: { schoolId } });

            // Get member user IDs for profile cleanup
            const memberships = await tx.schoolMembership.findMany({
                where: { schoolId },
                select: { userId: true },
            });
            const memberUserIds = memberships.map((m: any) => m.userId);

            // Delete student enrollments for members
            if (memberUserIds.length > 0) {
                await tx.studentEnrollment.deleteMany({
                    where: { studentId: { in: memberUserIds } },
                });

                // Delete teacher workloads for members
                await tx.teacherWorkload.deleteMany({
                    where: { teacherId: { in: memberUserIds } },
                });

                // Delete parent-student links for members
                await tx.parentStudent.deleteMany({
                    where: {
                        OR: [
                            { parentId: { in: memberUserIds } },
                            { studentId: { in: memberUserIds } },
                        ],
                    },
                });

                // Delete student profiles for members
                await tx.studentProfile.deleteMany({
                    where: { userId: { in: memberUserIds } },
                });

                // Delete teacher profiles for members
                await tx.teacherProfile.deleteMany({
                    where: { userId: { in: memberUserIds } },
                });
            }

            // Delete rooms
            await tx.room.deleteMany({ where: { schoolId } });

            // Delete classrooms
            await tx.classroom.deleteMany({ where: { schoolId } });

            // Delete grade levels
            await tx.gradeLevel.deleteMany({ where: { schoolId } });

            // Delete academic years
            await tx.academicYear.deleteMany({ where: { schoolId } });

            // Delete AI token usage
            await tx.aiTokenUsage.deleteMany({ where: { schoolId } });

            // Delete school memberships
            await tx.schoolMembership.deleteMany({ where: { schoolId } });

            // Finally delete the school
            await tx.school.delete({ where: { id: schoolId } });

            return { message: `Škola '${school.name}' byla úspěšně smazána.` };
        });
    }
}
