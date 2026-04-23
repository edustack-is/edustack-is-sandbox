import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  TeacherProfile,
  StudentProfile,
  ScheduleEvent,
  User,
} from '../database/types';
import { randomUUID } from 'crypto';

@Injectable()
export class TeacherService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Returns a unified schedule across ALL schools where this teacher teaches.
   */
  async getMySchedule(userId: string) {
    const teacherProfile = await this.db.queryOne<TeacherProfile>(
      'SELECT * FROM "TeacherProfile" WHERE userId = ?',
      [userId],
    );

    if (!teacherProfile)
      throw new NotFoundException('Teacher profile not found');

    const events = await this.db.query(
      `SELECT se.*, si.id as si_id, st.name as st_name, c.name as c_name, s.id as s_id, s.name as s_name 
       FROM "ScheduleEvent" se 
       JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id 
       JOIN "SubjectTemplate" st ON si.templateId = st.id 
       JOIN "Classroom" c ON se.classroomId = c.id 
       JOIN "School" s ON se.schoolId = s.id 
       WHERE se.teacherId = ? 
       ORDER BY se.dayOfWeek ASC, se.startTime ASC`,
      [teacherProfile.id],
    );

    return events.map((e: any) => ({
      ...e,
      subject: { id: e.si_id, template: { name: e.st_name } },
      classroom: { id: e.classroomId, name: e.c_name },
      school: { id: e.s_id, name: e.s_name },
    }));
  }

  /**
   * Returns a list of classes and their students that this teacher teaches within current school.
   */
  async getClasses(userId: string, schoolId: string) {
    const teacherProfile = await this.db.queryOne<TeacherProfile>(
      'SELECT id FROM "TeacherProfile" WHERE userId = ?',
      [userId],
    );
    if (!teacherProfile)
      throw new NotFoundException('Teacher profile not found');

    const classroomIds = (
      await this.db.query<{ classroomId: string }>(
        'SELECT DISTINCT classroomId FROM "ScheduleEvent" WHERE teacherId = ? AND schoolId = ?',
        [teacherProfile.id, schoolId],
      )
    ).map((e) => e.classroomId);

    if (classroomIds.length === 0) return [];

    const result = [];
    for (const cid of classroomIds) {
      const classroom = await this.db.queryOne(
        'SELECT * FROM "Classroom" WHERE id = ?',
        [cid],
      );
      if (!classroom) continue;

      const students = await this.db.query(
        'SELECT sp.*, u.firstName, u.lastName, u.email FROM "StudentProfile" sp JOIN "User" u ON sp.userId = u.id WHERE sp.classroomId = ?',
        [cid],
      );

      const events = await this.db.query(
        'SELECT se.*, st.name as st_name FROM "ScheduleEvent" se JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id JOIN "SubjectTemplate" st ON si.templateId = st.id WHERE se.classroomId = ? AND se.teacherId = ?',
        [cid, teacherProfile.id],
      );

      result.push({
        ...classroom,
        students: students.map((s: any) => ({
          ...s,
          user: {
            id: s.userId,
            firstName: s.firstName,
            lastName: s.lastName,
            email: s.email,
          },
        })),
        scheduleEvents: events.map((e: any) => ({
          ...e,
          subject: { template: { name: e.st_name } },
        })),
      });
    }
    return result;
  }

  /**
   * Creates a grade for a student.
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
    const teacher = await this.db.queryOne<TeacherProfile>(
      'SELECT id FROM "TeacherProfile" WHERE userId = ?',
      [userId],
    );
    if (!teacher) throw new NotFoundException('Teacher profile not found');

    const student = await this.db.queryOne<StudentProfile>(
      'SELECT id, classroomId FROM "StudentProfile" WHERE id = ?',
      [data.studentId],
    );
    if (!student) throw new NotFoundException('Student not found');

    const hasAuthority = await this.db.queryOne(
      'SELECT id FROM "ScheduleEvent" WHERE teacherId = ? AND schoolId = ? AND classroomId = ? AND subjectInstanceId = ? LIMIT 1',
      [teacher.id, schoolId, student.classroomId || '', data.subjectInstanceId],
    );
    if (!hasAuthority) throw new ForbiddenException('Not authorized.');

    const gradeId = randomUUID();
    await this.db.execute(
      'INSERT INTO "Grade" (id, value, weight, description, date, type, schoolId, studentId, subjectInstanceId, teacherId, createdAt) VALUES (?, ?, ?, ?, ?, "NUMERIC", ?, ?, ?, ?, ?)',
      [
        gradeId,
        data.value,
        data.weight,
        data.description || null,
        new Date().toISOString(),
        schoolId,
        data.studentId,
        data.subjectInstanceId,
        teacher.id,
        new Date().toISOString(),
      ],
    );

    await this.db.execute(
      'INSERT INTO "AuditLog" (id, actorId, action, entity, entityId, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        randomUUID(),
        userId,
        'CREATE_GRADE',
        'Grade',
        gradeId,
        JSON.stringify(data),
        new Date().toISOString(),
      ],
    );

    return await this.db.queryOne('SELECT * FROM "Grade" WHERE id = ?', [
      gradeId,
    ]);
  }

  /**
   * Records attendance for a student.
   */
  async createAttendance(
    userId: string,
    schoolId: string,
    data: { studentId: string; status: string; date?: string; note?: string },
  ) {
    const teacher = await this.db.queryOne<TeacherProfile>(
      'SELECT id FROM "TeacherProfile" WHERE userId = ?',
      [userId],
    );
    if (!teacher) throw new NotFoundException('Teacher profile not found');

    const student = await this.db.queryOne<StudentProfile>(
      'SELECT id, classroomId FROM "StudentProfile" WHERE id = ?',
      [data.studentId],
    );
    if (!student) throw new NotFoundException('Student not found');

    const hasAuthority = await this.db.queryOne(
      'SELECT id FROM "ScheduleEvent" WHERE teacherId = ? AND schoolId = ? AND classroomId = ? LIMIT 1',
      [teacher.id, schoolId, student.classroomId || ''],
    );
    if (!hasAuthority) throw new ForbiddenException('Not authorized.');

    const date = data.date
      ? new Date(data.date).toISOString()
      : new Date().toISOString();
    const id = randomUUID();
    await this.db.execute(
      'INSERT INTO "Attendance" (id, date, status, note, schoolId, studentId, teacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        date,
        data.status,
        data.note || null,
        schoolId,
        data.studentId,
        teacher.id,
        new Date().toISOString(),
      ],
    );

    await this.db.execute(
      'INSERT INTO "AuditLog" (id, actorId, action, entity, entityId, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        randomUUID(),
        userId,
        'CREATE_ATTENDANCE',
        'Attendance',
        id,
        JSON.stringify(data),
        new Date().toISOString(),
      ],
    );

    return await this.db.queryOne('SELECT * FROM "Attendance" WHERE id = ?', [
      id,
    ]);
  }
}
