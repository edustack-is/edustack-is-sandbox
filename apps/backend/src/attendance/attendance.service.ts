import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  Attendance,
  StudentProfile,
  User,
  Classroom,
  AbsenceExcuse,
  ParentStudent,
} from '../database/types';
import * as crypto from 'crypto';

@Injectable()
export class AttendanceService {
  constructor(private readonly db: DatabaseService) {}

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
    const teacher = await this.db.queryOne(
      'SELECT id FROM "TeacherProfile" WHERE userId = ?',
      [userId],
    );
    if (!teacher) throw new NotFoundException('Teacher profile not found');

    const classroom = await this.db.queryOne(
      'SELECT id, schoolId FROM "Classroom" WHERE id = ?',
      [data.classroomId],
    );
    if (!classroom || (classroom as any).schoolId !== schoolId)
      throw new NotFoundException('Classroom not found');

    const results = [];
    for (const rec of data.records) {
      const existing = await this.db.queryOne(
        'SELECT id FROM "Attendance" WHERE studentId = ? AND date = ? AND lessonNumber = ? AND schoolId = ?',
        [
          rec.studentId,
          new Date(data.date).toISOString(),
          data.lessonNumber,
          schoolId,
        ],
      );

      let id: string;
      if (existing) {
        id = (existing as any).id;
        await this.db.execute(
          'UPDATE "Attendance" SET status = ?, note = ? WHERE id = ?',
          [rec.status, rec.note || null, id],
        );
      } else {
        id = crypto.randomUUID();
        await this.db.execute(
          'INSERT INTO "Attendance" (id, date, lessonNumber, status, note, studentId, teacherId, schoolId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            new Date(data.date).toISOString(),
            data.lessonNumber,
            rec.status,
            rec.note || null,
            rec.studentId,
            (teacher as any).id,
            schoolId,
            new Date().toISOString(),
          ],
        );
      }
      results.push(
        await this.db.queryOne('SELECT * FROM "Attendance" WHERE id = ?', [id]),
      );

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
    const classroom = await this.db.queryOne(
      'SELECT id, name, schoolId FROM "Classroom" WHERE id = ?',
      [classroomId],
    );
    if (!classroom || (classroom as any).schoolId !== schoolId)
      throw new NotFoundException('Classroom not found');

    const students = await this.db.query(
      `SELECT sp.*, u.firstName as uFN, u.lastName as uLN FROM "StudentProfile" sp 
       JOIN "User" u ON sp.userId = u.id WHERE sp.classroomId = ?`,
      [classroomId],
    );

    const records = await this.db.query(
      'SELECT * FROM "Attendance" WHERE schoolId = ? AND date = ? AND studentId IN (' +
        students.map(() => '?').join(',') +
        ') ORDER BY lessonNumber ASC',
      [
        schoolId,
        new Date(date).toISOString(),
        ...students.map((s) => (s as any).id),
      ],
    );

    return {
      classroom: { id: (classroom as any).id, name: (classroom as any).name },
      students: students.map((s: any) => ({
        ...s,
        user: { firstName: s.uFN, lastName: s.uLN },
      })),
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
    const student = await this.db.queryOne<StudentProfile>(
      'SELECT * FROM "StudentProfile" WHERE id = ?',
      [data.studentId],
    );
    if (!student) throw new NotFoundException('Student not found');

    const relation = await this.db.queryOne(
      'SELECT id FROM "ParentStudent" WHERE parentId = ? AND studentId = ?',
      [parentId, student.userId],
    );
    if (!relation)
      throw new BadRequestException('You are not a parent of this student');

    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "AbsenceExcuse" (id, reason, dateFrom, dateTo, status, parentId, studentId, schoolId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.reason,
        new Date(data.dateFrom).toISOString(),
        new Date(data.dateTo).toISOString(),
        'PENDING',
        parentId,
        data.studentId,
        schoolId,
        new Date().toISOString(),
      ],
    );

