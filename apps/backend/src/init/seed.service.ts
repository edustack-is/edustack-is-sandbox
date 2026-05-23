import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CryptoService } from '../utils/crypto.service';
import {
  SecretType,
  UserRole,
  User,
  School,
  GradeLevel,
  SubjectTemplate,
  CurriculumVersion,
  AcademicYear,
} from '../database/types';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ─── Seed Data Types ──────────────────────────────────────────

interface SeedSso {
  google?: { clientId: string; clientSecret: string; isActive: boolean };
  github?: { clientId: string; clientSecret: string; isActive: boolean };
  microsoft?: { clientId: string; clientSecret: string; isActive: boolean };
}

interface SeedAi {
  geminiApiKey?: string;
  openAiApiKey?: string;
  anthropicApiKey?: string;
}

interface SeedSchool {
  name: string;
  address?: string;
}

interface SeedGradeLevel {
  name: string;
  levelNumber: number;
}

interface SeedSubject {
  name: string;
  code: string;
  svpDescription?: string;
}

interface SeedAllocation {
  subject: string; // code
  grade: number;
  hours: number;
  rvpDescription?: string;
}

interface SeedCurriculumVersion {
  name: string;
  validFrom: string;
  validTo?: string;
  allocations: SeedAllocation[];
}

interface SeedSemester {
  number: number;
  name: string;
  startDate: string;
  endDate: string;
}

interface SeedAcademicYear {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  semesters?: SeedSemester[];
}

interface SeedStaff {
  firstName: string;
  lastName: string;
  email: string;
  role: 'TEACHER' | 'DEPUTY' | 'PRINCIPAL';
}

interface SeedStudent {
  firstName: string;
  lastName: string;
  email?: string;
  grade: number;
}

interface SeedParent {
  firstName: string;
  lastName: string;
  email: string;
  // Student emails — must match the auto-generated `<first>.<last>@zak.skola.test`
  // form (or the `email` override) of an entry in `students`.
  children: string[];
}

interface SeedRoom {
  name: string;
  capacity?: number;
  isComputerLab?: boolean;
  specialEquipment?: string[];
}

export interface SeedData {
  meta?: { name?: string; description?: string; version?: string };
  sso?: SeedSso;
  ai?: SeedAi;
  school: SeedSchool;
  gradeLevels?: SeedGradeLevel[];
  subjects?: SeedSubject[];
  curriculumVersion?: SeedCurriculumVersion;
  academicYear?: SeedAcademicYear;
  staff?: SeedStaff[];
  students?: SeedStudent[];
  parents?: SeedParent[];
  rooms?: SeedRoom[];
}

