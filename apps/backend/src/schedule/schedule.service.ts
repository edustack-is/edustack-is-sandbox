import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  LessonTimeSlot,
  ScheduleEvent,
  ScheduleSubstitution,
  AcademicYear,
  Classroom,
  Room,
  User,
  TeacherProfile,
  SubjectInstance,
  SubjectTemplate,
  SubstitutionType,
} from '../database/types';
import * as crypto from 'crypto';

@Injectable()
export class ScheduleService {
  constructor(private readonly db: DatabaseService) {}

  // ─── LESSON TIME SLOTS ──────────────────────────────────────

  async getTimeSlots(schoolId: string) {
    return this.db.query<LessonTimeSlot>(
      'SELECT * FROM "LessonTimeSlot" WHERE schoolId = ? ORDER BY lessonNumber ASC',
      [schoolId],
    );
  }

  async upsertTimeSlots(schoolId: string, slots: any[]) {
    for (const slot of slots) {
      const existing = await this.db.queryOne('SELECT id FROM "LessonTimeSlot" WHERE schoolId = ? AND lessonNumber = ?', [schoolId, slot.lessonNumber]);
      if (existing) {
        await this.db.execute('UPDATE "LessonTimeSlot" SET startTime = ?, endTime = ?, label = ?, breakAfter = ? WHERE id = ?', [slot.startTime, slot.endTime, slot.label || null, slot.breakAfter ?? 10, (existing as any).id]);
      } else {
        await this.db.execute('INSERT INTO "LessonTimeSlot" (id, schoolId, lessonNumber, startTime, endTime, label, breakAfter) VALUES (?, ?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), schoolId, slot.lessonNumber, slot.startTime, slot.endTime, slot.label || null, slot.breakAfter ?? 10]);
      }
    }
    return this.getTimeSlots(schoolId);
  }

  // ─── SCHEDULE EVENTS ────────────────────────────────────────

  async getEvents(schoolId: string, filters?: any) {
    let sql = `SELECT se.*, st.name as subName, st.code as subCode, c.name as cName, u.firstName as tFN, u.lastName as tLN, r.name as rName 
               FROM "ScheduleEvent" se 
               JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id 
               JOIN "SubjectTemplate" st ON si.templateId = st.id 
               JOIN "Classroom" c ON se.classroomId = c.id 
               JOIN "TeacherProfile" tp ON se.teacherId = tp.id 
               JOIN "User" u ON tp.userId = u.id 
               LEFT JOIN "Room" r ON se.roomId = r.id 
               WHERE se.schoolId = ?`;
    const params = [schoolId];
    if (filters?.academicYearId) { sql += ' AND se.academicYearId = ?'; params.push(filters.academicYearId); }
    if (filters?.classroomId) { sql += ' AND se.classroomId = ?'; params.push(filters.classroomId); }
    if (filters?.teacherId) { sql += ' AND se.teacherId = ?'; params.push(filters.teacherId); }
    
    return this.db.query(sql + ' ORDER BY se.dayOfWeek ASC, se.lessonNumber ASC', params);
  }

  async createEvent(schoolId: string, data: any) {
    const id = crypto.randomUUID();
    await this.db.execute('INSERT INTO "ScheduleEvent" (id, dayOfWeek, lessonNumber, startTime, endTime, schoolId, subjectInstanceId, classroomId, teacherId, roomId, academicYearId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, data.dayOfWeek, data.lessonNumber, '08:00', '08:45', schoolId, data.subjectInstanceId, data.classroomId, data.teacherId, data.roomId || null, data.academicYearId, new Date().toISOString(), new Date().toISOString()]);
    return await this.getEventById(id);
  }

  private async getEventById(id: string) {
    return await this.db.queryOne('SELECT * FROM "ScheduleEvent" WHERE id = ?', [id]);
  }

  async updateEvent(schoolId: string, id: string, data: any) {
    await this.db.execute('UPDATE "ScheduleEvent" SET dayOfWeek = ?, lessonNumber = ?, updatedAt = ? WHERE id = ?', [data.dayOfWeek, data.lessonNumber, new Date().toISOString(), id]);
    return await this.getEventById(id);
  }

  async deleteEvent(schoolId: string, id: string) {
    await this.db.execute('DELETE FROM "ScheduleEvent" WHERE id = ?', [id]);
    return { success: true };
  }

  async bulkCreateEvents(schoolId: string, events: any[]) {
    return { created: 0 };
  }

  async getClassroomSchedule(schoolId: string, classroomId: string, academicYearId?: string) {
    return this.getEvents(schoolId, { classroomId, academicYearId });
  }

  async getTeacherSchedule(schoolId: string, teacherId: string, academicYearId?: string) {
    return this.getEvents(schoolId, { teacherId, academicYearId });
  }

  async getStudentSchedule(schoolId: string, studentId: string, academicYearId?: string) {
    return [];
  }

  // ─── SUBSTITUTIONS ──────────────────────────────────────

  async getSubstitutions(schoolId: string, filters: any) {
    return this.db.query('SELECT * FROM "ScheduleSubstitution" WHERE schoolId = ?', [schoolId]);
  }

  async createSubstitution(schoolId: string, userId: string, data: any) {
    const id = crypto.randomUUID();
    await this.db.execute('INSERT INTO "ScheduleSubstitution" (id, date, type, note, originalEventId, substituteTeacherId, substituteRoomId, substituteSubjectId, createdById, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, new Date(data.date).toISOString(), data.type, data.note || null, data.originalEventId, data.substituteTeacherId || null, data.substituteRoomId || null, data.substituteSubjectId || null, userId, schoolId, new Date().toISOString(), new Date().toISOString()]);
    return await this.db.queryOne('SELECT * FROM "ScheduleSubstitution" WHERE id = ?', [id]);
  }

  async updateSubstitution(schoolId: string, id: string, data: any) {
    await this.db.execute('UPDATE "ScheduleSubstitution" SET type = ?, note = ?, updatedAt = ? WHERE id = ?', [data.type, data.note, new Date().toISOString(), id]);
    return await this.db.queryOne('SELECT * FROM "ScheduleSubstitution" WHERE id = ?', [id]);
  }

  async deleteSubstitution(schoolId: string, id: string) {
    await this.db.execute('DELETE FROM "ScheduleSubstitution" WHERE id = ?', [id]);
    return { success: true };
  }

  async generateSchedule(schoolId: string, academicYearId: string, clear: boolean) {
    return { generated: 0 };
  }

  async getScheduleHtml(schoolId: string, classroomId: string, academicYearId: string) {
    return '<html><body>Rozvrh placeholder</body></html>';
  }

  // ─── SNAPSHOTS ──────────────────────────────────────────

  async getSnapshots(schoolId: string, ayId?: string) {
    return this.db.query('SELECT * FROM "ScheduleSnapshot" WHERE schoolId = ?' + (ayId ? ' AND academicYearId = ?' : ''), ayId ? [schoolId, ayId] : [schoolId]);
  }

  async createSnapshot(schoolId: string, ayId: string, name: string) {
    const id = crypto.randomUUID();
    await this.db.execute('INSERT INTO "ScheduleSnapshot" (id, name, data, academicYearId, schoolId, createdAt) VALUES (?, ?, ?, ?, ?, ?)', [id, name, '{}', ayId, schoolId, new Date().toISOString()]);
    return await this.db.queryOne('SELECT * FROM "ScheduleSnapshot" WHERE id = ?', [id]);
  }

  async diffSnapshot(schoolId: string, id: string) {
    return { changes: [] };
  }

  async deleteSnapshot(schoolId: string, id: string) {
    await this.db.execute('DELETE FROM "ScheduleSnapshot" WHERE id = ?', [id]);
    return { success: true };
  }

  // ─── RECURRING EVENTS ───────────────────────────────────

  async getRecurringEvents(schoolId: string) {
    return this.db.query('SELECT * FROM "RecurringEvent" WHERE schoolId = ?', [schoolId]);
  }

  async createRecurringEvent(schoolId: string, data: any) {
    const id = crypto.randomUUID();
    await this.db.execute('INSERT INTO "RecurringEvent" (id, title, description, dayOfWeek, startTime, endTime, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, data.title, data.description || null, data.dayOfWeek, data.startTime, data.endTime, schoolId, new Date().toISOString(), new Date().toISOString()]);
    return await this.db.queryOne('SELECT * FROM "RecurringEvent" WHERE id = ?', [id]);
  }

  async updateRecurringEvent(schoolId: string, id: string, data: any) {
    await this.db.execute('UPDATE "RecurringEvent" SET title = ?, updatedAt = ? WHERE id = ?', [data.title, new Date().toISOString(), id]);
    return await this.db.queryOne('SELECT * FROM "RecurringEvent" WHERE id = ?', [id]);
  }

  async deleteRecurringEvent(schoolId: string, id: string) {
    await this.db.execute('DELETE FROM "RecurringEvent" WHERE id = ?', [id]);
    return { success: true };
  }

  async validateCollision(day: number, lesson: number, teacherId: string, classroomId: string, roomId: string | undefined, ayId: string, schoolId: string, excludeId?: string) {
    return { valid: true };
  }
}
