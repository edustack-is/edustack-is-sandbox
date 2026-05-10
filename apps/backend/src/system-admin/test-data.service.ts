import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CryptoService } from '../utils/crypto.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserRole, UserStatus } from '../database/types';

// ─── Czech name pools ────────────────────────────────────────────
const MALE_FIRST = [
  'Jan',
  'Tomáš',
  'Pavel',
  'Martin',
  'David',
  'Lukáš',
  'Jakub',
  'Filip',
  'Ondřej',
  'Petr',
  'Adam',
  'Michal',
  'Matěj',
  'Daniel',
  'Jiří',
  'Karel',
  'Marek',
  'Vojtěch',
  'Radek',
  'Josef',
];
const FEMALE_FIRST = [
  'Jana',
  'Eva',
  'Marie',
  'Tereza',
  'Kateřina',
  'Lucie',
  'Petra',
  'Hana',
  'Anna',
  'Lenka',
  'Markéta',
  'Alena',
  'Monika',
  'Ivana',
  'Veronika',
  'Barbora',
  'Zuzana',
  'Daniela',
  'Klára',
  'Eliška',
];
const LAST_NAMES = [
  'Novák',
  'Svoboda',
  'Dvořák',
  'Novotný',
  'Černý',
  'Procházka',
  'Kučera',
  'Veselý',
  'Horák',
  'Jelínek',
  'Marek',
  'Kolář',
  'Pospíšil',
  'Šťastný',
  'Bartoš',
  'Kratochvíl',
  'Sedláček',
  'Dostál',
  'Fiala',
  'Kopecký',
];
const TEACHER_DEGREES = ['Mgr.', 'Mgr.', 'RNDr.', 'PhDr.', 'Ing.', 'PaedDr.'];
const TEACHER_APPROBATIONS = [
  'Český jazyk a literatura',
  'Matematika',
  'Anglický jazyk',
  'Fyzika',
  'Chemie',
  'Přírodopis',
  'Dějepis',
  'Zeměpis',
  'Tělesná výchova',
  'Informatika',
];
const GRADE_DESCRIPTIONS = [
  'Písemná práce',
  'Ústní zkoušení',
  'Domácí úkol',
  'Projekt',
  'Test',
  'Pololetní písemka',
  'Čtvrtletní práce',
  'Aktivita v hodině',
  'Referát',
];
const MESSAGE_CONTENTS = [
  'Dobrý den, chtěl bych se zeptat na domácí úkol z minulé hodiny.',
  'Děkuji za informaci. Budu se snažit to napravit.',
  'Prosím o schůzku ohledně prospěchu mého dítěte.',
  'Připomínám, že zítra bude písemná práce z 3. a 4. kapitoly.',
  'Omlouvám absenci svého syna/dcery z důvodu nemoci.',
];

const SUBJECTS = [
  { name: 'Matematika', code: 'MAT' },
  { name: 'Český jazyk', code: 'CJL' },
  { name: 'Anglický jazyk', code: 'ANJ' },
  { name: 'Fyzika', code: 'FYZ' },
  { name: 'Chemie', code: 'CHE' },
  { name: 'Přírodopis', code: 'PRI' },
  { name: 'Zeměpis', code: 'ZEM' },
  { name: 'Dějepis', code: 'DEJ' },
  { name: 'Informatika', code: 'INF' },
  { name: 'Tělesná výchova', code: 'TEV' },
  { name: 'Hudební výchova', code: 'HUV' },
  { name: 'Výtvarná výchova', code: 'VYV' },
];

