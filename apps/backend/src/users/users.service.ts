import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  User,
  StudentProfile,
  TeacherProfile,
  Identity,
} from '../database/types';
import { Readable } from 'stream';
import csv from 'csv-parser';
import { z } from 'zod';
import * as crypto from 'crypto';

const CreateUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.string(), // Simplified for raw SQL
});

@Injectable()
export class UsersService {
  constructor(private db: DatabaseService) {}

  async create(data: Partial<User>): Promise<User> {
    const id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "User" (id, email, firstName, lastName, isSystemAdmin, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id,
        data.email,
        data.firstName,
        data.lastName,
        data.isSystemAdmin || false,
        new Date().toISOString(),
      ],
    );
    return (await this.db.queryOne<User>('SELECT * FROM "User" WHERE id = ?', [
      id,
    ]))!;
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    schoolId?: string;
    role?: string;
    status?: string;
  }): Promise<{ data: any[]; total: number }> {
    const { skip = 0, take = 20, schoolId, role, status } = params;

    let whereClause = 'WHERE u.deletedAt IS NULL';
    const queryParams: any[] = [];

    if (schoolId) {
      whereClause += ' AND m.schoolId = ?';
      queryParams.push(schoolId);
    }
    if (role) {
      whereClause += ' AND m.role = ?';
      queryParams.push(role);
    }
    if (status) {
      whereClause += ' AND m.status = ?';
      queryParams.push(status);
    }
    const sql = `
      SELECT u.*, 
             sp.id as studentProfileId, sp.classroomId,
             tp.id as teacherProfileId, tp.degree, tp.approbation
      FROM "User" u
      LEFT JOIN "StudentProfile" sp ON u.id = sp.userId
      LEFT JOIN "TeacherProfile" tp ON u.id = tp.userId
      ${schoolId ? 'JOIN "SchoolMembership" m ON u.id = m.userId' : ''}
      ${whereClause}
      ORDER BY u.createdAt DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) as count
      FROM "User" u
      ${schoolId ? 'JOIN "SchoolMembership" m ON u.id = m.userId' : ''}
      ${whereClause}
    `;

    const [rows, countResult] = await Promise.all([
      this.db.query(sql, [...queryParams, take, skip]),
      this.db.queryOne<{ count: number }>(countSql, queryParams),
    ]);

    // Map rows to structure matching previous Prisma includes
    const data = rows.map((row: any) => ({
      ...row,
      studentProfile: row.studentProfileId
        ? { id: row.studentProfileId, classroomId: row.classroomId }
        : null,
      teacherProfile: row.teacherProfileId
        ? {
            id: row.teacherProfileId,
            degree: row.degree,
            approbation: row.approbation,
          }
        : null,
    }));

    return { data, total: countResult?.count || 0 };
  }

  async findOne(id: string): Promise<any | null> {
    const user = await this.db.queryOne<User>(
      'SELECT * FROM "User" WHERE id = ?',
      [id],
    );
    if (!user) return null;

    const [studentProfile, teacherProfile, identities] = await Promise.all([
      this.db.queryOne<StudentProfile>(
        'SELECT * FROM "StudentProfile" WHERE userId = ?',
        [id],
      ),
      this.db.queryOne<TeacherProfile>(
        'SELECT * FROM "TeacherProfile" WHERE userId = ?',
        [id],
      ),
      this.db.query<Identity>('SELECT * FROM "Identity" WHERE userId = ?', [
        id,
      ]),
    ]);

    return {
      ...user,
      studentProfile,
      teacherProfile,
      identities,
    };
  }

  async importUsersFromCsv(fileBuffer: Buffer, schoolId: string) {
    const results: any[] = [];
    const stream = Readable.from(fileBuffer);

    return new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          const validUsers: any[] = [];
          const errors: string[] = [];

          for (const row of results) {
            try {
              const userDto = {
                email: row.email,
                firstName: row.firstName,
                lastName: row.lastName,
                role: row.role,
              };

              const validated = CreateUserSchema.parse(userDto);

              const existing = await this.db.queryOne(
                'SELECT id FROM "User" WHERE email = ?',
                [validated.email],
              );
              if (existing) {
                errors.push(`Email ${validated.email} already exists`);
                continue;
              }

              validUsers.push(validated);
            } catch (e: any) {
              errors.push(`Invalid row: ${JSON.stringify(row)} - ${e.message}`);
            }
          }

          if (validUsers.length > 0) {
            await this.db.transaction(async (db) => {
              for (const user of validUsers) {
                const userId = crypto.randomUUID();
                await db.execute(
                  'INSERT INTO "User" (id, email, firstName, lastName, createdAt) VALUES (?, ?, ?, ?, ?)',
                  [
                    userId,
                    user.email,
                    user.firstName,
                    user.lastName,
                    new Date().toISOString(),
                  ],
                );
                await db.execute(
                  'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
                  [
                    crypto.randomUUID(),
                    userId,
                    schoolId,
                    user.role,
                    'PENDING',
                    new Date().toISOString(),
                  ],
                );
              }
            });
          }

          resolve({
            imported: validUsers.length,
            errors,
          });
        })
        .on('error', () =>
          reject(new BadRequestException('Failed to parse CSV')),
        );
    });
  }
}
