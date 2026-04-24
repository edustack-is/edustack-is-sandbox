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

  async createGrade(userId: string, schoolId: string, data: any) {
    const teacher = await this.getTeacherProfile(userId);
    const student = await this.db.queryOne<StudentProfile>('SELECT id, classroomId FROM "StudentProfile" WHERE id = ?', [data.studentId]);
    if (!student) throw new NotFoundException('Student not found');

    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "Grade" (id, value, weight, description, date, type, verbalText, category, schoolId, studentId, subjectInstanceId, teacherId, semesterId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.value, data.weight, data.description || null, new Date().toISOString(), data.type || 'NUMERIC', data.verbalText || null, data.category || null, schoolId, data.studentId, data.subjectInstanceId, teacher.id, data.semesterId || null, new Date().toISOString()]
    );
    return await this.getGradeWithIncludes(id);
  }

  private async getGradeWithIncludes(id: string) {
    return await this.db.queryOne(
      `SELECT g.*, st.name as subName, st.code as subCode, u.firstName, u.lastName 
       FROM "Grade" g 
       JOIN "SubjectInstance" si ON g.subjectInstanceId = si.id 
       JOIN "SubjectTemplate" st ON si.templateId = st.id 
       JOIN "TeacherProfile" tp ON g.teacherId = tp.id 
       JOIN "User" u ON tp.userId = u.id 
       WHERE g.id = ?`,
      [id]
    );
  }

  async updateGrade(userId: string, schoolId: string, gradeId: string, data: any) {
    const grade = await this.db.queryOne<Grade>('SELECT * FROM "Grade" WHERE id = ?', [gradeId]);
    if (!grade) throw new NotFoundException('Grade not found');
    
    const fields = ['updatedAt = ?'];
    const values = [new Date().toISOString()];
    ['value', 'weight', 'description', 'verbalText', 'category'].forEach(k => {
      if (data[k] !== undefined) { fields.push(`"${k}" = ?`); values.push(data[k]); }
    });
    await this.db.execute(`UPDATE "Grade" SET ${fields.join(', ')} WHERE id = ?`, [...values, gradeId]);
    return await this.getGradeWithIncludes(gradeId);
  }

  async deleteGrade(userId: string, schoolId: string, gradeId: string) {
    await this.db.execute('DELETE FROM "Grade" WHERE id = ?', [gradeId]);
    return { success: true };
  }

  async getGradesForClassroom(userId: string, schoolId: string, classroomId: string, opts?: any) {
    const classroom = await this.db.queryOne<Classroom>('SELECT * FROM "Classroom" WHERE id = ?', [classroomId]);
    const students = await this.db.query('SELECT sp.*, u.firstName, u.lastName FROM "StudentProfile" sp JOIN "User" u ON sp.userId = u.id WHERE sp.classroomId = ?', [classroomId]);
    const subjects = await this.db.query('SELECT DISTINCT si.id, st.name, st.code FROM "ScheduleEvent" se JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id JOIN "SubjectTemplate" st ON si.templateId = st.id WHERE se.classroomId = ?', [classroomId]);
    const grades = await this.db.query('SELECT * FROM "Grade" WHERE schoolId = ? AND studentId IN (SELECT id FROM "StudentProfile" WHERE classroomId = ?)', [schoolId, classroomId]);
    return { classroom, students, subjects, grades };
  }

  async getStudentGrades(schoolId: string, studentId: string, semesterId?: string) {
    const student = await this.db.queryOne('SELECT * FROM "StudentProfile" WHERE id = ?', [studentId]);
    const grades = await this.db.query('SELECT g.*, st.name as subName FROM "Grade" g JOIN "SubjectInstance" si ON g.subjectInstanceId = si.id JOIN "SubjectTemplate" st ON si.templateId = st.id WHERE g.studentId = ?', [studentId]);
    return { student, grades };
  }

  async getReportCardsForClass(schoolId: string, classroomId: string, semesterId: string) {
    const classroom = await this.db.queryOne<Classroom>('SELECT * FROM "Classroom" WHERE id = ?', [classroomId]);
    const students = await this.db.query('SELECT sp.*, u.firstName, u.lastName FROM "StudentProfile" sp JOIN "User" u ON sp.userId = u.id WHERE sp.classroomId = ?', [classroomId]);
    const subjects = await this.db.query('SELECT DISTINCT si.id, st.name, st.code FROM "ScheduleEvent" se JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id JOIN "SubjectTemplate" st ON si.templateId = st.id WHERE se.classroomId = ?', [classroomId]);

    const studentData = [];
    for (const s of students as any[]) {
      const subAvgs = [];
      for (const sub of subjects as any[]) {
        const rc = await this.db.queryOne('SELECT * FROM "ReportCard" WHERE studentId = ? AND subjectInstanceId = ? AND semesterId = ?', [s.id, sub.id, semesterId]);
        subAvgs.push({ subjectInstanceId: sub.id, reportCard: rc });
      }
      studentData.push({ ...s, subjects: subAvgs });
    }

    return { classroom, subjects, students: studentData };
  }

  async upsertReportCard(schoolId: string, data: any) {
    const existing = await this.db.queryOne('SELECT id FROM "ReportCard" WHERE studentId = ? AND subjectInstanceId = ? AND semesterId = ?', [data.studentId, data.subjectInstanceId, data.semesterId]);

    let id: string;
    if (existing) {
      id = (existing as any).id;
      await this.db.execute('UPDATE "ReportCard" SET finalGrade = ?, verbalEvaluation = ?, aiPolished = ?, updatedAt = ? WHERE id = ?', [data.finalGrade || null, data.verbalEvaluation || null, data.aiPolished ? 1 : 0, new Date().toISOString(), id]);
    } else {
      id = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "ReportCard" (id, studentId, subjectInstanceId, semesterId, schoolId, finalGrade, verbalEvaluation, aiPolished, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, data.studentId, data.subjectInstanceId, data.semesterId, schoolId, data.finalGrade || null, data.verbalEvaluation || null, data.aiPolished ? 1 : 0, new Date().toISOString(), new Date().toISOString()]
      );
    }
    return await this.db.queryOne('SELECT * FROM "ReportCard" WHERE id = ?', [id]);
  }

  async polishVerbalEvaluation(text: string) {
    const prompt = `Vylepši slovní hodnocení žáka, aby bylo profesionální a povzbuzující: ${text}`;
    const result = await this.model.generateContent(prompt);
    return { polishedText: result.response.text().trim() };
  }

  async getGradingTypesForClassroom(classroomId: string) {
    return { types: ['NUMERIC', 'VERBAL', 'PASS_FAIL'] };
  }

  async upsertBehaviorGrade(schoolId: string, data: any) {
    const id = crypto.randomUUID();
    await this.db.execute('INSERT INTO "BehaviorGrade" (id, grade, note, studentId, semesterId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, data.grade, data.note || null, data.studentId, data.semesterId, schoolId, new Date().toISOString(), new Date().toISOString()]);
    return await this.db.queryOne('SELECT * FROM "BehaviorGrade" WHERE id = ?', [id]);
  }

  async getBehaviorGrades(schoolId: string, filters: any) {
    return this.db.query('SELECT * FROM "BehaviorGrade" WHERE schoolId = ?', [schoolId]);
  }

  async upsertCompetencyGrade(schoolId: string, userId: string, data: any) {
    const id = crypto.randomUUID();
    await this.db.execute('INSERT INTO "CompetencyGrade" (id, level, note, studentId, competencyId, subjectInstanceId, semesterId, schoolId, teacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, data.level, data.note || null, data.studentId, data.competencyId, data.subjectInstanceId, data.semesterId, schoolId, userId, new Date().toISOString()]);
    return await this.db.queryOne('SELECT * FROM "CompetencyGrade" WHERE id = ?', [id]);
  }

  async getCompetencyGrades(schoolId: string, filters: any) {
    return this.db.query('SELECT * FROM "CompetencyGrade" WHERE schoolId = ?', [schoolId]);
  }

  async createMeasure(schoolId: string, userId: string, data: any) {
    const id = crypto.randomUUID();
    await this.db.execute('INSERT INTO "EducationalMeasure" (id, type, reason, date, studentId, issuedById, schoolId, semesterId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, data.type, data.reason, new Date().toISOString(), data.studentId, userId, schoolId, data.semesterId || null, new Date().toISOString()]);
    return await this.db.queryOne('SELECT * FROM "EducationalMeasure" WHERE id = ?', [id]);
  }

  async getMeasures(schoolId: string, filters: any) {
    return this.db.query('SELECT * FROM "EducationalMeasure" WHERE schoolId = ?', [schoolId]);
  }

  async deleteMeasure(schoolId: string, id: string) {
    await this.db.execute('DELETE FROM "EducationalMeasure" WHERE id = ?', [id]);
    return { success: true };
  }

  async getGradeHistory(schoolId: string, studentId: string) {
    return this.db.query('SELECT * FROM "AuditLog" WHERE entity = "Grade" AND entityId IN (SELECT id FROM "Grade" WHERE studentId = ?)', [studentId]);
  }

  async getReportCardHtml(studentId: string, semesterId: string) {
    return '<html><body>Vysvědčení placeholder</body></html>';
  }

  async createCommissionExam(schoolId: string, data: any) {
    const id = crypto.randomUUID();
    await this.db.execute('INSERT INTO "CommissionExam" (id, date, originalGrade, newGrade, note, studentId, subjectInstanceId, semesterId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, new Date().toISOString(), data.originalGrade, data.newGrade || null, data.note || null, data.studentId, data.subjectInstanceId, data.semesterId, schoolId, new Date().toISOString(), new Date().toISOString()]);
    return await this.db.queryOne('SELECT * FROM "CommissionExam" WHERE id = ?', [id]);
  }

  async getCommissionExams(schoolId: string, filters: any) {
    return this.db.query('SELECT * FROM "CommissionExam" WHERE schoolId = ?', [schoolId]);
  }

  async updateCommissionExam(schoolId: string, id: string, data: any) {
    await this.db.execute('UPDATE "CommissionExam" SET newGrade = ?, note = ?, updatedAt = ? WHERE id = ?', [data.newGrade, data.note, new Date().toISOString(), id]);
    return await this.db.queryOne('SELECT * FROM "CommissionExam" WHERE id = ?', [id]);
  }

  async deleteCommissionExam(schoolId: string, id: string) {
    await this.db.execute('DELETE FROM "CommissionExam" WHERE id = ?', [id]);
    return { success: true };
  }

  async getDeadline(schoolId: string, semesterId: string) {
    return await this.db.queryOne('SELECT * FROM "ClassificationDeadline" WHERE schoolId = ? AND semesterId = ?', [schoolId, semesterId]);
  }

  async upsertDeadline(schoolId: string, data: any) {
    const existing = await this.getDeadline(schoolId, data.semesterId);
    if (existing) {
      await this.db.execute('UPDATE "ClassificationDeadline" SET deadline = ?, updatedAt = ? WHERE id = ?', [new Date(data.deadline).toISOString(), new Date().toISOString(), (existing as any).id]);
      return await this.db.queryOne('SELECT * FROM "ClassificationDeadline" WHERE id = ?', [(existing as any).id]);
    } else {
      const id = crypto.randomUUID();
      await this.db.execute('INSERT INTO "ClassificationDeadline" (id, deadline, isLocked, semesterId, schoolId, createdAt, updatedAt) VALUES (?, ?, 0, ?, ?, ?, ?)', [id, new Date(data.deadline).toISOString(), data.semesterId, schoolId, new Date().toISOString(), new Date().toISOString()]);
      return await this.db.queryOne('SELECT * FROM "ClassificationDeadline" WHERE id = ?', [id]);
    }
  }

  async lockClassification(schoolId: string, semesterId: string, lock: boolean) {
    await this.db.execute('UPDATE "ClassificationDeadline" SET isLocked = ? WHERE schoolId = ? AND semesterId = ?', [lock ? 1 : 0, schoolId, semesterId]);
    return { success: true };
  }

  private async getTeacherProfile(userId: string): Promise<TeacherProfile> {
    const p = await this.db.queryOne<TeacherProfile>('SELECT * FROM "TeacherProfile" WHERE userId = ?', [userId]);
    if (!p) throw new NotFoundException('Teacher profile not found');
    return p;
  }
}
