import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  ClassBookEntry,
  TeacherSignature,
  ScheduleEvent,
  User,
  Attendance,
} from '../database/types';
import * as crypto from 'crypto';

@Injectable()
export class ClassBookService {
  constructor(private readonly db: DatabaseService) {}

  // ─── GET ENTRIES FOR A DATE ─────────────────────────────

  async getEntriesForDate(schoolId: string, classroomId: string, date: string) {
    const d = new Date(date);
    const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();

    const scheduleEvents = await this.db.query(
      `SELECT se.*, st.name as subjectName, u.id as userId, u.firstName, u.lastName 
       FROM "ScheduleEvent" se 
       JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id 
       JOIN "SubjectTemplate" st ON si.templateId = st.id 
       JOIN "TeacherProfile" tp ON se.teacherId = tp.id 
       JOIN "User" u ON tp.userId = u.id 
       WHERE se.schoolId = ? AND se.classroomId = ? AND se.dayOfWeek = ? 
       ORDER BY se.lessonNumber ASC`,
      [schoolId, classroomId, dayOfWeek],
    );

    const existing = await this.db.query(
      `SELECT cbe.*, u.firstName, u.lastName, ts.signedAt 
       FROM "ClassBookEntry" cbe 
       LEFT JOIN "User" u ON cbe.teacherId = u.id 
       LEFT JOIN "TeacherSignature" ts ON cbe.id = ts.classBookEntryId 
       WHERE cbe.schoolId = ? AND cbe.classroomId = ? AND date(cbe.date) = date(?) 
       ORDER BY cbe.lessonNumber ASC`,
      [schoolId, classroomId, d.toISOString()],
    );

    const existingMap = new Map(existing.map((e: any) => [e.lessonNumber, e]));

    return (scheduleEvents as any[]).map((se) => {
      const entry = existingMap.get(se.lessonNumber);
      if (entry) {
        return {
          ...entry,
          subjectName: entry.subjectName || se.subjectName,
          teacher: {
            id: entry.teacherId,
            firstName: entry.firstName,
            lastName: entry.lastName,
          },
          signature: entry.signedAt ? { signedAt: entry.signedAt } : null,
          fromSchedule: true,
        };
      }
      return {
        id: null,
        date: d.toISOString(),
        lessonNumber: se.lessonNumber,
        topic: null,
        notes: null,
        absentCount: null,
        schoolId,
        classroomId,
        teacherId: se.userId,
        teacher: {
          id: se.userId,
          firstName: se.firstName,
          lastName: se.lastName,
        },
        scheduleEventId: se.id,
        subjectName: se.subjectName,
        signature: null,
        fromSchedule: true,
      };
    });
  }

  // ─── UPSERT ENTRY ───────────────────────────────────────

  async upsertEntry(userId: string, schoolId: string, data: any) {
    const d = new Date(data.date).toISOString();
    const existing = await this.db.queryOne(
      'SELECT id FROM "ClassBookEntry" WHERE schoolId = ? AND classroomId = ? AND date(date) = date(?) AND lessonNumber = ?',
      [schoolId, data.classroomId, d, data.lessonNumber],
    );

    let id: string;
    if (existing) {
      id = (existing as any).id;
      await this.db.execute(
        'UPDATE "ClassBookEntry" SET topic = ?, notes = ?, absentCount = ?, updatedAt = ? WHERE id = ?',
        [
          data.topic || null,
          data.notes || null,
          data.absentCount ?? null,
          new Date().toISOString(),
          id,
        ],
      );
    } else {
      id = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "ClassBookEntry" (id, date, lessonNumber, topic, notes, absentCount, schoolId, classroomId, teacherId, scheduleEventId, subjectName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          id,
          d,
          data.lessonNumber,
          data.topic || null,
          data.notes || null,
          data.absentCount ?? null,
          schoolId,
          data.classroomId,
          userId,
          data.scheduleEventId || null,
          data.subjectName || null,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );
    }

    return await this.db.queryOne(
      `SELECT cbe.*, u.firstName, u.lastName, ts.signedAt 
       FROM "ClassBookEntry" cbe 
       JOIN "User" u ON cbe.teacherId = u.id 
       LEFT JOIN "TeacherSignature" ts ON cbe.id = ts.classBookEntryId 
       WHERE cbe.id = ?`,
      [id],
    );
  }

  // ─── SIGN ENTRY ─────────────────────────────────────────

  async signEntry(userId: string, entryId: string, ipAddress?: string) {
    const entry = await this.db.queryOne<ClassBookEntry>(
      'SELECT * FROM "ClassBookEntry" WHERE id = ?',
      [entryId],
    );
    if (!entry) throw new NotFoundException('Záznam nenalezen');
    if (entry.teacherId !== userId)
      throw new ForbiddenException('Můžete podepsat pouze své záznamy');

    const existing = await this.db.queryOne(
      'SELECT id FROM "TeacherSignature" WHERE classBookEntryId = ?',
      [entryId],
    );
    if (existing) {
      await this.db.execute(
        'UPDATE "TeacherSignature" SET signedAt = ?, ipAddress = ? WHERE id = ?',
        [new Date().toISOString(), ipAddress || null, (existing as any).id],
      );
    } else {
      await this.db.execute(
        'INSERT INTO "TeacherSignature" (id, classBookEntryId, teacherId, signedAt, ipAddress) VALUES (?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          entryId,
          userId,
          new Date().toISOString(),
          ipAddress || null,
        ],
      );
    }
    return { success: true };
  }

  // ─── GET ENTRIES FOR RANGE ──────────────────────────────

  async getEntriesForRange(
    schoolId: string,
    classroomId: string,
    dateFrom: string,
    dateTo: string,
  ) {
    return this.db.query(
      `SELECT cbe.*, u.firstName, u.lastName, ts.signedAt 
       FROM "ClassBookEntry" cbe 
       JOIN "User" u ON cbe.teacherId = u.id 
       LEFT JOIN "TeacherSignature" ts ON cbe.id = ts.classBookEntryId 
       WHERE cbe.schoolId = ? AND cbe.classroomId = ? AND cbe.date >= ? AND cbe.date <= ? 
       ORDER BY cbe.date ASC, cbe.lessonNumber ASC`,
      [
        schoolId,
        classroomId,
        new Date(dateFrom).toISOString(),
        new Date(dateTo).toISOString(),
      ],
    );
  }

  async getAttendanceForLesson(
    schoolId: string,
    classroomId: string,
    date: string,
    lessonNumber: number,
  ) {
    const d = new Date(date).toISOString();
    return this.db.query(
      `SELECT a.*, sp.firstName, sp.lastName FROM "Attendance" a 
       JOIN "StudentProfile" sp ON a.studentId = sp.id 
       JOIN "User" u ON sp.userId = u.id 
       WHERE a.schoolId = ? AND sp.classroomId = ? AND date(a.date) = date(?) AND a.lessonNumber = ? 
       ORDER BY sp.lastName ASC`,
      [schoolId, classroomId, d, lessonNumber],
    );
  }
}