    return await this.db.queryOne(
      `SELECT ae.*, u.firstName as sFN, u.lastName as sLN, p.firstName as pFN, p.lastName as pLN 
       FROM "AbsenceExcuse" ae 
       JOIN "StudentProfile" sp ON ae.studentId = sp.id 
       JOIN "User" u ON sp.userId = u.id 
       JOIN "User" p ON ae.parentId = p.id 
       WHERE ae.id = ?`,
      [id],
    );
  }

  async getExcuses(
    schoolId: string,
    filters?: {
      classroomId?: string;
      status?: string;
      actor?: { userId: string; role: 'STUDENT' | 'PARENT' };
    },
  ) {
    let where = 'WHERE ae.schoolId = ?';
    const params: any[] = [schoolId];
    if (filters?.status) {
      where += ' AND ae.status = ?';
      params.push(filters.status);
    }
    if (filters?.classroomId) {
      where += ' AND sp.classroomId = ?';
      params.push(filters.classroomId);
    }
    // Scope to the caller's own data: STUDENT sees only their own
    // excuses; PARENT sees those filed for any of their children.
    if (filters?.actor?.role === 'STUDENT') {
      where +=
        ' AND ae.studentId = (SELECT id FROM "StudentProfile" WHERE userId = ?)';
      params.push(filters.actor.userId);
    } else if (filters?.actor?.role === 'PARENT') {
      where +=
        ' AND ae.studentId IN (SELECT studentId FROM "ParentStudent" WHERE parentId = ?)';
      params.push(filters.actor.userId);
    }

    const excuses = await this.db.query(
      `SELECT ae.*, u.firstName as sFN, u.lastName as sLN, p.firstName as pFN, p.lastName as pLN, r.firstName as rFN, r.lastName as rLN 
       FROM "AbsenceExcuse" ae 
       JOIN "StudentProfile" sp ON ae.studentId = sp.id 
       JOIN "User" u ON sp.userId = u.id 
       JOIN "User" p ON ae.parentId = p.id 
       LEFT JOIN "User" r ON ae.reviewedById = r.id 
       ${where} ORDER BY ae.createdAt DESC`,
      params,
    );

    return excuses.map((ae: any) => ({
      ...ae,
      student: { user: { firstName: ae.sFN, lastName: ae.sLN } },
      parent: { firstName: ae.pFN, lastName: ae.pLN },
      reviewedBy: ae.reviewedById
        ? { firstName: ae.rFN, lastName: ae.rLN }
        : null,
    }));
  }

  async reviewExcuse(
    userId: string,
    schoolId: string,
    excuseId: string,
    status: 'APPROVED' | 'REJECTED',
  ) {
    const excuse = await this.db.queryOne<AbsenceExcuse>(
      'SELECT * FROM "AbsenceExcuse" WHERE id = ? AND schoolId = ?',
      [excuseId, schoolId],
    );
    if (!excuse) throw new NotFoundException('Excuse not found');

    await this.db.execute(
      'UPDATE "AbsenceExcuse" SET status = ?, reviewedById = ? WHERE id = ?',
      [status, userId, excuseId],
    );

    if (status === 'APPROVED') {
      await this.db.execute(
        'UPDATE "Attendance" SET status = ? WHERE studentId = ? AND schoolId = ? AND status = ? AND date >= ? AND date <= ?',
        [
          'EXCUSED',
          excuse.studentId,
          schoolId,
          'ABSENT',
          excuse.dateFrom,
          excuse.dateTo,
        ],
      );
    }

    return await this.db.queryOne(
      'SELECT * FROM "AbsenceExcuse" WHERE id = ?',
      [excuseId],
    );
  }

  // ─── STATISTICS ─────────────────────────────────────────────

  async getClassStatistics(
    schoolId: string,
    classroomId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const classroom = await this.db.queryOne(
      'SELECT id, name FROM "Classroom" WHERE id = ? AND schoolId = ?',
      [classroomId, schoolId],
    );
    if (!classroom) throw new NotFoundException('Classroom not found');

    const students = await this.db.query(
      `SELECT sp.*, u.firstName, u.lastName FROM "StudentProfile" sp
       JOIN "User" u ON sp.userId = u.id WHERE sp.classroomId = ?`,
      [classroomId],
    );

    let where =
      'WHERE schoolId = ? AND studentId IN (' +
      students.map(() => '?').join(',') +
      ')';
    const params: any[] = [schoolId, ...students.map((s) => (s as any).id)];
    if (dateFrom) {
      where += ' AND date >= ?';
      params.push(new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      where += ' AND date <= ?';
      params.push(new Date(dateTo).toISOString());
    }

    const records = await this.db.query<Attendance>(
      `SELECT * FROM "Attendance" ${where}`,
      params,
    );

    const stats = students.map((student: any) => {
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

    return { classroom, stats, dateFrom, dateTo };
  }

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

  async getUnexcusedAlerts(schoolId: string, threshold = 5) {
    const now = new Date();
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();

    const absences = await this.db.query(
      `SELECT a.*, sp.firstName, sp.lastName, c.id as cId, c.name as cName 
       FROM "Attendance" a 
       JOIN "StudentProfile" sp ON a.studentId = sp.id 
       LEFT JOIN "Classroom" c ON sp.classroomId = c.id 
       WHERE a.schoolId = ? AND a.status = ? AND a.date >= ?`,
      [schoolId, 'ABSENT', monthStart],
    );

    const byStudent = new Map<string, any>();
    for (const a of absences as any[]) {
      const current = byStudent.get(a.studentId) || {
        student: {
          id: a.studentId,
          firstName: a.firstName,
          lastName: a.lastName,
          classroom: { id: a.cId, name: a.cName },
        },
        count: 0,
      };
      current.count++;
      byStudent.set(a.studentId, current);
    }

    return Array.from(byStudent.values())
      .filter((v) => v.count >= threshold)
      .sort((a, b) => b.count - a.count);
  }

  private async notifyParentsAboutAbsence(
    studentId: string,
    date: string,
    lessonNumber: number,
  ) {
    const student = await this.db.queryOne<
      StudentProfile & { firstName: string; lastName: string; userId: string }
    >('SELECT * FROM "StudentProfile" WHERE id = ?', [studentId]);
    if (!student) return;

    const parents = await this.db.query<ParentStudent>(
      'SELECT parentId FROM "ParentStudent" WHERE studentId = ?',
      [student.userId],
    );

    for (const p of parents) {
      await this.db.execute(
        'INSERT INTO "Notification" (id, userId, type, title, body, linkUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          p.parentId,
          'ATTENDANCE',
          `Absence: ${student.firstName} ${student.lastName}`,
          `Váš žák ${student.firstName} ${student.lastName} byl zaznamenán jako nepřítomný dne ${date}, ${lessonNumber}. hodina.`,
          '/attendance',
          new Date().toISOString(),
        ],
      );
    }
  }
}
