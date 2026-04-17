import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  // ─── RECORD ATTENDANCE (per lesson) ─────────────────────────

  async recordAttendance(
    userId: string,
    schoolId: string,
    data: {
      date: string;
      lessonNumber: number;
      classroomId: string;
      records: Array<{ studentId: string; status: string; note?: string }>;
    },
  ) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });
    if (!teacherProfile)
      throw new NotFoundException('Teacher profile not found');

    const classroom = await this.prisma.classroom.findUnique({
      where: { id: data.classroomId },
      include: { students: { select: { id: true } } },
    });
    if (!classroom || classroom.schoolId !== schoolId)
      throw new NotFoundException('Classroom not found');

    const results = [];
    for (const rec of data.records) {
      const result = await this.prisma.attendance.upsert({
        where: {
          studentId_date_lessonNumber_schoolId: {
            studentId: rec.studentId,
            date: new Date(data.date),
            lessonNumber: data.lessonNumber,
            schoolId,
          },
        },
        update: { status: rec.status as any, note: rec.note },
        create: {
          date: new Date(data.date),
          lessonNumber: data.lessonNumber,
          status: rec.status as any,
          note: rec.note,
          studentId: rec.studentId,
          teacherId: teacherProfile.id,
          schoolId,
        },
      });
      results.push(result);

      // Auto-notify parents on ABSENT
      if (rec.status === 'ABSENT') {
        await this.notifyParentsAboutAbsence(
          rec.studentId,
          data.date,
          data.lessonNumber,
        );
      }
    }
    return results;
  }

  // ─── GET ATTENDANCE FOR CLASSROOM ───────────────────────────

  async getClassroomAttendance(
    schoolId: string,
    classroomId: string,
    date: string,
  ) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        students: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    if (!classroom || classroom.schoolId !== schoolId)
      throw new NotFoundException('Classroom not found');

    const records = await this.prisma.attendance.findMany({
      where: {
        schoolId,
        studentId: { in: classroom.students.map((s) => s.id) },
        date: new Date(date),
      },
      orderBy: [{ lessonNumber: 'asc' }],
    });

    return {
      classroom: { id: classroom.id, name: classroom.name },
      students: classroom.students,
      records,
    };
  }

  // ─── ABSENCE EXCUSES ────────────────────────────────────────

  async createExcuse(
    parentId: string,
    schoolId: string,
    data: {
      studentId: string;
      reason: string;
      dateFrom: string;
      dateTo: string;
    },
  ) {
    // Verify parent-student relationship
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: data.studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const relation = await this.prisma.parentStudent.findFirst({
      where: { parentId, studentId: student.userId },
    });
    if (!relation)
      throw new BadRequestException('You are not a parent of this student');

    return this.prisma.absenceExcuse.create({
      data: {
        reason: data.reason,
        dateFrom: new Date(data.dateFrom),
        dateTo: new Date(data.dateTo),
        parentId,
        studentId: data.studentId,
        schoolId,
      },
      include: {
        student: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        parent: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async getExcuses(
    schoolId: string,
    filters?: { classroomId?: string; status?: string },
  ) {
    const where: any = { schoolId };
    if (filters?.status) where.status = filters.status;
    if (filters?.classroomId) {
      const classroom = await this.prisma.classroom.findUnique({
        where: { id: filters.classroomId },
        select: { students: { select: { id: true } } },
      });
      if (classroom)
        where.studentId = { in: classroom.students.map((s) => s.id) };
    }
    return this.prisma.absenceExcuse.findMany({
      where,
      include: {
        student: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        parent: { select: { firstName: true, lastName: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewExcuse(
    userId: string,
    schoolId: string,
    excuseId: string,
    status: 'APPROVED' | 'REJECTED',
  ) {
    const excuse = await this.prisma.absenceExcuse.findFirst({
      where: { id: excuseId, schoolId },
    });
    if (!excuse) throw new NotFoundException('Excuse not found');

    const updated = await this.prisma.absenceExcuse.update({
      where: { id: excuseId },
      data: { status, reviewedById: userId },
      include: {
        student: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // If approved, auto-update attendance records to EXCUSED
    if (status === 'APPROVED') {
      await this.prisma.attendance.updateMany({
        where: {
          studentId: excuse.studentId,
          schoolId,
          status: 'ABSENT',
          date: { gte: excuse.dateFrom, lte: excuse.dateTo },
        },
        data: { status: 'EXCUSED' },
      });
    }

    return updated;
  }

  // ─── STATISTICS ─────────────────────────────────────────────

  async getClassStatistics(
    schoolId: string,
    classroomId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        students: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    if (!classroom || classroom.schoolId !== schoolId)
      throw new NotFoundException('Classroom not found');

    const where: any = {
      schoolId,
      studentId: { in: classroom.students.map((s) => s.id) },
    };
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const records = await this.prisma.attendance.findMany({ where });

    // Aggregate per student
    const stats = classroom.students.map((student) => {
      const studentRecords = records.filter((r) => r.studentId === student.id);
      const total = studentRecords.length;
      const present = studentRecords.filter(
        (r) => r.status === 'PRESENT',
      ).length;
      const absent = studentRecords.filter((r) => r.status === 'ABSENT').length;
      const late = studentRecords.filter((r) => r.status === 'LATE').length;
      const excused = studentRecords.filter(
        (r) => r.status === 'EXCUSED',
      ).length;

      return {
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        total,
        present,
        absent,
        late,
        excused,
        presentPercent: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    });

    return {
      classroom: { id: classroom.id, name: classroom.name },
      stats,
      dateFrom,
      dateTo,
    };
  }

  // ─── EXPORT CSV ─────────────────────────────────────────────

  async exportAttendanceCsv(
    schoolId: string,
    classroomId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const data = await this.getClassStatistics(
      schoolId,
      classroomId,
      dateFrom,
      dateTo,
    );
    const BOM = '\uFEFF';
    let csv =
      BOM + 'Student;Celkem;Přítomen;Nepřítomen;Pozdě;Omluven;% přítomnost\n';
    for (const s of data.stats) {
      csv += `${s.lastName} ${s.firstName};${s.total};${s.present};${s.absent};${s.late};${s.excused};${s.presentPercent}%\n`;
    }
    return csv;
  }

  // ─── UNEXCUSED ALERTS ───────────────────────────────────────

  async getUnexcusedAlerts(schoolId: string, threshold = 5) {
    // Get all unexcused absences in the current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const absences = await this.prisma.attendance.findMany({
      where: {
        schoolId,
        status: 'ABSENT',
        date: { gte: monthStart },
      },
      include: {
        studentProfile: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            classroom: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Group by student
    const byStudent = new Map<string, { student: any; count: number }>();
    for (const a of absences) {
      const key = a.studentId;
      if (!byStudent.has(key)) {
        byStudent.set(key, {
          student: {
            id: a.studentProfile.id,
            firstName: a.studentProfile.firstName,
            lastName: a.studentProfile.lastName,
            classroom: a.studentProfile.classroom,
          },
          count: 0,
        });
      }
      byStudent.get(key)!.count++;
    }

    // Filter above threshold
    return Array.from(byStudent.values())
      .filter((v) => v.count >= threshold)
      .sort((a, b) => b.count - a.count);
  }

  // ─── NOTIFY PARENTS ─────────────────────────────────────────

  private async notifyParentsAboutAbsence(
    studentId: string,
    date: string,
    lessonNumber: number,
  ) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: { user: true },
    });
    if (!student) return;

    const parentRelations = await this.prisma.parentStudent.findMany({
      where: { studentId: student.userId },
    });

    for (const rel of parentRelations) {
      await this.prisma.notification.create({
        data: {
          userId: rel.parentId,
          type: 'ATTENDANCE',
          title: `Absence: ${student.firstName} ${student.lastName}`,
          body: `Váš žák ${student.firstName} ${student.lastName} byl zaznamenán jako nepřítomný dne ${date}, ${lessonNumber}. hodina.`,
          linkUrl: '/attendance',
        },
      });
    }
  }
}
