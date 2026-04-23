import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ExportService {
  constructor(private readonly db: DatabaseService) {}

  // ─── DATA LOADERS ───────────────────────────────────────

  async getStudentsData(schoolId: string) {
    const students = await this.db.query(
      `SELECT sp.*, c.name as cName, u.email 
       FROM "StudentProfile" sp 
       JOIN "Classroom" c ON sp.classroomId = c.id 
       JOIN "User" u ON sp.userId = u.id 
       WHERE c.schoolId = ? 
       ORDER BY c.name ASC, sp.lastName ASC`,
      [schoolId],
    );
    return students.map((s: any) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email || '',
      classroom: s.cName || '',
    }));
  }

  async getGradesData(schoolId: string, classroomId?: string) {
    let where = 'WHERE g.schoolId = ?';
    const params: any[] = [schoolId];
    if (classroomId) {
      where += ' AND sp.classroomId = ?';
      params.push(classroomId);
    }

    const grades = await this.db.query(
      `SELECT g.*, sp.firstName, sp.lastName, c.name as cName, st.name as subName, u.firstName as tFN, u.lastName as tLN 
       FROM "Grade" g 
       JOIN "StudentProfile" sp ON g.studentId = sp.id 
       LEFT JOIN "Classroom" c ON sp.classroomId = c.id 
       JOIN "SubjectInstance" si ON g.subjectInstanceId = si.id 
       JOIN "SubjectTemplate" st ON si.templateId = st.id 
       JOIN "TeacherProfile" tp ON g.teacherId = tp.id 
       JOIN "User" u ON tp.userId = u.id 
       ${where} ORDER BY g.createdAt DESC LIMIT 5000`,
      params,
    );

    return grades.map((g: any) => ({
      student: `${g.lastName} ${g.firstName}`,
      classroom: g.cName || '',
      subject: g.subName || '',
      value: g.value,
      weight: g.weight,
      description: g.description || '',
      teacher: `${g.tLN} ${g.tFN}`,
      date: new Date(g.createdAt).toISOString().slice(0, 10),
    }));
  }

  async getAttendanceData(
    schoolId: string,
    classroomId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    let where = 'WHERE a.schoolId = ?';
    const params: any[] = [schoolId];
    if (classroomId) {
      where += ' AND sp.classroomId = ?';
      params.push(classroomId);
    }
    if (dateFrom) {
      where += ' AND a.date >= ?';
      params.push(new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      where += ' AND a.date <= ?';
      params.push(new Date(dateTo).toISOString());
    }

    const records = await this.db.query(
      `SELECT a.*, sp.firstName, sp.lastName, c.name as cName 
       FROM "Attendance" a 
       JOIN "StudentProfile" sp ON a.studentId = sp.id 
       LEFT JOIN "Classroom" c ON sp.classroomId = c.id 
       ${where} ORDER BY a.date DESC LIMIT 10000`,
      params,
    );

    return records.map((r: any) => ({
      student: `${r.lastName} ${r.firstName}`,
      classroom: r.cName || '',
      date: new Date(r.date).toISOString().slice(0, 10),
      status: r.status,
      note: r.note || '',
    }));
  }

  async getScheduleData(schoolId: string, classroomId?: string) {
    let where = 'WHERE se.schoolId = ?';
    const params: any[] = [schoolId];
    if (classroomId) {
      where += ' AND se.classroomId = ?';
      params.push(classroomId);
    }

    const events = await this.db.query(
      `SELECT se.*, c.name as cName, u.firstName, u.lastName, st.name as subName 
       FROM "ScheduleEvent" se 
       JOIN "Classroom" c ON se.classroomId = c.id 
       JOIN "TeacherProfile" tp ON se.teacherId = tp.id 
       JOIN "User" u ON tp.userId = u.id 
       JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id 
       JOIN "SubjectTemplate" st ON si.templateId = st.id 
       ${where} ORDER BY se.dayOfWeek ASC, se.lessonNumber ASC`,
      params,
    );

    const dayNames = [
      '',
      'Pondělí',
      'Úterý',
      'Středa',
      'Čtvrtek',
      'Pátek',
      'Sobota',
      'Neděle',
    ];
    return events.map((e: any) => ({
      day: dayNames[e.dayOfWeek] || String(e.dayOfWeek),
      lessonNumber: e.lessonNumber,
      subject: e.subName || '',
      teacher: `${e.lastName} ${e.firstName}`,
      classroom: e.cName || '',
    }));
  }

  async getClassbookData(
    schoolId: string,
    classroomId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    let where = 'WHERE cbe.classroomId = ? AND c.schoolId = ?';
    const params: any[] = [classroomId, schoolId];
    if (dateFrom) {
      where += ' AND cbe.date >= ?';
      params.push(new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      where += ' AND cbe.date <= ?';
      params.push(new Date(dateTo).toISOString());
    }

    const entries = await this.db.query(
      `SELECT cbe.*, u.firstName, u.lastName, c.name as cName 
       FROM "ClassBookEntry" cbe 
       JOIN "Classroom" c ON cbe.classroomId = c.id 
       JOIN "User" u ON cbe.teacherId = u.id 
       ${where} ORDER BY cbe.date DESC, cbe.lessonNumber ASC LIMIT 5000`,
      params,
    );

    return entries.map((e: any) => ({
      date: new Date(e.date).toISOString().slice(0, 10),
      lessonNumber: e.lessonNumber,
      subject: e.subjectName || '',
      topic: e.topic || '',
      notes: e.notes || '',
      absentCount: e.absentCount ?? '',
      teacher: `${e.lastName} ${e.firstName}`,
    }));
  }

  // ─── FORMAT CONVERTERS ──────────────────────────────────

  toCsv(data: Record<string, any>[]): string {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const escape = (v: any) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines = [
      headers.join(','),
      ...data.map((row) => headers.map((h) => escape(row[h])).join(',')),
    ];
    return '\ufeff' + lines.join('\n');
  }

  toXml(
    data: Record<string, any>[],
    rootName: string,
    itemName: string,
  ): string {
    const escXml = (v: any) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const items = data
      .map((row) => {
        const fields = Object.entries(row)
          .map(([k, v]) => `    <${k}>${escXml(v)}</${k}>`)
          .join('\n');
        return `  <${itemName}>\n${fields}\n  </${itemName}>`;
      })
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>\n${items}\n</${rootName}>`;
  }

  toJson(data: Record<string, any>[]): string {
    return JSON.stringify(data, null, 2);
  }
}
