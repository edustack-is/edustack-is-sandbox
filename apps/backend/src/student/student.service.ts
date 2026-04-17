import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the student's profile including their classroom and subjects.
   * Strictly uses userId from JWT — never trusts ID from URL.
   */
  async getMyData(userId: string, schoolId: string) {
    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: { userId },
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
          include: { subjectInstance: { include: { template: true } } },
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    });

    if (!studentProfile) {
      throw new NotFoundException('Student profile not found');
    }

    // Get subjects the student has via their classroom schedule
    const subjects = studentProfile.classroomId
      ? await this.prisma.subjectInstance.findMany({
          where: {
            schoolId,
            scheduleEvents: {
              some: { classroomId: studentProfile.classroomId },
            },
          },
          include: { template: true },
        })
      : [];

    return {
      profile: studentProfile,
      subjects,
    };
  }

  /**
   * Returns schedule events for the student's classroom.
   */
  async getSchedule(userId: string, schoolId: string) {
    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { classroomId: true },
    });

    if (!studentProfile) {
      throw new NotFoundException('Student profile not found');
    }

    if (!studentProfile.classroomId) {
      return []; // Student not assigned to a classroom yet
    }

    return this.prisma.scheduleEvent.findMany({
      where: {
        schoolId,
        classroomId: studentProfile.classroomId,
      },
      include: {
        subject: { include: { template: true } },
        teacherProfile: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        classroom: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }
}
