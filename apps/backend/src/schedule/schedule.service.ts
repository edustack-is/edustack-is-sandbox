import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubstitutionType } from '@prisma/client';

@Injectable()
export class ScheduleService {
  constructor(private prisma: PrismaService) {}

  // ─── LESSON TIME SLOTS ──────────────────────────────────────

  async getTimeSlots(schoolId: string) {
    return this.prisma.lessonTimeSlot.findMany({
      where: { schoolId },
      orderBy: { lessonNumber: 'asc' },
    });
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
    const results = [];
    for (const slot of slots) {
      const result = await this.prisma.lessonTimeSlot.upsert({
        where: {
          schoolId_lessonNumber: {
            schoolId,
            lessonNumber: slot.lessonNumber,
          },
        },
        create: {
          schoolId,
          lessonNumber: slot.lessonNumber,
          startTime: slot.startTime,
          endTime: slot.endTime,
          label: slot.label,
          breakAfter: slot.breakAfter ?? 10,
        },
        update: {
          startTime: slot.startTime,
          endTime: slot.endTime,
          label: slot.label,
          breakAfter: slot.breakAfter,
        },
      });
      results.push(result);
    }
    return results;
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
    const where: any = { schoolId };
    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.classroomId) where.classroomId = filters.classroomId;
    if (filters?.teacherId) where.teacherId = filters.teacherId;

    return this.prisma.scheduleEvent.findMany({
      where,
      include: {
        subject: {
          include: { template: true },
        },
        classroom: true,
        teacherProfile: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        room: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { lessonNumber: 'asc' }],
    });
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
    // Resolve time from lesson time slots
    const timeSlot = await this.prisma.lessonTimeSlot.findUnique({
      where: {
        schoolId_lessonNumber: {
          schoolId,
          lessonNumber: data.lessonNumber,
        },
      },
    });

    const startTime =
      timeSlot?.startTime ||
      `${String(7 + data.lessonNumber).padStart(2, '0')}:00`;
    const endTime =
      timeSlot?.endTime ||
      `${String(7 + data.lessonNumber).padStart(2, '0')}:45`;

    // Validate collisions
    const collision = await this.validateCollision(
      data.dayOfWeek,
      data.lessonNumber,
      data.teacherId,
      data.classroomId,
      data.roomId,
      data.academicYearId,
      schoolId,
    );

    if (!collision.valid) {
      throw new BadRequestException(collision.message);
    }

    return this.prisma.scheduleEvent.create({
      data: {
        dayOfWeek: data.dayOfWeek,
        lessonNumber: data.lessonNumber,
        startTime,
        endTime,
        schoolId,
        subjectInstanceId: data.subjectInstanceId,
        classroomId: data.classroomId,
        teacherId: data.teacherId,
        roomId: data.roomId || null,
        academicYearId: data.academicYearId,
      },
      include: {
        subject: { include: { template: true } },
        classroom: true,
        teacherProfile: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        room: true,
      },
    });
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
    const existing = await this.prisma.scheduleEvent.findFirst({
      where: { id: eventId, schoolId },
    });
    if (!existing) throw new NotFoundException('Schedule event not found');

    const dayOfWeek = data.dayOfWeek ?? existing.dayOfWeek;
    const lessonNumber = data.lessonNumber ?? existing.lessonNumber;
    const teacherId = data.teacherId ?? existing.teacherId;
    const classroomId = data.classroomId ?? existing.classroomId;
    const roomId = data.roomId ?? existing.roomId;

    // Resolve time if lessonNumber changed
    let startTime = existing.startTime;
    let endTime = existing.endTime;
    if (data.lessonNumber && data.lessonNumber !== existing.lessonNumber) {
      const timeSlot = await this.prisma.lessonTimeSlot.findUnique({
        where: {
          schoolId_lessonNumber: { schoolId, lessonNumber },
        },
      });
      startTime =
        timeSlot?.startTime ||
        `${String(7 + lessonNumber).padStart(2, '0')}:00`;
      endTime =
        timeSlot?.endTime || `${String(7 + lessonNumber).padStart(2, '0')}:45`;
    }

