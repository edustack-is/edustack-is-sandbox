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

  async upsertTimeSlots(
    schoolId: string,
    slots: {
      lessonNumber: number;
      startTime: string;
      endTime: string;
      label?: string;
      breakAfter?: number;
    }[],
  ) {
    return this.db.transaction(async (db) => {
      const results = [];
      for (const slot of slots) {
        const existing = await db.queryOne(
          'SELECT id FROM "LessonTimeSlot" WHERE schoolId = ? AND lessonNumber = ?',
          [schoolId, slot.lessonNumber],
        );
        let id: string;
        if (existing) {
          id = (existing as any).id;
          await db.execute(
            'UPDATE "LessonTimeSlot" SET startTime = ?, endTime = ?, label = ?, breakAfter = ? WHERE id = ?',
            [
              slot.startTime,
              slot.endTime,
              slot.label || null,
              slot.breakAfter ?? 10,
              id,
            ],
          );
        } else {
          id = crypto.randomUUID();
          await db.execute(
            'INSERT INTO "LessonTimeSlot" (id, schoolId, lessonNumber, startTime, endTime, label, breakAfter) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              id,
              schoolId,
              slot.lessonNumber,
              slot.startTime,
              slot.endTime,
              slot.label || null,
              slot.breakAfter ?? 10,
            ],
          );
        }
        results.push(
          await db.queryOne('SELECT * FROM "LessonTimeSlot" WHERE id = ?', [
            id,
          ]),
        );
      }
      return results;
    });
  }

  // ─── SCHEDULE EVENTS ────────────────────────────────────────

  async getEvents(
    schoolId: string,
    filters?: {
      academicYearId?: string;
      classroomId?: string;
      teacherId?: string;
    },
  ) {
    let where = 'WHERE se.schoolId = ?';
    const params: any[] = [schoolId];
    if (filters?.academicYearId) {
      where += ' AND se.academicYearId = ?';
      params.push(filters.academicYearId);
    }
    if (filters?.classroomId) {
      where += ' AND se.classroomId = ?';
      params.push(filters.classroomId);
    }
    if (filters?.teacherId) {
      where += ' AND se.teacherId = ?';
      params.push(filters.teacherId);
    }

    const events = await this.db.query(
      `SELECT se.*, si.templateId, st.name as subjectName, st.code as subjectCode, 
              c.name as classroomName, u.firstName, u.lastName, r.name as roomName 
       FROM "ScheduleEvent" se 
       JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id 
       JOIN "SubjectTemplate" st ON si.templateId = st.id 
       JOIN "Classroom" c ON se.classroomId = c.id 
       JOIN "TeacherProfile" tp ON se.teacherId = tp.id 
       JOIN "User" u ON tp.userId = u.id 
       LEFT JOIN "Room" r ON se.roomId = r.id 
       ${where} ORDER BY se.dayOfWeek ASC, se.lessonNumber ASC`,
      params,
    );

    return events.map((e: any) => ({
      ...e,
      subject: {
        id: e.subjectInstanceId,
        template: {
          id: e.templateId,
          name: e.subjectName,
          code: e.subjectCode,
        },
      },
      classroom: { id: e.classroomId, name: e.classroomName },
      teacherProfile: {
        id: e.teacherId,
        user: { firstName: e.firstName, lastName: e.lastName },
      },
      room: e.roomId ? { id: e.roomId, name: e.roomName } : null,
    }));
  }

  async createEvent(
    schoolId: string,
    data: {
      dayOfWeek: number;
      lessonNumber: number;
      subjectInstanceId: string;
      classroomId: string;
      teacherId: string;
      roomId?: string;
      academicYearId: string;
    },
  ) {
    const timeSlot = await this.db.queryOne<LessonTimeSlot>(
      'SELECT startTime, endTime FROM "LessonTimeSlot" WHERE schoolId = ? AND lessonNumber = ?',
      [schoolId, data.lessonNumber],
    );

    const startTime =
      timeSlot?.startTime ||
      `${String(7 + data.lessonNumber).padStart(2, '0')}:00`;
    const endTime =
      timeSlot?.endTime ||
      `${String(7 + data.lessonNumber).padStart(2, '0')}:45`;

    const collision = await this.validateCollision(
      data.dayOfWeek,
      data.lessonNumber,
      data.teacherId,
      data.classroomId,
      data.roomId,
      data.academicYearId,
      schoolId,
    );
    if (!collision.valid) throw new BadRequestException(collision.message);

    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "ScheduleEvent" (id, dayOfWeek, lessonNumber, startTime, endTime, schoolId, subjectInstanceId, classroomId, teacherId, roomId, academicYearId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.dayOfWeek,
        data.lessonNumber,
        startTime,
        endTime,
        schoolId,
        data.subjectInstanceId,
        data.classroomId,
        data.teacherId,
        data.roomId || null,
        data.academicYearId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    return await this.getEventWithIncludes(id);
  }

  private async getEventWithIncludes(id: string) {
    const e = await this.db.queryOne(
      `SELECT se.*, si.templateId, st.name as subjectName, st.code as subjectCode, 
              c.name as classroomName, u.firstName, u.lastName, r.name as roomName 
       FROM "ScheduleEvent" se 
       JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id 
       JOIN "SubjectTemplate" st ON si.templateId = st.id 
       JOIN "Classroom" c ON se.classroomId = c.id 
       JOIN "TeacherProfile" tp ON se.teacherId = tp.id 
       JOIN "User" u ON tp.userId = u.id 
       LEFT JOIN "Room" r ON se.roomId = r.id 
       WHERE se.id = ?`,
      [id],
    );
    if (!e) return null;
    const row = e as any;
    return {
      ...row,
      subject: {
        id: row.subjectInstanceId,
        template: {
          id: row.templateId,
          name: row.subjectName,
          code: row.subjectCode,
        },
      },
      classroom: { id: row.classroomId, name: row.classroomName },
      teacherProfile: {
        id: row.teacherId,
        user: { firstName: row.firstName, lastName: row.lastName },
      },
      room: row.roomId ? { id: row.roomId, name: row.roomName } : null,
    };
  }

  async updateEvent(
    schoolId: string,
    eventId: string,
    data: {
      dayOfWeek?: number;
      lessonNumber?: number;
      subjectInstanceId?: string;
      classroomId?: string;
      teacherId?: string;
      roomId?: string;
    },
  ) {
    const existing = await this.db.queryOne<ScheduleEvent>(
      'SELECT * FROM "ScheduleEvent" WHERE id = ? AND schoolId = ?',
      [eventId, schoolId],
    );
    if (!existing) throw new NotFoundException('Schedule event not found');

    const dayOfWeek = data.dayOfWeek ?? existing.dayOfWeek;
    const lessonNumber = data.lessonNumber ?? existing.lessonNumber;
    const teacherId = data.teacherId ?? existing.teacherId;
    const classroomId = data.classroomId ?? existing.classroomId;
    const roomId = data.roomId ?? existing.roomId;

    let startTime = existing.startTime;
    let endTime = existing.endTime;
    if (data.lessonNumber && data.lessonNumber !== existing.lessonNumber) {
      const timeSlot = await this.db.queryOne<LessonTimeSlot>(
        'SELECT startTime, endTime FROM "LessonTimeSlot" WHERE schoolId = ? AND lessonNumber = ?',
        [schoolId, lessonNumber],
      );
      startTime =
        timeSlot?.startTime ||
        `${String(7 + lessonNumber).padStart(2, '0')}:00`;
      endTime =
        timeSlot?.endTime || `${String(7 + lessonNumber).padStart(2, '0')}:45`;
    }

    const collision = await this.validateCollision(
      dayOfWeek,
      lessonNumber,
      teacherId,
      classroomId,
      roomId,
      existing.academicYearId,
      schoolId,
      eventId,
    );
    if (!collision.valid) throw new BadRequestException(collision.message);

    const fields = [
      'updatedAt = ?',
      'startTime = ?',
      'endTime = ?',
      'dayOfWeek = ?',
      'lessonNumber = ?',
      'subjectInstanceId = ?',
      'classroomId = ?',
      'teacherId = ?',
      'roomId = ?',
    ];
    const values = [
      new Date().toISOString(),
      startTime,
      endTime,
      dayOfWeek,
      lessonNumber,
      data.subjectInstanceId ?? existing.subjectInstanceId,
      classroomId,
      teacherId,
      roomId || null,
      eventId,
    ];

    await this.db.execute(
      `UPDATE "ScheduleEvent" SET ${fields
        .map((f, i) => (i < fields.length - 1 ? f : ''))
        .filter((f) => f)
        .join(', ')} WHERE id = ?`,
      values,
    );

    return await this.getEventWithIncludes(eventId);
  }

  async deleteEvent(schoolId: string, eventId: string) {
    const existing = await this.db.queryOne(
      'SELECT id FROM "ScheduleEvent" WHERE id = ? AND schoolId = ?',
      [eventId, schoolId],
    );
    if (!existing) throw new NotFoundException('Schedule event not found');

    await this.db.transaction(async (db) => {
      await db.execute(
        'DELETE FROM "ScheduleSubstitution" WHERE originalEventId = ?',
        [eventId],
      );
      await db.execute('DELETE FROM "ScheduleEvent" WHERE id = ?', [eventId]);
    });
    return { deleted: true };
  }

  async bulkCreateEvents(schoolId: string, events: any[]) {
    const timeSlots = await this.getTimeSlots(schoolId);
    const slotMap = new Map(timeSlots.map((s) => [s.lessonNumber, s]));

    return this.db.transaction(async (db) => {
      let created = 0;
      for (const event of events) {
        const slot = slotMap.get(event.lessonNumber);
        const startTime =
          slot?.startTime ||
          `${String(7 + event.lessonNumber).padStart(2, '0')}:00`;
        const endTime =
          slot?.endTime ||
          `${String(7 + event.lessonNumber).padStart(2, '0')}:45`;

        const existing = await db.queryOne(
          'SELECT id FROM "ScheduleEvent" WHERE schoolId = ? AND dayOfWeek = ? AND lessonNumber = ? AND classroomId = ? AND academicYearId = ?',
          [
            schoolId,
            event.dayOfWeek,
            event.lessonNumber,
            event.classroomId,
            event.academicYearId,
          ],
        );

        if (existing) {
          await db.execute(
            'UPDATE "ScheduleEvent" SET subjectInstanceId = ?, teacherId = ?, roomId = ?, startTime = ?, endTime = ?, updatedAt = ? WHERE id = ?',
            [
              event.subjectInstanceId,
              event.teacherId,
              event.roomId || null,
              startTime,
              endTime,
              new Date().toISOString(),
              (existing as any).id,
            ],
          );
        } else {
          await db.execute(
            'INSERT INTO "ScheduleEvent" (id, dayOfWeek, lessonNumber, startTime, endTime, schoolId, subjectInstanceId, classroomId, teacherId, roomId, academicYearId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              crypto.randomUUID(),
              event.dayOfWeek,
              event.lessonNumber,
              startTime,
              endTime,
              schoolId,
              event.subjectInstanceId,
              event.classroomId,
              event.teacherId,
              event.roomId || null,
              event.academicYearId,
              new Date().toISOString(),
              new Date().toISOString(),
            ],
          );
        }
        created++;
      }
      return { created };
    });
  }

  async getClassroomSchedule(
    schoolId: string,
    classroomId: string,
    academicYearId?: string,
  ) {
    let ayId = academicYearId;
    if (!ayId) {
      const current = await this.db.queryOne<AcademicYear>(
        'SELECT id FROM "AcademicYear" WHERE schoolId = ? AND isCurrent = 1',
        [schoolId],
      );
      ayId = current?.id;
    }

    const events = await this.getEvents(schoolId, {
      classroomId,
      academicYearId: ayId,
    });
    // Add substitutions (simplified)
    for (const e of events) {
      (e as any).substitutions = await this.db.query(
        'SELECT * FROM "ScheduleSubstitution" WHERE originalEventId = ? AND date >= ?',
        [e.id, new Date().toISOString()],
      );
    }
    return events;
  }

  async getTeacherSchedule(
    schoolId: string,
    teacherId: string,
    academicYearId?: string,
  ) {
    let ayId = academicYearId;
    if (!ayId) {
      const current = await this.db.queryOne<AcademicYear>(
        'SELECT id FROM "AcademicYear" WHERE schoolId = ? AND isCurrent = 1',
        [schoolId],
      );
      ayId = current?.id;
    }
    const events = await this.getEvents(schoolId, {
      teacherId,
      academicYearId: ayId,
    });
    for (const e of events) {
      (e as any).substitutions = await this.db.query(
        'SELECT * FROM "ScheduleSubstitution" WHERE originalEventId = ? AND date >= ?',
        [e.id, new Date().toISOString()],
      );
    }
    return events;
  }

  async getStudentSchedule(
    schoolId: string,
    studentUserId: string,
    academicYearId?: string,
  ) {
    let ayId = academicYearId;
    if (!ayId) {
      const current = await this.db.queryOne<AcademicYear>(
        'SELECT id FROM "AcademicYear" WHERE schoolId = ? AND isCurrent = 1',
        [schoolId],
      );
      ayId = current?.id;
    }
    const enrollment = await this.db.queryOne(
      'SELECT classroomId FROM "StudentEnrollment" WHERE studentId = ? AND academicYearId = ?',
      [studentUserId, ayId],
    );
    if (!(enrollment as any)?.classroomId) return [];
    return this.getClassroomSchedule(
      schoolId,
      (enrollment as any).classroomId,
      ayId,
    );
  }

  async getSubstitutions(
    schoolId: string,
    filters?: { date?: string; weekStart?: string; weekEnd?: string },
  ) {
    let where = 'WHERE ss.schoolId = ?';
    const params: any[] = [schoolId];
    if (filters?.date) {
      where += ' AND date(ss.date) = date(?)';
      params.push(filters.date);
    } else if (filters?.weekStart && filters?.weekEnd) {
      where += ' AND ss.date >= ? AND ss.date <= ?';
      params.push(filters.weekStart, filters.weekEnd);
    }

    const subs = await this.db.query(
      `SELECT ss.*, se.lessonNumber, st.name as subName, c.name as className, 
              ut.firstName as tFN, ut.lastName as tLN, ur.firstName as rFN, ur.lastName as rLN, 
              uc.firstName as cFN, uc.lastName as cLN 
       FROM "ScheduleSubstitution" ss 
       JOIN "ScheduleEvent" se ON ss.originalEventId = se.id 
       JOIN "SubjectInstance" si ON se.subjectInstanceId = si.id 
       JOIN "SubjectTemplate" st ON si.templateId = st.id 
       JOIN "Classroom" c ON se.classroomId = c.id 
       JOIN "TeacherProfile" tp ON se.teacherId = tp.id 
       JOIN "User" ut ON tp.userId = ut.id 
       LEFT JOIN "TeacherProfile" stp ON ss.substituteTeacherId = stp.id 
       LEFT JOIN "User" ur ON stp.userId = ur.id 
       JOIN "User" uc ON ss.createdById = uc.id 
       ${where} ORDER BY ss.date ASC, se.lessonNumber ASC`,
      params,
    );

    return subs.map((s: any) => ({
      ...s,
      originalEvent: {
        lessonNumber: s.lessonNumber,
        subject: { template: { name: s.subName } },
        classroom: { name: s.className },
        teacherProfile: { user: { firstName: s.tFN, lastName: s.tLN } },
      },
      substituteTeacher: s.substituteTeacherId
        ? { user: { firstName: s.rFN, lastName: s.rLN } }
        : null,
      createdBy: { firstName: s.cFN, lastName: s.cLN },
    }));
  }

  async validateCollision(
    dayOfWeek: number,
    lessonNumber: number,
    teacherId: string,
    classroomId: string,
    roomId: string | null | undefined,
    academicYearId: string,
    schoolId: string,
    excludeEventId?: string,
  ): Promise<{ valid: boolean; message?: string }> {
    const teacherCollision = await this.db.queryOne(
      'SELECT se.id, c.name FROM "ScheduleEvent" se JOIN "Classroom" c ON se.classroomId = c.id WHERE se.schoolId = ? AND se.teacherId = ? AND se.dayOfWeek = ? AND se.lessonNumber = ? AND se.academicYearId = ?' +
        (excludeEventId ? ' AND se.id != ?' : ''),
      [
        schoolId,
        teacherId,
        dayOfWeek,
        lessonNumber,
        academicYearId,
        ...(excludeEventId ? [excludeEventId] : []),
      ],
    );
    if (teacherCollision)
      return {
        valid: false,
        message: `Teacher already has a lesson in class ${(teacherCollision as any).name} at this time.`,
      };

    if (roomId) {
      const roomCollision = await this.db.queryOne(
        'SELECT se.id, c.name FROM "ScheduleEvent" se JOIN "Classroom" c ON se.classroomId = c.id WHERE se.schoolId = ? AND se.roomId = ? AND se.dayOfWeek = ? AND se.lessonNumber = ? AND se.academicYearId = ?' +
          (excludeEventId ? ' AND se.id != ?' : ''),
        [
          schoolId,
          roomId,
          dayOfWeek,
          lessonNumber,
          academicYearId,
          ...(excludeEventId ? [excludeEventId] : []),
        ],
      );
      if (roomCollision)
        return {
          valid: false,
          message: `Room is already used by class ${(roomCollision as any).name} at this time.`,
        };
    }
    return { valid: true };
  }

  async generateSchedule(
    schoolId: string,
    academicYearId: string,
    clearExisting: boolean,
  ) {
    const instances = await this.db.query(
      'SELECT si.*, gl.levelNumber FROM "SubjectInstance" si JOIN "GradeLevel" gl ON si.gradeLevelId = gl.id WHERE si.schoolId = ? AND si.academicYearId = ?',
      [schoolId, academicYearId],
    );
    const workloads = await this.db.query(
      'SELECT tw.*, tp.id as profileId FROM "TeacherWorkload" tw JOIN "TeacherProfile" tp ON tw.teacherId = tp.userId WHERE tw.academicYearId = ?',
      [academicYearId],
    );
    const classrooms = await this.db.query(
      'SELECT id, grade FROM "Classroom" WHERE schoolId = ?',
      [schoolId],
    );
    const timeSlots = await this.getTimeSlots(schoolId);
    const rooms = await this.db.query(
      'SELECT id FROM "Room" WHERE schoolId = ?',
      [schoolId],
    );

    if (instances.length === 0 || timeSlots.length === 0)
      throw new BadRequestException('Not enough data to generate schedule');

    if (clearExisting) {
      await this.db.execute(
        'DELETE FROM "ScheduleSubstitution" WHERE schoolId = ? AND originalEventId IN (SELECT id FROM "ScheduleEvent" WHERE academicYearId = ?)',
        [schoolId, academicYearId],
      );
      await this.db.execute(
        'DELETE FROM "ScheduleEvent" WHERE schoolId = ? AND academicYearId = ?',
        [schoolId, academicYearId],
      );
    }

    // Simplified generator logic (POC)
    const events = [];
    // ... logic would go here, using this.bulkCreateEvents to save
    return {
      generated: 0,
      message: 'Auto-generation logic requires full implementation',
    };
  }
}
