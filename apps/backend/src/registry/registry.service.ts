import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Classroom, StudentProfile, TeacherProfile } from '../database/types';
import * as crypto from 'crypto';

@Injectable()
export class RegistryService {
  constructor(private db: DatabaseService) {}

  async createClassroom(
    schoolId: string,
    data: { name: string; grade: number },
  ): Promise<Classroom> {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "Classroom" (id, name, grade, schoolId) VALUES (?, ?, ?, ?)',
      [id, data.name, data.grade, schoolId],
    );
    return (await this.db.queryOne<Classroom>(
      'SELECT * FROM "Classroom" WHERE id = ?',
      [id],
    ))!;
  }

  async findAllClassrooms(schoolId: string): Promise<Classroom[]> {
    const classrooms = await this.db.query<Classroom>(
      'SELECT * FROM "Classroom" WHERE schoolId = ?',
      [schoolId],
    );
    if (classrooms.length === 0) return [];

    const classroomIds = classrooms.map((c) => c.id);
    const placeholders = classroomIds.map(() => '?').join(',');

    const students = await this.db.query<StudentProfile>(
      `SELECT * FROM "StudentProfile" WHERE classroomId IN (${placeholders})`,
      classroomIds,
    );
    const teachers = await this.db.query<TeacherProfile>(
      `SELECT * FROM "TeacherProfile" WHERE homeroomClassId IN (${placeholders})`,
      classroomIds,
    );

    const studentsByClassroom = new Map<string, StudentProfile[]>();
    for (const s of students) {
      if (!s.classroomId) continue;
      const list = studentsByClassroom.get(s.classroomId) ?? [];
      list.push(s);
      studentsByClassroom.set(s.classroomId, list);
    }
    const teacherByClassroom = new Map<string, TeacherProfile>();
    for (const t of teachers) {
      if (t.homeroomClassId) teacherByClassroom.set(t.homeroomClassId, t);
    }

    return classrooms.map((c) => ({
      ...c,
      students: studentsByClassroom.get(c.id) ?? [],
      homeroomTeacher: teacherByClassroom.get(c.id) ?? null,
    })) as Classroom[];
  }

  async createStudentProfile(
    schoolId: string,
    data: {
      userId: string;
      firstName: string;
      lastName: string;
      classroomId?: string | null;
    },
  ): Promise<StudentProfile> {
    if (data.classroomId) {
      await this.assertClassroomBelongsToSchool(data.classroomId, schoolId);
    }
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "StudentProfile" (id, userId, firstName, lastName, classroomId) VALUES (?, ?, ?, ?, ?)',
      [
        id,
        data.userId,
        data.firstName,
        data.lastName,
        data.classroomId || null,
      ],
    );
    return (await this.db.queryOne<StudentProfile>(
      'SELECT * FROM "StudentProfile" WHERE id = ?',
      [id],
    ))!;
  }

  async createTeacherProfile(
    schoolId: string,
    data: {
      userId: string;
      degree?: string | null;
      approbation?: string | null;
      homeroomClassId?: string | null;
    },
  ): Promise<TeacherProfile> {
    if (data.homeroomClassId) {
      await this.assertClassroomBelongsToSchool(data.homeroomClassId, schoolId);
    }
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "TeacherProfile" (id, userId, degree, approbation, homeroomClassId) VALUES (?, ?, ?, ?, ?)',
      [
        id,
        data.userId,
        data.degree || null,
        data.approbation || null,
        data.homeroomClassId || null,
      ],
    );
    return (await this.db.queryOne<TeacherProfile>(
      'SELECT * FROM "TeacherProfile" WHERE id = ?',
      [id],
    ))!;
  }

  private async assertClassroomBelongsToSchool(
    classroomId: string,
    schoolId: string,
  ): Promise<void> {
    const row = await this.db.queryOne<{ schoolId: string }>(
      'SELECT schoolId FROM "Classroom" WHERE id = ?',
      [classroomId],
    );
    if (!row) {
      throw new NotFoundException('Classroom not found.');
    }
    if (row.schoolId !== schoolId) {
      throw new ForbiddenException('Classroom belongs to a different school.');
    }
  }
}