export interface SeedResult {
  school: { id: string; name: string };
  counts: {
    gradeLevels: number;
    subjects: number;
    curriculumEntries: number;
    staff: number;
    students: number;
    parents: number;
    rooms: number;
    ssoProviders: number;
    aiKeys: number;
  };
  defaultPassword: string;
  summary: string;
}

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cryptoService: CryptoService,
  ) {}

  async getAvailableSeedFiles(): Promise<
    Array<{ filename: string; name: string; description: string }>
  > {
    const dataDir = path.resolve(process.cwd(), '..', '..', 'data');
    const altDir = path.resolve(process.cwd(), 'data');
    const dirs = [dataDir, altDir, '/app/data'];
    const results: any[] = [];

    for (const dir of dirs) {
      try {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
          for (const file of files) {
            try {
              const content = JSON.parse(
                fs.readFileSync(path.join(dir, file), 'utf-8'),
              );
              results.push({
                filename: file,
                name: content.meta?.name || file,
                description: content.meta?.description || '',
              });
            } catch {
              /* malformed */
            }
          }
          if (results.length > 0) break;
        }
      } catch {
        /* access */
      }
    }
    return results;
  }

  private loadSeedFile(filename: string): SeedData {
    const dirs = [
      path.resolve(process.cwd(), '..', '..', 'data'),
      path.resolve(process.cwd(), 'data'),
      '/app/data',
    ];
    for (const dir of dirs) {
      const filepath = path.join(dir, filename);
      try {
        if (fs.existsSync(filepath))
          return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      } catch {}
    }
    throw new BadRequestException(`Seed file "${filename}" not found.`);
  }

  async executeSeed(
    adminUserId: string,
    options: {
      filename?: string;
      data?: SeedData;
      overrideAi?: SeedAi;
      overrideSso?: SeedSso;
    },
  ): Promise<SeedResult> {
    const userCountResult = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM "User"',
    );
    if ((userCountResult?.count || 0) > 1)
      throw new ForbiddenException('System not fresh.');

    const seed =
      options.data || this.loadSeedFile(options.filename || 'demo-seed.json');
    if (options.overrideAi) seed.ai = { ...seed.ai, ...options.overrideAi };
    if (options.overrideSso) seed.sso = { ...seed.sso, ...options.overrideSso };

    const defaultPassword = process.env.DEMO_PASSWORD || 'Demo1234!';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);
    const counts = {
      gradeLevels: 0,
      subjects: 0,
      curriculumEntries: 0,
      staff: 0,
      students: 0,
      parents: 0,
      rooms: 0,
      ssoProviders: 0,
      aiKeys: 0,
    };

    return this.db.transaction(async (db) => {
      const schoolId = crypto.randomUUID();
      await db.execute(
        'INSERT INTO "School" (id, name, address, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [
          schoolId,
          seed.school.name,
          seed.school.address || null,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );
      await db.execute(
        'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          adminUserId,
          schoolId,
          UserRole.ADMIN,
          'ACTIVE',
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );

      // SSO
      if (seed.sso) {
        for (const [provider, config] of Object.entries(seed.sso)) {
          if (config?.clientId && config?.clientSecret) {
            const svc = provider.toLowerCase();
            await db.execute(
              'INSERT INTO "SystemSecret" (id, type, service, key, value, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [
                crypto.randomUUID(),
                'SSO',
                svc,
                'CLIENT_ID',
                config.clientId,
                config.isActive ? 1 : 0,
                new Date().toISOString(),
                new Date().toISOString(),
              ],
            );
            await db.execute(
              'INSERT INTO "SystemSecret" (id, type, service, key, value, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [
                crypto.randomUUID(),
                'SSO',
                svc,
                'CLIENT_SECRET',
                this.cryptoService.encrypt(config.clientSecret),
                config.isActive ? 1 : 0,
                new Date().toISOString(),
                new Date().toISOString(),
              ],
            );
            counts.ssoProviders++;
          }
        }
      }

      // AI
      if (seed.ai) {
        const mappings: [string, string | undefined][] = [
          ['google', seed.ai.geminiApiKey],
          ['openai', seed.ai.openAiApiKey],
          ['anthropic', seed.ai.anthropicApiKey],
        ];
        for (const [svc, val] of mappings) {
          if (val && val.length > 5) {
            await db.execute(
              'INSERT INTO "SystemSecret" (id, type, service, key, value, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [
                crypto.randomUUID(),
                'AI',
                svc,
                'API_KEY',
                this.cryptoService.encrypt(val),
                1,
                new Date().toISOString(),
                new Date().toISOString(),
              ],
            );
            counts.aiKeys++;
          }
        }
      }

      // Grades
      const glMap = new Map<number, string>();
      if (seed.gradeLevels) {
        for (const gl of seed.gradeLevels) {
          const id = crypto.randomUUID();
          await db.execute(
            'INSERT INTO "GradeLevel" (id, name, levelNumber, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
            [
              id,
              gl.name,
              gl.levelNumber,
              schoolId,
              new Date().toISOString(),
              new Date().toISOString(),
            ],
          );
          glMap.set(gl.levelNumber, id);
          counts.gradeLevels++;
        }
      }

      // Subjects
      const subMap = new Map<string, string>();
      if (seed.subjects) {
        for (const sub of seed.subjects) {
          const id = crypto.randomUUID();
          await db.execute(
            'INSERT INTO "SubjectTemplate" (id, name, code, svpDescription, schoolId) VALUES (?, ?, ?, ?, ?)',
            [id, sub.name, sub.code, sub.svpDescription || null, schoolId],
          );
          subMap.set(sub.code, id);
          counts.subjects++;
        }
      }

      // Classrooms
      const classroomMap = new Map<string, string>(); // name -> id
      const gradesToCreate = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      for (const g of gradesToCreate) {
        const id = crypto.randomUUID();
        const name = `${g}.A`;
        await db.execute(
          'INSERT INTO "Classroom" (id, name, grade, schoolId) VALUES (?, ?, ?, ?)',
          [id, name, g, schoolId],
        );
        classroomMap.set(name, id);
      }

      // Curriculum
      let cvId: string | null = null;
      if (seed.curriculumVersion) {
        cvId = crypto.randomUUID();
        await db.execute(
          'INSERT INTO "CurriculumVersion" (id, name, validFrom, validTo, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            cvId,
            seed.curriculumVersion.name,
            new Date(seed.curriculumVersion.validFrom).toISOString(),
            seed.curriculumVersion.validTo
              ? new Date(seed.curriculumVersion.validTo).toISOString()
              : null,
            schoolId,
            new Date().toISOString(),
            new Date().toISOString(),
          ],
        );
        for (const alloc of seed.curriculumVersion.allocations) {
          const sId = subMap.get(alloc.subject);
          const gId = glMap.get(alloc.grade);
          if (sId && gId) {
            await db.execute(
              'INSERT INTO "CurriculumEntry" (id, hoursPerWeek, rvpDescription, curriculumVersionId, subjectTemplateId, gradeLevelId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [
                crypto.randomUUID(),
                alloc.hours,
                alloc.rvpDescription || null,
                cvId,
                sId,
                gId,
                new Date().toISOString(),
                new Date().toISOString(),
              ],
            );
            counts.curriculumEntries++;
          }
        }
      }

      // Academic Year
      let ayId: string | null = null;
      if (seed.academicYear) {
        ayId = crypto.randomUUID();
        await db.execute(
          'INSERT INTO "AcademicYear" (id, name, startDate, endDate, isCurrent, schoolId, curriculumVersionId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            ayId,
            seed.academicYear.name,
            new Date(seed.academicYear.startDate).toISOString(),
            new Date(seed.academicYear.endDate).toISOString(),
            seed.academicYear.isCurrent ? 1 : 0,
            schoolId,
            cvId,
            new Date().toISOString(),
            new Date().toISOString(),
          ],
        );
        if (seed.academicYear.semesters) {
          for (const sem of seed.academicYear.semesters) {
            await db.execute(
              'INSERT INTO "Semester" (id, number, name, startDate, endDate, academicYearId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [
                crypto.randomUUID(),
                sem.number,
                sem.name,
                new Date(sem.startDate).toISOString(),
                new Date(sem.endDate).toISOString(),
                ayId,
                new Date().toISOString(),
                new Date().toISOString(),
              ],
            );
          }
        }
      }

      // Staff
      if (seed.staff) {
        for (const s of seed.staff) {
          const uId = crypto.randomUUID();
          await db.execute(
            'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
            [
              uId,
              s.email,
              s.firstName,
              s.lastName,
              hashedPassword,
              new Date().toISOString(),
            ],
          );
          await db.execute(
            'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              crypto.randomUUID(),
              uId,
              schoolId,
              s.role,
              'ACTIVE',
              new Date().toISOString(),
              new Date().toISOString(),
            ],
          );
          if (s.role === 'TEACHER' || s.role === 'DEPUTY') {
            const tProfileId = crypto.randomUUID();
            const hId =
              s.role === 'TEACHER' && s.lastName === 'Svoboda'
                ? classroomMap.get('5.A')
                : null;
            await db.execute(
              'INSERT INTO "TeacherProfile" (id, userId, homeroomClassId) VALUES (?, ?, ?)',
              [tProfileId, uId, hId],
            );
          }
          counts.staff++;
        }
      }

      // Students — track email → userId so the parents pass can wire ParentStudent links.
      const studentEmailToId = new Map<string, string>();
      if (seed.students) {
        for (const st of seed.students) {
          const uId = crypto.randomUUID();
          const email =
            st.email ||
            `${st.firstName.toLowerCase()}.${st.lastName.toLowerCase().replace(/[^a-z]/g, '')}@zak.skola.test`;
          studentEmailToId.set(email, uId);
          await db.execute(
            'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
            [
              uId,
              email,
              st.firstName,
              st.lastName,
              hashedPassword,
              new Date().toISOString(),
            ],
          );
          await db.execute(
            'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              crypto.randomUUID(),
              uId,
              schoolId,
              'STUDENT',
              'ACTIVE',
              new Date().toISOString(),
              new Date().toISOString(),
            ],
          );

          const cId = classroomMap.get(`${st.grade}.A`);
          await db.execute(
            'INSERT INTO "StudentProfile" (id, userId, firstName, lastName, classroomId) VALUES (?, ?, ?, ?, ?)',
            [crypto.randomUUID(), uId, st.firstName, st.lastName, cId || null],
          );

          const gId = glMap.get(st.grade);
          if (ayId && gId)
            await db.execute(
              'INSERT INTO "StudentEnrollment" (id, studentId, academicYearId, gradeLevelId, classroomId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [
                crypto.randomUUID(),
                uId,
                ayId,
                gId,
                cId || null,
                new Date().toISOString(),
                new Date().toISOString(),
              ],
            );
          counts.students++;
        }
      }

      // Parents — each parent is a User+SchoolMembership(PARENT) plus one
      // ParentStudent row per child. We resolve children by email against
      // the studentEmailToId map populated above; an unknown email is a
      // seed-file mistake and we surface it with a clear message.
      if (seed.parents) {
        for (const p of seed.parents) {
          const uId = crypto.randomUUID();
          await db.execute(
            'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
            [
              uId,
              p.email,
              p.firstName,
              p.lastName,
              hashedPassword,
              new Date().toISOString(),
            ],
          );
          await db.execute(
            'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              crypto.randomUUID(),
              uId,
              schoolId,
              'PARENT',
              'ACTIVE',
              new Date().toISOString(),
              new Date().toISOString(),
            ],
          );
          for (const childEmail of p.children) {
            const studentId = studentEmailToId.get(childEmail);
            if (!studentId) {
              throw new BadRequestException(
                `Seed parent ${p.email}: child "${childEmail}" not found among seeded students.`,
              );
            }
            await db.execute(
              'INSERT INTO "ParentStudent" (id, parentId, studentId) VALUES (?, ?, ?)',
              [crypto.randomUUID(), uId, studentId],
            );
          }
          counts.parents++;
        }
      }

      return {
        school: { id: schoolId, name: seed.school.name },
        counts,
        defaultPassword,
        summary: 'Seed complete',
      };
    });
  }
}
