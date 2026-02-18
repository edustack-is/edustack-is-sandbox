import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';

@Injectable()
export class DeputyService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ) { }

    // ─── SCHOOL DASHBOARD ────────────────────────────────────────────

    async getSchoolDashboard(schoolId: string) {
        const [
            studentCount,
            teacherCount,
            classroomCount,
            subjectCount,
            roomCount,
            currentAcademicYear,
            recentMembers,
        ] = await Promise.all([
            this.prisma.schoolMembership.count({
                where: { schoolId, role: 'STUDENT', status: UserStatus.ACTIVE },
            }),
            this.prisma.schoolMembership.count({
                where: { schoolId, role: 'TEACHER', status: UserStatus.ACTIVE },
            }),
            this.prisma.classroom.count({ where: { schoolId } }),
            this.prisma.subjectTemplate.count({ where: { schoolId } }),
            this.prisma.room.count({ where: { schoolId } }),
            this.prisma.academicYear.findFirst({
                where: { schoolId, isCurrent: true },
                select: { id: true, name: true, startDate: true, endDate: true },
            }),
            this.prisma.schoolMembership.findMany({
                where: { schoolId },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: {
                    user: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
            }),
        ]);

        // Count all members (not just active)
        const totalMembers = await this.prisma.schoolMembership.count({ where: { schoolId } });
        const pendingMembers = await this.prisma.schoolMembership.count({
            where: { schoolId, status: UserStatus.PENDING },
        });

        return {
            studentCount,
            teacherCount,
            classroomCount,
            subjectCount,
            roomCount,
            totalMembers,
            pendingMembers,
            currentAcademicYear,
            recentMembers: recentMembers.map(m => ({
                id: m.user.id,
                name: `${m.user.firstName} ${m.user.lastName}`,
                email: m.user.email,
                role: m.role,
                status: m.status,
                createdAt: m.createdAt,
            })),
        };
    }

    // ─── CLASSROOM CRUD ──────────────────────────────────────────────

    async getClassrooms(schoolId: string) {
        return this.prisma.classroom.findMany({
            where: { schoolId },
            include: {
                students: {
                    include: { user: { select: { firstName: true, lastName: true } } },
                },
                homeroomTeacher: {
                    include: { user: { select: { firstName: true, lastName: true } } },
                },
            },
            orderBy: [{ grade: 'asc' }, { name: 'asc' }],
        });
    }

    async createClassroom(actorId: string, schoolId: string, data: { name: string; grade: number }) {
        const classroom = await this.prisma.classroom.create({
            data: { name: data.name, grade: data.grade, schoolId },
        });

        await this.audit(actorId, 'CREATE_CLASSROOM', 'Classroom', classroom.id, data);
        return classroom;
    }

    async updateClassroom(actorId: string, schoolId: string, id: string, data: { name?: string; grade?: number }) {
        const existing = await this.prisma.classroom.findFirst({ where: { id, schoolId } });
        if (!existing) throw new NotFoundException('Classroom not found');

        const updated = await this.prisma.classroom.update({
            where: { id },
            data,
        });

        await this.audit(actorId, 'UPDATE_CLASSROOM', 'Classroom', id, data, existing);
        return updated;
    }

    async deleteClassroom(actorId: string, schoolId: string, id: string) {
        const existing = await this.prisma.classroom.findFirst({ where: { id, schoolId } });
        if (!existing) throw new NotFoundException('Classroom not found');

        await this.prisma.classroom.delete({ where: { id } });
        await this.audit(actorId, 'DELETE_CLASSROOM', 'Classroom', id, null, existing);
        return { deleted: true };
    }

    // ─── SUBJECT CRUD ────────────────────────────────────────────────

    async getSubjects(schoolId: string) {
        return this.prisma.subjectTemplate.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' },
        });
    }

    async createSubject(actorId: string, schoolId: string, data: { name: string; code: string; svpDescription?: string }) {
        const subject = await this.prisma.subjectTemplate.create({
            data: { name: data.name, code: data.code, svpDescription: data.svpDescription, schoolId },
        });

        await this.audit(actorId, 'CREATE_SUBJECT', 'SubjectTemplate', subject.id, data);
        return subject;
    }

    async updateSubject(actorId: string, schoolId: string, id: string, data: { name?: string; code?: string; svpDescription?: string }) {
        const existing = await this.prisma.subjectTemplate.findFirst({ where: { id, schoolId } });
        if (!existing) throw new NotFoundException('Subject template not found');

        const updated = await this.prisma.subjectTemplate.update({ where: { id }, data });
        await this.audit(actorId, 'UPDATE_SUBJECT', 'SubjectTemplate', id, data, existing);
        return updated;
    }

    async deleteSubject(actorId: string, schoolId: string, id: string) {
        const existing = await this.prisma.subjectTemplate.findFirst({ where: { id, schoolId } });
        if (!existing) throw new NotFoundException('Subject template not found');

        await this.prisma.subjectTemplate.delete({ where: { id } });
        await this.audit(actorId, 'DELETE_SUBJECT', 'SubjectTemplate', id, null, existing);
        return { deleted: true };
    }

    // ─── ROOM CRUD ───────────────────────────────────────────────────

    async getRooms(schoolId: string) {
        return this.prisma.room.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' },
        });
    }

    async createRoom(actorId: string, schoolId: string, data: { name: string; capacity?: number; isComputerLab?: boolean; specialEquipment?: string[] }) {
        const room = await this.prisma.room.create({
            data: {
                name: data.name,
                capacity: data.capacity ?? 30,
                isComputerLab: data.isComputerLab ?? false,
                specialEquipment: data.specialEquipment ?? [],
                schoolId,
            },
        });

        await this.audit(actorId, 'CREATE_ROOM', 'Room', room.id, data);
        return room;
    }

    async updateRoom(actorId: string, schoolId: string, id: string, data: { name?: string; capacity?: number; isComputerLab?: boolean; specialEquipment?: string[] }) {
        const existing = await this.prisma.room.findFirst({ where: { id, schoolId } });
        if (!existing) throw new NotFoundException('Room not found');

        const updated = await this.prisma.room.update({ where: { id }, data });
        await this.audit(actorId, 'UPDATE_ROOM', 'Room', id, data, existing);
        return updated;
    }

    async deleteRoom(actorId: string, schoolId: string, id: string) {
        const existing = await this.prisma.room.findFirst({ where: { id, schoolId } });
        if (!existing) throw new NotFoundException('Room not found');

        await this.prisma.room.delete({ where: { id } });
        await this.audit(actorId, 'DELETE_ROOM', 'Room', id, null, existing);
        return { deleted: true };
    }

    // ─── USER INVITATION ─────────────────────────────────────────────

    async inviteUser(
        actorId: string,
        schoolId: string,
        data: {
            email: string;
            firstName: string;
            lastName: string;
            role: UserRole;
            workloadPercentage?: number;
        },
    ) {
        if (!['TEACHER', 'STUDENT', 'DEPUTY', 'PRINCIPAL'].includes(data.role)) {
            throw new BadRequestException('Can only invite TEACHER, STUDENT, DEPUTY, or PRINCIPAL roles.');
        }

        // PRINCIPAL uniqueness: only one per school
        if (data.role === 'PRINCIPAL') {
            const existingPrincipal = await this.prisma.schoolMembership.findFirst({
                where: { schoolId, role: 'PRINCIPAL' },
            });
            if (existingPrincipal) {
                throw new BadRequestException('This school already has a principal. Only one principal per school is allowed.');
            }
        }

        // Check if user already exists
        let user = await this.prisma.user.findUnique({ where: { email: data.email } });

        const invitationToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = await bcrypt.hash(invitationToken, 10);
        const invitationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

        if (!user) {
            // Create new user
            user = await this.prisma.user.create({
                data: {
                    email: data.email,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    invitationToken: hashedToken,
                    invitationExpires,
                },
            });
        } else {
            // Update existing user with invitation token
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: { invitationToken: hashedToken, invitationExpires },
            });
        }

        // Create school membership with appropriate role
        const membershipData: any = {
            userId: user.id,
            schoolId,
            role: data.role,
            status: UserStatus.PENDING,
        };

        if (data.role === 'TEACHER' && data.workloadPercentage !== undefined) {
            membershipData.workloadPercentage = data.workloadPercentage;
        }

        // Upsert membership (user might already be a member with different role)
        await this.prisma.schoolMembership.upsert({
            where: { userId_schoolId: { userId: user.id, schoolId } },
            create: membershipData,
            update: {
                role: data.role,
                status: UserStatus.PENDING,
                ...(data.role === 'TEACHER' && data.workloadPercentage !== undefined
                    ? { workloadPercentage: data.workloadPercentage }
                    : {}),
            },
        });

        // Create teacher/student profile if needed
        if (data.role === 'TEACHER') {
            await this.prisma.teacherProfile.upsert({
                where: { userId: user.id },
                create: { userId: user.id },
                update: {},
            });
        } else if (data.role === 'STUDENT') {
            await this.prisma.studentProfile.upsert({
                where: { userId: user.id },
                create: { userId: user.id, firstName: data.firstName, lastName: data.lastName },
                update: {},
            });
        }

        const fullToken = `${user.id}.${invitationToken}`;

        // Send invitation email
        this.mailService.sendInvitation(user.email, `${user.firstName} ${user.lastName}`, fullToken)
            .catch(e => console.error('Failed to send invitation email', e));

        await this.audit(actorId, 'INVITE_USER', 'User', user.id, {
            email: data.email,
            role: data.role,
            workloadPercentage: data.workloadPercentage,
        });

        return { token: fullToken, userId: user.id };
    }

    // ─── SCHOOL-SCOPED USER LIST ────────────────────────────────────

    async getSchoolUsers(schoolId: string) {
        const memberships = await this.prisma.schoolMembership.findMany({
            where: { schoolId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        lastLogin: true,
                        createdAt: true,
                        studentProfile: {
                            select: {
                                id: true,
                                classroom: { select: { id: true, name: true } },
                            },
                        },
                        teacherProfile: {
                            select: {
                                id: true,
                                homeroomClass: { select: { id: true, name: true } },
                            },
                        },
                        childOf: {
                            select: {
                                parent: { select: { id: true, firstName: true, lastName: true } },
                            },
                        },
                        parentOf: {
                            select: {
                                student: { select: { id: true, firstName: true, lastName: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return memberships.map((m) => ({
            id: m.user.id,
            membershipId: m.id,
            email: m.user.email,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
            role: m.role,
            status: m.status,
            workloadPercentage: m.workloadPercentage,
            lastLogin: m.user.lastLogin,
            createdAt: m.user.createdAt,
            classroomName: m.user.studentProfile?.classroom?.name || null,
            classroomId: m.user.studentProfile?.classroom?.id || null,
            homeroomClassName: m.user.teacherProfile?.homeroomClass?.name || null,
            teacherProfileId: m.user.teacherProfile?.id || null,
            parents: (m.user.childOf || []).map((r: any) => ({
                id: r.parent.id,
                name: `${r.parent.firstName} ${r.parent.lastName}`,
            })),
            children: (m.user.parentOf || []).map((r: any) => ({
                id: r.student.id,
                name: `${r.student.firstName} ${r.student.lastName}`,
            })),
        }));
    }

    // ─── CREATE STUDENT + FAMILY ────────────────────────────────────

    async createStudentFamily(
        actorId: string,
        schoolId: string,
        data: {
            student: { firstName: string; lastName: string; email?: string };
            parents: Array<{ firstName: string; lastName: string; email: string; phone?: string }>;
        },
    ) {
        return this.prisma.$transaction(async (tx) => {
            // 1. Create student user
            const studentEmail = data.student.email || `student-${crypto.randomUUID()}@noemail.local`;
            const studentInvitationToken = data.student.email ? crypto.randomBytes(32).toString('hex') : null;
            const studentHashedToken = studentInvitationToken ? await bcrypt.hash(studentInvitationToken, 10) : null;
            const invitationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

            const studentUser = await tx.user.create({
                data: {
                    email: studentEmail,
                    firstName: data.student.firstName,
                    lastName: data.student.lastName,
                    ...(studentHashedToken ? { invitationToken: studentHashedToken, invitationExpires: invitationExpires } : {}),
                },
            });

            // 2. Create SchoolMembership for student
            await tx.schoolMembership.create({
                data: {
                    userId: studentUser.id,
                    schoolId,
                    role: 'STUDENT',
                    status: UserStatus.PENDING,
                },
            });

            // 3. Create StudentProfile
            await tx.studentProfile.create({
                data: {
                    userId: studentUser.id,
                    firstName: data.student.firstName,
                    lastName: data.student.lastName,
                },
            });

            // 4. Process parents
            const createdParents: Array<{ userId: string; email: string; token?: string }> = [];

            for (const parentData of data.parents) {
                // Find or create parent user
                let parentUser = await tx.user.findUnique({ where: { email: parentData.email } });
                const parentInvitationToken = crypto.randomBytes(32).toString('hex');
                const parentHashedToken = await bcrypt.hash(parentInvitationToken, 10);

                if (!parentUser) {
                    parentUser = await tx.user.create({
                        data: {
                            email: parentData.email,
                            firstName: parentData.firstName,
                            lastName: parentData.lastName,
                            invitationToken: parentHashedToken,
                            invitationExpires: invitationExpires,
                        },
                    });
                } else {
                    parentUser = await tx.user.update({
                        where: { id: parentUser.id },
                        data: { invitationToken: parentHashedToken, invitationExpires: invitationExpires },
                    });
                }

                // Create/upsert SchoolMembership for parent
                await tx.schoolMembership.upsert({
                    where: { userId_schoolId: { userId: parentUser.id, schoolId } },
                    create: { userId: parentUser.id, schoolId, role: 'PARENT', status: UserStatus.PENDING },
                    update: {},
                });

                // Create ParentStudent link
                await tx.parentStudent.upsert({
                    where: { parentId_studentId: { parentId: parentUser.id, studentId: studentUser.id } },
                    create: { parentId: parentUser.id, studentId: studentUser.id },
                    update: {},
                });

                const fullParentToken = `${parentUser.id}.${parentInvitationToken}`;
                createdParents.push({
                    userId: parentUser.id,
                    email: parentData.email,
                    token: fullParentToken,
                });

                // Send invitation email to parent
                this.mailService.sendInvitation(parentData.email, `${parentData.firstName} ${parentData.lastName}`, fullParentToken)
                    .catch(e => console.error('Failed to send parent invitation email', e));
            }

            // 5. Audit
            await tx.auditLog.create({
                data: {
                    actorId,
                    action: 'CREATE_STUDENT_FAMILY',
                    entity: 'User',
                    entityId: studentUser.id,
                    newValues: { student: data.student, parentCount: data.parents.length },
                },
            });

            // Send invitation email to student (outside loop, once)
            if (studentInvitationToken) {
                this.mailService.sendInvitation(studentUser.email, `${studentUser.firstName} ${studentUser.lastName}`, `${studentUser.id}.${studentInvitationToken}`)
                    .catch(e => console.error('Failed to send student invitation email', e));
            }

            return {
                student: { id: studentUser.id, email: studentEmail },
                parents: createdParents,
                studentToken: studentInvitationToken ? `${studentUser.id}.${studentInvitationToken}` : null,
            };
        });
    }

    // ─── CREATE STAFF ───────────────────────────────────────────────

    async createStaff(
        actorId: string,
        schoolId: string,
        data: {
            firstName: string;
            lastName: string;
            email: string;
            role: 'TEACHER' | 'DEPUTY';
            workloadPercentage: number;
        },
    ) {
        const invitationToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = await bcrypt.hash(invitationToken, 10);
        const invitationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

        const user = await this.prisma.$transaction(async (tx) => {
            // Find or create user
            let user = await tx.user.findUnique({ where: { email: data.email } });

            if (!user) {
                user = await tx.user.create({
                    data: {
                        email: data.email,
                        firstName: data.firstName,
                        lastName: data.lastName,
                        invitationToken: hashedToken,
                        invitationExpires,
                    },
                });
            } else {
                user = await tx.user.update({
                    where: { id: user.id },
                    data: { invitationToken: hashedToken, invitationExpires },
                });
            }

            // Create SchoolMembership
            await tx.schoolMembership.upsert({
                where: { userId_schoolId: { userId: user.id, schoolId } },
                create: {
                    userId: user.id,
                    schoolId,
                    role: data.role,
                    status: UserStatus.PENDING,
                    workloadPercentage: data.workloadPercentage,
                },
                update: {
                    role: data.role,
                    status: UserStatus.PENDING,
                    workloadPercentage: data.workloadPercentage,
                },
            });

            // Create TeacherProfile if TEACHER
            if (data.role === 'TEACHER') {
                await tx.teacherProfile.upsert({
                    where: { userId: user.id },
                    create: { userId: user.id },
                    update: {},
                });
            }
            return user;
        });

        const fullToken = `${user.id}.${invitationToken}`;

        // Send invitation email
        this.mailService.sendInvitation(user.email, `${user.firstName} ${user.lastName}`, fullToken)
            .catch(e => console.error('Failed to send invitation email', e));

        await this.audit(actorId, 'CREATE_STAFF', 'User', user.id, {
            email: data.email,
            role: data.role,
            workloadPercentage: data.workloadPercentage,
        });

        return { token: fullToken, userId: user.id };
    }

    async resendInvitation(actorId: string, schoolId: string, userId: string) {
        // 1. Verify user exists and belongs to the school
        const membership = await this.prisma.schoolMembership.findUnique({
            where: { userId_schoolId: { userId, schoolId } },
            include: { user: true },
        });

        if (!membership) {
            throw new NotFoundException('User not found in this school');
        }

        if (membership.status !== UserStatus.PENDING) {
            throw new BadRequestException('User is already active or not pending');
        }

        const user = membership.user;

        // 2. Generate new token
        const invitationToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = await bcrypt.hash(invitationToken, 10);
        const invitationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                invitationToken: hashedToken,
                invitationExpires,
            },
        });

        // 3. Send email
        const fullToken = `${userId}.${invitationToken}`;
        // We'll use fire-and-forget for email sending if we want to be consistent,
        // but for a manual action like "resend", maybe it's better to await or at least handle error.
        this.mailService.sendInvitation(user.email, `${user.firstName} ${user.lastName}`, fullToken)
            .catch(e => console.error('Failed to resend invitation email', e));

        // 4. Audit
        await this.audit(actorId, 'RESEND_INVITATION', 'User', userId, { email: user.email });

        return { success: true };
    }

    // ─── REMOVE USER FROM SCHOOL ────────────────────────────────────

    async removeSchoolUser(actorId: string, schoolId: string, targetUserId: string) {
        const membership = await this.prisma.schoolMembership.findFirst({
            where: { userId: targetUserId, schoolId },
            include: { user: true },
        });
        if (!membership) throw new NotFoundException('User is not a member of this school.');

        // Cannot remove yourself
        if (actorId === targetUserId) {
            throw new BadRequestException('Cannot remove yourself from the school.');
        }

        // Cannot remove PRINCIPAL unless you are PRINCIPAL
        if (membership.role === 'PRINCIPAL') {
            throw new BadRequestException('Cannot remove the principal. Contact system admin.');
        }

        await this.prisma.schoolMembership.update({
            where: { id: membership.id },
            data: { status: 'ARCHIVED' },
        });

        await this.audit(actorId, 'REMOVE_SCHOOL_USER', 'SchoolMembership', membership.id, {
            userId: targetUserId,
            email: membership.user.email,
            role: membership.role,
            newStatus: 'ARCHIVED',
        });

        return { message: `User ${membership.user.email} has been removed from the school.` };
    }

    // ─── SET STUDENT AS ALUMNI ────────────────────────────────────────

    async setAlumniStatus(actorId: string, schoolId: string, targetUserId: string) {
        const membership = await this.prisma.schoolMembership.findFirst({
            where: { userId: targetUserId, schoolId },
            include: { user: true },
        });
        if (!membership) throw new NotFoundException('User is not a member of this school.');

        if (membership.role !== 'STUDENT') {
            throw new BadRequestException('Only students can be set as alumni.');
        }

        if (membership.status === 'ALUMNI') {
            throw new BadRequestException('User is already marked as alumni.');
        }

        const oldStatus = membership.status;
        await this.prisma.schoolMembership.update({
            where: { id: membership.id },
            data: { status: 'ALUMNI' },
        });

        await this.audit(actorId, 'SET_ALUMNI', 'SchoolMembership', membership.id, {
            userId: targetUserId,
            email: membership.user.email,
            newStatus: 'ALUMNI',
        }, {
            oldStatus,
        });

        return { message: `Student ${membership.user.firstName} ${membership.user.lastName} has been marked as alumni.` };
    }

    // ─── IMPERSONATE SCHOOL USER (read-only) ─────────────────────────

    async impersonateSchoolUser(
        actorId: string,
        schoolId: string,
        targetUserId: string,
        jwtService: any,
    ) {
        const membership = await this.prisma.schoolMembership.findFirst({
            where: { userId: targetUserId, schoolId },
            include: { user: true },
        });
        if (!membership) throw new NotFoundException('User is not a member of this school.');

        // Cannot impersonate PRINCIPAL or DEPUTY
        if (['PRINCIPAL', 'DEPUTY'].includes(membership.role)) {
            throw new BadRequestException('Cannot impersonate school management.');
        }

        // Audit
        await this.audit(actorId, 'IMPERSONATE_SCHOOL_USER', 'User', targetUserId, {
            email: membership.user.email,
            role: membership.role,
            schoolId,
            readOnly: true,
        });

        // Generate a read-only tenant token for the target user
        const payload = {
            sub: membership.user.id,
            email: membership.user.email,
            schoolId,
            role: membership.role,
            type: 'TENANT',
            isImpersonated: true,
            readOnly: true,
            actorId,
        };

        return {
            access_token: jwtService.sign(payload),
        };
    }

    // ─── AUDIT HELPER ────────────────────────────────────────────────

    private async audit(actorId: string, action: string, entity: string, entityId: string, newValues?: any, oldValues?: any) {
        await this.prisma.auditLog.create({
            data: {
                actorId,
                action,
                entity,
                entityId,
                newValues: newValues ?? undefined,
                oldValues: oldValues ?? undefined,
            },
        });
    }
}
