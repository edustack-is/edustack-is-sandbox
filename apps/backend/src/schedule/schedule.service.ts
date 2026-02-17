import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubstitutionType } from '@prisma/client';

@Injectable()
export class ScheduleService {
    constructor(private prisma: PrismaService) { }

    // ─── LESSON TIME SLOTS ──────────────────────────────────────

    async getTimeSlots(schoolId: string) {
        return this.prisma.lessonTimeSlot.findMany({
            where: { schoolId },
            orderBy: { lessonNumber: 'asc' },
        });
    }

    async upsertTimeSlots(schoolId: string, slots: { lessonNumber: number; startTime: string; endTime: string }[]) {
        const results = [];
        for (const slot of slots) {
            const result = await this.prisma.lessonTimeSlot.upsert({
                where: {
                    schoolId_lessonNumber: {
                        schoolId,
                        lessonNumber: slot.lessonNumber,
                    },
                },
                create: {
                    schoolId,
                    lessonNumber: slot.lessonNumber,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                },
                update: {
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                },
            });
            results.push(result);
        }
        return results;
    }

    // ─── SCHEDULE EVENTS ────────────────────────────────────────

    async getEvents(schoolId: string, filters?: {
        academicYearId?: string;
        classroomId?: string;
        teacherId?: string;
    }) {
        const where: any = { schoolId };
        if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
        if (filters?.classroomId) where.classroomId = filters.classroomId;
        if (filters?.teacherId) where.teacherId = filters.teacherId;

        return this.prisma.scheduleEvent.findMany({
            where,
            include: {
                subject: {
                    include: { template: true },
                },
                classroom: true,
                teacherProfile: {
                    include: { user: { select: { firstName: true, lastName: true } } },
                },
                room: true,
            },
            orderBy: [
                { dayOfWeek: 'asc' },
                { lessonNumber: 'asc' },
            ],
        });
    }

    async createEvent(schoolId: string, data: {
        dayOfWeek: number;
        lessonNumber: number;
        subjectInstanceId: string;
        classroomId: string;
        teacherId: string;
        roomId?: string;
        academicYearId: string;
    }) {
        // Resolve time from lesson time slots
        const timeSlot = await this.prisma.lessonTimeSlot.findUnique({
            where: {
                schoolId_lessonNumber: {
                    schoolId,
                    lessonNumber: data.lessonNumber,
                },
            },
        });

        const startTime = timeSlot?.startTime || `${String(7 + data.lessonNumber).padStart(2, '0')}:00`;
        const endTime = timeSlot?.endTime || `${String(7 + data.lessonNumber).padStart(2, '0')}:45`;

        // Validate collisions
        const collision = await this.validateCollision(
            data.dayOfWeek,
            data.lessonNumber,
            data.teacherId,
            data.classroomId,
            data.roomId,
            data.academicYearId,
            schoolId,
        );

        if (!collision.valid) {
            throw new BadRequestException(collision.message);
        }

        return this.prisma.scheduleEvent.create({
            data: {
                dayOfWeek: data.dayOfWeek,
                lessonNumber: data.lessonNumber,
                startTime,
                endTime,
                schoolId,
                subjectInstanceId: data.subjectInstanceId,
                classroomId: data.classroomId,
                teacherId: data.teacherId,
                roomId: data.roomId || null,
                academicYearId: data.academicYearId,
            },
            include: {
                subject: { include: { template: true } },
                classroom: true,
                teacherProfile: {
                    include: { user: { select: { firstName: true, lastName: true } } },
                },
                room: true,
            },
        });
    }

    async updateEvent(schoolId: string, eventId: string, data: {
        dayOfWeek?: number;
        lessonNumber?: number;
        subjectInstanceId?: string;
        classroomId?: string;
        teacherId?: string;
        roomId?: string;
    }) {
        const existing = await this.prisma.scheduleEvent.findFirst({
            where: { id: eventId, schoolId },
        });
        if (!existing) throw new NotFoundException('Schedule event not found');

        const dayOfWeek = data.dayOfWeek ?? existing.dayOfWeek;
        const lessonNumber = data.lessonNumber ?? existing.lessonNumber;
        const teacherId = data.teacherId ?? existing.teacherId;
        const classroomId = data.classroomId ?? existing.classroomId;
        const roomId = data.roomId ?? existing.roomId;

        // Resolve time if lessonNumber changed
        let startTime = existing.startTime;
        let endTime = existing.endTime;
        if (data.lessonNumber && data.lessonNumber !== existing.lessonNumber) {
            const timeSlot = await this.prisma.lessonTimeSlot.findUnique({
                where: {
                    schoolId_lessonNumber: { schoolId, lessonNumber },
                },
            });
            startTime = timeSlot?.startTime || `${String(7 + lessonNumber).padStart(2, '0')}:00`;
            endTime = timeSlot?.endTime || `${String(7 + lessonNumber).padStart(2, '0')}:45`;
        }

        // Validate collisions (excluding self)
        const collision = await this.validateCollision(
            dayOfWeek, lessonNumber, teacherId, classroomId, roomId,
            existing.academicYearId, schoolId, eventId,
        );
        if (!collision.valid) {
            throw new BadRequestException(collision.message);
        }

        return this.prisma.scheduleEvent.update({
            where: { id: eventId },
            data: {
                dayOfWeek,
                lessonNumber,
                startTime,
                endTime,
                subjectInstanceId: data.subjectInstanceId,
                classroomId,
                teacherId,
                roomId,
            },
            include: {
                subject: { include: { template: true } },
                classroom: true,
                teacherProfile: {
                    include: { user: { select: { firstName: true, lastName: true } } },
                },
                room: true,
            },
        });
    }

