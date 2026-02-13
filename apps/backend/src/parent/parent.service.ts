import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParentService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Returns all children linked to this parent, across all schools.
     */
    async getChildren(parentUserId: string) {
        const links = await this.prisma.parentStudent.findMany({
            where: { parentId: parentUserId },
            include: {
                student: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        studentProfile: {
                            include: {
                                classroom: true,
                            },
                        },
                        schoolMemberships: {
                            where: { status: 'ACTIVE' },
                            include: {
                                school: { select: { id: true, name: true } },
                            },
                        },
                    },
                },
            },
        });

        return links.map((link) => ({
            linkId: link.id,
            studentId: link.studentId,
            student: link.student,
        }));
    }

    /**
     * Returns a child's dashboard data (grades, schedule, profile).
     * Verifies the parent owns this child via ParentStudent.
     */
    async getChildDashboard(parentUserId: string, studentUserId: string) {
        // Security: verify parent-student relationship
        const link = await this.prisma.parentStudent.findFirst({
            where: {
                parentId: parentUserId,
                studentId: studentUserId,
            },
        });

        if (!link) {
            throw new ForbiddenException('You do not have access to this student.');
        }

        // Get student profile with classroom, grades, and schedule
        const studentProfile = await this.prisma.studentProfile.findUnique({
            where: { userId: studentUserId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                classroom: true,
                grades: {
                    include: {
                        subject: true,
                        teacherProfile: {
                            include: {
                                user: { select: { firstName: true, lastName: true } },
                            },
                        },
                    },
                    orderBy: { date: 'desc' },
                    take: 30,
                },
            },
        });

        if (!studentProfile) {
            throw new NotFoundException('Student profile not found');
        }

        // Get schedule if student has a classroom
        const schedule = studentProfile.classroomId
            ? await this.prisma.scheduleEvent.findMany({
                where: { classroomId: studentProfile.classroomId },
                include: {
                    subject: true,
                    teacherProfile: {
                        include: {
                            user: { select: { firstName: true, lastName: true } },
                        },
                    },
                    classroom: true,
                },
                orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
            })
            : [];

        // Get subjects
        const subjects = studentProfile.classroomId
            ? await this.prisma.subject.findMany({
                where: {
                    scheduleEvents: {
                        some: { classroomId: studentProfile.classroomId },
                    },
                },
            })
            : [];

        return {
            profile: studentProfile,
            schedule,
            subjects,
        };
    }
}
