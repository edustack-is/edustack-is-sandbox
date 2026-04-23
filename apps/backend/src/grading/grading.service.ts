import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  Grade,
  StudentProfile,
  TeacherProfile,
  Classroom,
  SubjectInstance,
  ReportCard,
  Semester,
  AcademicYear,
  BehaviorGrade,
  CompetencyGrade,
  EducationalMeasure,
  CommissionExam,
  ClassificationDeadline,
} from '../database/types';
import * as crypto from 'crypto';

@Injectable()
export class GradingService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private db: DatabaseService) {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  // ─── GRADE CRUD ─────────────────────────────────────────────

  async createGrade(
    userId: string,
    schoolId: string,
    data: {
      studentId: string;
      subjectInstanceId: string;
      value: string;
      weight: number;
      description?: string;
      type?: string;
      verbalText?: string;
      category?: string;
      semesterId?: string;
    },
  ) {
    const teacher = await this.getTeacherProfile(userId);
    const student = await this.db.queryOne<StudentProfile>(
      'SELECT id, classroomId FROM "StudentProfile" WHERE id = ?',
      [data.studentId],
    );
    if (!student) throw new NotFoundException('Student not found');

    const hasAuthority = await this.db.queryOne(
      'SELECT id FROM "ScheduleEvent" WHERE teacherId = ? AND schoolId = ? AND classroomId = ? AND subjectInstanceId = ?',
      [teacher.id, schoolId, student.classroomId || '', data.subjectInstanceId],
    );
    if (!hasAuthority)
      throw new ForbiddenException(
        'You are not authorized to grade this student.',
      );

    const type = data.type || 'NUMERIC';
    if (type === 'NUMERIC') {
      const v = parseInt(data.value);
      if (isNaN(v) || v < 1 || v > 5)
        throw new BadRequestException('Numeric grade must be 1-5.');
    }

    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "Grade" (id, value, weight, description, date, type, verbalText, category, schoolId, studentId, subjectInstanceId, teacherId, semesterId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.value,
        data.weight,
        data.description || null,
        new Date().toISOString(),
        type,
        data.verbalText || null,
        data.category || null,
        schoolId,
        data.studentId,
        data.subjectInstanceId,
        teacher.id,
        data.semesterId || null,
        new Date().toISOString(),
      ],
    );

