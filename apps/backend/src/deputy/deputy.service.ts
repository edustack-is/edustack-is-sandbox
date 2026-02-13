import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DeputyService {
    constructor(private readonly prisma: PrismaService) { }

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
        return this.prisma.subject.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' },
        });
    }

    async createSubject(actorId: string, schoolId: string, data: { name: string }) {
        const subject = await this.prisma.subject.create({
            data: { name: data.name, schoolId },
        });

        await this.audit(actorId, 'CREATE_SUBJECT', 'Subject', subject.id, data);
        return subject;
    }

    async updateSubject(actorId: string, schoolId: string, id: string, data: { name?: string }) {
        const existing = await this.prisma.subject.findFirst({ where: { id, schoolId } });
        if (!existing) throw new NotFoundException('Subject not found');

        const updated = await this.prisma.subject.update({ where: { id }, data });
        await this.audit(actorId, 'UPDATE_SUBJECT', 'Subject', id, data, existing);
        return updated;
    }

    async deleteSubject(actorId: string, schoolId: string, id: string) {
        const existing = await this.prisma.subject.findFirst({ where: { id, schoolId } });
        if (!existing) throw new NotFoundException('Subject not found');

        await this.prisma.subject.delete({ where: { id } });
        await this.audit(actorId, 'DELETE_SUBJECT', 'Subject', id, null, existing);
        return { deleted: true };
    }

    // ─── ROOM CRUD ───────────────────────────────────────────────────

    async getRooms(schoolId: string) {
        return this.prisma.room.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' },
        });
    }

    async createRoom(actorId: string, schoolId: string, data: { name: string; capacity?: number; equipment?: string[] }) {
        const room = await this.prisma.room.create({
            data: {
                name: data.name,
                capacity: data.capacity ?? 30,
                equipment: data.equipment ?? [],
                schoolId,
            },
        });

        await this.audit(actorId, 'CREATE_ROOM', 'Room', room.id, data);
        return room;
    }

    async updateRoom(actorId: string, schoolId: string, id: string, data: { name?: string; capacity?: number; equipment?: string[] }) {
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

        await this.audit(actorId, 'INVITE_USER', 'User', user.id, {
            email: data.email,
            role: data.role,
            workloadPercentage: data.workloadPercentage,
        });

        return { token: fullToken, userId: user.id };
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