    async deleteEvent(schoolId: string, eventId: string) {
        const existing = await this.prisma.scheduleEvent.findFirst({
            where: { id: eventId, schoolId },
        });
        if (!existing) throw new NotFoundException('Schedule event not found');

        // Also delete related substitutions
        await this.prisma.scheduleSubstitution.deleteMany({
            where: { originalEventId: eventId },
        });

        return this.prisma.scheduleEvent.delete({
            where: { id: eventId },
        });
    }

    async bulkCreateEvents(schoolId: string, events: {
        dayOfWeek: number;
        lessonNumber: number;
        subjectInstanceId: string;
        classroomId: string;
        teacherId: string;
        roomId?: string;
        academicYearId: string;
    }[]) {
        // Get all time slots
        const timeSlots = await this.prisma.lessonTimeSlot.findMany({
            where: { schoolId },
        });
        const slotMap = new Map(timeSlots.map(s => [s.lessonNumber, s]));

        const results = [];
        const errors = [];

        for (const event of events) {
            try {
                const slot = slotMap.get(event.lessonNumber);
                const startTime = slot?.startTime || `${String(7 + event.lessonNumber).padStart(2, '0')}:00`;
                const endTime = slot?.endTime || `${String(7 + event.lessonNumber).padStart(2, '0')}:45`;

                const result = await this.prisma.scheduleEvent.upsert({
                    where: {
                        schoolId_dayOfWeek_lessonNumber_classroomId_academicYearId: {
                            schoolId,
                            dayOfWeek: event.dayOfWeek,
                            lessonNumber: event.lessonNumber,
                            classroomId: event.classroomId,
                            academicYearId: event.academicYearId,
                        },
                    },
                    create: {
                        dayOfWeek: event.dayOfWeek,
                        lessonNumber: event.lessonNumber,
                        startTime,
                        endTime,
                        schoolId,
                        subjectInstanceId: event.subjectInstanceId,
                        classroomId: event.classroomId,
                        teacherId: event.teacherId,
                        roomId: event.roomId || null,
                        academicYearId: event.academicYearId,
                    },
                    update: {
                        subjectInstanceId: event.subjectInstanceId,
                        teacherId: event.teacherId,
                        roomId: event.roomId || null,
                        startTime,
                        endTime,
                    },
                });
                results.push(result);
            } catch (e) {
                errors.push({ event, error: e.message });
            }
        }

        return { created: results.length, errors };
    }

    // ─── VIEW ENDPOINTS ─────────────────────────────────────────

    async getClassroomSchedule(schoolId: string, classroomId: string, academicYearId?: string) {
        const where: any = { schoolId, classroomId };
        if (academicYearId) where.academicYearId = academicYearId;
        else {
            const currentYear = await this.prisma.academicYear.findFirst({
                where: { schoolId, isCurrent: true },
            });
            if (currentYear) where.academicYearId = currentYear.id;
        }

        return this.prisma.scheduleEvent.findMany({
            where,
            include: {
                subject: { include: { template: true } },
                teacherProfile: {
                    include: { user: { select: { firstName: true, lastName: true } } },
                },
                room: true,
                classroom: true,
                substitutions: {
                    where: {
                        date: { gte: new Date() },
                    },
                },
            },
            orderBy: [
                { dayOfWeek: 'asc' },
                { lessonNumber: 'asc' },
            ],
        });
    }

    async getTeacherSchedule(schoolId: string, teacherId: string, academicYearId?: string) {
        const where: any = { schoolId, teacherId };
        if (academicYearId) where.academicYearId = academicYearId;
        else {
            const currentYear = await this.prisma.academicYear.findFirst({
                where: { schoolId, isCurrent: true },
            });
            if (currentYear) where.academicYearId = currentYear.id;
        }

        return this.prisma.scheduleEvent.findMany({
            where,
            include: {
                subject: { include: { template: true } },
                classroom: true,
                room: true,
                substitutions: {
                    where: {
                        date: { gte: new Date() },
                    },
                },
            },
            orderBy: [
                { dayOfWeek: 'asc' },
                { lessonNumber: 'asc' },
            ],
        });
    }

    async getStudentSchedule(schoolId: string, studentUserId: string, academicYearId?: string) {
        // Find student's classroom via enrollment
        const enrollmentWhere: any = { studentId: studentUserId };
        if (academicYearId) {
            enrollmentWhere.academicYearId = academicYearId;
        } else {
            const currentYear = await this.prisma.academicYear.findFirst({
                where: { schoolId, isCurrent: true },
            });
            if (currentYear) enrollmentWhere.academicYearId = currentYear.id;
        }

        const enrollment = await this.prisma.studentEnrollment.findFirst({
            where: enrollmentWhere,
        });

        if (!enrollment?.classroomId) {
            return [];
        }

        return this.getClassroomSchedule(schoolId, enrollment.classroomId, academicYearId);
    }

