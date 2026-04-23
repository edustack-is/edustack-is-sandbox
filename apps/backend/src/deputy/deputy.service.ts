import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  UserRole,
  UserStatus,
  RoomSharing,
  Room,
  Building,
  School,
  User,
  SchoolMembership,
  Classroom,
  SubjectTemplate,
  AcademicYear,
  SchoolEvent,
  TeacherProfile,
  StudentProfile,
  ParentStudent,
  ThematicPlan,
  ThematicPlanWeek,
  LessonPreparation,
  TeachingMaterial,
  RvpCompetency,
  CompetencyMapping,
} from '../database/types';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';

@Injectable()
export class DeputyService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mailService: MailService,
  ) {}

  // ─── SCHOOL DASHBOARD ────────────────────────────────────────────

  async getSchoolDashboard(schoolId: string) {
    const [
      studentCountResult,
      teacherCountResult,
      classroomCountResult,
      subjectCountResult,
      roomCountResult,
      buildingCountResult,
      currentAcademicYear,
      recentMembers,
      upcomingEvents,
      totalMembersResult,
      pendingMembersResult,
    ] = await Promise.all([
      this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "SchoolMembership" WHERE schoolId = ? AND role = "STUDENT" AND status = "ACTIVE"',
        [schoolId],
      ),
      this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "SchoolMembership" WHERE schoolId = ? AND role = "TEACHER" AND status = "ACTIVE"',
        [schoolId],
      ),
      this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "Classroom" WHERE schoolId = ?',
        [schoolId],
      ),
      this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "SubjectTemplate" WHERE schoolId = ?',
        [schoolId],
      ),
      this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "Room" WHERE schoolId = ?',
        [schoolId],
      ),
      this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "Building" WHERE schoolId = ?',
        [schoolId],
      ),
      this.db.queryOne<AcademicYear>(
        'SELECT id, name, startDate, endDate FROM "AcademicYear" WHERE schoolId = ? AND isCurrent = 1 LIMIT 1',
        [schoolId],
      ),
      this.db.query(
        `SELECT m.*, u.id as userId, u.firstName, u.lastName, u.email 
         FROM "SchoolMembership" m 
         JOIN "User" u ON m.userId = u.id 
         WHERE m.schoolId = ? 
         ORDER BY m.createdAt DESC LIMIT 5`,
        [schoolId],
      ),
      this.db.query<SchoolEvent>(
        'SELECT * FROM "SchoolEvent" WHERE schoolId = ? AND date >= ? ORDER BY date ASC LIMIT 5',
        [schoolId, new Date().toISOString()],
      ),
      this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "SchoolMembership" WHERE schoolId = ?',
        [schoolId],
      ),
      this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "SchoolMembership" WHERE schoolId = ? AND status = "PENDING"',
        [schoolId],
      ),
    ]);

    return {
      studentCount: studentCountResult?.count || 0,
      teacherCount: teacherCountResult?.count || 0,
      classroomCount: classroomCountResult?.count || 0,
      subjectCount: subjectCountResult?.count || 0,
      roomCount: roomCountResult?.count || 0,
      buildingCount: buildingCountResult?.count || 0,
      totalMembers: totalMembersResult?.count || 0,
      pendingMembers: pendingMembersResult?.count || 0,
      currentAcademicYear,
      upcomingEvents,
      recentMembers: recentMembers.map((m: any) => ({
        id: m.userId,
        name: `${m.firstName} ${m.lastName}`,
        email: m.email,
        role: m.role,
        status: m.status,
        createdAt: m.createdAt,
      })),
    };
  }

  // ─── CLASSROOM CRUD ──────────────────────────────────────────────

  async getClassrooms(schoolId: string) {
    const classrooms = await this.db.query<Classroom>(
      'SELECT * FROM "Classroom" WHERE schoolId = ? ORDER BY grade ASC, name ASC',
      [schoolId],
    );

    const result = [];
    for (const classroom of classrooms) {
      const students = await this.db.query(
        `SELECT sp.*, u.firstName as userFirstName, u.lastName as userLastName 
         FROM "StudentProfile" sp 
         JOIN "User" u ON sp.userId = u.id 
         WHERE sp.classroomId = ?`,
        [classroom.id],
      );

      const homeroomTeacher = await this.db.queryOne(
        `SELECT tp.*, u.firstName as userFirstName, u.lastName as userLastName 
         FROM "TeacherProfile" tp 
         JOIN "User" u ON tp.userId = u.id 
         WHERE tp.homeroomClassId = ?`,
        [classroom.id],
      );

      result.push({
        ...classroom,
        students: students.map((s: any) => ({
          ...s,
          user: { firstName: s.userFirstName, lastName: s.userLastName },
        })),
        homeroomTeacher: homeroomTeacher
          ? {
              ...homeroomTeacher,
              user: {
                firstName: (homeroomTeacher as any).userFirstName,
                lastName: (homeroomTeacher as any).userLastName,
              },
            }
          : null,
      });
    }
    return result;
  }

  async createClassroom(
    actorId: string,
    schoolId: string,
    data: { name: string; grade: number },
  ) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "Classroom" (id, name, grade, schoolId) VALUES (?, ?, ?, ?)',
      [id, data.name, data.grade, schoolId],
    );

    const classroom = (await this.db.queryOne<Classroom>(
      'SELECT * FROM "Classroom" WHERE id = ?',
      [id],
    ))!;
    await this.audit(actorId, 'CREATE_CLASSROOM', 'Classroom', id, data);
    return classroom;
  }

  async updateClassroom(
    actorId: string,
    schoolId: string,
    id: string,
    data: { name?: string; grade?: number },
  ) {
    const existing = await this.db.queryOne<Classroom>(
      'SELECT * FROM "Classroom" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Classroom not found');

    const fields = [];
    const values = [];
    if (data.name !== undefined) {
      fields.push('"name" = ?');
      values.push(data.name);
    }
    if (data.grade !== undefined) {
      fields.push('"grade" = ?');
      values.push(data.grade);
    }

    if (fields.length > 0) {
      await this.db.execute(
        `UPDATE "Classroom" SET ${fields.join(', ')} WHERE id = ?`,
        [...values, id],
      );
    }

    const updated = (await this.db.queryOne<Classroom>(
      'SELECT * FROM "Classroom" WHERE id = ?',
      [id],
    ))!;
    await this.audit(
      actorId,
      'UPDATE_CLASSROOM',
      'Classroom',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteClassroom(actorId: string, schoolId: string, id: string) {
    const existing = await this.db.queryOne<Classroom>(
      'SELECT * FROM "Classroom" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Classroom not found');

    await this.db.execute('DELETE FROM "Classroom" WHERE id = ?', [id]);
    await this.audit(
      actorId,
      'DELETE_CLASSROOM',
      'Classroom',
      id,
      null,
      existing,
    );
    return { deleted: true };
  }

  // ─── SUBJECT CRUD ────────────────────────────────────────────────

  async getSubjects(schoolId: string) {
    return this.db.query<SubjectTemplate>(
      'SELECT * FROM "SubjectTemplate" WHERE schoolId = ? ORDER BY name ASC',
      [schoolId],
    );
  }

  async createSubject(
    actorId: string,
    schoolId: string,
    data: { name: string; code: string; svpDescription?: string },
  ) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "SubjectTemplate" (id, name, code, svpDescription, schoolId) VALUES (?, ?, ?, ?, ?)',
      [id, data.name, data.code, data.svpDescription || null, schoolId],
    );

    const subject = (await this.db.queryOne<SubjectTemplate>(
      'SELECT * FROM "SubjectTemplate" WHERE id = ?',
      [id],
    ))!;
    await this.audit(actorId, 'CREATE_SUBJECT', 'SubjectTemplate', id, data);
    return subject;
  }

  async updateSubject(
    actorId: string,
    schoolId: string,
    id: string,
    data: { name?: string; code?: string; svpDescription?: string },
  ) {
    const existing = await this.db.queryOne<SubjectTemplate>(
      'SELECT * FROM "SubjectTemplate" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Subject template not found');

    const fields = [];
    const values = [];
    if (data.name !== undefined) {
      fields.push('"name" = ?');
      values.push(data.name);
    }
    if (data.code !== undefined) {
      fields.push('"code" = ?');
      values.push(data.code);
    }
    if (data.svpDescription !== undefined) {
      fields.push('"svpDescription" = ?');
      values.push(data.svpDescription);
    }

    if (fields.length > 0) {
      await this.db.execute(
        `UPDATE "SubjectTemplate" SET ${fields.join(', ')} WHERE id = ?`,
        [...values, id],
      );
    }

    const updated = (await this.db.queryOne<SubjectTemplate>(
      'SELECT * FROM "SubjectTemplate" WHERE id = ?',
      [id],
    ))!;
    await this.audit(
      actorId,
      'UPDATE_SUBJECT',
      'SubjectTemplate',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteSubject(actorId: string, schoolId: string, id: string) {
    const existing = await this.db.queryOne<SubjectTemplate>(
      'SELECT * FROM "SubjectTemplate" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Subject template not found');

    await this.db.execute('DELETE FROM "SubjectTemplate" WHERE id = ?', [id]);
    await this.audit(
      actorId,
      'DELETE_SUBJECT',
      'SubjectTemplate',
      id,
      null,
      existing,
    );
    return { deleted: true };
  }

  // ─── ROOM CRUD ───────────────────────────────────────────────────

  async getRooms(schoolId: string) {
    const rooms = await this.db.query<Room>(
      'SELECT * FROM "Room" WHERE schoolId = ? ORDER BY name ASC',
      [schoolId],
    );

    const result = [];
    for (const room of rooms) {
      const building = room.buildingId
        ? await this.db.queryOne<{ id: string; name: string }>(
            'SELECT id, name FROM "Building" WHERE id = ?',
            [room.buildingId],
          )
        : null;
      result.push({ ...room, building });
    }
    return result;
  }

  async createRoom(
    actorId: string,
    schoolId: string,
    data: {
      name: string;
      capacity?: number;
      isComputerLab?: boolean;
      specialEquipment?: string[];
      buildingId?: string;
      floor?: number;
    },
  ) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "Room" (id, name, capacity, isComputerLab, specialEquipment, buildingId, floor, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.name,
        data.capacity ?? 30,
        data.isComputerLab ? 1 : 0,
        data.specialEquipment ? JSON.stringify(data.specialEquipment) : null,
        data.buildingId || null,
        data.floor ?? null,
        schoolId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    const room = (await this.db.queryOne<Room>(
      'SELECT * FROM "Room" WHERE id = ?',
      [id],
    ))!;
    await this.audit(actorId, 'CREATE_ROOM', 'Room', id, data);
    return room;
  }

  async updateRoom(
    actorId: string,
    schoolId: string,
    id: string,
    data: {
      name?: string;
      capacity?: number;
      isComputerLab?: boolean;
      specialEquipment?: string[];
      buildingId?: string | null;
      floor?: number | null;
    },
  ) {
    const existing = await this.db.queryOne<Room>(
      'SELECT * FROM "Room" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Room not found');

    const fields = ['updatedAt = ?'];
    const values: any[] = [new Date().toISOString()];

    if (data.name !== undefined) {
      fields.push('"name" = ?');
      values.push(data.name);
    }
    if (data.capacity !== undefined) {
      fields.push('"capacity" = ?');
      values.push(data.capacity);
    }
    if (data.isComputerLab !== undefined) {
      fields.push('"isComputerLab" = ?');
      values.push(data.isComputerLab ? 1 : 0);
    }
    if (data.specialEquipment !== undefined) {
      fields.push('"specialEquipment" = ?');
      values.push(JSON.stringify(data.specialEquipment));
    }
    if (data.buildingId !== undefined) {
      fields.push('"buildingId" = ?');
      values.push(data.buildingId);
    }
    if (data.floor !== undefined) {
      fields.push('"floor" = ?');
      values.push(data.floor);
    }

    await this.db.execute(
      `UPDATE "Room" SET ${fields.join(', ')} WHERE id = ?`,
      [...values, id],
    );

    const updated = (await this.db.queryOne<Room>(
      'SELECT * FROM "Room" WHERE id = ?',
      [id],
    ))!;
    await this.audit(actorId, 'UPDATE_ROOM', 'Room', id, data, existing);
    return updated;
  }

  async deleteRoom(actorId: string, schoolId: string, id: string) {
    const existing = await this.db.queryOne<Room>(
      'SELECT * FROM "Room" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Room not found');

    await this.db.execute('DELETE FROM "Room" WHERE id = ?', [id]);
    await this.audit(actorId, 'DELETE_ROOM', 'Room', id, null, existing);
    return { deleted: true };
  }

  // ─── BUILDING CRUD ───────────────────────────────────────────────

  async getBuildings(schoolId: string) {
    const buildings = await this.db.query<Building>(
      'SELECT * FROM "Building" WHERE schoolId = ? ORDER BY name ASC',
      [schoolId],
    );
    const result = [];
    for (const b of buildings) {
      const rooms = await this.db.query<{ id: string; name: string }>(
        'SELECT id, name FROM "Room" WHERE buildingId = ?',
        [b.id],
      );
      result.push({ ...b, rooms });
    }
    return result;
  }

  async createBuilding(
    actorId: string,
    schoolId: string,
    data: { name: string; address?: string; floors?: number },
  ) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "Building" (id, name, address, floors, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.name,
        data.address || null,
        data.floors ?? 1,
        schoolId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    const building = (await this.db.queryOne<Building>(
      'SELECT * FROM "Building" WHERE id = ?',
      [id],
    ))!;
    await this.audit(actorId, 'CREATE_BUILDING', 'Building', id, data);
    return building;
  }

  async updateBuilding(
    actorId: string,
    schoolId: string,
    id: string,
    data: { name?: string; address?: string; floors?: number },
  ) {
    const existing = await this.db.queryOne<Building>(
      'SELECT * FROM "Building" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Building not found');

    const fields = ['updatedAt = ?'];
    const values: any[] = [new Date().toISOString()];

    if (data.name !== undefined) {
      fields.push('"name" = ?');
      values.push(data.name);
    }
    if (data.address !== undefined) {
      fields.push('"address" = ?');
      values.push(data.address);
    }
    if (data.floors !== undefined) {
      fields.push('"floors" = ?');
      values.push(data.floors);
    }

    await this.db.execute(
      `UPDATE "Building" SET ${fields.join(', ')} WHERE id = ?`,
      [...values, id],
    );

    const updated = (await this.db.queryOne<Building>(
      'SELECT * FROM "Building" WHERE id = ?',
      [id],
    ))!;
    await this.audit(
      actorId,
      'UPDATE_BUILDING',
      'Building',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteBuilding(actorId: string, schoolId: string, id: string) {
    const existing = await this.db.queryOne<Building>(
      'SELECT * FROM "Building" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Building not found');

    await this.db.execute('DELETE FROM "Building" WHERE id = ?', [id]);
    await this.audit(
      actorId,
      'DELETE_BUILDING',
      'Building',
      id,
      null,
      existing,
    );
    return { deleted: true };
  }

  // ─── ROOM SHARING ────────────────────────────────────────────────

  async shareRoom(
    actorId: string,
    schoolId: string,
    roomId: string,
    targetSchoolId: string,
  ) {
    const room = await this.db.queryOne<Room>(
      'SELECT * FROM "Room" WHERE id = ? AND schoolId = ?',
      [roomId, schoolId],
    );
    if (!room) throw new NotFoundException('Room not found in your school');
    if (schoolId === targetSchoolId)
      throw new BadRequestException('Cannot share room with the same school');

    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "RoomSharing" (id, roomId, sharedWithSchoolId, createdAt) VALUES (?, ?, ?, ?)',
      [id, roomId, targetSchoolId, new Date().toISOString()],
    );

    const sharing = (await this.db.queryOne<RoomSharing>(
      'SELECT * FROM "RoomSharing" WHERE id = ?',
      [id],
    ))!;
    await this.audit(actorId, 'SHARE_ROOM', 'RoomSharing', id, {
      roomId,
      targetSchoolId,
    });
    return sharing;
  }

  async unshareRoom(
    actorId: string,
    schoolId: string,
    roomId: string,
    targetSchoolId: string,
  ) {
    const room = await this.db.queryOne<Room>(
      'SELECT * FROM "Room" WHERE id = ? AND schoolId = ?',
      [roomId, schoolId],
    );
    if (!room) throw new NotFoundException('Room not found in your school');

    const sharing = await this.db.queryOne<RoomSharing>(
      'SELECT * FROM "RoomSharing" WHERE roomId = ? AND sharedWithSchoolId = ?',
      [roomId, targetSchoolId],
    );
    if (!sharing) throw new NotFoundException('Sharing not found');

    await this.db.execute('DELETE FROM "RoomSharing" WHERE id = ?', [
      sharing.id,
    ]);
    await this.audit(actorId, 'UNSHARE_ROOM', 'RoomSharing', sharing.id, {
      roomId,
      targetSchoolId,
    });
    return { deleted: true };
  }

  async getSharedRooms(schoolId: string) {
    const sharings = await this.db.query(
      `SELECT rs.*, r.name as roomName, r.capacity, r.schoolId as ownerId, s.name as ownerName, b.name as buildingName 
       FROM "RoomSharing" rs 
       JOIN "Room" r ON rs.roomId = r.id 
       JOIN "School" s ON r.schoolId = s.id 
       LEFT JOIN "Building" b ON r.buildingId = b.id 
       WHERE rs.sharedWithSchoolId = ?`,
      [schoolId],
    );

    return sharings.map((s: any) => ({
      id: s.id,
      room: {
        id: s.roomId,
        name: s.roomName,
        capacity: s.capacity,
        school: { id: s.ownerId, name: s.ownerName },
        building: s.buildingName ? { name: s.buildingName } : null,
      },
      ownerSchool: { id: s.ownerId, name: s.ownerName },
    }));
  }

  async getRoomSharingsForRoom(roomId: string) {
    return this.db.query(
      `SELECT rs.*, s.id as schoolId, s.name as schoolName 
       FROM "RoomSharing" rs 
       JOIN "School" s ON rs.sharedWithSchoolId = s.id 
       WHERE rs.roomId = ?`,
      [roomId],
    );
  }

  // ─── SCHOOL EVENT CRUD ───────────────────────────────────────────

  async getEvents(schoolId: string) {
    return this.db.query<SchoolEvent>(
      'SELECT * FROM "SchoolEvent" WHERE schoolId = ? ORDER BY date ASC',
      [schoolId],
    );
  }

  async getUpcomingEvents(schoolId: string, limit = 10) {
    return this.db.query<SchoolEvent>(
      'SELECT * FROM "SchoolEvent" WHERE schoolId = ? AND date >= ? ORDER BY date ASC LIMIT ?',
      [schoolId, new Date().toISOString(), limit],
    );
  }

  async createEvent(
    actorId: string,
    schoolId: string,
    data: {
      title: string;
      description?: string;
      date: string;
      endDate?: string;
      type?: string;
      allDay?: boolean;
    },
  ) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "SchoolEvent" (id, title, description, date, endDate, type, allDay, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.title,
        data.description || null,
        new Date(data.date).toISOString(),
        data.endDate ? new Date(data.endDate).toISOString() : null,
        data.type ?? 'OTHER',
        (data.allDay ?? true) ? 1 : 0,
        schoolId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    const event = (await this.db.queryOne<SchoolEvent>(
      'SELECT * FROM "SchoolEvent" WHERE id = ?',
      [id],
    ))!;
    await this.audit(actorId, 'CREATE_EVENT', 'SchoolEvent', id, data);
    return event;
  }

  async updateEvent(
    actorId: string,
    schoolId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      date?: string;
      endDate?: string;
      type?: string;
      allDay?: boolean;
    },
  ) {
    const existing = await this.db.queryOne<SchoolEvent>(
      'SELECT * FROM "SchoolEvent" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Event not found');

    const fields = ['updatedAt = ?'];
    const values: any[] = [new Date().toISOString()];

    if (data.title !== undefined) {
      fields.push('"title" = ?');
      values.push(data.title);
    }
    if (data.description !== undefined) {
      fields.push('"description" = ?');
      values.push(data.description);
    }
    if (data.date !== undefined) {
      fields.push('"date" = ?');
      values.push(new Date(data.date).toISOString());
    }
    if (data.endDate !== undefined) {
      fields.push('"endDate" = ?');
      values.push(data.endDate ? new Date(data.endDate).toISOString() : null);
    }
    if (data.type !== undefined) {
      fields.push('"type" = ?');
      values.push(data.type);
    }
    if (data.allDay !== undefined) {
      fields.push('"allDay" = ?');
      values.push(data.allDay ? 1 : 0);
    }

    await this.db.execute(
      `UPDATE "SchoolEvent" SET ${fields.join(', ')} WHERE id = ?`,
      [...values, id],
    );

    const updated = (await this.db.queryOne<SchoolEvent>(
      'SELECT * FROM "SchoolEvent" WHERE id = ?',
      [id],
    ))!;
    await this.audit(
      actorId,
      'UPDATE_EVENT',
      'SchoolEvent',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteEvent(actorId: string, schoolId: string, id: string) {
    const existing = await this.db.queryOne<SchoolEvent>(
      'SELECT * FROM "SchoolEvent" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Event not found');

    await this.db.execute('DELETE FROM "SchoolEvent" WHERE id = ?', [id]);
    await this.audit(
      actorId,
      'DELETE_EVENT',
      'SchoolEvent',
      id,
      null,
      existing,
    );
    return { deleted: true };
  }

  // ─── USER INVITATION ─────────────────────────────────────────────

  async inviteUser(
    actorId: string,
    schoolId: string,
    data: {
      email: string;
      firstName: string;
      lastName: string;
      role: UserRole;
      workloadPercentage?: number;
    },
  ) {
    if (!['TEACHER', 'STUDENT', 'DEPUTY', 'PRINCIPAL'].includes(data.role)) {
      throw new BadRequestException(
        'Can only invite TEACHER, STUDENT, DEPUTY, or PRINCIPAL roles.',
      );
    }

    if (data.role === UserRole.PRINCIPAL) {
      const existingPrincipal = await this.db.queryOne(
        'SELECT id FROM "SchoolMembership" WHERE schoolId = ? AND role = "PRINCIPAL"',
        [schoolId],
      );
      if (existingPrincipal) {
        throw new BadRequestException(
          'This school already has a principal. Only one principal per school is allowed.',
        );
      }
    }

    let user = await this.db.queryOne<User>(
      'SELECT * FROM "User" WHERE email = ?',
      [data.email],
    );

    const invitationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(invitationToken, 10);
    const invitationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    return this.db.transaction(async (db) => {
      if (!user) {
        const userId = crypto.randomUUID();
        await db.execute(
          'INSERT INTO "User" (id, email, firstName, lastName, invitationToken, invitationExpires, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            userId,
            data.email,
            data.firstName,
            data.lastName,
            hashedToken,
            invitationExpires.toISOString(),
            new Date().toISOString(),
          ],
        );
        user = (await db.queryOne<User>('SELECT * FROM "User" WHERE id = ?', [
          userId,
        ]))!;
      } else {
        await db.execute(
          'UPDATE "User" SET invitationToken = ?, invitationExpires = ? WHERE id = ?',
          [hashedToken, invitationExpires.toISOString(), user.id],
        );
      }

      const existingMembership = await db.queryOne(
        'SELECT id FROM "SchoolMembership" WHERE userId = ? AND schoolId = ?',
        [user.id, schoolId],
      );
      if (existingMembership) {
        await db.execute(
          'UPDATE "SchoolMembership" SET role = ?, status = ?, workloadPercentage = ?, updatedAt = ? WHERE id = ?',
          [
            data.role,
            'PENDING',
            data.workloadPercentage ?? null,
            new Date().toISOString(),
            existingMembership.id,
          ],
        );
      } else {
        await db.execute(
          'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, workloadPercentage, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            user.id,
            schoolId,
            data.role,
            'PENDING',
            data.workloadPercentage ?? null,
            new Date().toISOString(),
            new Date().toISOString(),
          ],
        );
      }

      if (data.role === UserRole.TEACHER) {
        const existingProfile = await db.queryOne(
          'SELECT id FROM "TeacherProfile" WHERE userId = ?',
          [user.id],
        );
        if (!existingProfile) {
          await db.execute(
            'INSERT INTO "TeacherProfile" (id, userId) VALUES (?, ?)',
            [crypto.randomUUID(), user.id],
          );
        }
      } else if (data.role === UserRole.STUDENT) {
        const existingProfile = await db.queryOne(
          'SELECT id FROM "StudentProfile" WHERE userId = ?',
          [user.id],
        );
        if (!existingProfile) {
          await db.execute(
            'INSERT INTO "StudentProfile" (id, userId, firstName, lastName) VALUES (?, ?, ?, ?)',
            [crypto.randomUUID(), user.id, data.firstName, data.lastName],
          );
        }
      }

      const fullToken = `${user.id}.${invitationToken}`;
      this.mailService
        .sendInvitation(
          user.email,
          `${user.firstName} ${user.lastName}`,
          fullToken,
        )
        .catch((e) => console.error('Failed to send invitation email', e));

      await this.audit(actorId, 'INVITE_USER', 'User', user.id, {
        email: data.email,
        role: data.role,
        workloadPercentage: data.workloadPercentage,
      });

      return { token: fullToken, userId: user.id };
    });
  }

  // ─── SCHOOL-SCOPED USER LIST ────────────────────────────────────

  async getSchoolUsers(schoolId: string) {
    const memberships = await this.db.query(
      `SELECT m.*, u.firstName, u.lastName, u.email, u.lastLogin, u.createdAt as userCreatedAt 
       FROM "SchoolMembership" m 
       JOIN "User" u ON m.userId = u.id 
       WHERE m.schoolId = ? 
       ORDER BY m.createdAt DESC`,
      [schoolId],
    );

    const result = [];
    for (const m of memberships) {
      const studentProfile = await this.db.queryOne(
        `SELECT sp.id, c.id as classroomId, c.name as classroomName 
         FROM "StudentProfile" sp 
         LEFT JOIN "Classroom" c ON sp.classroomId = c.id 
         WHERE sp.userId = ?`,
        [m.userId],
      );

      const teacherProfile = await this.db.queryOne(
        `SELECT tp.id, c.id as classroomId, c.name as classroomName 
         FROM "TeacherProfile" tp 
         LEFT JOIN "Classroom" c ON tp.homeroomClassId = c.id 
         WHERE tp.userId = ?`,
        [m.userId],
      );

      const parents = await this.db.query(
        `SELECT u.id, u.firstName, u.lastName 
         FROM "ParentStudent" ps 
         JOIN "User" u ON ps.parentId = u.id 
         WHERE ps.studentId = ?`,
        [m.userId],
      );

      const children = await this.db.query(
        `SELECT u.id, u.firstName, u.lastName 
         FROM "ParentStudent" ps 
         JOIN "User" u ON ps.studentId = u.id 
         WHERE ps.parentId = ?`,
        [m.userId],
      );

      result.push({
        id: m.userId,
        membershipId: m.id,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        role: m.role,
        status: m.status,
        workloadPercentage: m.workloadPercentage,
        lastLogin: m.lastLogin,
        createdAt: m.userCreatedAt,
        classroomName: (studentProfile as any)?.classroomName || null,
        classroomId: (studentProfile as any)?.classroomId || null,
        homeroomClassName: (teacherProfile as any)?.classroomName || null,
        teacherProfileId: (teacherProfile as any)?.id || null,
        parents: parents.map((p: any) => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
        })),
        children: children.map((c: any) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
        })),
      });
    }
    return result;
  }

  // ─── CREATE STUDENT + FAMILY ────────────────────────────────────

  async createStudentFamily(
    actorId: string,
    schoolId: string,
    data: {
      student: { firstName: string; lastName: string; email?: string };
      parents: Array<{
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
      }>;
    },
  ) {
    return this.db.transaction(async (db) => {
      const studentEmail =
        data.student.email || `student-${crypto.randomUUID()}@noemail.local`;
      const studentInvitationToken = data.student.email
        ? crypto.randomBytes(32).toString('hex')
        : null;
      const studentHashedToken = studentInvitationToken
        ? await bcrypt.hash(studentInvitationToken, 10)
        : null;
      const invitationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const studentId = crypto.randomUUID();
      await db.execute(
        'INSERT INTO "User" (id, email, firstName, lastName, invitationToken, invitationExpires, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          studentId,
          studentEmail,
          data.student.firstName,
          data.student.lastName,
          studentHashedToken,
          studentInvitationToken ? invitationExpires.toISOString() : null,
          new Date().toISOString(),
        ],
      );

      await db.execute(
        'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          studentId,
          schoolId,
          'STUDENT',
          'PENDING',
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );

      await db.execute(
        'INSERT INTO "StudentProfile" (id, userId, firstName, lastName) VALUES (?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          studentId,
          data.student.firstName,
          data.student.lastName,
        ],
      );

      const createdParents = [];
      for (const parentData of data.parents) {
        let parentUser = await db.queryOne<User>(
          'SELECT * FROM "User" WHERE email = ?',
          [parentData.email],
        );
        const parentInvitationToken = crypto.randomBytes(32).toString('hex');
        const parentHashedToken = await bcrypt.hash(parentInvitationToken, 10);

        if (!parentUser) {
          const pId = crypto.randomUUID();
          await db.execute(
            'INSERT INTO "User" (id, email, firstName, lastName, invitationToken, invitationExpires, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              pId,
              parentData.email,
              parentData.firstName,
              parentData.lastName,
              parentHashedToken,
              invitationExpires.toISOString(),
              new Date().toISOString(),
            ],
          );
          parentUser = (await db.queryOne<User>(
            'SELECT * FROM "User" WHERE id = ?',
            [pId],
          ))!;
        } else {
          await db.execute(
            'UPDATE "User" SET invitationToken = ?, invitationExpires = ? WHERE id = ?',
            [parentHashedToken, invitationExpires.toISOString(), parentUser.id],
          );
        }

        const existingMembership = await db.queryOne(
          'SELECT id FROM "SchoolMembership" WHERE userId = ? AND schoolId = ?',
          [parentUser.id, schoolId],
        );
        if (!existingMembership) {
          await db.execute(
            'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              crypto.randomUUID(),
              parentUser.id,
              schoolId,
              'PARENT',
              'PENDING',
              new Date().toISOString(),
              new Date().toISOString(),
            ],
          );
        }

        await db.execute(
          'INSERT INTO "ParentStudent" (id, parentId, studentId, createdAt) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM "ParentStudent" WHERE parentId = ? AND studentId = ?)',
          [
            crypto.randomUUID(),
            parentUser.id,
            studentId,
            new Date().toISOString(),
            parentUser.id,
            studentId,
          ],
        );

        const fullParentToken = `${parentUser.id}.${parentInvitationToken}`;
        createdParents.push({
          userId: parentUser.id,
          email: parentData.email,
          token: fullParentToken,
        });

        this.mailService
          .sendInvitation(
            parentData.email,
            `${parentData.firstName} ${parentData.lastName}`,
            fullParentToken,
          )
          .catch((e) =>
            console.error('Failed to send parent invitation email', e),
          );
      }

      await db.execute(
        'INSERT INTO "AuditLog" (id, actorId, action, entity, entityId, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          actorId,
          'CREATE_STUDENT_FAMILY',
          'User',
          studentId,
          JSON.stringify({
            student: data.student,
            parentCount: data.parents.length,
          }),
          new Date().toISOString(),
        ],
      );

      if (studentInvitationToken) {
        this.mailService
          .sendInvitation(
            studentEmail,
            `${data.student.firstName} ${data.student.lastName}`,
            `${studentId}.${studentInvitationToken}`,
          )
          .catch((e) =>
            console.error('Failed to send student invitation email', e),
          );
      }

      return {
        student: { id: studentId, email: studentEmail },
        parents: createdParents,
        studentToken: studentInvitationToken
          ? `${studentId}.${studentInvitationToken}`
          : null,
      };
    });
  }

  // ─── CREATE STAFF ───────────────────────────────────────────────

  async createStaff(
    actorId: string,
    schoolId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      role: 'TEACHER' | 'DEPUTY';
      workloadPercentage: number;
    },
  ) {
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(invitationToken, 10);
    const invitationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    return this.db.transaction(async (db) => {
      let user = await db.queryOne<User>(
        'SELECT * FROM "User" WHERE email = ?',
        [data.email],
      );

      if (!user) {
        const uId = crypto.randomUUID();
        await db.execute(
          'INSERT INTO "User" (id, email, firstName, lastName, invitationToken, invitationExpires, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            uId,
            data.email,
            data.firstName,
            data.lastName,
            hashedToken,
            invitationExpires.toISOString(),
            new Date().toISOString(),
          ],
        );
        user = (await db.queryOne<User>('SELECT * FROM "User" WHERE id = ?', [
          uId,
        ]))!;
      } else {
        await db.execute(
          'UPDATE "User" SET invitationToken = ?, invitationExpires = ? WHERE id = ?',
          [hashedToken, invitationExpires.toISOString(), user.id],
        );
      }

      const existingMembership = await db.queryOne(
        'SELECT id FROM "SchoolMembership" WHERE userId = ? AND schoolId = ?',
        [user.id, schoolId],
      );
      if (existingMembership) {
        await db.execute(
          'UPDATE "SchoolMembership" SET role = ?, status = ?, workloadPercentage = ?, updatedAt = ? WHERE id = ?',
          [
            data.role,
            'PENDING',
            data.workloadPercentage,
            new Date().toISOString(),
            existingMembership.id,
          ],
        );
      } else {
        await db.execute(
          'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, workloadPercentage, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            user.id,
            schoolId,
            data.role,
            'PENDING',
            data.workloadPercentage,
            new Date().toISOString(),
            new Date().toISOString(),
          ],
        );
      }

      if (data.role === 'TEACHER') {
        const existingProfile = await db.queryOne(
          'SELECT id FROM "TeacherProfile" WHERE userId = ?',
          [user.id],
        );
        if (!existingProfile) {
          await db.execute(
            'INSERT INTO "TeacherProfile" (id, userId) VALUES (?, ?)',
            [crypto.randomUUID(), user.id],
          );
        }
      }

      const fullToken = `${user.id}.${invitationToken}`;
      this.mailService
        .sendInvitation(
          user.email,
          `${user.firstName} ${user.lastName}`,
          fullToken,
        )
        .catch((e) => console.error('Failed to send invitation email', e));

      await this.audit(actorId, 'CREATE_STAFF', 'User', user.id, {
        email: data.email,
        role: data.role,
        workloadPercentage: data.workloadPercentage,
      });

      return { token: fullToken, userId: user.id };
    });
  }

  async resendInvitation(actorId: string, schoolId: string, userId: string) {
    const membership = await this.db.queryOne(
      'SELECT m.*, u.email, u.firstName, u.lastName FROM "SchoolMembership" m JOIN "User" u ON m.userId = u.id WHERE m.userId = ? AND m.schoolId = ?',
      [userId, schoolId],
    );
    if (!membership)
      throw new NotFoundException('User not found in this school');
    if ((membership as any).status !== 'PENDING')
      throw new BadRequestException('User is already active or not pending');

    const invitationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(invitationToken, 10);
    const invitationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await this.db.execute(
      'UPDATE "User" SET invitationToken = ?, invitationExpires = ? WHERE id = ?',
      [hashedToken, invitationExpires.toISOString(), userId],
    );

    const fullToken = `${userId}.${invitationToken}`;
    this.mailService
      .sendInvitation(
        (membership as any).email,
        `${(membership as any).firstName} ${(membership as any).lastName}`,
        fullToken,
      )
      .catch((e) => console.error('Failed to resend invitation email', e));

    await this.audit(actorId, 'RESEND_INVITATION', 'User', userId, {
      email: (membership as any).email,
    });

    return { success: true };
  }

  // ─── REMOVE USER FROM SCHOOL ────────────────────────────────────

  async removeSchoolUser(
    actorId: string,
    schoolId: string,
    targetUserId: string,
  ) {
    const membership = await this.db.queryOne(
      'SELECT m.*, u.email FROM "SchoolMembership" m JOIN "User" u ON m.userId = u.id WHERE m.userId = ? AND m.schoolId = ?',
      [targetUserId, schoolId],
    );
    if (!membership)
      throw new NotFoundException('User is not a member of this school.');
    if (actorId === targetUserId)
      throw new BadRequestException('Cannot remove yourself from the school.');
    if ((membership as any).role === 'PRINCIPAL')
      throw new BadRequestException(
        'Cannot remove the principal. Contact system admin.',
      );

    await this.db.execute(
      'UPDATE "SchoolMembership" SET status = "ARCHIVED", updatedAt = ? WHERE id = ?',
      [new Date().toISOString(), (membership as any).id],
    );

    await this.audit(
      actorId,
      'REMOVE_SCHOOL_USER',
      'SchoolMembership',
      (membership as any).id,
      {
        userId: targetUserId,
        email: (membership as any).email,
        role: (membership as any).role,
        newStatus: 'ARCHIVED',
      },
    );

    return {
      message: `User ${(membership as any).email} has been removed from the school.`,
    };
  }

  // ─── SET STUDENT AS ALUMNI ────────────────────────────────────────

  async setAlumniStatus(
    actorId: string,
    schoolId: string,
    targetUserId: string,
  ) {
    const membership = await this.db.queryOne(
      'SELECT m.*, u.firstName, u.lastName, u.email FROM "SchoolMembership" m JOIN "User" u ON m.userId = u.id WHERE m.userId = ? AND m.schoolId = ?',
      [targetUserId, schoolId],
    );
    if (!membership)
      throw new NotFoundException('User is not a member of this school.');
    if ((membership as any).role !== 'STUDENT')
      throw new BadRequestException('Only students can be set as alumni.');
    if ((membership as any).status === 'ALUMNI')
      throw new BadRequestException('User is already marked as alumni.');

    const oldStatus = (membership as any).status;
    await this.db.execute(
      'UPDATE "SchoolMembership" SET status = "ALUMNI", updatedAt = ? WHERE id = ?',
      [new Date().toISOString(), (membership as any).id],
    );

    await this.audit(
      actorId,
      'SET_ALUMNI',
      'SchoolMembership',
      (membership as any).id,
      {
        userId: targetUserId,
        email: (membership as any).email,
        newStatus: 'ALUMNI',
      },
      { oldStatus },
    );

    return {
      message: `Student ${(membership as any).firstName} ${(membership as any).lastName} has been marked as alumni.`,
    };
  }

  // ─── IMPERSONATE SCHOOL USER (read-only) ─────────────────────────

  async impersonateSchoolUser(
    actorId: string,
    schoolId: string,
    targetUserId: string,
    jwtService: any,
  ) {
    const membership = await this.db.queryOne(
      'SELECT m.*, u.email FROM "SchoolMembership" m JOIN "User" u ON m.userId = u.id WHERE m.userId = ? AND m.schoolId = ?',
      [targetUserId, schoolId],
    );
    if (!membership)
      throw new NotFoundException('User is not a member of this school.');
    if (['PRINCIPAL', 'DEPUTY'].includes((membership as any).role))
      throw new BadRequestException('Cannot impersonate school management.');

    await this.audit(actorId, 'IMPERSONATE_SCHOOL_USER', 'User', targetUserId, {
      email: (membership as any).email,
      role: (membership as any).role,
      schoolId,
      readOnly: true,
    });

    const payload = {
      sub: targetUserId,
      email: (membership as any).email,
      schoolId,
      role: (membership as any).role,
      type: 'TENANT',
      isImpersonated: true,
      readOnly: true,
      actorId,
    };

    return { access_token: jwtService.sign(payload) };
  }

  // ─── UPDATE SCHOOL USER ────────────────────────────────────────────

  async updateSchoolUser(
    actorId: string,
    schoolId: string,
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      workloadPercentage?: number;
    },
  ) {
    const membership = await this.db.queryOne(
      'SELECT m.*, u.firstName, u.lastName, u.email FROM "SchoolMembership" m JOIN "User" u ON m.userId = u.id WHERE m.userId = ? AND m.schoolId = ?',
      [userId, schoolId],
    );
    if (!membership)
      throw new NotFoundException('User is not a member of this school.');

    const oldValues = {
      firstName: (membership as any).firstName,
      lastName: (membership as any).lastName,
      email: (membership as any).email,
      workloadPercentage: (membership as any).workloadPercentage,
    };

    const userFields = [];
    const userValues = [];
    if (data.firstName !== undefined) {
      userFields.push('firstName = ?');
      userValues.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      userFields.push('lastName = ?');
      userValues.push(data.lastName);
    }
    if (data.email !== undefined) {
      userFields.push('email = ?');
      userValues.push(data.email);
    }

    if (userFields.length > 0) {
      await this.db.execute(
        `UPDATE "User" SET ${userFields.join(', ')} WHERE id = ?`,
        [...userValues, userId],
      );
    }

    if (data.workloadPercentage !== undefined) {
      await this.db.execute(
        'UPDATE "SchoolMembership" SET workloadPercentage = ?, updatedAt = ? WHERE id = ?',
        [
          data.workloadPercentage,
          new Date().toISOString(),
          (membership as any).id,
        ],
      );
    }

    if (
      (membership as any).role === 'STUDENT' &&
      (data.firstName || data.lastName)
    ) {
      const spFields = [];
      const spValues = [];
      if (data.firstName) {
        spFields.push('firstName = ?');
        spValues.push(data.firstName);
      }
      if (data.lastName) {
        spFields.push('lastName = ?');
        spValues.push(data.lastName);
      }
      await this.db.execute(
        `UPDATE "StudentProfile" SET ${spFields.join(', ')} WHERE userId = ?`,
        [...spValues, userId],
      );
    }

    await this.audit(
      actorId,
      'UPDATE_SCHOOL_USER',
      'User',
      userId,
      data,
      oldValues,
    );
    return { success: true };
  }

  // ─── SUSPEND / REACTIVATE USER ───────────────────────────────────

  async suspendUser(actorId: string, schoolId: string, userId: string) {
    const membership = await this.db.queryOne(
      'SELECT m.*, u.firstName, u.lastName FROM "SchoolMembership" m JOIN "User" u ON m.userId = u.id WHERE m.userId = ? AND m.schoolId = ?',
      [userId, schoolId],
    );
    if (!membership)
      throw new NotFoundException('User not found in this school.');
    if ((membership as any).role === 'PRINCIPAL')
      throw new BadRequestException('Cannot suspend the principal.');
    if (actorId === userId)
      throw new BadRequestException('Cannot suspend yourself.');
    if ((membership as any).status === 'SUSPENDED')
      throw new BadRequestException('User is already suspended.');

    await this.db.execute(
      'UPDATE "SchoolMembership" SET status = "SUSPENDED", updatedAt = ? WHERE id = ?',
      [new Date().toISOString(), (membership as any).id],
    );

    await this.audit(
      actorId,
      'SUSPEND_USER',
      'SchoolMembership',
      (membership as any).id,
      { userId, newStatus: 'SUSPENDED' },
      { oldStatus: (membership as any).status },
    );

    return {
      message: `User ${(membership as any).firstName} ${(membership as any).lastName} has been suspended.`,
    };
  }

  async reactivateUser(actorId: string, schoolId: string, userId: string) {
    const membership = await this.db.queryOne(
      'SELECT m.*, u.firstName, u.lastName FROM "SchoolMembership" m JOIN "User" u ON m.userId = u.id WHERE m.userId = ? AND m.schoolId = ?',
      [userId, schoolId],
    );
    if (!membership)
      throw new NotFoundException('User not found in this school.');
    if ((membership as any).status !== 'SUSPENDED')
      throw new BadRequestException('User is not suspended.');

    await this.db.execute(
      'UPDATE "SchoolMembership" SET status = "ACTIVE", updatedAt = ? WHERE id = ?',
      [new Date().toISOString(), (membership as any).id],
    );

    await this.audit(
      actorId,
      'REACTIVATE_USER',
      'SchoolMembership',
      (membership as any).id,
      { userId, newStatus: 'ACTIVE' },
      { oldStatus: 'SUSPENDED' },
    );

    return {
      message: `User ${(membership as any).firstName} ${(membership as any).lastName} has been reactivated.`,
    };
  }

  // ─── CHANGE USER ROLE ────────────────────────────────────────────

  async changeUserRole(
    actorId: string,
    schoolId: string,
    userId: string,
    newRole: string,
  ) {
    const validRoles = ['TEACHER', 'STUDENT', 'DEPUTY', 'PARENT'];
    if (!validRoles.includes(newRole))
      throw new BadRequestException(
        `Invalid role. Allowed: ${validRoles.join(', ')}`,
      );

    const membership = await this.db.queryOne(
      'SELECT m.*, u.firstName, u.lastName FROM "SchoolMembership" m JOIN "User" u ON m.userId = u.id WHERE m.userId = ? AND m.schoolId = ?',
      [userId, schoolId],
    );
    if (!membership)
      throw new NotFoundException('User not found in this school.');
    if ((membership as any).role === 'PRINCIPAL')
      throw new BadRequestException('Cannot change the principal role.');
    if (actorId === userId)
      throw new BadRequestException('Cannot change your own role.');

    const oldRole = (membership as any).role;
    await this.db.execute(
      'UPDATE "SchoolMembership" SET role = ?, updatedAt = ? WHERE id = ?',
      [newRole, new Date().toISOString(), (membership as any).id],
    );

    if (newRole === 'TEACHER') {
      const existing = await this.db.queryOne(
        'SELECT id FROM "TeacherProfile" WHERE userId = ?',
        [userId],
      );
      if (!existing)
        await this.db.execute(
          'INSERT INTO "TeacherProfile" (id, userId) VALUES (?, ?)',
          [crypto.randomUUID(), userId],
        );
    } else if (newRole === 'STUDENT') {
      const existing = await this.db.queryOne(
        'SELECT id FROM "StudentProfile" WHERE userId = ?',
        [userId],
      );
      if (!existing) {
        await this.db.execute(
          'INSERT INTO "StudentProfile" (id, userId, firstName, lastName) VALUES (?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            userId,
            (membership as any).firstName,
            (membership as any).lastName,
          ],
        );
      }
    }

    await this.audit(
      actorId,
      'CHANGE_USER_ROLE',
      'SchoolMembership',
      (membership as any).id,
      { userId, newRole },
      { oldRole },
    );

    return { success: true, newRole };
  }

  // ─── EXPORT USERS CSV ────────────────────────────────────────────

  async exportUsersCSV(schoolId: string): Promise<string> {
    const memberships = await this.db.query(
      `SELECT m.role, m.status, m.workloadPercentage, u.firstName, u.lastName, u.email, u.lastLogin, u.createdAt 
       FROM "SchoolMembership" m 
       JOIN "User" u ON m.userId = u.id 
       WHERE m.schoolId = ? 
       ORDER BY u.createdAt DESC`,
      [schoolId],
    );

    const header =
      'Příjmení;Jméno;Email;Role;Status;Úvazek;Poslední přihlášení;Datum vytvoření';
    const rows = memberships.map((m: any) =>
      [
        m.lastName,
        m.firstName,
        m.email,
        m.role,
        m.status,
        m.workloadPercentage ?? '',
        m.lastLogin ? new Date(m.lastLogin).toISOString() : '',
        new Date(m.createdAt).toISOString(),
      ].join(';'),
    );

    return [header, ...rows].join('\n');
  }

  // ─── THEMATIC PLANS ──────────────────────────────────────────────

  async getThematicPlans(schoolId: string) {
    const plans = await this.db.query(
      `SELECT tp.*, st.name as subjectName, st.code as subjectCode, ay.name as yearName, gl.name as gradeName, 
              u.firstName, u.lastName, (SELECT COUNT(*) FROM "ThematicPlanWeek" WHERE planId = tp.id) as weekCount 
       FROM "ThematicPlan" tp 
       JOIN "SubjectTemplate" st ON tp.subjectTemplateId = st.id 
       JOIN "AcademicYear" ay ON tp.academicYearId = ay.id 
       JOIN "GradeLevel" gl ON tp.gradeLevelId = gl.id 
       JOIN "User" u ON tp.teacherId = u.id 
       WHERE tp.schoolId = ? 
       ORDER BY tp.createdAt DESC`,
      [schoolId],
    );

    return plans.map((p: any) => ({
      ...p,
      subjectTemplate: {
        id: p.subjectTemplateId,
        name: p.subjectName,
        code: p.subjectCode,
      },
      academicYear: { id: p.academicYearId, name: p.yearName },
      gradeLevel: { id: p.gradeLevelId, name: p.gradeName },
      teacher: {
        id: p.teacherId,
        firstName: p.firstName,
        lastName: p.lastName,
      },
      _count: { weeks: p.weekCount },
    }));
  }

  async getThematicPlan(schoolId: string, id: string) {
    const plan = await this.db.queryOne(
      `SELECT tp.*, st.name as subjectName, st.code as subjectCode, ay.name as yearName, gl.name as gradeName, 
              u.firstName, u.lastName 
       FROM "ThematicPlan" tp 
       JOIN "SubjectTemplate" st ON tp.subjectTemplateId = st.id 
       JOIN "AcademicYear" ay ON tp.academicYearId = ay.id 
       JOIN "GradeLevel" gl ON tp.gradeLevelId = gl.id 
       JOIN "User" u ON tp.teacherId = u.id 
       WHERE tp.id = ? AND tp.schoolId = ?`,
      [id, schoolId],
    );
    if (!plan) throw new NotFoundException('Thematic plan not found');

    const weeks = await this.db.query(
      'SELECT * FROM "ThematicPlanWeek" WHERE planId = ? ORDER BY weekNumber ASC',
      [id],
    );

    return {
      ...plan,
      subjectTemplate: {
        id: (plan as any).subjectTemplateId,
        name: (plan as any).subjectName,
        code: (plan as any).subjectCode,
      },
      academicYear: {
        id: (plan as any).academicYearId,
        name: (plan as any).yearName,
      },
      gradeLevel: {
        id: (plan as any).gradeLevelId,
        name: (plan as any).gradeName,
      },
      teacher: {
        id: (plan as any).teacherId,
        firstName: (plan as any).firstName,
        lastName: (plan as any).lastName,
      },
      weeks,
    };
  }

  async createThematicPlan(
    actorId: string,
    schoolId: string,
    data: {
      title: string;
      subjectTemplateId: string;
      academicYearId: string;
      gradeLevelId: string;
    },
  ) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "ThematicPlan" (id, title, subjectTemplateId, academicYearId, gradeLevelId, teacherId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.title,
        data.subjectTemplateId,
        data.academicYearId,
        data.gradeLevelId,
        actorId,
        schoolId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    const plan = (await this.db.queryOne<ThematicPlan>(
      'SELECT * FROM "ThematicPlan" WHERE id = ?',
      [id],
    ))!;
    await this.audit(actorId, 'CREATE_THEMATIC_PLAN', 'ThematicPlan', id, data);
    return plan;
  }

  async updateThematicPlan(
    actorId: string,
    schoolId: string,
    id: string,
    data: { title?: string },
  ) {
    const existing = await this.db.queryOne(
      'SELECT * FROM "ThematicPlan" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Thematic plan not found');

    await this.db.execute(
      'UPDATE "ThematicPlan" SET title = ?, updatedAt = ? WHERE id = ?',
      [data.title, new Date().toISOString(), id],
    );
    const updated = (await this.db.queryOne<ThematicPlan>(
      'SELECT * FROM "ThematicPlan" WHERE id = ?',
      [id],
    ))!;
    await this.audit(
      actorId,
      'UPDATE_THEMATIC_PLAN',
      'ThematicPlan',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteThematicPlan(actorId: string, schoolId: string, id: string) {
    const existing = await this.db.queryOne(
      'SELECT * FROM "ThematicPlan" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Thematic plan not found');
    await this.db.execute('DELETE FROM "ThematicPlan" WHERE id = ?', [id]);
    await this.audit(
      actorId,
      'DELETE_THEMATIC_PLAN',
      'ThematicPlan',
      id,
      null,
      existing,
    );
    return { success: true };
  }

  async saveThematicPlanWeeks(
    actorId: string,
    schoolId: string,
    planId: string,
    weeks: Array<{
      weekNumber: number;
      topic: string;
      objectives?: string;
      methods?: string;
      resources?: string;
      crossCurricular?: string;
      notes?: string;
    }>,
  ) {
    const plan = await this.db.queryOne(
      'SELECT id FROM "ThematicPlan" WHERE id = ? AND schoolId = ?',
      [planId, schoolId],
    );
    if (!plan) throw new NotFoundException('Thematic plan not found');

    return this.db.transaction(async (db) => {
      await db.execute('DELETE FROM "ThematicPlanWeek" WHERE planId = ?', [
        planId,
      ]);
      for (const w of weeks) {
        await db.execute(
          'INSERT INTO "ThematicPlanWeek" (id, weekNumber, topic, objectives, methods, resources, crossCurricular, notes, planId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            w.weekNumber,
            w.topic,
            w.objectives || null,
            w.methods || null,
            w.resources || null,
            w.crossCurricular || null,
            w.notes || null,
            planId,
          ],
        );
      }
      await this.audit(actorId, 'SAVE_PLAN_WEEKS', 'ThematicPlan', planId, {
        weekCount: weeks.length,
      });
      return { saved: weeks.length };
    });
  }

  // ─── LESSON PREPARATIONS ─────────────────────────────────────────

  async getLessonPreparations(
    schoolId: string,
    filters?: { subjectTemplateId?: string; teacherId?: string },
  ) {
    let where = 'WHERE lp.schoolId = ?';
    const params: any[] = [schoolId];
    if (filters?.subjectTemplateId) {
      where += ' AND lp.subjectTemplateId = ?';
      params.push(filters.subjectTemplateId);
    }
    if (filters?.teacherId) {
      where += ' AND lp.teacherId = ?';
      params.push(filters.teacherId);
    }

    const preps = await this.db.query(
      `SELECT lp.*, st.name as subjectName, st.code as subjectCode, u.firstName, u.lastName 
       FROM "LessonPreparation" lp 
       JOIN "SubjectTemplate" st ON lp.subjectTemplateId = st.id 
       JOIN "User" u ON lp.teacherId = u.id 
       ${where} ORDER BY lp.date DESC`,
      params,
    );

    return preps.map((p: any) => ({
      ...p,
      subjectTemplate: {
        id: p.subjectTemplateId,
        name: p.subjectName,
        code: p.subjectCode,
      },
      teacher: {
        id: p.teacherId,
        firstName: p.firstName,
        lastName: p.lastName,
      },
    }));
  }

  async createLessonPreparation(
    actorId: string,
    schoolId: string,
    data: {
      title: string;
      date: string;
      duration?: number;
      topic: string;
      objectives?: string;
      activities?: string;
      materials?: string;
      homework?: string;
      evaluation?: string;
      subjectTemplateId: string;
    },
  ) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "LessonPreparation" (id, title, date, duration, topic, objectives, activities, materials, homework, evaluation, subjectTemplateId, teacherId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.title,
        new Date(data.date).toISOString(),
        data.duration ?? 45,
        data.topic,
        data.objectives || null,
        data.activities || null,
        data.materials || null,
        data.homework || null,
        data.evaluation || null,
        data.subjectTemplateId,
        actorId,
        schoolId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    const prep = (await this.db.queryOne<LessonPreparation>(
      'SELECT * FROM "LessonPreparation" WHERE id = ?',
      [id],
    ))!;
    await this.audit(
      actorId,
      'CREATE_LESSON_PREPARATION',
      'LessonPreparation',
      id,
      data,
    );
    return prep;
  }

  async updateLessonPreparation(
    actorId: string,
    schoolId: string,
    id: string,
    data: {
      title?: string;
      date?: string;
      duration?: number;
      topic?: string;
      objectives?: string;
      activities?: string;
      materials?: string;
      homework?: string;
      evaluation?: string;
    },
  ) {
    const existing = await this.db.queryOne(
      'SELECT * FROM "LessonPreparation" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Lesson preparation not found');

    const fields = ['updatedAt = ?'];
    const values: any[] = [new Date().toISOString()];
    const keys = [
      'title',
      'duration',
      'topic',
      'objectives',
      'activities',
      'materials',
      'homework',
      'evaluation',
    ];
    keys.forEach((k) => {
      if ((data as any)[k] !== undefined) {
        fields.push(`"${k}" = ?`);
        values.push((data as any)[k]);
      }
    });
    if (data.date) {
      fields.push('"date" = ?');
      values.push(new Date(data.date).toISOString());
    }

    await this.db.execute(
      `UPDATE "LessonPreparation" SET ${fields.join(', ')} WHERE id = ?`,
      [...values, id],
    );
    const updated = (await this.db.queryOne<LessonPreparation>(
      'SELECT * FROM "LessonPreparation" WHERE id = ?',
      [id],
    ))!;
    await this.audit(
      actorId,
      'UPDATE_LESSON_PREPARATION',
      'LessonPreparation',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteLessonPreparation(actorId: string, schoolId: string, id: string) {
    const existing = await this.db.queryOne(
      'SELECT * FROM "LessonPreparation" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Lesson preparation not found');
    await this.db.execute('DELETE FROM "LessonPreparation" WHERE id = ?', [id]);
    await this.audit(
      actorId,
      'DELETE_LESSON_PREPARATION',
      'LessonPreparation',
      id,
      null,
      existing,
    );
    return { success: true };
  }

  // ─── TEACHING MATERIALS ──────────────────────────────────────────

  async getTeachingMaterials(
    schoolId: string,
    filters?: { subjectTemplateId?: string; type?: string },
  ) {
    let where = 'WHERE tm.schoolId = ?';
    const params: any[] = [schoolId];
    if (filters?.subjectTemplateId) {
      where += ' AND tm.subjectTemplateId = ?';
      params.push(filters.subjectTemplateId);
    }
    if (filters?.type) {
      where += ' AND tm.type = ?';
      params.push(filters.type);
    }

    const materials = await this.db.query(
      `SELECT tm.*, st.name as subjectName, st.code as subjectCode, gl.name as gradeName, u.firstName, u.lastName 
       FROM "TeachingMaterial" tm 
       LEFT JOIN "SubjectTemplate" st ON tm.subjectTemplateId = st.id 
       LEFT JOIN "GradeLevel" gl ON tm.gradeLevelId = gl.id 
       JOIN "User" u ON tm.uploadedById = u.id 
       ${where} ORDER BY tm.createdAt DESC`,
      params,
    );

    return materials.map((m: any) => ({
      ...m,
      subjectTemplate: m.subjectTemplateId
        ? { id: m.subjectTemplateId, name: m.subjectName, code: m.subjectCode }
        : null,
      gradeLevel: m.gradeLevelId
        ? { id: m.gradeLevelId, name: m.gradeName }
        : null,
      uploadedBy: {
        id: m.uploadedById,
        firstName: m.firstName,
        lastName: m.lastName,
      },
    }));
  }

  async createTeachingMaterial(
    actorId: string,
    schoolId: string,
    data: {
      title: string;
      description?: string;
      url: string;
      type?: string;
      subjectTemplateId?: string;
      gradeLevelId?: string;
    },
  ) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "TeachingMaterial" (id, title, description, url, type, subjectTemplateId, gradeLevelId, uploadedById, schoolId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.title,
        data.description || null,
        data.url,
        data.type ?? 'OTHER',
        data.subjectTemplateId || null,
        data.gradeLevelId || null,
        actorId,
        schoolId,
        new Date().toISOString(),
      ],
    );
    const material = (await this.db.queryOne<TeachingMaterial>(
      'SELECT * FROM "TeachingMaterial" WHERE id = ?',
      [id],
    ))!;
    await this.audit(
      actorId,
      'CREATE_TEACHING_MATERIAL',
      'TeachingMaterial',
      id,
      data,
    );
    return material;
  }

  async updateTeachingMaterial(
    actorId: string,
    schoolId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      url?: string;
      type?: string;
      subjectTemplateId?: string | null;
      gradeLevelId?: string | null;
    },
  ) {
    const existing = await this.db.queryOne(
      'SELECT * FROM "TeachingMaterial" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Teaching material not found');

    const fields = [];
    const values = [];
    const keys = [
      'title',
      'description',
      'url',
      'type',
      'subjectTemplateId',
      'gradeLevelId',
    ];
    keys.forEach((k) => {
      if ((data as any)[k] !== undefined) {
        fields.push(`"${k}" = ?`);
        values.push((data as any)[k]);
      }
    });

    if (fields.length > 0) {
      await this.db.execute(
        `UPDATE "TeachingMaterial" SET ${fields.join(', ')} WHERE id = ?`,
        [...values, id],
      );
    }
    const updated = (await this.db.queryOne<TeachingMaterial>(
      'SELECT * FROM "TeachingMaterial" WHERE id = ?',
      [id],
    ))!;
    await this.audit(
      actorId,
      'UPDATE_TEACHING_MATERIAL',
      'TeachingMaterial',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteTeachingMaterial(actorId: string, schoolId: string, id: string) {
    const existing = await this.db.queryOne(
      'SELECT * FROM "TeachingMaterial" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Teaching material not found');
    await this.db.execute('DELETE FROM "TeachingMaterial" WHERE id = ?', [id]);
    await this.audit(
      actorId,
      'DELETE_TEACHING_MATERIAL',
      'TeachingMaterial',
      id,
      null,
      existing,
    );
    return { success: true };
  }

  // ─── RVP COMPETENCIES ────────────────────────────────────────────

  async getRvpCompetencies(schoolId: string) {
    const comps = await this.db.query(
      `SELECT c.*, (SELECT COUNT(*) FROM "CompetencyMapping" WHERE competencyId = c.id) as mappingCount 
       FROM "RvpCompetency" c WHERE c.schoolId = ? ORDER BY c.area ASC, c.code ASC`,
      [schoolId],
    );
    return comps.map((c: any) => ({
      ...c,
      _count: { mappings: c.mappingCount },
    }));
  }

  async createRvpCompetency(
    actorId: string,
    schoolId: string,
    data: { code: string; name: string; area: string; description?: string },
  ) {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "RvpCompetency" (id, code, name, area, description, schoolId) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.code, data.name, data.area, data.description || null, schoolId],
    );
    const comp = (await this.db.queryOne<RvpCompetency>(
      'SELECT * FROM "RvpCompetency" WHERE id = ?',
      [id],
    ))!;
    await this.audit(
      actorId,
      'CREATE_RVP_COMPETENCY',
      'RvpCompetency',
      id,
      data,
    );
    return comp;
  }

  async updateRvpCompetency(
    actorId: string,
    schoolId: string,
    id: string,
    data: { code?: string; name?: string; area?: string; description?: string },
  ) {
    const existing = await this.db.queryOne(
      'SELECT * FROM "RvpCompetency" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Competency not found');

    const fields = [];
    const values = [];
    ['code', 'name', 'area', 'description'].forEach((k) => {
      if ((data as any)[k] !== undefined) {
        fields.push(`"${k}" = ?`);
        values.push((data as any)[k]);
      }
    });

    if (fields.length > 0) {
      await this.db.execute(
        `UPDATE "RvpCompetency" SET ${fields.join(', ')} WHERE id = ?`,
        [...values, id],
      );
    }
    const updated = (await this.db.queryOne<RvpCompetency>(
      'SELECT * FROM "RvpCompetency" WHERE id = ?',
      [id],
    ))!;
    await this.audit(
      actorId,
      'UPDATE_RVP_COMPETENCY',
      'RvpCompetency',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteRvpCompetency(actorId: string, schoolId: string, id: string) {
    const existing = await this.db.queryOne(
      'SELECT * FROM "RvpCompetency" WHERE id = ? AND schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Competency not found');
    await this.db.execute('DELETE FROM "RvpCompetency" WHERE id = ?', [id]);
    await this.audit(
      actorId,
      'DELETE_RVP_COMPETENCY',
      'RvpCompetency',
      id,
      null,
      existing,
    );
    return { success: true };
  }

  // ─── COMPETENCY MAPPINGS ─────────────────────────────────────────

  async getCompetencyMappings(
    schoolId: string,
    filters?: { subjectTemplateId?: string; gradeLevelId?: string },
  ) {
    let where = 'WHERE c.schoolId = ?';
    const params: any[] = [schoolId];
    if (filters?.subjectTemplateId) {
      where += ' AND cm.subjectTemplateId = ?';
      params.push(filters.subjectTemplateId);
    }
    if (filters?.gradeLevelId) {
      where += ' AND cm.gradeLevelId = ?';
      params.push(filters.gradeLevelId);
    }

    const mappings = await this.db.query(
      `SELECT cm.*, c.code as compCode, c.name as compName, c.area as compArea, 
              st.name as subjectName, st.code as subjectCode, gl.name as gradeName 
       FROM "CompetencyMapping" cm 
       JOIN "RvpCompetency" c ON cm.competencyId = c.id 
       JOIN "SubjectTemplate" st ON cm.subjectTemplateId = st.id 
       JOIN "GradeLevel" gl ON cm.gradeLevelId = gl.id 
       ${where} ORDER BY c.code ASC`,
      params,
    );

    return mappings.map((m: any) => ({
      ...m,
      competency: {
        id: m.competencyId,
        code: m.compCode,
        name: m.compName,
        area: m.compArea,
      },
      subjectTemplate: {
        id: m.subjectTemplateId,
        name: m.subjectName,
        code: m.subjectCode,
      },
      gradeLevel: { id: m.gradeLevelId, name: m.gradeName },
    }));
  }

  async upsertCompetencyMapping(
    actorId: string,
    schoolId: string,
    data: {
      competencyId: string;
      subjectTemplateId: string;
      gradeLevelId: string;
      fulfilled: boolean;
      note?: string;
    },
  ) {
    const comp = await this.db.queryOne(
      'SELECT id FROM "RvpCompetency" WHERE id = ? AND schoolId = ?',
      [data.competencyId, schoolId],
    );
    if (!comp)
      throw new NotFoundException('Competency not found in this school');

    const existing = await this.db.queryOne(
      'SELECT id FROM "CompetencyMapping" WHERE competencyId = ? AND subjectTemplateId = ? AND gradeLevelId = ?',
      [data.competencyId, data.subjectTemplateId, data.gradeLevelId],
    );

    let id: string;
    if (existing) {
      id = (existing as any).id;
      await this.db.execute(
        'UPDATE "CompetencyMapping" SET fulfilled = ?, note = ? WHERE id = ?',
        [data.fulfilled ? 1 : 0, data.note || null, id],
      );
    } else {
      id = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "CompetencyMapping" (id, competencyId, subjectTemplateId, gradeLevelId, fulfilled, note) VALUES (?, ?, ?, ?, ?, ?)',
        [
          id,
          data.competencyId,
          data.subjectTemplateId,
          data.gradeLevelId,
          data.fulfilled ? 1 : 0,
          data.note || null,
        ],
      );
    }

    const mapping = (await this.db.queryOne<CompetencyMapping>(
      'SELECT * FROM "CompetencyMapping" WHERE id = ?',
      [id],
    ))!;
    await this.audit(
      actorId,
      'UPSERT_COMPETENCY_MAPPING',
      'CompetencyMapping',
      id,
      data,
    );
    return mapping;
  }

  async deleteCompetencyMapping(actorId: string, schoolId: string, id: string) {
    const existing = await this.db.queryOne(
      'SELECT cm.* FROM "CompetencyMapping" cm JOIN "RvpCompetency" c ON cm.competencyId = c.id WHERE cm.id = ? AND c.schoolId = ?',
      [id, schoolId],
    );
    if (!existing) throw new NotFoundException('Mapping not found');
    await this.db.execute('DELETE FROM "CompetencyMapping" WHERE id = ?', [id]);
    await this.audit(
      actorId,
      'DELETE_COMPETENCY_MAPPING',
      'CompetencyMapping',
      id,
      null,
      existing,
    );
    return { success: true };
  }

  // ─── AUDIT HELPER ────────────────────────────────────────────────

  private async audit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    newValues?: any,
    oldValues?: any,
  ) {
    await this.db.execute(
      'INSERT INTO "AuditLog" (id, actorId, action, entity, entityId, newValues, oldValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        actorId,
        action,
        entity,
        entityId,
        newValues ? JSON.stringify(newValues) : null,
        oldValues ? JSON.stringify(oldValues) : null,
        new Date().toISOString(),
      ],
    );
  }
}
