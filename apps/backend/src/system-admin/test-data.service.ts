import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
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
  'Roman',
  'Milan',
  'Vladimír',
  'Aleš',
  'Richard',
  'Patrik',
  'Stanislav',
  'Dominik',
  'Štěpán',
  'Václav',
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
  'Michaela',
  'Simona',
  'Andrea',
  'Kristýna',
  'Denisa',
  'Nikola',
  'Adéla',
  'Karolína',
  'Gabriela',
  'Natálie',
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
  'Urban',
  'Vlček',
  'Hrubý',
  'Němec',
  'Pokorný',
  'Beneš',
  'Mach',
  'Holub',
  'Kadlec',
  'Strnad',
];
const TEACHER_DEGREES = [
  'Mgr.',
  'Mgr.',
  'Mgr.',
  'RNDr.',
  'PhDr.',
  'Ing.',
  'PaedDr.',
  'MgA.',
];
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
  'Hudební výchova',
  'Výtvarná výchova',
  'Občanská výchova',
  'Německý jazyk',
  '1. stupeň ZŠ',
  'Speciální pedagogika',
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
  'Laboratorní práce',
  'Čtenářský deník',
  'Seminární práce',
  'Diktát',
  'Slohová práce',
];
const MESSAGE_CONTENTS = [
  'Dobrý den, chtěl bych se zeptat na domácí úkol z minulé hodiny.',
  'Děkuji za informaci. Budu se snažit to napravit.',
  'Prosím o schůzku ohledně prospěchu mého dítěte.',
  'Připomínám, že zítra bude písemná práce z 3. a 4. kapitoly.',
  'Omlouvám absenci svého syna/dcery z důvodu nemoci.',
  'Chtěla bych poděkovat za individuální přístup k mému dítěti.',
  'Můžete mi prosím poslat podklady k doplnění učiva?',
  'Informuji vás o plánované třídní schůzce příští týden.',
  'Potřebuji se domluvit na termínu náhradní písemky.',
  'Váš syn/dcera dnes zapomněl sešit, prosím o kontrolu pomůcek.',
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

@Injectable()
export class TestDataService {
  private readonly logger = new Logger(TestDataService.name);

  constructor(private db: DatabaseService) {}

  async generateAll(config: any): Promise<any> {
    this.logger.log(`Generating test data for ${config.schoolName}`);

    const demoPassword = process.env.DEMO_PASSWORD || 'Demo1234!';
    const passwordHash = await bcrypt.hash(demoPassword, 10);

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
        [
          id,
          config.schoolName,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );
      school = await this.db.queryOne('SELECT * FROM "School" WHERE id = ?', [
        id,
      ]);
    }
    const schoolId = (school as any).id;

    // Academic Year
    const ayId = crypto.randomUUID();
    await this.db.execute(
      'INSERT INTO "AcademicYear" (id, name, startDate, endDate, isCurrent, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
      [
        ayId,
        '2025/2026',
        '2025-09-01',
        '2026-06-30',
        schoolId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    // Semesters
    await this.db.execute(
      'INSERT INTO "Semester" (id, number, name, startDate, endDate, academicYearId, createdAt, updatedAt) VALUES (?, 1, "1. pololetí", "2025-09-01", "2026-01-31", ?, ?, ?)',
      [
        crypto.randomUUID(),
        ayId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    await this.db.execute(
      'INSERT INTO "Semester" (id, number, name, startDate, endDate, academicYearId, createdAt, updatedAt) VALUES (?, 2, "2. pololetí", "2026-02-01", "2026-06-30", ?, ?, ?)',
      [
        crypto.randomUUID(),
        ayId,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    // Grade Levels & Classrooms
    const classroomIds = [];
    const gradeLevelMap = new Map<number, string>();
    for (let i = 1; i <= 9; i++) {
      const glId = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "GradeLevel" (id, name, levelNumber, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [
          glId,
          `${i}. ročník`,
          i,
          schoolId,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );
      gradeLevelMap.set(i, glId);

      for (const letter of ['A', 'B']) {
        const cId = crypto.randomUUID();
        await this.db.execute(
          'INSERT INTO "Classroom" (id, name, grade, schoolId) VALUES (?, ?, ?, ?)',
          [cId, `${i}.${letter}`, i, schoolId],
        );
        classroomIds.push(cId);
      }
    }

    // Teachers
    const teacherUserIds = [];
    const schoolDomain = `${removeDiacritics(config.schoolName).replace(/\s+/g, '')}.demo.test`;
    for (let i = 0; i < config.teacherCount; i++) {
      const isFemale = Math.random() > 0.5;
      const firstName = isFemale ? pick(FEMALE_FIRST) : pick(MALE_FIRST);
      const lastName = pick(LAST_NAMES);
      const email = `${removeDiacritics(lastName)}${i}@${schoolDomain}`;
      const userId = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [
          userId,
          email,
          firstName,
          lastName,
          passwordHash,
          new Date().toISOString(),
        ],
      );
      await this.db.execute(
        'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          userId,
          schoolId,
          UserRole.TEACHER,
          UserStatus.ACTIVE,
          new Date().toISOString(),
        ],
      );
      await this.db.execute(
        'INSERT INTO "TeacherProfile" (id, userId, degree, approbation) VALUES (?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          userId,
          pick(TEACHER_DEGREES),
          pick(TEACHER_APPROBATIONS),
        ],
      );
      teacherUserIds.push(userId);
    }

    return { schoolId, schoolName: config.schoolName };
  }

  async wipeSchoolData(schoolId: string) {
    this.logger.warn(`Wiping data for school ${schoolId}`);
    const tables = [
      'AuditLog',
      'SystemLog',
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
    ];

    await this.db.execute('PRAGMA foreign_keys = OFF');
    for (const t of tables) {
      try {
        await this.db.execute(`DELETE FROM "${t}" WHERE "schoolId" = ?`, [
          schoolId,
        ]);
      } catch (e) {}
    }
    await this.db.execute('DELETE FROM "School" WHERE id = ?', [schoolId]);
    await this.db.execute('PRAGMA foreign_keys = ON');
  }

  async wipeAllData() {
    this.logger.warn('Wiping ALL data');
    const tables = [
      'AuditLog',
      'SystemLog',
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
