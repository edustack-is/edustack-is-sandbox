import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class TeacherService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns a unified schedule across ALL schools where this teacher teaches.
   * Ignores current school context — uses global identity.
   */
  async getMySchedule(userId: string) {
    // Find teacher profile
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!teacherProfile) {
      throw new NotFoundException('Teacher profile not found');
    }

    // Get all schedule events for this teacher across all schools
    const events = await this.prisma.scheduleEvent.findMany({
      where: { teacherId: teacherProfile.id },
      include: {
        subject: { include: { template: true } },
        classroom: true,
        school: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return events;
  }

  /**
   * Returns a list of classes and their students that this teacher teaches
   * within the current school context.
   */
  async getClasses(userId: string, schoolId: string) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!teacherProfile) {
      throw new NotFoundException('Teacher profile not found');
    }

    // Get distinct classrooms from schedule events in this school
    const events = await this.prisma.scheduleEvent.findMany({
      where: {
        teacherId: teacherProfile.id,
        schoolId,
      },
      select: { classroomId: true, subjectInstanceId: true },
      distinct: ['classroomId'],
    });

    const classroomIds = events.map((e) => e.classroomId);

    const classrooms = await this.prisma.classroom.findMany({
      where: { id: { in: classroomIds } },
      include: {
        students: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        scheduleEvents: {
          where: { teacherId: teacherProfile.id },
          include: { subject: { include: { template: true } } },
        },
      },
    });

    return classrooms;
  }

  /**
   * Creates a grade for a student. Validates that the teacher teaches this student
   * via schedule events (teacher teaches in the student's classroom for the given subject).
   */
  async createGrade(
    userId: string,
    schoolId: string,
    data: {
      studentId: string;
      subjectInstanceId: string;
      value: string;
      weight: number;
      description?: string;
    },
  ) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });
    if (!teacherProfile)
      throw new NotFoundException('Teacher profile not found');

    // Validate student exists
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: data.studentId },
      select: { id: true, classroomId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    // Validate teacher teaches this student's classroom for the given subject
    const hasAuthority = await this.prisma.scheduleEvent.findFirst({
      where: {
        teacherId: teacherProfile.id,
        schoolId,
        classroomId: student.classroomId ?? undefined,
        subjectInstanceId: data.subjectInstanceId,
      },
    });

    if (!hasAuthority) {
      throw new ForbiddenException(
        'You are not authorized to grade this student for this subject.',
      );
    }

    // Create the grade
    const grade = await this.prisma.grade.create({
      data: {
        value: data.value,
        weight: data.weight,
        description: data.description,
        schoolId,
        studentId: data.studentId,
        subjectInstanceId: data.subjectInstanceId,
        teacherId: teacherProfile.id,
      },
      include: {
        subjectInstance: { include: { template: true } },
        studentProfile: true,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'CREATE_GRADE',
        entity: 'Grade',
        entityId: grade.id,
        newValues: {
          value: data.value,
          weight: data.weight,
          studentId: data.studentId,
          subjectInstanceId: data.subjectInstanceId,
          description: data.description,
        },
      },
    });

    return grade;
  }

  /**
   * Records attendance for a student. Validates teacher authority via schedule events.
   */
  async createAttendance(
    userId: string,
    schoolId: string,
    data: {
      studentId: string;
      status: AttendanceStatus;
      date?: string;
      note?: string;
    },
  ) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });
    if (!teacherProfile)
      throw new NotFoundException('Teacher profile not found');

    // Validate student exists
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: data.studentId },
      select: { id: true, classroomId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    // Validate teacher teaches this student's classroom
    const hasAuthority = await this.prisma.scheduleEvent.findFirst({
      where: {
        teacherId: teacherProfile.id,
        schoolId,
        classroomId: student.classroomId ?? undefined,
      },
    });

    if (!hasAuthority) {
      throw new ForbiddenException(
        'You are not authorized to record attendance for this student.',
      );
    }

    const attendanceDate = data.date ? new Date(data.date) : new Date();

    // Create or update attendance (upsert by student+date+school)
    const attendance = await this.prisma.attendance.create({
      data: {
        date: attendanceDate,
        status: data.status,
        note: data.note,
        schoolId,
        studentId: data.studentId,
        teacherId: teacherProfile.id,
      },
      include: { studentProfile: true },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'CREATE_ATTENDANCE',
        entity: 'Attendance',
        entityId: attendance.id,
        newValues: {
          studentId: data.studentId,
          status: data.status,
          date: attendanceDate.toISOString(),
          note: data.note,
        },
      },
    });

    return attendance;
  }
}