    await this.db.execute(
      'INSERT INTO "AuditLog" (id, actorId, action, entity, entityId, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        userId,
        'CREATE_GRADE',
        'Grade',
        id,
        JSON.stringify(data),
        new Date().toISOString(),
      ],
    );

    return await this.getGradeWithIncludes(id);
  }

  private async getGradeWithIncludes(id: string) {
    const g = await this.db.queryOne(
      `SELECT g.*, st.name as subName, st.code as subCode, u.firstName, u.lastName 
       FROM "Grade" g 
       JOIN "SubjectInstance" si ON g.subjectInstanceId = si.id 
       JOIN "SubjectTemplate" st ON si.templateId = st.id 
       JOIN "TeacherProfile" tp ON g.teacherId = tp.id 
       JOIN "User" u ON tp.userId = u.id 
       WHERE g.id = ?`,
      [id],
    );
    return g;
  }

  async updateGrade(
    userId: string,
    schoolId: string,
    gradeId: string,
    data: any,
  ) {
    const grade = await this.db.queryOne<Grade>(
      'SELECT * FROM "Grade" WHERE id = ?',
      [gradeId],
    );
    if (!grade) throw new NotFoundException('Grade not found');
    const teacher = await this.getTeacherProfile(userId);
    if (grade.teacherId !== teacher.id)
      throw new ForbiddenException('You can only edit your own grades.');

    const fields = [];
    const values = [];
    ['value', 'weight', 'description', 'verbalText', 'category'].forEach(
      (k) => {
        if (data[k] !== undefined) {
          fields.push(`"${k}" = ?`);
          values.push(data[k]);
        }
      },
    );

    if (fields.length > 0) {
      await this.db.execute(
        `UPDATE "Grade" SET ${fields.join(', ')} WHERE id = ?`,
        [...values, gradeId],
      );
    }

    await this.db.execute(
      'INSERT INTO "AuditLog" (id, actorId, action, entity, entityId, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        userId,
        'UPDATE_GRADE',
        'Grade',
        gradeId,
        JSON.stringify(data),
        new Date().toISOString(),
      ],
    );
    return await this.getGradeWithIncludes(gradeId);
  }

  async deleteGrade(userId: string, schoolId: string, gradeId: string) {
    const grade = await this.db.queryOne<Grade>(
      'SELECT * FROM "Grade" WHERE id = ?',
      [gradeId],
    );
    if (!grade) throw new NotFoundException('Grade not found');
    const teacher = await this.getTeacherProfile(userId);
    if (grade.teacherId !== teacher.id)
      throw new ForbiddenException('You can only delete your own grades.');

    await this.db.execute('DELETE FROM "Grade" WHERE id = ?', [gradeId]);
    await this.db.execute(
      'INSERT INTO "AuditLog" (id, actorId, action, entity, entityId, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        userId,
        'DELETE_GRADE',
        'Grade',
        gradeId,
        JSON.stringify({ studentId: grade.studentId }),
        new Date().toISOString(),
      ],
    );
    return { success: true };
  }

  // ─── QUERIES ──────────────────────────────────────────────────

  async getGradesForClassroom(
    userId: string,
    schoolId: string,
    classroomId: string,
    opts?: any,
  ) {
    const classroom = await this.db.queryOne<Classroom>(
      'SELECT * FROM "Classroom" WHERE id = ?',
      [classroomId],
    );
    if (!classroom) throw new NotFoundException('Classroom not found');

    const students = await this.db.query(
      'SELECT sp.*, u.firstName, u.lastName FROM "StudentProfile" sp JOIN "User" u ON sp.userId = u.id WHERE sp.classroomId = ?',
      [classroomId],
    );

    let subjectsQuery =
      'SELECT DISTINCT si.*, st.name, st.code FROM "ScheduleEvent" se JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id JOIN "SubjectTemplate" st ON si.templateId = st.id WHERE se.classroomId = ?';
    const subParams = [classroomId];
    if (!opts?.isAdmin) {
      const t = await this.getTeacherProfile(userId);
      subjectsQuery += ' AND se.teacherId = ?';
      subParams.push(t.id);
    }
    const subjectInstances = await this.db.query(subjectsQuery, subParams);

    const studentIds = students.map((s: any) => s.id);
    const subIds = subjectInstances.map((si: any) => si.id);

    if (studentIds.length === 0 || subIds.length === 0)
      return { classroom, students: [], subjects: [], grades: [] };

    let gradesSql =
      'SELECT g.*, u.firstName as tFN, u.lastName as tLN FROM "Grade" g JOIN "TeacherProfile" tp ON g.teacherId = tp.id JOIN "User" u ON tp.userId = u.id WHERE g.schoolId = ? AND g.studentId IN (' +
      studentIds.map(() => '?').join(',') +
      ') AND g.subjectInstanceId IN (' +
      subIds.map(() => '?').join(',') +
      ')';
    const gradeParams = [schoolId, ...studentIds, ...subIds];
    if (opts?.semesterId) {
      gradesSql += ' AND g.semesterId = ?';
      gradeParams.push(opts.semesterId);
    }

    const grades = await this.db.query(
      gradesSql + ' ORDER BY g.date DESC',
      gradeParams,
    );

    return {
      classroom,
      students,
      subjects: subjectInstances.map((si: any) => ({
        id: si.id,
        name: si.name,
        code: si.code,
      })),
      grades: grades.map((g: any) => ({
        ...g,
        teacherProfile: { user: { firstName: g.tFN, lastName: g.tLN } },
      })),
    };
  }

  async getStudentGrades(
    schoolId: string,
    studentId: string,
    semesterId?: string,
  ) {
    const student = await this.db.queryOne(
      'SELECT sp.*, u.firstName, u.lastName FROM "StudentProfile" sp JOIN "User" u ON sp.userId = u.id WHERE sp.id = ?',
      [studentId],
    );
    if (!student) throw new NotFoundException('Student not found');

    let sql =
      'SELECT g.*, st.name as subName, st.code as subCode, u.firstName as tFN, u.lastName as tLN FROM "Grade" g JOIN "SubjectInstance" si ON g.subjectInstanceId = si.id JOIN "SubjectTemplate" st ON si.templateId = st.id JOIN "TeacherProfile" tp ON g.teacherId = tp.id JOIN "User" u ON tp.userId = u.id WHERE g.studentId = ?';
    const params = [studentId];
    if (semesterId) {
      sql += ' AND g.semesterId = ?';
      params.push(semesterId);
    }

    const grades = await this.db.query(sql + ' ORDER BY g.date DESC', params);
    return {
      student,
      grades: grades.map((g: any) => ({
        ...g,
        subjectInstance: { template: { name: g.subName, code: g.subCode } },
        teacherProfile: { user: { firstName: g.tFN, lastName: g.tLN } },
      })),
    };
  }

  async calculateWeightedAverage(
    studentId: string,
    subjectInstanceId: string,
  ): Promise<number> {
    const grades = await this.db.query<Grade>(
      'SELECT value, weight FROM "Grade" WHERE studentId = ? AND subjectInstanceId = ? AND type = "NUMERIC"',
      [studentId, subjectInstanceId],
    );
    if (grades.length === 0) return 0;

    let total = 0,
      weight = 0;
    for (const g of grades) {
      const v = parseFloat(g.value);
      if (!isNaN(v)) {
        total += v * g.weight;
        weight += g.weight;
      }
    }
    return weight === 0 ? 0 : Math.round((total / weight) * 100) / 100;
  }

  // ─── REPORT CARDS ───────────────────────────────────────────

  async getReportCardsForClass(
    schoolId: string,
    classroomId: string,
    semesterId: string,
  ) {
    const classroom = await this.db.queryOne<Classroom>(
      'SELECT * FROM "Classroom" WHERE id = ?',
      [classroomId],
    );
    const students = await this.db.query(
      'SELECT sp.*, u.firstName, u.lastName FROM "StudentProfile" sp JOIN "User" u ON sp.userId = u.id WHERE sp.classroomId = ?',
      [classroomId],
    );
    const subjects = await this.db.query(
      'SELECT DISTINCT si.id, st.name, st.code FROM "ScheduleEvent" se JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id JOIN "SubjectTemplate" st ON si.templateId = st.id WHERE se.classroomId = ?',
      [classroomId],
    );

    const studentData = [];
    for (const s of students as any[]) {
      const subAvgs = [];
      for (const sub of subjects as any[]) {
        const avg = await this.calculateWeightedAverage(s.id, sub.id);
        const rc = await this.db.queryOne(
          'SELECT * FROM "ReportCard" WHERE studentId = ? AND subjectInstanceId = ? AND semesterId = ?',
          [s.id, sub.id, semesterId],
        );
        subAvgs.push({
          subjectInstanceId: sub.id,
          average: avg,
          reportCard: rc,
        });
      }
      studentData.push({ ...s, subjects: subAvgs });
    }

    return { classroom, subjects, students: studentData };
  }

  async upsertReportCard(userId: string, schoolId: string, data: any) {
    const existing = await this.db.queryOne(
      'SELECT id FROM "ReportCard" WHERE studentId = ? AND subjectInstanceId = ? AND semesterId = ?',
      [data.studentId, data.subjectInstanceId, data.semesterId],
    );

    let id: string;
    if (existing) {
      id = (existing as any).id;
      const fields = ['updatedAt = ?'];
      const values = [new Date().toISOString()];
      ['finalGrade', 'verbalEvaluation', 'aiPolished'].forEach((k) => {
        if (data[k] !== undefined) {
          fields.push(`"${k}" = ?`);
          values.push(data[k]);
        }
      });
      await this.db.execute(
        `UPDATE "ReportCard" SET ${fields.join(', ')} WHERE id = ?`,
        [...values, id],
      );
    } else {
      id = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "ReportCard" (id, studentId, subjectInstanceId, semesterId, schoolId, finalGrade, verbalEvaluation, aiPolished, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          id,
          data.studentId,
          data.subjectInstanceId,
          data.semesterId,
          schoolId,
          data.finalGrade || null,
          data.verbalEvaluation || null,
          data.aiPolished ? 1 : 0,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );
    }
    return await this.db.queryOne('SELECT * FROM "ReportCard" WHERE id = ?', [
      id,
    ]);
  }

  // ─── HELPERS ────────────────────────────────────────────────

  private async getTeacherProfile(userId: string): Promise<TeacherProfile> {
    const p = await this.db.queryOne<TeacherProfile>(
      'SELECT * FROM "TeacherProfile" WHERE userId = ?',
      [userId],
    );
    if (!p) throw new NotFoundException('Teacher profile not found');
    return p;
  }
}