    // Validate collisions (excluding self)
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
    if (!collision.valid) {
      throw new BadRequestException(collision.message);
    }

    return this.prisma.scheduleEvent.update({
      where: { id: eventId },
      data: {
        dayOfWeek,
        lessonNumber,
        startTime,
        endTime,
        subjectInstanceId: data.subjectInstanceId,
        classroomId,
        teacherId,
        roomId,
      },
      include: {
        subject: { include: { template: true } },
        classroom: true,
        teacherProfile: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        room: true,
      },
    });
  }

  async deleteEvent(schoolId: string, eventId: string) {
    const existing = await this.prisma.scheduleEvent.findFirst({
      where: { id: eventId, schoolId },
    });
    if (!existing) throw new NotFoundException('Schedule event not found');

    // Also delete related substitutions
    await this.prisma.scheduleSubstitution.deleteMany({
      where: { originalEventId: eventId },
    });

    return this.prisma.scheduleEvent.delete({
      where: { id: eventId },
    });
  }

  async bulkCreateEvents(
    schoolId: string,
    events: {
      dayOfWeek: number;
      lessonNumber: number;
      subjectInstanceId: string;
      classroomId: string;
      teacherId: string;
      roomId?: string;
      academicYearId: string;
    }[],
  ) {
    // Get all time slots
    const timeSlots = await this.prisma.lessonTimeSlot.findMany({
      where: { schoolId },
    });
    const slotMap = new Map(timeSlots.map((s) => [s.lessonNumber, s]));

    const results = [];
    const errors = [];

    for (const event of events) {
      try {
        const slot = slotMap.get(event.lessonNumber);
        const startTime =
          slot?.startTime ||
          `${String(7 + event.lessonNumber).padStart(2, '0')}:00`;
        const endTime =
          slot?.endTime ||
          `${String(7 + event.lessonNumber).padStart(2, '0')}:45`;

        const result = await this.prisma.scheduleEvent.upsert({
          where: {
            schoolId_dayOfWeek_lessonNumber_classroomId_academicYearId: {
              schoolId,
              dayOfWeek: event.dayOfWeek,
              lessonNumber: event.lessonNumber,
              classroomId: event.classroomId,
              academicYearId: event.academicYearId,
            },
          },
          create: {
            dayOfWeek: event.dayOfWeek,
            lessonNumber: event.lessonNumber,
            startTime,
            endTime,
            schoolId,
            subjectInstanceId: event.subjectInstanceId,
            classroomId: event.classroomId,
            teacherId: event.teacherId,
            roomId: event.roomId || null,
            academicYearId: event.academicYearId,
          },
          update: {
            subjectInstanceId: event.subjectInstanceId,
            teacherId: event.teacherId,
            roomId: event.roomId || null,
            startTime,
            endTime,
          },
        });
        results.push(result);
      } catch (e) {
        errors.push({ event, error: e.message });
      }
    }

    return { created: results.length, errors };
  }

  // ─── VIEW ENDPOINTS ─────────────────────────────────────────

  async getClassroomSchedule(
    schoolId: string,
    classroomId: string,
    academicYearId?: string,
  ) {
    const where: any = { schoolId, classroomId };
    if (academicYearId) where.academicYearId = academicYearId;
    else {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
      });
      if (currentYear) where.academicYearId = currentYear.id;
    }

    return this.prisma.scheduleEvent.findMany({
      where,
      include: {
        subject: { include: { template: true } },
        teacherProfile: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        room: true,
        classroom: true,
        substitutions: {
          where: {
            date: { gte: new Date() },
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { lessonNumber: 'asc' }],
    });
  }

  async getTeacherSchedule(
    schoolId: string,
    teacherId: string,
    academicYearId?: string,
  ) {
    const where: any = { schoolId, teacherId };
    if (academicYearId) where.academicYearId = academicYearId;
    else {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
      });
      if (currentYear) where.academicYearId = currentYear.id;
    }

    return this.prisma.scheduleEvent.findMany({
      where,
      include: {
        subject: { include: { template: true } },
        classroom: true,
        room: true,
        substitutions: {
          where: {
            date: { gte: new Date() },
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { lessonNumber: 'asc' }],
    });
  }

  async getStudentSchedule(
    schoolId: string,
    studentUserId: string,
    academicYearId?: string,
  ) {
    // Find student's classroom via enrollment
    const enrollmentWhere: any = { studentId: studentUserId };
    if (academicYearId) {
      enrollmentWhere.academicYearId = academicYearId;
    } else {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
      });
      if (currentYear) enrollmentWhere.academicYearId = currentYear.id;
    }

    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: enrollmentWhere,
    });

    if (!enrollment?.classroomId) {
      return [];
    }

    return this.getClassroomSchedule(
      schoolId,
      enrollment.classroomId,
      academicYearId,
    );
  }

  // ─── SUBSTITUTIONS ──────────────────────────────────────────

  async getSubstitutions(
    schoolId: string,
    filters?: {
      date?: string;
      weekStart?: string;
      weekEnd?: string;
    },
  ) {
    const where: any = { schoolId };

    if (filters?.date) {
      const d = new Date(filters.date);
      where.date = {
        gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
      };
    } else if (filters?.weekStart && filters?.weekEnd) {
      where.date = {
        gte: new Date(filters.weekStart),
        lte: new Date(filters.weekEnd),
      };
    }

    return this.prisma.scheduleSubstitution.findMany({
      where,
      include: {
        originalEvent: {
          include: {
            subject: { include: { template: true } },
            classroom: true,
            teacherProfile: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        substituteTeacher: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        substituteRoom: true,
        substituteSubject: { include: { template: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ date: 'asc' }, { originalEvent: { lessonNumber: 'asc' } }],
    });
  }

  async createSubstitution(
    schoolId: string,
    userId: string,
    data: {
      date: string;
      originalEventId: string;
      type: SubstitutionType;
      note?: string;
      substituteTeacherId?: string;
      substituteRoomId?: string;
      substituteSubjectId?: string;
    },
  ) {
    // Verify event belongs to school
    const event = await this.prisma.scheduleEvent.findFirst({
      where: { id: data.originalEventId, schoolId },
    });
    if (!event) throw new NotFoundException('Schedule event not found');

    return this.prisma.scheduleSubstitution.create({
      data: {
        date: new Date(data.date),
        type: data.type,
        note: data.note,
        originalEventId: data.originalEventId,
        substituteTeacherId: data.substituteTeacherId,
        substituteRoomId: data.substituteRoomId,
        substituteSubjectId: data.substituteSubjectId,
        createdById: userId,
        schoolId,
      },
      include: {
        originalEvent: {
          include: {
            subject: { include: { template: true } },
            classroom: true,
            teacherProfile: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        substituteTeacher: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        substituteRoom: true,
      },
    });
  }

  async updateSubstitution(
    schoolId: string,
    substitutionId: string,
    data: {
      type?: SubstitutionType;
      note?: string;
      substituteTeacherId?: string;
      substituteRoomId?: string;
      substituteSubjectId?: string;
    },
  ) {
    const existing = await this.prisma.scheduleSubstitution.findFirst({
      where: { id: substitutionId, schoolId },
    });
    if (!existing) throw new NotFoundException('Substitution not found');

    return this.prisma.scheduleSubstitution.update({
      where: { id: substitutionId },
      data,
    });
  }

  async deleteSubstitution(schoolId: string, substitutionId: string) {
    const existing = await this.prisma.scheduleSubstitution.findFirst({
      where: { id: substitutionId, schoolId },
    });
    if (!existing) throw new NotFoundException('Substitution not found');

    return this.prisma.scheduleSubstitution.delete({
      where: { id: substitutionId },
    });
  }

  // ─── COLLISION VALIDATION ───────────────────────────────────

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
    const excludeCondition = excludeEventId
      ? { id: { not: excludeEventId } }
      : {};

    // Check teacher collision
    const teacherCollision = await this.prisma.scheduleEvent.findFirst({
      where: {
        schoolId,
        teacherId,
        dayOfWeek,
        lessonNumber,
        academicYearId,
        ...excludeCondition,
      },
      include: { classroom: true },
    });

    if (teacherCollision) {
      return {
        valid: false,
        message: `Teacher already has a lesson in class ${teacherCollision.classroom.name} at this time.`,
      };
    }

    // Check room collision (if room is specified)
    if (roomId) {
      const roomCollision = await this.prisma.scheduleEvent.findFirst({
        where: {
          schoolId,
          roomId,
          dayOfWeek,
          lessonNumber,
          academicYearId,
          ...excludeCondition,
        },
        include: { classroom: true },
      });

      if (roomCollision) {
        return {
          valid: false,
          message: `Room is already used by class ${roomCollision.classroom.name} at this time.`,
        };
      }
    }

    return { valid: true };
  }

  // ─── AUTO-GENERATE SCHEDULE ─────────────────────────────────

  async generateSchedule(
    schoolId: string,
    academicYearId: string,
    clearExisting: boolean,
  ) {
    // 1. Get subject instances with grade level info + teacher workloads
    const instances = await this.prisma.subjectInstance.findMany({
      where: { schoolId, academicYearId },
      include: {
        template: true,
        gradeLevel: true,
      },
    });

    // 2. Get teacher workloads to map instances → teacher profiles
    const workloads = await this.prisma.teacherWorkload.findMany({
      where: { academicYearId },
      include: { teacher: { include: { teacherProfile: true } } },
    });

    // 3. Get classrooms, time slots, rooms
    const classrooms = await this.prisma.classroom.findMany({
      where: { schoolId },
      select: { id: true, grade: true },
    });
    const timeSlots = await this.prisma.lessonTimeSlot.findMany({
      where: { schoolId },
      orderBy: { lessonNumber: 'asc' },
    });
    const rooms = await this.prisma.room.findMany({ where: { schoolId } });

    if (instances.length === 0)
      throw new BadRequestException(
        'No subject instances found for this academic year',
      );
    if (timeSlots.length === 0)
      throw new BadRequestException('No time slots defined');

    // 4. Optionally clear existing
    if (clearExisting) {
      await this.prisma.scheduleSubstitution.deleteMany({
        where: { schoolId, originalEvent: { academicYearId } },
      });
      await this.prisma.scheduleEvent.deleteMany({
        where: { schoolId, academicYearId },
      });
    }

    // 5. Build teacher profile IDs
    const teacherProfileIds = workloads
      .map((w) => w.teacher?.teacherProfile?.id)
      .filter((id): id is string => !!id);

    const maxLesson = Math.max(...timeSlots.map((s) => s.lessonNumber));
    const days = [1, 2, 3, 4, 5];

    // Track occupancy
    const teacherOccupied = new Map<string, Set<string>>();
    const classroomOccupied = new Map<string, Set<string>>();
    const roomOccupied = new Map<string, Set<string>>();

    const getOrCreate = (map: Map<string, Set<string>>, key: string) => {
      if (!map.has(key)) map.set(key, new Set());
      return map.get(key)!;
    };

    const events: Array<{
      dayOfWeek: number;
      lessonNumber: number;
      subjectInstanceId: string;
      classroomId: string;
      teacherId: string;
      roomId?: string;
      academicYearId: string;
    }> = [];

    // 6. For each classroom, find matching grade-level instances and place them
    for (const classroom of classrooms) {
      const gradeInstances = instances.filter(
        (i) => i.gradeLevel.levelNumber === classroom.grade,
      );
      if (gradeInstances.length === 0) continue;

      let teacherIdx = 0;
      for (const inst of gradeInstances) {
        const hoursNeeded = inst.hoursPerWeek ?? 1;
        let placed = 0;

        for (const day of days) {
          if (placed >= hoursNeeded) break;
          for (let lesson = 1; lesson <= maxLesson; lesson++) {
            if (placed >= hoursNeeded) break;
            const key = `${day}-${lesson}`;

            if (getOrCreate(classroomOccupied, classroom.id).has(key)) continue;

            // Find available teacher
            let teacherId: string | null = null;
            for (let t = 0; t < teacherProfileIds.length; t++) {
              const tid =
                teacherProfileIds[(teacherIdx + t) % teacherProfileIds.length];
              if (!getOrCreate(teacherOccupied, tid).has(key)) {
                teacherId = tid;
                teacherIdx = (teacherIdx + t + 1) % teacherProfileIds.length;
                break;
              }
            }
            if (!teacherId) continue;

            // Find a free room
            let assignedRoom: string | undefined;
            for (const room of rooms) {
              if (!getOrCreate(roomOccupied, room.id).has(key)) {
                assignedRoom = room.id;
                break;
              }
            }

            // Mark occupied
            getOrCreate(teacherOccupied, teacherId).add(key);
            getOrCreate(classroomOccupied, classroom.id).add(key);
            if (assignedRoom) getOrCreate(roomOccupied, assignedRoom).add(key);

            events.push({
              dayOfWeek: day,
              lessonNumber: lesson,
              subjectInstanceId: inst.id,
              classroomId: classroom.id,
              teacherId,
              roomId: assignedRoom,
              academicYearId,
            });
            placed++;
          }
        }
      }
    }

    // 7. Bulk insert
    const result = await this.bulkCreateEvents(schoolId, events);
    return { generated: events.length, ...result };
  }

  // ─── SCHEDULE EXPORT (HTML for print) ────────────────────────

  async getScheduleHtml(
    schoolId: string,
    classroomId: string,
    academicYearId: string,
  ) {
    const events = await this.getClassroomSchedule(
      schoolId,
      classroomId,
      academicYearId,
    );
    const slots = await this.getTimeSlots(schoolId);
    const classroom = await this.prisma.classroom.findFirst({
      where: { id: classroomId, schoolId },
    });

    const dayLabels = ['', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];
    const maxLesson =
      slots.length > 0 ? Math.max(...slots.map((s) => s.lessonNumber)) : 8;

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rozvrh – ${classroom?.name || ''}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; }
          h2 { text-align: center; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
          th { background: #f0f0f0; }
          @media print { body { margin: 0; } }
        </style></head><body>`;
    html += `<h2>Rozvrh: ${classroom?.name || classroomId}</h2>`;
    html += '<table><thead><tr><th>Hodina</th>';
    for (let d = 1; d <= 5; d++) html += `<th>${dayLabels[d]}</th>`;
    html += '</tr></thead><tbody>';

    for (let lesson = 1; lesson <= maxLesson; lesson++) {
      const slot = slots.find((s) => s.lessonNumber === lesson);
      html += `<tr><td><strong>${lesson}.</strong><br/>${slot?.startTime || ''}-${slot?.endTime || ''}</td>`;
      for (let day = 1; day <= 5; day++) {
        const ev = events.find(
          (e: any) => e.dayOfWeek === day && e.lessonNumber === lesson,
        );
        if (ev) {
          const subName = (ev as any).subject?.template?.name || '';
          const teacher = (ev as any).teacherProfile?.user;
          const teacherName = teacher ? `${teacher.lastName}` : '';
          const roomName = (ev as any).room?.name || '';
          html += `<td>${subName}<br/><small>${teacherName}</small><br/><small>${roomName}</small></td>`;
        } else {
          html += '<td></td>';
        }
      }
      html += '</tr>';
    }

    html += '</tbody></table></body></html>';
    return html;
  }

  // ─── SCHEDULE SNAPSHOTS & DIFF ───────────────────────────────

  async getSnapshots(schoolId: string, academicYearId?: string) {
    return this.prisma.scheduleSnapshot.findMany({
      where: {
        schoolId,
        ...(academicYearId ? { academicYearId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSnapshot(schoolId: string, academicYearId: string, name: string) {
    const events = await this.prisma.scheduleEvent.findMany({
      where: { schoolId, academicYearId },
      include: {
        subject: { include: { template: true } },
        classroom: true,
        teacherProfile: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        room: true,
      },
    });

    return this.prisma.scheduleSnapshot.create({
      data: {
        name,
        data: events as any,
        schoolId,
        academicYearId,
      },
    });
  }

  async diffSnapshot(schoolId: string, snapshotId: string) {
    const snapshot = await this.prisma.scheduleSnapshot.findFirst({
      where: { id: snapshotId, schoolId },
    });
    if (!snapshot) throw new NotFoundException('Snapshot not found');

    const currentEvents = await this.prisma.scheduleEvent.findMany({
      where: { schoolId, academicYearId: snapshot.academicYearId },
      include: {
        subject: { include: { template: true } },
        classroom: true,
        teacherProfile: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        room: true,
      },
    });

    const oldEvents = snapshot.data as any[];

    // Build lookup by day+lesson+classroom
    const key = (e: any) => `${e.dayOfWeek}-${e.lessonNumber}-${e.classroomId}`;
    const oldMap = new Map(oldEvents.map((e) => [key(e), e]));
    const newMap = new Map(currentEvents.map((e) => [key(e), e]));

    const added: any[] = [];
    const removed: any[] = [];
    const changed: any[] = [];

    for (const [k, ev] of newMap) {
      if (!oldMap.has(k)) {
        added.push(ev);
      } else {
        const old = oldMap.get(k)!;
        if (
          old.subjectInstanceId !== ev.subjectInstanceId ||
          old.teacherId !== ev.teacherId ||
          old.roomId !== ev.roomId
        ) {
          changed.push({ old, current: ev });
        }
      }
    }
    for (const [k, ev] of oldMap) {
      if (!newMap.has(k)) removed.push(ev);
    }

    return {
      snapshotName: snapshot.name,
      snapshotDate: snapshot.createdAt,
      added,
      removed,
      changed,
    };
  }

  async deleteSnapshot(schoolId: string, snapshotId: string) {
    const snapshot = await this.prisma.scheduleSnapshot.findFirst({
      where: { id: snapshotId, schoolId },
    });
    if (!snapshot) throw new NotFoundException('Snapshot not found');
    return this.prisma.scheduleSnapshot.delete({ where: { id: snapshotId } });
  }

  // ─── RECURRING EVENTS (kroužky) ──────────────────────────────

  async getRecurringEvents(schoolId: string) {
    return this.prisma.recurringEvent.findMany({
      where: { schoolId },
      include: {
        room: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createRecurringEvent(
    schoolId: string,
    data: {
      title: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      roomId?: string;
      teacherId?: string;
    },
  ) {
    return this.prisma.recurringEvent.create({
      data: {
        ...data,
        roomId: data.roomId || null,
        teacherId: data.teacherId || null,
        schoolId,
      },
    });
  }

  async updateRecurringEvent(
    schoolId: string,
    id: string,
    data: {
      title?: string;
      dayOfWeek?: number;
      startTime?: string;
      endTime?: string;
      roomId?: string | null;
      teacherId?: string | null;
    },
  ) {
    const existing = await this.prisma.recurringEvent.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Recurring event not found');
    return this.prisma.recurringEvent.update({ where: { id }, data });
  }

  async deleteRecurringEvent(schoolId: string, id: string) {
    const existing = await this.prisma.recurringEvent.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Recurring event not found');
    return this.prisma.recurringEvent.delete({ where: { id } });
  }
}