    // ─── SUBSTITUTIONS ──────────────────────────────────────────

    async getSubstitutions(schoolId: string, filters?: {
        date?: string;
        weekStart?: string;
        weekEnd?: string;
    }) {
        const where: any = { schoolId };

        if (filters?.date) {
            const d = new Date(filters.date);
            where.date = {
                gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
                lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
            };
        } else if (filters?.weekStart && filters?.weekEnd) {
            where.date = {
                gte: new Date(filters.weekStart),
                lte: new Date(filters.weekEnd),
            };
        }

        return this.prisma.scheduleSubstitution.findMany({
            where,
            include: {
                originalEvent: {
                    include: {
                        subject: { include: { template: true } },
                        classroom: true,
                        teacherProfile: {
                            include: { user: { select: { firstName: true, lastName: true } } },
                        },
                    },
                },
                substituteTeacher: {
                    include: { user: { select: { firstName: true, lastName: true } } },
                },
                substituteRoom: true,
                substituteSubject: { include: { template: true } },
                createdBy: { select: { firstName: true, lastName: true } },
            },
            orderBy: [
                { date: 'asc' },
                { originalEvent: { lessonNumber: 'asc' } },
            ],
        });
    }

    async createSubstitution(schoolId: string, userId: string, data: {
        date: string;
        originalEventId: string;
        type: SubstitutionType;
        note?: string;
        substituteTeacherId?: string;
        substituteRoomId?: string;
        substituteSubjectId?: string;
    }) {
        // Verify event belongs to school
        const event = await this.prisma.scheduleEvent.findFirst({
            where: { id: data.originalEventId, schoolId },
        });
        if (!event) throw new NotFoundException('Schedule event not found');

        return this.prisma.scheduleSubstitution.create({
            data: {
                date: new Date(data.date),
                type: data.type,
                note: data.note,
                originalEventId: data.originalEventId,
                substituteTeacherId: data.substituteTeacherId,
                substituteRoomId: data.substituteRoomId,
                substituteSubjectId: data.substituteSubjectId,
                createdById: userId,
                schoolId,
            },
            include: {
                originalEvent: {
                    include: {
                        subject: { include: { template: true } },
                        classroom: true,
                        teacherProfile: {
                            include: { user: { select: { firstName: true, lastName: true } } },
                        },
                    },
                },
                substituteTeacher: {
                    include: { user: { select: { firstName: true, lastName: true } } },
                },
                substituteRoom: true,
            },
        });
    }

    async updateSubstitution(schoolId: string, substitutionId: string, data: {
        type?: SubstitutionType;
        note?: string;
        substituteTeacherId?: string;
        substituteRoomId?: string;
        substituteSubjectId?: string;
    }) {
        const existing = await this.prisma.scheduleSubstitution.findFirst({
            where: { id: substitutionId, schoolId },
        });
        if (!existing) throw new NotFoundException('Substitution not found');

        return this.prisma.scheduleSubstitution.update({
            where: { id: substitutionId },
            data,
        });
    }

    async deleteSubstitution(schoolId: string, substitutionId: string) {
        const existing = await this.prisma.scheduleSubstitution.findFirst({
            where: { id: substitutionId, schoolId },
        });
        if (!existing) throw new NotFoundException('Substitution not found');

        return this.prisma.scheduleSubstitution.delete({
            where: { id: substitutionId },
        });
    }

    // ─── COLLISION VALIDATION ───────────────────────────────────

    async validateCollision(
        dayOfWeek: number,
        lessonNumber: number,
        teacherId: string,
        classroomId: string,
        roomId: string | null | undefined,
        academicYearId: string,
        schoolId: string,
        excludeEventId?: string,
    ): Promise<{ valid: boolean; message?: string }> {
        const excludeCondition = excludeEventId ? { id: { not: excludeEventId } } : {};

        // Check teacher collision
        const teacherCollision = await this.prisma.scheduleEvent.findFirst({
            where: {
                schoolId,
                teacherId,
                dayOfWeek,
                lessonNumber,
                academicYearId,
                ...excludeCondition,
            },
            include: { classroom: true },
        });

        if (teacherCollision) {
            return {
                valid: false,
                message: `Teacher already has a lesson in class ${teacherCollision.classroom.name} at this time.`,
            };
        }

        // Check room collision (if room is specified)
        if (roomId) {
            const roomCollision = await this.prisma.scheduleEvent.findFirst({
                where: {
                    schoolId,
                    roomId,
                    dayOfWeek,
                    lessonNumber,
                    academicYearId,
                    ...excludeCondition,
                },
                include: { classroom: true },
            });

            if (roomCollision) {
                return {
                    valid: false,
                    message: `Room is already used by class ${roomCollision.classroom.name} at this time.`,
                };
            }
        }

        return { valid: true };
    }
}
