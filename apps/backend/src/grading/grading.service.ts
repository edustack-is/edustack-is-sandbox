import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AiService } from '../ai/ai.service';
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
  constructor(
    private db: DatabaseService,
    private aiService: AiService,
  ) {}

  // ─── GRADE CRUD ─────────────────────────────────────────────

  async createGrade(userId: string, schoolId: string, data: any) {
    const teacher = await this.getTeacherProfile(userId);
    const student = await this.db.queryOne<StudentProfile>(
      'SELECT id, classroomId FROM "StudentProfile" WHERE id = ?',
      [data.studentId],
    );
    if (!student) throw new NotFoundException('Student not found');

    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "Grade" (id, value, weight, description, date, type, verbalText, category, schoolId, studentId, subjectInstanceId, teacherId, semesterId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.value,
        data.weight,
        data.description || null,
        new Date().toISOString(),
        data.type || 'NUMERIC',
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
      [id],
    );
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

    const fields = ['updatedAt = ?'];
    const values = [new Date().toISOString()];
    ['value', 'weight', 'description', 'verbalText', 'category'].forEach(
      (k) => {
        if (data[k] !== undefined) {
          fields.push(`"${k}" = ?`);
          values.push(data[k]);
        }
      },
    );
    await this.db.execute(
      `UPDATE "Grade" SET ${fields.join(', ')} WHERE id = ?`,
      [...values, gradeId],
    );
    return await this.getGradeWithIncludes(gradeId);
  }

  async deleteGrade(userId: string, schoolId: string, gradeId: string) {
    await this.db.execute('DELETE FROM "Grade" WHERE id = ?', [gradeId]);
    return { success: true };
  }

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
    const students = await this.db.query(
      'SELECT sp.*, u.firstName, u.lastName FROM "StudentProfile" sp JOIN "User" u ON sp.userId = u.id WHERE sp.classroomId = ?',
      [classroomId],
    );
    const subjects = await this.db.query(
      'SELECT DISTINCT si.id, st.name, st.code FROM "ScheduleEvent" se JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id JOIN "SubjectTemplate" st ON si.templateId = st.id WHERE se.classroomId = ?',
      [classroomId],
    );
    const grades = await this.db.query(
      'SELECT * FROM "Grade" WHERE schoolId = ? AND studentId IN (SELECT id FROM "StudentProfile" WHERE classroomId = ?)',
      [schoolId, classroomId],
    );
    return { classroom, students, subjects, grades };
  }

  /**
   * Compute the weighted average for a student in one subject (school-scoped).
   * Only NUMERIC grades with a parseable numeric value contribute. Returns
   * `{ average: null, count: 0 }` if no eligible grades exist.
   */
  async getWeightedAverage(
    schoolId: string,
    studentId: string,
    subjectInstanceId: string,
    semesterId?: string,
  ): Promise<{ average: number | null; count: number }> {
    const params: unknown[] = [schoolId, studentId, subjectInstanceId];
    let sql =
      'SELECT value, weight FROM "Grade" ' +
      'WHERE schoolId = ? AND studentId = ? AND subjectInstanceId = ? ' +
      "AND type = 'NUMERIC'";
    if (semesterId) {
      sql += ' AND semesterId = ?';
      params.push(semesterId);
    }
    const rows = await this.db.query<{ value: string; weight: number }>(
      sql,
      params,
    );

    let weightedSum = 0;
    let weightSum = 0;
    let count = 0;
    for (const row of rows) {
      const numeric = parseFloat(row.value);
      const weight = Number(row.weight) || 0;
      if (Number.isFinite(numeric) && weight > 0) {
        weightedSum += numeric * weight;
        weightSum += weight;
        count += 1;
      }
    }

    if (weightSum === 0) {
      return { average: null, count: 0 };
    }
    return {
      average: Math.round((weightedSum / weightSum) * 100) / 100,
      count,
    };
  }

  async getStudentGrades(
    schoolId: string,
    studentId: string,
    semesterId?: string,
  ) {
    const student = await this.db.queryOne(
      'SELECT * FROM "StudentProfile" WHERE id = ?',
      [studentId],
    );
    const grades = await this.db.query(
      'SELECT g.*, st.name as subName FROM "Grade" g JOIN "SubjectInstance" si ON g.subjectInstanceId = si.id JOIN "SubjectTemplate" st ON si.templateId = st.id WHERE g.studentId = ?',
      [studentId],
    );
    return { student, grades };
  }

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
        const rc = await this.db.queryOne(
          'SELECT * FROM "ReportCard" WHERE studentId = ? AND subjectInstanceId = ? AND semesterId = ?',
          [s.id, sub.id, semesterId],
        );
        subAvgs.push({ subjectInstanceId: sub.id, reportCard: rc });
      }
      studentData.push({ ...s, subjects: subAvgs });
    }

    return { classroom, subjects, students: studentData };
  }

  async upsertReportCard(schoolId: string, data: any) {
    const existing = await this.db.queryOne(
      'SELECT id FROM "ReportCard" WHERE studentId = ? AND subjectInstanceId = ? AND semesterId = ?',
      [data.studentId, data.subjectInstanceId, data.semesterId],
    );

    let id: string;
    if (existing) {
      id = (existing as any).id;
      await this.db.execute(
        'UPDATE "ReportCard" SET finalGrade = ?, verbalEvaluation = ?, aiPolished = ?, updatedAt = ? WHERE id = ?',
        [
          data.finalGrade || null,
          data.verbalEvaluation || null,
          data.aiPolished ? 1 : 0,
          new Date().toISOString(),
          id,
        ],
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

  async polishVerbalEvaluation(text: string, feedback?: string) {
    // Three independently-generated rewrites with distinct tones so the
    // teacher can pick the wording closest to what they want, or send a
    // feedback prompt to regenerate. The variants are NOT persisted —
    // only the one the teacher accepts and saves on the report card.
    //
    // Each rewrite MUST come back as one clean paragraph ready to paste
    // into the textarea. The prompt below blocks the model from doing
    // its usual "here are several options…" thing; sanitizePolish()
    // below strips anything that slips through anyway.
    const variants = [
      {
        id: 'formal',
        label: 'Formální',
        tone: 'formální, věcný a spisovný',
      },
      {
        id: 'encouraging',
        label: 'Povzbuzující',
        tone: 'povzbuzující, vřelý a motivační',
      },
      {
        id: 'concise',
        label: 'Stručný',
        tone: 'stručný, jasný a konkrétní',
      },
    ];
    const strictInstruction =
      'Přepiš toto slovní hodnocení žáka do jediného souvislého odstavce vhodného přímo na vysvědčení. ' +
      'VYSTUP: vrať POUZE samotný přepsaný text. Žádné varianty, žádné možnosti, žádné nadpisy, žádné odrážky, ' +
      'žádné uvozovky kolem celého textu, žádné markdown formátování, žádné komentáře, žádné poznámky pro učitele, ' +
      'žádné "doporučení" ani "tipy", žádné dotazy. Pouze hotový text, který lze rovnou vložit do vysvědčení. ' +
      'Zachovej věcný obsah původního textu, neuváděj fakta, která v něm nejsou.' +
      (feedback?.trim()
        ? ` Zohledni přitom následující pokyn od učitele: ${feedback.trim()}.`
        : '');

    const results = await Promise.all(
      variants.map((v) =>
        this.aiService.refineText({
          existingText: text,
          context: `Jsi učitel na 1. nebo 2. stupni ZŠ. Piš tónem, který je ${v.tone}.`,
          instruction: strictInstruction,
        }),
      ),
    );

    return {
      variants: variants.map((v, i) => ({
        id: v.id,
        label: v.label,
        tone: v.tone,
        text: this.sanitizePolish(results[i].text),
      })),
    };
  }

  /**
   * Coerce a model response into a single ready-to-paste paragraph.
   *
   * The model is instructed to return just the rewrite, but it often
   * disobeys and returns a "Here are some options…" preamble + several
   * markdown-quoted variants + a "Recommendation" tail. We handle that
   * in three passes, from most to least specific:
   *
   *  1. If the response contains markdown blockquoted text segments
   *     (`> "…"` lines — exactly the shape the model produced in the
   *     bug report), treat those AS the rewrite and use the first one.
   *  2. Otherwise drop the obvious preamble openers and cut at the
   *     first "Varianta N" / "Doporučení:" / "Tip:" / bullet / ###
   *     heading.
   *  3. Strip surrounding quotes and code fences as cleanup.
   *
   * Always returns something — if every step would leave the string
   * empty, falls back to the raw text. The UI never displays a blank
   * variant.
   */
  private sanitizePolish(raw: string): string {
    const original = (raw || '').trim();
    if (!original) return '';

    // Strategy 1: pick the first blockquoted rewrite if the model
    // produced "list of variants" markdown.
    const blockquote =
      /(?:^|\n)\s*>\s*[„"”„«]?([^\n]+?)[“"”»]?\s*(?=\n|$)/u.exec(original);
    if (blockquote && blockquote[1].trim().length >= 20) {
      return this.stripWrappers(blockquote[1].trim());
    }

    // Strategy 2: drop preamble + cut at the first variant header /
    // commentary section.
    let s = original;

    // Code fences first.
    s = s.replace(/^```[a-z]*\s*\n?/i, '').replace(/\n?```\s*$/i, '');

    // Drop "Here are a few options…" preamble lines.
    const preambleMatchers = [
      /^Jako učitel(\s[a-zá-ž]+){0,12}\s+(doporučuji|navrhuji|nabízím|formuluji|nabídnu)\b.*$/im,
      /^Zde (je|jsou)\b.*$/im,
      /^Níže (je|jsou)\b.*$/im,
      /^Tady (je|jsou)\b.*$/im,
      /^(Here|Below) (is|are)\b.*$/im,
      /^Samozřejmě,\s.*$/im,
      /^Rád(a)? (s )?tím (vám )?pomohu.*$/im,
    ];
    for (const re of preambleMatchers) {
      s = s.replace(re, '').trim();
    }

    // Cut at the first commentary marker.
    const cutMarkers = [
      /\n\s*\*?\*?(Varianta|Variant|Možnost|Verze|Version)\s*\d/i,
      /\n\s*\*?\*?(Doporučení|Doporucení|Tip|Tipy|Pár tipů|Poznámka|Recommendation|Note)\s*[:：]/i,
      /\n\s*###\s/,
      /\n\s*\*\s/,
      /\n\s*Která z nich/i,
    ];
    for (const marker of cutMarkers) {
      const m = s.search(marker);
      if (m > 0) s = s.slice(0, m);
    }

    s = this.stripWrappers(s);
    s = s.replace(/\n{3,}/g, '\n\n').trim();

    // Strategy 3 — last resort: if our cleanup nuked everything, fall
    // back to the (admittedly noisy) raw response so the teacher still
    // has something to work with.
    return s.length >= 10 ? s : this.stripWrappers(original);
  }

  /**
   * Strip surrounding quote characters and inner markdown emphasis
   * markers (**bold**, _italic_) so the result is paste-ready plain
   * text.
   */
  private stripWrappers(text: string): string {
    let s = text.trim();
    // Remove surrounding quote pair (Czech and ASCII forms).
    const quoted = /^[„"'»](.*)["“'«]$/s.exec(s);
    if (quoted) s = quoted[1].trim();
    // Strip leading bullet/blockquote artefacts.
    s = s.replace(/^>\s*/gm, '').trim();
    // Remove **bold** and __bold__ markers (keep the inner text).
    s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
    return s.trim();
  }

  async getGradingTypesForClassroom(classroomId: string) {
    return { types: ['NUMERIC', 'VERBAL', 'PASS_FAIL'] };
  }

  async upsertBehaviorGrade(schoolId: string, data: any) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "BehaviorGrade" (id, grade, note, studentId, semesterId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.grade,
        data.note || null,
        data.studentId,
        data.semesterId,
        schoolId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    return await this.db.queryOne(
      'SELECT * FROM "BehaviorGrade" WHERE id = ?',
      [id],
    );
  }

  async getBehaviorGrades(schoolId: string, filters: any) {
    return this.db.query('SELECT * FROM "BehaviorGrade" WHERE schoolId = ?', [
      schoolId,
    ]);
  }

  async upsertCompetencyGrade(schoolId: string, userId: string, data: any) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "CompetencyGrade" (id, level, note, studentId, competencyId, subjectInstanceId, semesterId, schoolId, teacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.level,
        data.note || null,
        data.studentId,
        data.competencyId,
        data.subjectInstanceId,
        data.semesterId,
        schoolId,
        userId,
        new Date().toISOString(),
      ],
    );
    return await this.db.queryOne(
      'SELECT * FROM "CompetencyGrade" WHERE id = ?',
      [id],
    );
  }

  async getCompetencyGrades(schoolId: string, filters: any) {
    return this.db.query('SELECT * FROM "CompetencyGrade" WHERE schoolId = ?', [
      schoolId,
    ]);
  }

  async createMeasure(schoolId: string, userId: string, data: any) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "EducationalMeasure" (id, type, reason, date, studentId, issuedById, schoolId, semesterId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.type,
        data.reason,
        new Date().toISOString(),
        data.studentId,
        userId,
        schoolId,
        data.semesterId || null,
        new Date().toISOString(),
      ],
    );
    return await this.db.queryOne(
      'SELECT * FROM "EducationalMeasure" WHERE id = ?',
      [id],
    );
  }

  async getMeasures(schoolId: string, filters: any) {
    return this.db.query(
      'SELECT * FROM "EducationalMeasure" WHERE schoolId = ?',
      [schoolId],
    );
  }

  async deleteMeasure(schoolId: string, id: string) {
    await this.db.execute('DELETE FROM "EducationalMeasure" WHERE id = ?', [
      id,
    ]);
    return { success: true };
  }

  async getGradeHistory(schoolId: string, studentId: string) {
    return this.db.query(
      'SELECT * FROM "AuditLog" WHERE entity = "Grade" AND entityId IN (SELECT id FROM "Grade" WHERE studentId = ?)',
      [studentId],
    );
  }

  async getReportCardHtml(studentId: string, semesterId: string) {
    return '<html><body>Vysvědčení placeholder</body></html>';
  }

  async createCommissionExam(schoolId: string, data: any) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "CommissionExam" (id, date, originalGrade, newGrade, note, studentId, subjectInstanceId, semesterId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        new Date().toISOString(),
        data.originalGrade,
        data.newGrade || null,
        data.note || null,
        data.studentId,
        data.subjectInstanceId,
        data.semesterId,
        schoolId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    return await this.db.queryOne(
      'SELECT * FROM "CommissionExam" WHERE id = ?',
      [id],
    );
  }

  async getCommissionExams(schoolId: string, filters: any) {
    return this.db.query('SELECT * FROM "CommissionExam" WHERE schoolId = ?', [
      schoolId,
    ]);
  }

  async updateCommissionExam(schoolId: string, id: string, data: any) {
    await this.db.execute(
      'UPDATE "CommissionExam" SET newGrade = ?, note = ?, updatedAt = ? WHERE id = ?',
      [data.newGrade, data.note, new Date().toISOString(), id],
    );
    return await this.db.queryOne(
      'SELECT * FROM "CommissionExam" WHERE id = ?',
      [id],
    );
  }

  async deleteCommissionExam(schoolId: string, id: string) {
    await this.db.execute('DELETE FROM "CommissionExam" WHERE id = ?', [id]);
    return { success: true };
  }

  async getDeadline(schoolId: string, semesterId: string) {
    return await this.db.queryOne(
      'SELECT * FROM "ClassificationDeadline" WHERE schoolId = ? AND semesterId = ?',
      [schoolId, semesterId],
    );
  }

  async upsertDeadline(schoolId: string, data: any) {
    const existing = await this.getDeadline(schoolId, data.semesterId);
    if (existing) {
      await this.db.execute(
        'UPDATE "ClassificationDeadline" SET deadline = ?, updatedAt = ? WHERE id = ?',
        [
          new Date(data.deadline).toISOString(),
          new Date().toISOString(),
          (existing as any).id,
        ],
      );
      return await this.db.queryOne(
        'SELECT * FROM "ClassificationDeadline" WHERE id = ?',
        [(existing as any).id],
      );
    } else {
      const id = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "ClassificationDeadline" (id, deadline, isLocked, semesterId, schoolId, createdAt, updatedAt) VALUES (?, ?, 0, ?, ?, ?, ?)',
        [
          id,
          new Date(data.deadline).toISOString(),
          data.semesterId,
          schoolId,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );
      return await this.db.queryOne(
        'SELECT * FROM "ClassificationDeadline" WHERE id = ?',
        [id],
      );
    }
  }

  async lockClassification(
    schoolId: string,
    semesterId: string,
    lock: boolean,
  ) {
    await this.db.execute(
      'UPDATE "ClassificationDeadline" SET isLocked = ? WHERE schoolId = ? AND semesterId = ?',
      [lock ? 1 : 0, schoolId, semesterId],
    );
    return { success: true };
  }

  private async getTeacherProfile(userId: string): Promise<TeacherProfile> {
    const p = await this.db.queryOne<TeacherProfile>(
      'SELECT * FROM "TeacherProfile" WHERE userId = ?',
      [userId],
    );
    if (!p) throw new NotFoundException('Teacher profile not found');
    return p;
  }
}
