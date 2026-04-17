import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../utils/crypto.service';
import { SecretType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

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
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Returns list of available seed files in the data/ directory.
   */
  async getAvailableSeedFiles(): Promise<
    Array<{ filename: string; name: string; description: string }>
  > {
    const dataDir = path.resolve(process.cwd(), '..', '..', 'data');
    const altDir = path.resolve(process.cwd(), 'data');

    const dirs = [dataDir, altDir, '/app/data'];
    const results: Array<{
      filename: string;
      name: string;
      description: string;
    }> = [];

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
              // Skip malformed JSON files
            }
          }
          if (results.length > 0) break; // Use first dir that has files
        }
      } catch {
        // Dir not accessible
      }
    }
    return results;
  }

  /**
   * Load seed file from various possible locations.
   */
  private loadSeedFile(filename: string): SeedData {
    const dirs = [
      path.resolve(process.cwd(), '..', '..', 'data'),
      path.resolve(process.cwd(), 'data'),
      '/app/data',
    ];

    for (const dir of dirs) {
      const filepath = path.join(dir, filename);
      try {
        if (fs.existsSync(filepath)) {
          this.logger.log(`Loading seed file: ${filepath}`);
          return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        }
      } catch {
        // Try next
      }
    }

    throw new BadRequestException(`Seed file "${filename}" not found.`);
  }

  /**
   * Execute the seed with the given filename or inline data.
   * Only works when the system has ≤ 1 user (admin just created).
   */
  async executeSeed(
    adminUserId: string,
    options: {
      filename?: string;
      data?: SeedData;
      overrideAi?: SeedAi;
      overrideSso?: SeedSso;
    },
  ): Promise<SeedResult> {
    // Security: only allow seeding when system is fresh
    const userCount = await this.prisma.user.count();
    if (userCount > 1) {
      throw new ForbiddenException(
        'Demo seed can only run on a fresh system (≤ 1 user). Reset the database first.',
      );
    }

    const seed =
      options.data || this.loadSeedFile(options.filename || 'demo-seed.json');

    // Merge overrides
    if (options.overrideAi) {
      seed.ai = { ...seed.ai, ...options.overrideAi };
    }
    if (options.overrideSso) {
      seed.sso = { ...seed.sso, ...options.overrideSso };
    }

    this.logger.log(`Starting seed: ${seed.meta?.name || 'unnamed'}`);

    const defaultPassword = 'Heslo123!';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const counts = {
      gradeLevels: 0,
      subjects: 0,
      curriculumEntries: 0,
      staff: 0,
      students: 0,
      rooms: 0,
      ssoProviders: 0,
      aiKeys: 0,
    };

    // ─── 1. Create school ───────────────────────────────────────

    const school = await this.prisma.school.create({
      data: {
        name: seed.school.name,
        address: seed.school.address,
      },
    });
    this.logger.log(`Created school: ${school.name}`);

    // ─── 2. Assign admin to school ──────────────────────────────

    await this.prisma.schoolMembership.create({
      data: {
        userId: adminUserId,
        schoolId: school.id,
        role: UserRole.ADMIN,
      },
    });

    // ─── 3. SSO Configuration ──────────────────────────────────

    if (seed.sso) {
      for (const [provider, config] of Object.entries(seed.sso)) {
        if (config && config.clientId && config.clientSecret) {
          // Note: Provider name should be raw (e.g. "google", "github")
          const serviceName = provider.toLowerCase();

          await this.prisma.systemSecret.upsert({
            where: {
              type_service_key: {
                type: SecretType.SSO,
                service: serviceName,
                key: 'CLIENT_ID',
              },
            },
            update: {
              value: config.clientId,
              isActive: config.isActive ?? true,
            },
            create: {
              type: SecretType.SSO,
              service: serviceName,
              key: 'CLIENT_ID',
              value: config.clientId,
              isActive: config.isActive ?? true,
            },
          });
          await this.prisma.systemSecret.upsert({
            where: {
              type_service_key: {
                type: SecretType.SSO,
                service: serviceName,
                key: 'CLIENT_SECRET',
              },
            },
            update: {
              value: this.cryptoService.encrypt(config.clientSecret),
              isActive: config.isActive ?? true,
            },
            create: {
              type: SecretType.SSO,
              service: serviceName,
              key: 'CLIENT_SECRET',
              value: this.cryptoService.encrypt(config.clientSecret),
              isActive: config.isActive ?? true,
            },
          });
          counts.ssoProviders++;
        }
      }
    }

    // ─── 4. AI Keys ─────────────────────────────────────────────

    if (seed.ai) {
      const keyMappings: [string, string, string | undefined][] = [
        ['google', 'API_KEY', seed.ai.geminiApiKey],
        ['openai', 'API_KEY', seed.ai.openAiApiKey],
        ['anthropic', 'API_KEY', seed.ai.anthropicApiKey],
      ];
      for (const [service, key, value] of keyMappings) {
        if (value && value.length > 5) {
          await this.prisma.systemSecret.upsert({
            where: { type_service_key: { type: SecretType.AI, service, key } },
            update: { value: this.cryptoService.encrypt(value) },
            create: {
              type: SecretType.AI,
              service,
              key,
              value: this.cryptoService.encrypt(value),
            },
          });
          counts.aiKeys++;
        }
      }
    }

    // ─── 5. Grade Levels ────────────────────────────────────────

    const gradeLevelMap = new Map<number, string>(); // levelNumber → id
    if (seed.gradeLevels) {
      for (const gl of seed.gradeLevels) {
        const created = await this.prisma.gradeLevel.create({
          data: {
            name: gl.name,
            levelNumber: gl.levelNumber,
            schoolId: school.id,
          },
        });
        gradeLevelMap.set(gl.levelNumber, created.id);
        counts.gradeLevels++;
      }
    }

    // ─── 6. Subjects ────────────────────────────────────────────

    const subjectMap = new Map<string, string>(); // code → id
    if (seed.subjects) {
      for (const sub of seed.subjects) {
        const created = await this.prisma.subjectTemplate.create({
          data: {
            name: sub.name,
            code: sub.code,
            svpDescription: sub.svpDescription,
            schoolId: school.id,
          },
        });
        subjectMap.set(sub.code, created.id);
        counts.subjects++;
      }
    }

    // ─── 7. Curriculum Version + Entries ────────────────────────

    let currVersionId: string | null = null;
    if (seed.curriculumVersion) {
      const version = await this.prisma.curriculumVersion.create({
        data: {
          name: seed.curriculumVersion.name,
          validFrom: new Date(seed.curriculumVersion.validFrom),
          validTo: seed.curriculumVersion.validTo
            ? new Date(seed.curriculumVersion.validTo)
            : null,
          schoolId: school.id,
        },
      });
      currVersionId = version.id;

      for (const alloc of seed.curriculumVersion.allocations) {
        const subId = subjectMap.get(alloc.subject);
        const glId = gradeLevelMap.get(alloc.grade);
        if (subId && glId) {
          await this.prisma.curriculumEntry.create({
            data: {
              curriculumVersionId: version.id,
              subjectTemplateId: subId,
              gradeLevelId: glId,
              hoursPerWeek: alloc.hours,
              rvpDescription: alloc.rvpDescription,
            },
          });
          counts.curriculumEntries++;
        }
      }
    }

    // ─── 8. Academic Year + Semesters ───────────────────────────

    let academicYearId: string | null = null;
    if (seed.academicYear) {
      const ay = await this.prisma.academicYear.create({
        data: {
          name: seed.academicYear.name,
          startDate: new Date(seed.academicYear.startDate),
          endDate: new Date(seed.academicYear.endDate),
          isCurrent: seed.academicYear.isCurrent,
          schoolId: school.id,
          curriculumVersionId: currVersionId,
        },
      });
      academicYearId = ay.id;

      if (seed.academicYear.semesters) {
        for (const sem of seed.academicYear.semesters) {
          await this.prisma.semester.create({
            data: {
              number: sem.number,
              name: sem.name,
              startDate: new Date(sem.startDate),
              endDate: new Date(sem.endDate),
              academicYearId: ay.id,
            },
          });
        }
      }
    }

    // ─── 9. Staff ───────────────────────────────────────────────

    if (seed.staff) {
      for (const s of seed.staff) {
        const user = await this.prisma.user.create({
          data: {
            email: s.email,
            firstName: s.firstName,
            lastName: s.lastName,
            passwordHash: hashedPassword,
          },
        });
        await this.prisma.schoolMembership.create({
          data: {
            userId: user.id,
            schoolId: school.id,
            role: s.role as UserRole,
          },
        });
        // Create teacher profile for TEACHER role
        if (s.role === 'TEACHER' || s.role === 'DEPUTY') {
          await this.prisma.teacherProfile.create({
            data: {
              userId: user.id,
            },
          });
        }
        counts.staff++;
      }
    }

    // ─── 10. Students ───────────────────────────────────────────

    if (seed.students) {
      for (const st of seed.students) {
        const email =
          st.email ||
          `${st.firstName.toLowerCase()}.${st.lastName.toLowerCase().replace(/[^a-z]/g, '')}@zak.skola.test`;
        const user = await this.prisma.user.create({
          data: {
            email,
            firstName: st.firstName,
            lastName: st.lastName,
            passwordHash: hashedPassword,
          },
        });
        await this.prisma.schoolMembership.create({
          data: {
            userId: user.id,
            schoolId: school.id,
            role: UserRole.STUDENT,
          },
        });

        // Enroll in current academic year + grade
        const glId = gradeLevelMap.get(st.grade);
        if (academicYearId && glId) {
          await this.prisma.studentEnrollment.create({
            data: {
              studentId: user.id,
              academicYearId,
              gradeLevelId: glId,
            },
          });
        }
        counts.students++;
      }
    }

    // ─── 11. Rooms ──────────────────────────────────────────────

    if (seed.rooms) {
      for (const room of seed.rooms) {
        await this.prisma.room.create({
          data: {
            name: room.name,
            capacity: room.capacity || 30,
            isComputerLab: room.isComputerLab || false,
            specialEquipment: room.specialEquipment || [],
            schoolId: school.id,
          },
        });
        counts.rooms++;
      }
    }

    // ─── Done ───────────────────────────────────────────────────

    const summary = [
      `School: ${school.name}`,
      `${counts.gradeLevels} grade lvls, ${counts.subjects} subjects, ${counts.curriculumEntries} curriculum entries`,
      `${counts.staff} staff, ${counts.students} students, ${counts.rooms} rooms`,
      counts.ssoProviders > 0 ? `${counts.ssoProviders} SSO providers` : null,
      counts.aiKeys > 0 ? `${counts.aiKeys} AI keys` : null,
      `Default password for all users: ${defaultPassword}`,
    ]
      .filter(Boolean)
      .join(' | ');

    this.logger.log(`Seed complete: ${summary}`);

    return {
      school: { id: school.id, name: school.name },
      counts,
      defaultPassword,
      summary,
    };
  }
}