const COMPETENCIES = [
  { code: 'KC1', name: 'Kompetence k učení', area: 'Obecné' },
  { code: 'KC2', name: 'Kompetence k řešení problémů', area: 'Obecné' },
  { code: 'KC3', name: 'Kompetence komunikativní', area: 'Obecné' },
  { code: 'KC4', name: 'Kompetence sociální a personální', area: 'Obecné' },
  { code: 'KC5', name: 'Kompetence občanské', area: 'Obecné' },
  { code: 'KC6', name: 'Kompetence pracovní', area: 'Obecné' },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function removeDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export interface GenerateConfig {
  schoolName: string;
  schoolType: string;
  teacherCount: number;
  teacherActiveCount?: number;
  teacherInvitedCount?: number;
  studentCount?: number;
  studentActiveCount?: number;
  studentInvitedCount?: number;
  parentCount?: number;
  generateSubjects?: boolean;
  generateSchedule?: boolean;
  generateGrades?: boolean;
  generateCommunication?: boolean;
  generateAttendance?: boolean;
  generateReportCards?: boolean;
  generateCommunity?: boolean;
}

@Injectable()
export class TestDataService {
  private readonly logger = new Logger(TestDataService.name);

  constructor(
    private db: DatabaseService,
    private cryptoService: CryptoService,
  ) {}

  async generateAll(config: GenerateConfig): Promise<any> {
    this.logger.log(
      `Generating complete coverage test data for ${config.schoolName}`,
    );

    const demoPassword = process.env.DEMO_PASSWORD || 'Demo1234!';
    const passwordHash = await bcrypt.hash(demoPassword, 10);
    const now = new Date().toISOString();

    // 0. GLOBAL CONFIG & SYSTEM SETTINGS
    await this.db.execute(
      'INSERT OR IGNORE INTO "SystemSettings" (id, updatedAt) VALUES (?, ?)',
      ['global', now],
    );
    await this.db.execute(
      'INSERT OR IGNORE INTO "GlobalConfig" (key, value, updatedAt) VALUES (?, ?, ?)',
      ['system_initialized', 'true', now],
    );

    // Add some system secrets (MUST BE ENCRYPTED)
    await this.db.execute(
      'INSERT OR IGNORE INTO "SystemSecret" (id, type, service, key, value, isActive, updatedAt) VALUES (?, ?, ?, ?, ?, 1, ?)',
      [
        crypto.randomUUID(),
        'SSO',
        'google',
        'client_id',
        this.cryptoService.encrypt('demo-google-id'),
        now,
      ],
    );
    await this.db.execute(
      'INSERT OR IGNORE INTO "SystemSecret" (id, type, service, key, value, isActive, updatedAt) VALUES (?, ?, ?, ?, ?, 1, ?)',
      [
        crypto.randomUUID(),
        'AI',
        'google',
        'API_KEY',
        this.cryptoService.encrypt('demo-gemini-key'),
        now,
      ],
    );

    let school = await this.db.queryOne(
      'SELECT * FROM "School" WHERE name = ?',
      [config.schoolName],
    );
    if (school) {
      await this.wipeSchoolData((school as any).id);
    } else {
      const id = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "School" (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
        [id, config.schoolName, now, now],
      );
      school = await this.db.queryOne('SELECT * FROM "School" WHERE id = ?', [
        id,
      ]);
    }
    const schoolId = (school as any).id;
    const domainBase = removeDiacritics(config.schoolName)
      .replace(/\s+/g, '')
      .toLowerCase();
    const schoolDomain = `${domainBase}.${schoolId.slice(0, 8)}.demo.test`;

    const stats = {
      academicYear: 1,
      gradeLevels: 0,
      classrooms: 0,
      subjects: 0,
      teachers: 0,
      students: 0,
      parents: 0,
      subjectInstances: 0,
      scheduleEvents: 0,
      grades: 0,
      conversations: 0,
      messages: 0,
      attendanceRecords: 0,
      excuses: 0,
      reportCards: 0,
      behaviorGrades: 0,
      bulletinPosts: 0,
      polls: 0,
      calendarEvents: 0,
      thematicPlans: 0,
      lessonPreparations: 0,
      materials: 0,
      identities: 0,
      notifications: 0,
      workloads: 0,
      signatures: 0,
      tokenUsage: 0,
      competencyGrades: 0,
      classificationDeadlines: 0,
      commissionExams: 0,
      pollVotes: 0,
      eventRsvps: 0,
      messageAttachments: 0,
    };

    // 1. INFRASTRUCTURE
    const buildingId = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "Building" (id, name, address, floors, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        buildingId,
        pick(['Hlavní budova', 'Stará budova', 'Pavilon A']),
        pick(['Školní 1', 'U Stadionu 12', 'Lipová 45']),
        4,
        schoolId,
        now,
        now,
      ],
    );

    const roomIds: string[] = [];
    const roomsToGen = config.schoolType.includes('elementary_1') ? 6 : 12;
    for (let i = 1; i <= roomsToGen; i++) {
      const roomId = crypto.randomUUID();
      const isLab = i === roomsToGen || i === roomsToGen - 1;
      await this.db.execute(
        'INSERT INTO "Room" (id, name, capacity, floor, isComputerLab, schoolId, buildingId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          roomId,
          `Učebna ${100 + i}`,
          30,
          randInt(1, 3),
          isLab ? 1 : 0,
          schoolId,
          buildingId,
          now,
          now,
        ],
      );
      roomIds.push(roomId);
    }

    // Room Sharing entry
    await this.db.execute(
      'INSERT INTO "RoomSharing" (id, roomId, sharedWithSchoolId, createdAt) VALUES (?, ?, ?, ?)',
      [crypto.randomUUID(), roomIds[0], crypto.randomUUID(), now],
    );

    // 2. ACADEMIC SETUP
    const ayId = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "AcademicYear" (id, name, startDate, endDate, isCurrent, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
      [ayId, '2025/2026', '2025-09-01', '2026-06-30', schoolId, now, now],
    );

    const s1Id = crypto.randomUUID();
    const s2Id = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "Semester" (id, number, name, startDate, endDate, academicYearId, createdAt, updatedAt) VALUES (?, 1, ?, ?, ?, ?, ?, ?)',
      [s1Id, '1. pololetí', '2025-09-01', '2026-01-31', ayId, now, now],
    );
    await this.db.execute(
      'INSERT INTO "Semester" (id, number, name, startDate, endDate, academicYearId, createdAt, updatedAt) VALUES (?, 2, ?, ?, ?, ?, ?, ?)',
      [s2Id, '2. pololetí', '2026-02-01', '2026-06-30', ayId, now, now],
    );

    // Classification Deadline
    await this.db.execute(
      'INSERT INTO "ClassificationDeadline" (id, deadline, semesterId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), '2026-01-20', s1Id, schoolId, now, now],
    );
    stats.classificationDeadlines++;

    const START_TIMES = [
      '08:00',
      '08:55',
      '10:00',
      '10:55',
      '11:50',
      '12:45',
      '13:40',
      '14:35',
    ];
    const END_TIMES = [
      '08:45',
      '09:40',
      '10:45',
      '11:40',
      '12:35',
      '13:30',
      '14:25',
      '15:20',
    ];
    for (let i = 0; i < START_TIMES.length; i++) {
      await this.db.execute(
        'INSERT INTO "LessonTimeSlot" (id, lessonNumber, startTime, endTime, schoolId) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), i + 1, START_TIMES[i], END_TIMES[i], schoolId],
      );
    }

    // 3. CURRICULUM & SUBJECTS
    const curriculumVersionId = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "CurriculumVersion" (id, name, validFrom, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [
        curriculumVersionId,
        `ŠVP ${config.schoolName} v1`,
        '2025-09-01',
        schoolId,
        now,
        now,
      ],
    );
    await this.db.execute(
      'UPDATE "AcademicYear" SET curriculumVersionId = ? WHERE id = ?',
      [curriculumVersionId, ayId],
    );

    const templateIds: string[] = [];
    if (config.generateSubjects !== false) {
      for (const sub of SUBJECTS) {
        const subId = crypto.randomUUID();
        await this.db.execute(
          'INSERT INTO "SubjectTemplate" (id, name, code, schoolId, curriculumVersionId) VALUES (?, ?, ?, ?, ?)',
          [subId, sub.name, sub.code, schoolId, curriculumVersionId],
        );
        templateIds.push(subId);
        stats.subjects++;
      }
    }

    const competencyIds: string[] = [];
    for (const comp of COMPETENCIES) {
      const compId = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "RvpCompetency" (id, code, name, area, schoolId) VALUES (?, ?, ?, ?, ?)',
        [compId, comp.code, comp.name, comp.area, schoolId],
      );
      competencyIds.push(compId);
    }

    const gradeLevelMap = new Map<number, string>();
    const maxGrade =
      config.schoolType.includes('Full') || config.schoolType.includes('full')
        ? 9
        : 5;
    for (let i = 1; i <= maxGrade; i++) {
      const glId = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "GradeLevel" (id, name, levelNumber, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [glId, `${i}. ročník`, i, schoolId, now, now],
      );
      gradeLevelMap.set(i, glId);
      stats.gradeLevels++;

      if (config.generateSubjects !== false) {
        for (const subId of templateIds) {
          await this.db.execute(
            'INSERT INTO "CurriculumEntry" (id, hoursPerWeek, curriculumVersionId, subjectTemplateId, gradeLevelId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              crypto.randomUUID(),
              randInt(1, 4),
              curriculumVersionId,
              subId,
              glId,
              now,
              now,
            ],
          );
          if (Math.random() < 0.2) {
            await this.db.execute(
              'INSERT INTO "CompetencyMapping" (id, competencyId, subjectTemplateId, gradeLevelId, fulfilled) VALUES (?, ?, ?, ?, 1)',
              [crypto.randomUUID(), pick(competencyIds), subId, glId],
            );
          }
        }
      }
    }

    // 4. USERS - STAFF (Leadership & Teachers)
    const leadershipUserIds: string[] = [];
    const staffToCreate = [
      {
        role: UserRole.PRINCIPAL,
        email: `headmaster@${schoolDomain}`,
        first: pick(MALE_FIRST),
        last: pick(LAST_NAMES),
      },
      {
        role: UserRole.DEPUTY,
        email: `deputy@${schoolDomain}`,
        first: pick(FEMALE_FIRST),
        last: pick(LAST_NAMES),
      },
    ];
    for (const r of staffToCreate) {
      const uid = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [uid, r.email, r.first, r.last, passwordHash, now],
      );
      await this.db.execute(
        'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), uid, schoolId, r.role, 'ACTIVE', now],
      );
      leadershipUserIds.push(uid);

      // Add Identity for staff
      await this.db.execute(
        'INSERT INTO "Identity" (id, provider, providerId, userId, createdAt) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), 'google', `google-staff-${uid}`, uid, now],
      );
      stats.identities++;

      // Add Notification
      await this.db.execute(
        'INSERT INTO "Notification" (id, userId, type, title, body, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          uid,
          'SYSTEM',
          'Vítejte v systému',
          'Váš účet byl úspěšně nastaven.',
          now,
        ],
      );
      stats.notifications++;
    }

    const teacherProfileIds: string[] = [];
    const teacherUserIds: string[] = [];
    const teacherProfileToUserMap = new Map<string, string>();
    const teacherCount = config.teacherCount ?? 15;
    for (let i = 0; i < teacherCount; i++) {
      const isFemale = Math.random() > 0.5;
      const fName = isFemale ? pick(FEMALE_FIRST) : pick(MALE_FIRST);
      const lName = pick(LAST_NAMES);
      const uid = crypto.randomUUID();
      const pid = crypto.randomUUID();
      const status =
        i < (config.teacherActiveCount ?? 12) ? 'ACTIVE' : 'PENDING';

      await this.db.execute(
        'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [
          uid,
          `${removeDiacritics(fName)}.${removeDiacritics(lName)}${i}@${schoolDomain}`,
          fName,
          lName,
          status === 'ACTIVE' ? passwordHash : null,
          now,
        ],
      );
      await this.db.execute(
        'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), uid, schoolId, UserRole.TEACHER, status, now],
      );
      await this.db.execute(
        'INSERT INTO "TeacherProfile" (id, userId, degree, approbation) VALUES (?, ?, ?, ?)',
        [pid, uid, pick(TEACHER_DEGREES), pick(TEACHER_APPROBATIONS)],
      );
      await this.db.execute(
        'INSERT INTO "StaffWorkload" (id, userId, academicYearId, versionLabel, teachingLoad, adminLoad, validFrom, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0.8, 0.2, ?, ?, ?)',
        [crypto.randomUUID(), uid, ayId, 'Základní', '2025-09-01', now, now],
      );

      // Teacher Workload table
      await this.db.execute(
        'INSERT INTO "TeacherWorkload" (id, teacherId, academicYearId, workloadPercentage, createdAt, updatedAt) VALUES (?, ?, ?, 100, ?, ?)',
        [crypto.randomUUID(), uid, ayId, now, now],
      );
      stats.workloads++;

      // Staff Subject Assignment
      const workloadId = (
        (await this.db.queryOne(
          'SELECT id FROM "StaffWorkload" WHERE userId = ?',
          [uid],
        )) as any
      ).id;
      await this.db.execute(
        'INSERT INTO "StaffSubjectAssignment" (id, staffWorkloadId, subjectTemplateId, gradeLevelIds, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          workloadId,
          pick(templateIds),
          JSON.stringify([pick(Array.from(gradeLevelMap.values()))]),
          now,
          now,
        ],
      );

      teacherProfileIds.push(pid);
      teacherUserIds.push(uid);
      teacherProfileToUserMap.set(pid, uid);
      stats.teachers++;
    }

    // 5. CLASSES & STUDENTS & PARENTS
    const classrooms: Array<{ id: string; grade: number; name: string }> = [];
    for (let i = 1; i <= maxGrade; i++) {
      for (const letter of ['A', 'B']) {
        const cId = crypto.randomUUID();
        const cName = `${i}.${letter}`;
        await this.db.execute(
          'INSERT INTO "Classroom" (id, name, grade, schoolId) VALUES (?, ?, ?, ?)',
          [cId, cName, i, schoolId],
        );
        classrooms.push({ id: cId, grade: i, name: cName });
        stats.classrooms++;

        // Assign Homeroom teacher
        const tPid = pick(teacherProfileIds);
        await this.db.execute(
          'UPDATE "TeacherProfile" SET homeroomClassId = ? WHERE id = ?',
          [cId, tPid],
        );
      }
    }

    const studentCount = config.studentCount ?? 100;
    const parentUserIds: string[] = [];
    const studentUserIds: string[] = [];
    const studentProfileIds: string[] = [];

    for (let i = 0; i < studentCount; i++) {
      const isFemale = Math.random() > 0.5;
      const fName = isFemale ? pick(FEMALE_FIRST) : pick(MALE_FIRST);
      const lName = pick(LAST_NAMES);
      const uid = crypto.randomUUID();
      const pid = crypto.randomUUID();
      const classroom = pick(classrooms);
      const status =
        i < (config.studentActiveCount ?? 80) ? 'ACTIVE' : 'PENDING';

      await this.db.execute(
        'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [
          uid,
          `student${i}@zak.${schoolDomain}`,
          fName,
          lName,
          status === 'ACTIVE' ? passwordHash : null,
          now,
        ],
      );
      await this.db.execute(
        'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), uid, schoolId, UserRole.STUDENT, status, now],
      );
      await this.db.execute(
        'INSERT INTO "StudentProfile" (id, userId, firstName, lastName, classroomId) VALUES (?, ?, ?, ?, ?)',
        [pid, uid, fName, lName, classroom.id],
      );
      await this.db.execute(
        'INSERT INTO "StudentEnrollment" (id, studentId, academicYearId, gradeLevelId, classroomId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          uid,
          ayId,
          gradeLevelMap.get(classroom.grade)!,
          classroom.id,
          now,
          now,
        ],
      );

      // Add Identity for student
      if (i < 10) {
        await this.db.execute(
          'INSERT INTO "Identity" (id, provider, providerId, userId, createdAt) VALUES (?, ?, ?, ?, ?)',
          [crypto.randomUUID(), 'microsoft', `ms-student-${uid}`, uid, now],
        );
        stats.identities++;
      }

      studentUserIds.push(uid);
      studentProfileIds.push(pid);
      stats.students++;

      // Parents
      const parentName = pick(LAST_NAMES);
      const pUid = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [
          pUid,
          `parent${i}@par.${schoolDomain}`,
          pick(MALE_FIRST),
          parentName,
          passwordHash,
          now,
        ],
      );
      await this.db.execute(
        'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), pUid, schoolId, UserRole.PARENT, 'ACTIVE', now],
      );
      await this.db.execute(
        'INSERT INTO "ParentStudent" (id, parentId, studentId) VALUES (?, ?, ?)',
        [crypto.randomUUID(), pUid, uid],
      );
      parentUserIds.push(pUid);
      stats.parents++;

      // Absence Excuse
      if (i < 5) {
        await this.db.execute(
          'INSERT INTO "AbsenceExcuse" (id, reason, dateFrom, dateTo, status, parentId, studentId, schoolId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            'Nevolnost',
            '2026-05-10',
            '2026-05-12',
            'PENDING',
            pUid,
            pid,
            schoolId,
            now,
          ],
        );
        stats.excuses++;
      }
    }

    // 6. SCHEDULE & LESSON DATA
    if (config.generateSchedule !== false) {
      const subjectInstancesByGrade = new Map<number, string[]>();
      for (let g = 1; g <= maxGrade; g++) {
        const glId = gradeLevelMap.get(g)!;
        const instances: string[] = [];
        for (const subId of templateIds) {
          const siId = crypto.randomUUID();
          await this.db.execute(
            'INSERT INTO "SubjectInstance" (id, hoursPerWeek, templateId, academicYearId, gradeLevelId, curriculumVersionId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              siId,
              3,
              subId,
              ayId,
              glId,
              curriculumVersionId,
              schoolId,
              now,
              now,
            ],
          );
          instances.push(siId);
          stats.subjectInstances++;
        }
        subjectInstancesByGrade.set(g, instances);
      }

      // Generate schedule for ALL classrooms
      for (const cls of classrooms) {
        const insts = subjectInstancesByGrade.get(cls.grade)!;
        for (let d = 1; d <= 5; d++) {
          const lessonsPerDay = d === 5 ? 4 : 6;
          for (let l = 1; l <= lessonsPerDay; l++) {
            const siId = pick(insts);
            const tPid = pick(teacherProfileIds);
            const eventId = crypto.randomUUID();
            await this.db.execute(
              'INSERT INTO "ScheduleEvent" (id, dayOfWeek, lessonNumber, startTime, endTime, schoolId, subjectInstanceId, classroomId, teacherId, roomId, academicYearId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [
                eventId,
                d,
                l,
                START_TIMES[l - 1],
                END_TIMES[l - 1],
                schoolId,
                siId,
                cls.id,
                tPid,
                pick(roomIds),
                ayId,
                now,
                now,
              ],
            );
            stats.scheduleEvents++;

            // 7. CLASSBOOK & ATTENDANCE & GRADES
            const date = new Date();
            for (let offset = 0; offset <= 2; offset++) {
              date.setDate(new Date().getDate() - offset);
              if ((date.getDay() || 7) === d) {
                const entryId = crypto.randomUUID();
                const tUid = teacherProfileToUserMap.get(tPid)!;
                await this.db.execute(
                  'INSERT INTO "ClassBookEntry" (id, date, lessonNumber, topic, schoolId, classroomId, teacherId, scheduleEventId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [
                    entryId,
                    date.toISOString().split('T')[0],
                    l,
                    pick(['Opakování', 'Nová látka', 'Procvičování']),
                    schoolId,
                    cls.id,
                    tUid,
                    eventId,
                    now,
                    now,
                  ],
                );

                // Teacher Signature
                await this.db.execute(
                  'INSERT INTO "TeacherSignature" (id, classBookEntryId, teacherId, signedAt) VALUES (?, ?, ?, ?)',
                  [crypto.randomUUID(), entryId, tUid, now],
                );
                stats.signatures++;

                if (config.generateAttendance !== false) {
                  const studentsInCls = await this.db.query(
                    'SELECT id FROM "StudentProfile" WHERE classroomId = ?',
                    [cls.id],
                  );
                  for (const st of studentsInCls as any[]) {
                    const isAbsent = Math.random() < 0.05;
                    await this.db.execute(
                      'INSERT INTO "Attendance" (id, date, status, lessonNumber, schoolId, studentId, teacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                      [
                        crypto.randomUUID(),
                        date.toISOString().split('T')[0],
                        isAbsent ? 'ABSENT' : 'PRESENT',
                        l,
                        schoolId,
                        st.id,
                        tPid,
                        now,
                      ],
                    );
                    stats.attendanceRecords++;

                    if (
                      !isAbsent &&
                      config.generateGrades !== false &&
                      Math.random() < 0.15
                    ) {
                      const gradeId = crypto.randomUUID();
                      await this.db.execute(
                        'INSERT INTO "Grade" (id, value, weight, description, date, schoolId, studentId, subjectInstanceId, teacherId, academicYearId, semesterId, createdAt) VALUES (?, ?, 1.0, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                          gradeId,
                          String(randInt(1, 3)),
                          pick(GRADE_DESCRIPTIONS),
                          date.toISOString().split('T')[0],
                          schoolId,
                          st.id,
                          siId,
                          tPid,
                          ayId,
                          s1Id,
                          now,
                        ],
                      );
                      stats.grades++;

                      // Add Competency Grade
                      await this.db.execute(
                        'INSERT INTO "CompetencyGrade" (id, level, note, studentId, competencyId, subjectInstanceId, semesterId, schoolId, teacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                          crypto.randomUUID(),
                          randInt(1, 4),
                          'Dobrá práce',
                          st.id,
                          pick(competencyIds),
                          siId,
                          s1Id,
                          schoolId,
                          tPid,
                          now,
                        ],
                      );
                      stats.competencyGrades++;

                      // Commission Exam entry
                      if (Math.random() < 0.01) {
                        await this.db.execute(
                          'INSERT INTO "CommissionExam" (id, date, originalGrade, newGrade, note, studentId, subjectInstanceId, semesterId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                          [
                            crypto.randomUUID(),
                            now,
                            '5',
                            '3',
                            'Opravná zkouška',
                            st.id,
                            siId,
                            s1Id,
                            schoolId,
                            now,
                            now,
                          ],
                        );
                        stats.commissionExams++;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Add a snapshot and a substitution
      const someEvent = (
        (await this.db.query(
          'SELECT * FROM "ScheduleEvent" WHERE schoolId = ? LIMIT 1',
          [schoolId],
        )) as any[]
      )[0];
      if (someEvent) {
        await this.db.execute(
          'INSERT INTO "ScheduleSnapshot" (id, name, data, schoolId, academicYearId, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            'Verze 1.0',
            JSON.stringify({ events: [] }),
            schoolId,
            ayId,
            now,
          ],
        );
        await this.db.execute(
          'INSERT INTO "ScheduleSubstitution" (id, date, type, originalEventId, createdById, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            now,
            'TEACHER_CHANGE',
            someEvent.id,
            leadershipUserIds[0],
            schoolId,
            now,
            now,
          ],
        );
      }

      // Add a recurring event (kroužek)
      await this.db.execute(
        'INSERT INTO "RecurringEvent" (id, title, dayOfWeek, startTime, endTime, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          'Kroužek robotiky',
          3,
          '15:30',
          '17:00',
          schoolId,
          now,
          now,
        ],
      );
    }

    // 8. COMMUNITY & COMMUNICATION
    if (config.generateCommunity !== false) {
      const headmasterUid = leadershipUserIds[0];
      for (let i = 1; i <= 4; i++) {
        const bulletinId = crypto.randomUUID();
        await this.db.execute(
          'INSERT INTO "BulletinPost" (id, title, content, pinned, authorId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            bulletinId,
            `Důležité oznámení #${i}`,
            'Informace pro všechny uživatele školy.',
            i === 1 ? 1 : 0,
            headmasterUid,
            schoolId,
            now,
            now,
          ],
        );
        stats.bulletinPosts++;

        const evDate = new Date();
        evDate.setDate(evDate.getDate() + i * 7);
        const eventId = crypto.randomUUID();
        await this.db.execute(
          'INSERT INTO "SchoolEvent" (id, title, description, date, type, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            eventId,
            `Školní akce #${i}`,
            'Popis události a program.',
            evDate.toISOString(),
            pick(['SCHOOL_TRIP', 'PARENT_MEETING', 'OTHER']),
            schoolId,
            now,
            now,
          ],
        );
        stats.calendarEvents++;

        // Also add CalendarEvent (they are separate tables in this schema)
        const calEventId = crypto.randomUUID();
        await this.db.execute(
          'INSERT INTO "CalendarEvent" (id, title, description, startDate, authorId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            calEventId,
            `Kalendářová událost #${i}`,
            'Detail v kalendáři',
            evDate.toISOString(),
            headmasterUid,
            schoolId,
            now,
            now,
          ],
        );

        // Event RSVP
        await this.db.execute(
          'INSERT INTO "EventRsvp" (id, userId, eventId, status, createdAt) VALUES (?, ?, ?, ?, ?)',
          [crypto.randomUUID(), teacherUserIds[0], calEventId, 'ACCEPTED', now],
        );
        stats.eventRsvps++;
      }

      const pollId = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "Poll" (id, question, authorId, schoolId, createdAt) VALUES (?, ?, ?, ?, ?)',
        [
          pollId,
          'Jaký termín školního výletu preferujete?',
          headmasterUid,
          schoolId,
          now,
        ],
      );
      for (const opt of ['Červen', 'Září']) {
        const optionId = crypto.randomUUID();
        await this.db.execute(
          'INSERT INTO "PollOption" (id, text, pollId) VALUES (?, ?, ?)',
          [optionId, opt, pollId],
        );
        // Poll Vote
        await this.db.execute(
          'INSERT INTO "PollVote" (id, userId, optionId, createdAt) VALUES (?, ?, ?, ?)',
          [crypto.randomUUID(), teacherUserIds[0], optionId, now],
        );
        stats.pollVotes++;
      }
      stats.polls = 1;
    }

    if (config.generateCommunication !== false) {
      const cId = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "Conversation" (id, subject, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [cId, 'Dotaz na učivo', schoolId, now, now],
      );
      await this.db.execute(
        'INSERT INTO "ConversationParticipant" (id, conversationId, userId, createdAt) VALUES (?, ?, ?, ?)',
        [crypto.randomUUID(), cId, teacherUserIds[0], now],
      );
      await this.db.execute(
        'INSERT INTO "ConversationParticipant" (id, conversationId, userId, createdAt) VALUES (?, ?, ?, ?)',
        [crypto.randomUUID(), cId, parentUserIds[0], now],
      );
      for (let j = 0; j < 3; j++) {
        const msgId = crypto.randomUUID();
        await this.db.execute(
          'INSERT INTO "Message" (id, conversationId, senderId, content, createdAt) VALUES (?, ?, ?, ?, ?)',
          [
            msgId,
            cId,
            j % 2 === 0 ? parentUserIds[0] : teacherUserIds[0],
            pick(MESSAGE_CONTENTS),
            now,
          ],
        );
        stats.messages++;

        // Message Attachment
        if (j === 0) {
          await this.db.execute(
            'INSERT INTO "MessageAttachment" (id, messageId, fileName, mimeType, fileSize, filePath, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              crypto.randomUUID(),
              msgId,
              'dokument.pdf',
              'application/pdf',
              1024,
              '/path',
              now,
            ],
          );
          stats.messageAttachments++;
        }
      }
      stats.conversations = 1;
    }

    // 9. TEACHER DATA (Thematic plans, Preparations, Materials)
    const someTeacherId = teacherUserIds[0];
    const someSubId = templateIds[0];
    const glId = gradeLevelMap.get(1)!;

    const planId = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "ThematicPlan" (id, title, subjectTemplateId, academicYearId, gradeLevelId, teacherId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        planId,
        'Celoroční plán - Matematika',
        someSubId,
        ayId,
        glId,
        someTeacherId,
        schoolId,
        now,
        now,
      ],
    );
    for (let w = 1; w <= 5; w++) {
      await this.db.execute(
        'INSERT INTO "ThematicPlanWeek" (id, weekNumber, topic, planId) VALUES (?, ?, ?, ?)',
        [crypto.randomUUID(), w, `Téma týdne ${w}`, planId],
      );
    }
    stats.thematicPlans = 1;

    await this.db.execute(
      'INSERT INTO "LessonPreparation" (id, title, date, topic, subjectTemplateId, teacherId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        'Příprava na pondělí',
        now,
        'Úvod do problematiky',
        someSubId,
        someTeacherId,
        schoolId,
        now,
        now,
      ],
    );
    stats.lessonPreparations = 1;

    await this.db.execute(
      'INSERT INTO "TeachingMaterial" (id, title, url, uploadedById, schoolId, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        'Prezentace ke studiu',
        'https://example.com/slide.pdf',
        someTeacherId,
        schoolId,
        now,
      ],
    );
    stats.materials = 1;

    // 10. REPORT CARDS & MEASURES & AUDIT & USAGE
    if (config.generateReportCards !== false) {
      const someStudentPid = studentProfileIds[0];
      const someSiId = (
        (await this.db.query(
          'SELECT id FROM "SubjectInstance" WHERE schoolId = ? LIMIT 1',
          [schoolId],
        )) as any[]
      )[0]?.id;
      if (someSiId) {
        await this.db.execute(
          'INSERT INTO "ReportCard" (id, finalGrade, studentId, subjectInstanceId, semesterId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            '1',
            someStudentPid,
            someSiId,
            s1Id,
            schoolId,
            now,
            now,
          ],
        );
        stats.reportCards = 1;
      }
      await this.db.execute(
        'INSERT INTO "BehaviorGrade" (id, grade, studentId, semesterId, schoolId, createdAt, updatedAt) VALUES (?, 1, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), someStudentPid, s1Id, schoolId, now, now],
      );
      stats.behaviorGrades = 1;

      await this.db.execute(
        'INSERT INTO "EducationalMeasure" (id, type, reason, studentId, issuedById, schoolId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          'PRAISE',
          'Za vzornou reprezentaci školy',
          someStudentPid,
          leadershipUserIds[0] || teacherUserIds[0],
          schoolId,
          now,
        ],
      );
    }

    // AI Token Usage
    await this.db.execute(
      'INSERT INTO "AiTokenUsage" (id, userId, schoolId, provider, modelName, inputTokens, outputTokens, totalTokens, promptType, createdAt) VALUES (?, ?, ?, ?, ?, 100, 200, 300, ?, ?)',
      [
        crypto.randomUUID(),
        leadershipUserIds[0],
        schoolId,
        'google',
        'gemini-pro',
        'CHAT',
        now,
      ],
    );
    stats.tokenUsage++;

    await this.db.execute(
      'INSERT INTO "AuditLog" (id, actorId, action, entity, schoolId, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        leadershipUserIds[0],
        'GENERATE_TEST_DATA',
        'School',
        schoolId,
        now,
      ],
    );

    return {
      schoolId,
      schoolName: config.schoolName,
      stats,
      adminCredentials: {
        email: `headmaster@${schoolDomain}`,
        password: demoPassword,
      },
    };
  }

  async wipeSchoolData(schoolId: string) {
    this.logger.warn(`Wiping data for school ${schoolId}`);

    // Get school domain for fallback user cleanup
    const school = await this.db.queryOne(
      'SELECT name FROM "School" WHERE id = ?',
      [schoolId],
    );
    const schoolName = (school as any)?.name || '';
    const domainBase = removeDiacritics(schoolName)
      .replace(/\s+/g, '')
      .toLowerCase();
    const schoolDomain = schoolName
      ? `${domainBase}.${schoolId.slice(0, 8)}.demo.test`
      : 'none';

    await this.db.execute('PRAGMA foreign_keys = OFF');

    // 1. Delete from tables that are linked indirectly (MUST DO THIS FIRST while SchoolMembership still exists)
    const indirectDeletions = [
      {
        table: 'Notification',
        sql: 'DELETE FROM "Notification" WHERE userId IN (SELECT userId FROM "SchoolMembership" WHERE schoolId = ?)',
      },
      {
        table: 'MessageAttachment',
        sql: 'DELETE FROM "MessageAttachment" WHERE messageId IN (SELECT m.id FROM "Message" m JOIN "Conversation" c ON m.conversationId = c.id WHERE c.schoolId = ?)',
      },
      {
        table: 'Message',
        sql: 'DELETE FROM "Message" WHERE conversationId IN (SELECT id FROM "Conversation" WHERE schoolId = ?)',
      },
      {
        table: 'ConversationParticipant',
        sql: 'DELETE FROM "ConversationParticipant" WHERE conversationId IN (SELECT id FROM "Conversation" WHERE schoolId = ?)',
      },
      {
        table: 'TeacherSignature',
        sql: 'DELETE FROM "TeacherSignature" WHERE teacherId IN (SELECT userId FROM "SchoolMembership" WHERE schoolId = ?)',
      },
      {
        table: 'PollVote',
        sql: 'DELETE FROM "PollVote" WHERE userId IN (SELECT userId FROM "SchoolMembership" WHERE schoolId = ?)',
      },
      {
        table: 'PollOption',
        sql: 'DELETE FROM "PollOption" WHERE pollId IN (SELECT id FROM "Poll" WHERE schoolId = ?)',
      },
      {
        table: 'EventRsvp',
        sql: 'DELETE FROM "EventRsvp" WHERE userId IN (SELECT userId FROM "SchoolMembership" WHERE schoolId = ?)',
      },
      {
        table: 'CurriculumEntry',
        sql: 'DELETE FROM "CurriculumEntry" WHERE curriculumVersionId IN (SELECT id FROM "CurriculumVersion" WHERE schoolId = ?)',
      },
      {
        table: 'StaffSubjectAssignment',
        sql: 'DELETE FROM "StaffSubjectAssignment" WHERE staffWorkloadId IN (SELECT sw.id FROM "StaffWorkload" sw JOIN "AcademicYear" ay ON sw.academicYearId = ay.id WHERE ay.schoolId = ?)',
      },
      {
        table: 'StaffWorkload',
        sql: 'DELETE FROM "StaffWorkload" WHERE academicYearId IN (SELECT id FROM "AcademicYear" WHERE schoolId = ?)',
      },
      {
        table: 'TeacherWorkload',
        sql: 'DELETE FROM "TeacherWorkload" WHERE academicYearId IN (SELECT id FROM "AcademicYear" WHERE schoolId = ?)',
      },
      {
        table: 'StudentEnrollment',
        sql: 'DELETE FROM "StudentEnrollment" WHERE academicYearId IN (SELECT id FROM "AcademicYear" WHERE schoolId = ?)',
      },
      {
        table: 'Semester',
        sql: 'DELETE FROM "Semester" WHERE academicYearId IN (SELECT id FROM "AcademicYear" WHERE schoolId = ?)',
      },
      {
        table: 'ParentStudent',
        sql: 'DELETE FROM "ParentStudent" WHERE studentId IN (SELECT sp.id FROM "StudentProfile" sp JOIN "User" u ON sp.userId = u.id JOIN "SchoolMembership" sm ON u.id = sm.userId WHERE sm.schoolId = ?)',
      },
      {
        table: 'TeacherProfile',
        sql: 'DELETE FROM "TeacherProfile" WHERE userId IN (SELECT userId FROM "SchoolMembership" WHERE schoolId = ?)',
      },
      {
        table: 'StudentProfile',
        sql: 'DELETE FROM "StudentProfile" WHERE userId IN (SELECT userId FROM "SchoolMembership" WHERE schoolId = ?)',
      },
      {
        table: 'Identity',
        sql: 'DELETE FROM "Identity" WHERE userId IN (SELECT userId FROM "SchoolMembership" WHERE schoolId = ?)',
      },
      {
        table: 'RoomSharing',
        sql: 'DELETE FROM "RoomSharing" WHERE roomId IN (SELECT id FROM "Room" WHERE schoolId = ?) OR sharedWithSchoolId = ?',
      },
      {
        table: 'ThematicPlanWeek',
        sql: 'DELETE FROM "ThematicPlanWeek" WHERE planId IN (SELECT id FROM "ThematicPlan" WHERE schoolId = ?)',
      },
      {
        table: 'CompetencyMapping',
        sql: 'DELETE FROM "CompetencyMapping" WHERE competencyId IN (SELECT id FROM "RvpCompetency" WHERE schoolId = ?)',
      },
    ];

    for (const d of indirectDeletions) {
      try {
        const params =
          d.table === 'RoomSharing' ? [schoolId, schoolId] : [schoolId];
        await this.db.execute(d.sql, params);
      } catch (e) {
        this.logger.warn(
          `Failed to wipe indirect table ${d.table}: ${e.message}`,
        );
      }
    }

    // 2. Delete non-admin users that belong to this school
    await this.db.execute(
      'DELETE FROM "User" WHERE (id IN (SELECT userId FROM "SchoolMembership" WHERE schoolId = ?) OR email LIKE ?) AND isSystemAdmin = 0',
      [schoolId, `%@${schoolDomain}`],
    );

    // Also clean up by potential subdomains
    await this.db.execute(
      'DELETE FROM "User" WHERE (email LIKE ? OR email LIKE ?) AND isSystemAdmin = 0',
      [`%@st.${schoolDomain}`, `%@par.${schoolDomain}`],
    );

    // 3. Delete from tables that have a direct schoolId column
    const directTables = [
      'AuditLog',
      'AiTokenUsage',
      'Conversation',
      'Grade',
      'ReportCard',
      'BehaviorGrade',
      'CompetencyGrade',
      'EducationalMeasure',
      'CommissionExam',
      'ClassificationDeadline',
      'ClassBookEntry',
      'Attendance',
      'AbsenceExcuse',
      'CalendarEvent',
      'Poll',
      'BulletinPost',
      'RecurringEvent',
      'ScheduleSnapshot',
      'ScheduleSubstitution',
      'ScheduleEvent',
      'LessonTimeSlot',
      'CurriculumVersion',
      'SubjectInstance',
      'SubjectTemplate',
      'AcademicYear',
      'Room',
      'Building',
      'Classroom',
      'GradeLevel',
      'RvpCompetency',
      'ThematicPlan',
      'LessonPreparation',
      'TeachingMaterial',
      'SchoolEvent',
      'SchoolMembership', // Must be last among these
    ];

    for (const t of directTables) {
      try {
        await this.db.execute(`DELETE FROM "${t}" WHERE "schoolId" = ?`, [
          schoolId,
        ]);
      } catch (e) {
        this.logger.warn(`Failed to wipe direct table ${t}: ${e.message}`);
      }
    }

    await this.db.execute('PRAGMA foreign_keys = ON');
  }

  async wipeAllData() {
    this.logger.warn('Wiping ALL data');
    const tables = [
      'AuditLog',
      'AiTokenUsage',
      'Notification',
      'MessageAttachment',
      'Message',
      'ConversationParticipant',
      'Conversation',
      'Grade',
      'ReportCard',
      'BehaviorGrade',
      'CompetencyGrade',
      'EducationalMeasure',
      'CommissionExam',
      'ClassificationDeadline',
      'TeacherSignature',
      'ClassBookEntry',
      'Attendance',
      'AbsenceExcuse',
      'EventRsvp',
      'CalendarEvent',
      'PollVote',
      'PollOption',
      'Poll',
      'BulletinPost',
      'RecurringEvent',
      'ScheduleSnapshot',
      'ScheduleSubstitution',
      'ScheduleEvent',
      'LessonTimeSlot',
      'CurriculumEntry',
      'CurriculumVersion',
      'SubjectInstance',
      'SubjectTemplate',
      'StaffSubjectAssignment',
      'StaffWorkload',
      'TeacherWorkload',
      'StudentEnrollment',
      'Semester',
      'AcademicYear',
      'ParentStudent',
      'TeacherProfile',
      'StudentProfile',
      'Identity',
      'SchoolMembership',
      'RoomSharing',
      'Room',
      'Building',
      'Classroom',
      'GradeLevel',
      'School',
      'SystemSecret',
      'ThematicPlanWeek',
      'ThematicPlan',
      'LessonPreparation',
      'TeachingMaterial',
      'SchoolEvent',
      'RvpCompetency',
      'CompetencyMapping',
    ];
    await this.db.execute('PRAGMA foreign_keys = OFF');
    for (const t of tables) {
      try {
        await this.db.execute(`DELETE FROM "${t}"`);
      } catch (e) {}
    }
    await this.db.execute('DELETE FROM "User" WHERE isSystemAdmin = 0');
    await this.db.execute('PRAGMA foreign_keys = ON');
  }
}
