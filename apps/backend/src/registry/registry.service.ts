import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Classroom, StudentProfile, TeacherProfile } from '../database/types';
import * as crypto from 'crypto';

@Injectable()
export class RegistryService {
  constructor(private db: DatabaseService) {}

  async createClassroom(data: any): Promise<Classroom> {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "Classroom" (id, name, grade, schoolId) VALUES (?, ?, ?, ?)',
      [id, data.name, data.grade, data.schoolId],
    );
    return (await this.db.queryOne<Classroom>(
      'SELECT * FROM "Classroom" WHERE id = ?',
      [id],
    ))!;
  }

  async findAllClassrooms(): Promise<Classroom[]> {
    const classrooms = await this.db.query<Classroom>(
      'SELECT * FROM "Classroom"',
    );
    const result = [];
    for (const c of classrooms) {
      const students = await this.db.query(
        'SELECT * FROM "StudentProfile" WHERE classroomId = ?',
        [c.id],
      );
      const teacher = await this.db.queryOne(
        'SELECT * FROM "TeacherProfile" WHERE homeroomClassId = ?',
        [c.id],
      );
      result.push({ ...c, students, homeroomTeacher: teacher });
    }
    return result;
  }

  async createStudentProfile(data: any): Promise<StudentProfile> {
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

  async createTeacherProfile(data: any): Promise<TeacherProfile> {
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
}
