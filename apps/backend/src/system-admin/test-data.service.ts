import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

// ─── Subject definitions ─────────────────────────────────────────

interface SubjectDef {
  name: string;
  code: string;
}

const SUBJECTS_ELEMENTARY_1: SubjectDef[] = [
  { name: 'Český jazyk a literatura', code: 'CJL' },
  { name: 'Anglický jazyk', code: 'AJ' },
  { name: 'Matematika', code: 'M' },
  { name: 'Prvouka', code: 'PRV' },
  { name: 'Přírodověda', code: 'PŘ' },
  { name: 'Vlastivěda', code: 'VL' },
  { name: 'Hudební výchova', code: 'HV' },
  { name: 'Výtvarná výchova', code: 'VV' },
  { name: 'Tělesná výchova', code: 'TV' },
  { name: 'Pracovní činnosti', code: 'PČ' },
  { name: 'Informatika', code: 'INF' },
];
const SUBJECTS_ELEMENTARY_2: SubjectDef[] = [
  { name: 'Český jazyk a literatura', code: 'CJL' },
  { name: 'Anglický jazyk', code: 'AJ' },
  { name: 'Německý jazyk', code: 'NJ' },
  { name: 'Matematika', code: 'M' },
  { name: 'Fyzika', code: 'F' },
  { name: 'Chemie', code: 'CH' },
  { name: 'Přírodopis', code: 'PŘ' },
  { name: 'Zeměpis', code: 'Z' },
  { name: 'Dějepis', code: 'D' },
  { name: 'Občanská výchova', code: 'OV' },
  { name: 'Hudební výchova', code: 'HV' },
  { name: 'Výtvarná výchova', code: 'VV' },
  { name: 'Tělesná výchova', code: 'TV' },
  { name: 'Pracovní činnosti', code: 'PČ' },
  { name: 'Informatika', code: 'INF' },
];
const SUBJECTS_GYMNASIUM: SubjectDef[] = [
  { name: 'Český jazyk a literatura', code: 'CJL' },
  { name: 'Anglický jazyk', code: 'AJ' },
  { name: 'Německý jazyk', code: 'NJ' },
  { name: 'Francouzský jazyk', code: 'FJ' },
  { name: 'Matematika', code: 'M' },
  { name: 'Fyzika', code: 'F' },
  { name: 'Chemie', code: 'CH' },
  { name: 'Biologie', code: 'BI' },
  { name: 'Zeměpis', code: 'Z' },
  { name: 'Dějepis', code: 'D' },
  { name: 'Základy společenských věd', code: 'ZSV' },
  { name: 'Hudební výchova', code: 'HV' },
  { name: 'Výtvarná výchova', code: 'VV' },
  { name: 'Tělesná výchova', code: 'TV' },
  { name: 'Informatika a výpočetní technika', code: 'IVT' },
];

function getSubjectsForType(type: string): SubjectDef[] {
  switch (type) {
    case 'elementary_1':
      return SUBJECTS_ELEMENTARY_1;
    case 'elementary_full': {
      const merged = [...SUBJECTS_ELEMENTARY_1, ...SUBJECTS_ELEMENTARY_2];
      const seen = new Set<string>();
      return merged.filter((s: any) => {
        if (seen.has(s.code)) return false;
        seen.add(s.code);
        return true;
      });
    }
    case 'gymnasium_8':
    case 'gymnasium_4':
      return SUBJECTS_GYMNASIUM;
    default:
      return SUBJECTS_ELEMENTARY_1;
  }
}

interface GradeDef {
  levelNumber: number;
  levelName: string;
  classrooms: string[];
}

function getGradesForType(type: string): GradeDef[] {
  switch (type) {
    case 'elementary_1':
      return Array.from({ length: 5 }, (_, i) => ({
        levelNumber: i + 1,
        levelName: `${i + 1}. ročník`,
        classrooms: [`${i + 1}.A`, `${i + 1}.B`],
      }));
    case 'elementary_full':
      return Array.from({ length: 9 }, (_, i) => ({
        levelNumber: i + 1,
        levelName: `${i + 1}. ročník`,
        classrooms: [`${i + 1}.A`, `${i + 1}.B`],
      }));
    case 'gymnasium_8': {
      const names = [
        'Prima',
        'Sekunda',
        'Tercie',
        'Kvarta',
        'Kvinta',
        'Sexta',
        'Septima',
        'Oktáva',
      ];
      return names.map((name, i) => ({
        levelNumber: i + 1,
        levelName: name,
        classrooms: [`${name} A`, `${name} B`],
      }));
    }
    case 'gymnasium_4':
      return Array.from({ length: 4 }, (_, i) => ({
        levelNumber: i + 1,
        levelName: `${i + 1}. ročník`,
        classrooms: [`${i + 1}.A`, `${i + 1}.B`],
      }));
    default:
      return [];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

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

// Pre-computed bcrypt hash for 'Demo1234!'
const DEMO_PASSWORD_HASH =
  '$2b$10$8K1p/q5zQxl0SRDV4Gqe6eruJ3Mn1.Tl5Yng3ORq0q6Z8hMO0dPHG';

// ─── Config types ────────────────────────────────────────────────

export interface GenerateConfig {
  schoolName: string;
  schoolType:
    | 'elementary_1'
    | 'elementary_full'
    | 'gymnasium_8'
    | 'gymnasium_4';
  teacherCount: number;
  teacherActiveCount: number;
  teacherInvitedCount: number;
  studentCount: number;
  studentActiveCount: number;
  studentInvitedCount: number;
  parentCount: number; // 0 = auto (1 per student)
  generateSubjects: boolean;
  generateSchedule: boolean;
  generateGrades: boolean;
  generateCommunication: boolean;
  generateAttendance?: boolean;
  generateReportCards?: boolean;
  generateCommunity?: boolean;
}

export interface GenerateResult {
  schoolId: string;
  schoolName: string;
  stats: {
    academicYear: string;
    gradeLevels: number;
    classrooms: number;
    subjects: number;
    teachers: number;
    students: number;
    parents: number;
    subjectInstances: number;
    scheduleEvents: number;
    grades: number;
    conversations: number;
    messages: number;
    notifications: number;
    attendanceRecords: number;
    excuses: number;
    reportCards: number;
    behaviorGrades: number;
    bulletinPosts: number;
    polls: number;
    calendarEvents: number;
  };
}

// ═════════════════════════════════════════════════════════════════
// SERVICE
// ═════════════════════════════════════════════════════════════════

@Injectable()
export class TestDataService {
  private readonly logger = new Logger(TestDataService.name);

  constructor(private prisma: PrismaService) {}

  // ─── MAIN ORCHESTRATOR ───────────────────────────────────────

  async generateAll(config: GenerateConfig): Promise<GenerateResult> {
    this.logger.log(
      `Generating test data for school '${config.schoolName}' (${config.schoolType})`,
    );

    const stats: GenerateResult['stats'] = {
      academicYear: '',
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
      notifications: 0,
      attendanceRecords: 0,
      excuses: 0,
      reportCards: 0,
      behaviorGrades: 0,
      bulletinPosts: 0,
      polls: 0,
      calendarEvents: 0,
    };

    // 1. Create school (upsert if exists)
    let school = await this.prisma.school.findFirst({
      where: { name: config.schoolName },
    });

    if (school) {
      this.logger.log(`School ${config.schoolName} already exists. Wiping data before regenerating...`);
      await this.wipeSchoolData(school.id);
    } else {
      school = await this.prisma.school.create({
        data: { name: config.schoolName },
      });
    }
    const schoolId = school.id;

    // 2. Create structure
    const { academicYear, classroomIds, gradeLevelMap } =
      await this.createStructure(schoolId, config.schoolType, stats);

    // 3. Create users
    const teacherUserIds = await this.createTeachers(
      schoolId,
      config,
      academicYear?.id,
      stats,
    );
    const { studentUserIds, studentProfileIds } = await this.createStudents(
      schoolId,
      config,
      classroomIds,
      academicYear,
      gradeLevelMap,
      stats,
    );
    const parentUserIds = await this.createParents(
      schoolId,
      config,
      studentUserIds,
      stats,
    );

    // 4. Create subjects
    let subjectInstanceIds: string[] = [];
    let teacherProfileIds: string[] = [];
    if (config.generateSubjects) {
      const result = await this.createSubjects(
        schoolId,
        config.schoolType,
        academicYear,
        gradeLevelMap,
        stats,
      );
      subjectInstanceIds = result.subjectInstanceIds;
    }
    // get teacher profile IDs
    const teacherProfiles = await this.prisma.teacherProfile.findMany({
      where: { userId: { in: teacherUserIds } },
      select: { id: true },
    });
    teacherProfileIds = teacherProfiles.map((t: any) => t.id);

    // 5. Schedule
    if (
      config.generateSchedule &&
      subjectInstanceIds.length > 0 &&
      teacherProfileIds.length > 0
    ) {
      await this.createSchedule(
        schoolId,
        academicYear,
        classroomIds,
        subjectInstanceIds,
        teacherProfileIds,
        stats,
      );
    }

    // 6. Grades
    if (
      config.generateGrades &&
      subjectInstanceIds.length > 0 &&
      studentProfileIds.length > 0 &&
      teacherProfileIds.length > 0
    ) {
      await this.createGrades(
        schoolId,
        academicYear,
        subjectInstanceIds,
        studentProfileIds,
        teacherProfileIds,
        stats,
      );
    }

    // 7. Communication
    if (
      config.generateCommunication &&
      (teacherUserIds.length > 0 || studentUserIds.length > 0)
    ) {
      await this.createCommunication(
        schoolId,
        teacherUserIds,
        studentUserIds,
        parentUserIds,
        stats,
      );
    }

    // 8. Attendance & Excuses
    if (
      config.generateAttendance !== false &&
      studentProfileIds.length > 0 &&
      teacherProfileIds.length > 0 &&
      subjectInstanceIds.length > 0
    ) {
      await this.createAttendance(
        schoolId,
        academicYear,
        classroomIds,
        studentProfileIds,
        teacherProfileIds,
        parentUserIds,
        stats,
      );
    }

    // 9. Report Cards & Behavior
    if (
      config.generateReportCards !== false &&
      studentProfileIds.length > 0 &&
      subjectInstanceIds.length > 0
    ) {
      await this.createReportCards(
        schoolId,
        academicYear,
        subjectInstanceIds,
        studentProfileIds,
        stats,
      );
    }

    // 10. Community (Bulletin, Polls, Calendar)
    if (config.generateCommunity !== false && teacherUserIds.length > 0) {
      await this.createCommunity(
        schoolId,
        teacherUserIds,
        studentUserIds,
        parentUserIds,
        stats,
      );
    }

    return { schoolId, schoolName: config.schoolName, stats };
  }

  // ─── STRUCTURE ───────────────────────────────────────────────

  private async createStructure(
    schoolId: string,
    schoolType: string,
    stats: GenerateResult['stats'],
  ) {
    const grades = getGradesForType(schoolType);
    const yearName = '2025/2026';

    const academicYear = await this.prisma.academicYear.create({
      data: {
        name: yearName,
        startDate: new Date('2025-09-01'),
        endDate: new Date('2026-06-30'),
        isCurrent: true,
        schoolId,
      },
    });
    stats.academicYear = yearName;

    // Create semesters
    await this.prisma.semester.createMany({
      data: [
        {
          number: 1,
          name: '1. pololetí',
          startDate: new Date('2025-09-01'),
          endDate: new Date('2026-01-31'),
          academicYearId: academicYear.id,
        },
        {
          number: 2,
          name: '2. pololetí',
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-06-30'),
          academicYearId: academicYear.id,
        },
      ],
    });

    const classroomIds: string[] = [];
    const gradeLevelMap: Record<number, string> = {}; // levelNumber -> gradeLevelId

    for (const grade of grades) {
      const gradeLevel = await this.prisma.gradeLevel.create({
        data: {
          name: grade.levelName,
          levelNumber: grade.levelNumber,
          schoolId,
        },
      });
      gradeLevelMap[grade.levelNumber] = gradeLevel.id;
      stats.gradeLevels++;

      for (const className of grade.classrooms) {
        const classroom = await this.prisma.classroom.create({
          data: { name: className, grade: grade.levelNumber, schoolId },
        });
        classroomIds.push(classroom.id);
        stats.classrooms++;
      }
    }

    // Create time slots
    const slots = [
      { lessonNumber: 1, startTime: '08:00', endTime: '08:45' },
      { lessonNumber: 2, startTime: '08:55', endTime: '09:40' },
      { lessonNumber: 3, startTime: '10:00', endTime: '10:45' },
      { lessonNumber: 4, startTime: '10:55', endTime: '11:40' },
      { lessonNumber: 5, startTime: '11:50', endTime: '12:35' },
      { lessonNumber: 6, startTime: '12:45', endTime: '13:30' },
      { lessonNumber: 7, startTime: '13:40', endTime: '14:25' },
      { lessonNumber: 8, startTime: '14:35', endTime: '15:20' },
    ];
    await this.prisma.lessonTimeSlot.createMany({
      data: slots.map((s: any) => ({ ...s, schoolId })),
    });

    // Create rooms
    const rooms = [
      'A101',
      'A102',
      'A103',
      'B201',
      'B202',
      'B203',
      'C301',
      'PC1',
      'Tělocvična',
      'Aula',
    ];
    for (const name of rooms) {
      await this.prisma.room.create({
        data: {
          name,
          schoolId,
          capacity: name === 'Tělocvična' ? 60 : name === 'Aula' ? 100 : 30,
          isComputerLab: name.startsWith('PC'),
        },
      });
    }

    return { academicYear, classroomIds, gradeLevelMap };
  }

  // ─── TEACHERS ────────────────────────────────────────────────

  private async createTeachers(
    schoolId: string,
    config: GenerateConfig,
    academicYearId: string | undefined,
    stats: GenerateResult['stats'],
  ): Promise<string[]> {
    const userIds: string[] = [];
    const totalTeachers = config.teacherCount;
    const usedEmails = new Set<string>();

    for (let i = 0; i < totalTeachers; i++) {
      const isFemale = Math.random() > 0.4; // slightly more female teachers
      const firstName = isFemale ? pick(FEMALE_FIRST) : pick(MALE_FIRST);
      const lastName = pick(LAST_NAMES);
      let email = `${removeDiacritics(lastName)}${i}@demo.edustack.cz`;
      while (usedEmails.has(email)) {
        email = `${removeDiacritics(lastName)}${i}${randInt(1, 99)}@demo.edustack.cz`;
      }
      usedEmails.add(email);

      const isActive = i < config.teacherActiveCount;
      const isInvited =
        !isActive && i < config.teacherActiveCount + config.teacherInvitedCount;
      const status = isActive ? 'ACTIVE' : isInvited ? 'PENDING' : 'ACTIVE';

      const user = await this.prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          passwordHash: DEMO_PASSWORD_HASH,
          invitationToken: isInvited ? `inv-${Date.now()}-${i}` : undefined,
        },
      });
      userIds.push(user.id);

      await this.prisma.schoolMembership.create({
        data: {
          userId: user.id,
          schoolId,
          role: 'TEACHER',
          status,
          workloadPercentage:
            Math.random() > 0.3 ? 1.0 : 0.5 + Math.random() * 0.5,
        },
      });

      await this.prisma.teacherProfile.create({
        data: {
          userId: user.id,
          degree: pick(TEACHER_DEGREES),
          approbation: pick(TEACHER_APPROBATIONS),
        },
      });

      if (academicYearId) {
        await this.prisma.teacherWorkload.create({
          data: {
            teacherId: user.id,
            academicYearId,
            workloadPercentage:
              Math.random() > 0.3 ? 1.0 : 0.5 + Math.random() * 0.5,
          },
        });
      }
      stats.teachers++;
    }
    return userIds;
  }

  // ─── STUDENTS ────────────────────────────────────────────────

  private async createStudents(
    schoolId: string,
    config: GenerateConfig,
    classroomIds: string[],
    academicYear: any,
    gradeLevelMap: Record<number, string>,
    stats: GenerateResult['stats'],
  ): Promise<{ studentUserIds: string[]; studentProfileIds: string[] }> {
    const studentUserIds: string[] = [];
    const studentProfileIds: string[] = [];
    const totalStudents = config.studentCount;
    const usedEmails = new Set<string>();

    // Get classrooms with their grade info
    const classrooms = await this.prisma.classroom.findMany({
      where: { schoolId },
      select: { id: true, grade: true },
    });

    for (let i = 0; i < totalStudents; i++) {
      const isFemale = Math.random() > 0.5;
      const firstName = isFemale ? pick(FEMALE_FIRST) : pick(MALE_FIRST);
      const lastName = pick(LAST_NAMES);
      let email = `student.${removeDiacritics(lastName)}${i}@demo.edustack.cz`;
      while (usedEmails.has(email)) {
        email = `student.${removeDiacritics(lastName)}${i}${randInt(1, 99)}@demo.edustack.cz`;
      }
      usedEmails.add(email);

      const isActive = i < config.studentActiveCount;
      const isInvited =
        !isActive && i < config.studentActiveCount + config.studentInvitedCount;
      const status = isActive ? 'ACTIVE' : isInvited ? 'PENDING' : 'ACTIVE';

      const classroomIdx = i % classroomIds.length;
      const classroomId = classroomIds[classroomIdx];
      const classroom = classrooms.find((c: any) => c.id === classroomId);

      const user = await this.prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          passwordHash: DEMO_PASSWORD_HASH,
          invitationToken: isInvited ? `inv-${Date.now()}-s${i}` : undefined,
        },
      });
      studentUserIds.push(user.id);

      const profile = await this.prisma.studentProfile.create({
        data: { userId: user.id, firstName, lastName, classroomId },
      });
      studentProfileIds.push(profile.id);

      await this.prisma.schoolMembership.create({
        data: { userId: user.id, schoolId, role: 'STUDENT', status },
      });

      // Create enrollment
      if (academicYear && classroom) {
        const gradeLevelId = gradeLevelMap[classroom.grade];
        if (gradeLevelId) {
          await this.prisma.studentEnrollment.create({
            data: {
              studentId: user.id,
              academicYearId: academicYear.id,
              gradeLevelId,
              classroomId,
            },
          });
        }
      }

      stats.students++;
    }
    return { studentUserIds, studentProfileIds };
  }

  // ─── PARENTS ─────────────────────────────────────────────────

  private async createParents(
    schoolId: string,
    config: GenerateConfig,
    studentUserIds: string[],
    stats: GenerateResult['stats'],
  ): Promise<string[]> {
    const parentUserIds: string[] = [];
    const parentCount =
      config.parentCount === 0 ? studentUserIds.length : config.parentCount;
    const usedEmails = new Set<string>();

    for (let i = 0; i < parentCount && i < studentUserIds.length; i++) {
      const isFemale = Math.random() > 0.4;
      const firstName = isFemale ? pick(FEMALE_FIRST) : pick(MALE_FIRST);
      const lastName = pick(LAST_NAMES);
      let email = `rodic.${removeDiacritics(lastName)}${i}@demo.edustack.cz`;
      while (usedEmails.has(email)) {
        email = `rodic.${removeDiacritics(lastName)}${i}${randInt(1, 99)}@demo.edustack.cz`;
      }
      usedEmails.add(email);

      const user = await this.prisma.user.create({
        data: { email, firstName, lastName, passwordHash: DEMO_PASSWORD_HASH },
      });
      parentUserIds.push(user.id);

      await this.prisma.schoolMembership.create({
        data: { userId: user.id, schoolId, role: 'PARENT', status: 'ACTIVE' },
      });

      // Link parent to student
      await this.prisma.parentStudent.create({
        data: { parentId: user.id, studentId: studentUserIds[i] },
      });

      stats.parents++;
    }
    return parentUserIds;
  }

  // ─── SUBJECTS ────────────────────────────────────────────────

  private async createSubjects(
    schoolId: string,
    schoolType: string,
    academicYear: any,
    gradeLevelMap: Record<number, string>,
    stats: GenerateResult['stats'],
  ): Promise<{ subjectInstanceIds: string[] }> {
    const subjects = getSubjectsForType(schoolType);
    const subjectInstanceIds: string[] = [];

    for (const subj of subjects) {
      const template = await this.prisma.subjectTemplate.create({
        data: { name: subj.name, code: subj.code, schoolId },
      });
      stats.subjects++;

      // Create instances for each grade level
      if (academicYear) {
        for (const [levelNumStr, gradeLevelId] of Object.entries(
          gradeLevelMap,
        )) {
          const levelNum = parseInt(levelNumStr);
          const hoursPerWeek = this.getHoursPerWeek(
            subj.code,
            levelNum,
            schoolType,
          );
          if (hoursPerWeek <= 0) continue;

          const instance = await this.prisma.subjectInstance.create({
            data: {
              templateId: template.id,
              academicYearId: academicYear.id,
              gradeLevelId,
              schoolId,
              hoursPerWeek,
            },
          });
          subjectInstanceIds.push(instance.id);
          stats.subjectInstances++;
        }
      }
    }
    return { subjectInstanceIds };
  }

  private getHoursPerWeek(code: string, level: number, _type: string): number {
    const base: Record<string, number> = {
      CJL: 5,
      M: 4,
      AJ: 3,
      NJ: 2,
      FJ: 2,
      F: 2,
      CH: 2,
      PŘ: 2,
      BI: 2,
      Z: 2,
      D: 2,
      OV: 1,
      ZSV: 2,
      HV: 1,
      VV: 2,
      TV: 2,
      PČ: 1,
      INF: 1,
      IVT: 2,
      PRV: 2,
      VL: 2,
    };
    return base[code] || 2;
  }

  // ─── SCHEDULE ────────────────────────────────────────────────

  private async createSchedule(
    schoolId: string,
    academicYear: any,
    classroomIds: string[],
    subjectInstanceIds: string[],
    teacherProfileIds: string[],
    stats: GenerateResult['stats'],
  ) {
    const slots = await this.prisma.lessonTimeSlot.findMany({
      where: { schoolId },
      orderBy: { lessonNumber: 'asc' },
    });
    if (slots.length === 0) return;

    // Get subject instances with details
    const instances = await this.prisma.subjectInstance.findMany({
      where: { id: { in: subjectInstanceIds } },
      include: { template: true, gradeLevel: true },
    });

    // Get classrooms with grade
    const classrooms = await this.prisma.classroom.findMany({
      where: { schoolId },
      select: { id: true, grade: true },
    });

    // Track teacher schedule to avoid conflicts
    const teacherSchedule = new Set<string>(); // "teacherId-day-lesson"

    for (const classroom of classrooms) {
      // Get instances for this grade level
      const gradeInstances = instances.filter(
        (i: any) => i.gradeLevel.levelNumber === classroom.grade,
      );
      if (gradeInstances.length === 0) continue;

      // Build a weekly schedule: 5 days × N lessons
      const maxLessons = Math.min(slots.length, 7); // max 7 lessons/day

      for (let day = 1; day <= 5; day++) {
        const lessonsToday = randInt(5, maxLessons);
        for (let lesson = 1; lesson <= lessonsToday; lesson++) {
          const slot = slots.find((s: any) => s.lessonNumber === lesson);
          if (!slot) continue;

          // Pick a subject instance (round-robin through available ones)
          const instanceIdx = (day * 10 + lesson) % gradeInstances.length;
          const instance = gradeInstances[instanceIdx];

          // Find an available teacher
          let assignedTeacher: string | null = null;
          for (const tid of teacherProfileIds) {
            const key = `${tid}-${day}-${lesson}`;
            if (!teacherSchedule.has(key)) {
              assignedTeacher = tid;
              teacherSchedule.add(key);
              break;
            }
          }
          if (!assignedTeacher) continue; // all teachers busy

          try {
            await this.prisma.scheduleEvent.create({
              data: {
                dayOfWeek: day,
                lessonNumber: lesson,
                startTime: slot.startTime,
                endTime: slot.endTime,
                schoolId,
                subjectInstanceId: instance.id,
                classroomId: classroom.id,
                teacherId: assignedTeacher,
                academicYearId: academicYear.id,
              },
            });
            stats.scheduleEvents++;
          } catch {
            // Skip unique constraint violations
          }
        }
      }
    }
  }

  // ─── GRADES ──────────────────────────────────────────────────

  private async createGrades(
    schoolId: string,
    academicYear: any,
    subjectInstanceIds: string[],
    studentProfileIds: string[],
    teacherProfileIds: string[],
    stats: GenerateResult['stats'],
  ) {
    // Get student profiles with their classroom info
    const students = await this.prisma.studentProfile.findMany({
      where: { id: { in: studentProfileIds } },
      select: {
        id: true,
        classroomId: true,
        classroom: { select: { grade: true } },
      },
    });

    // Get instances with grade level info
    const instances = await this.prisma.subjectInstance.findMany({
      where: { id: { in: subjectInstanceIds } },
      include: { gradeLevel: true },
    });

    for (const student of students) {
      if (!student.classroomId || !student.classroom) continue;

      // Find subject instances for this student's grade
      const relevantInstances = instances.filter(
        (i: any) => i.gradeLevel.levelNumber === student.classroom!.grade,
      );

      for (const instance of relevantInstances) {
        const gradeCount = randInt(5, 12);
        for (let g = 0; g < gradeCount; g++) {
          const value = String(randInt(1, 5));
          const weight = [0.5, 0.7, 0.8, 1.0][randInt(0, 3)];
          const category = [
            'EXAM',
            'HOMEWORK',
            'CLASSWORK',
            'PROJECT',
            'OTHER',
          ][randInt(0, 4)];

          // Random date in this school year
          const dayOffset = randInt(0, 200);
          const date = new Date('2025-09-01');
          date.setDate(date.getDate() + dayOffset);

          try {
            await this.prisma.grade.create({
              data: {
                value,
                weight,
                description: pick(GRADE_DESCRIPTIONS),
                date,
                type: 'NUMERIC',
                category,
                schoolId,
                studentId: student.id,
                subjectInstanceId: instance.id,
                teacherId: pick(teacherProfileIds),
                academicYearId: academicYear?.id,
              },
            });
            stats.grades++;
          } catch {
            // Skip errors
          }
        }
      }
    }
  }

  // ─── COMMUNICATION ───────────────────────────────────────────

  private async createCommunication(
    schoolId: string,
    teacherUserIds: string[],
    studentUserIds: string[],
    parentUserIds: string[],
    stats: GenerateResult['stats'],
  ) {
    const allUserIds = [...teacherUserIds, ...studentUserIds, ...parentUserIds];
    if (allUserIds.length < 2) return;

    // Create 5 direct conversations
    for (let c = 0; c < Math.min(5, Math.floor(allUserIds.length / 2)); c++) {
      const senderId =
        teacherUserIds.length > 0 ? pick(teacherUserIds) : allUserIds[0];
      let recipientId =
        parentUserIds.length > 0
          ? pick(parentUserIds)
          : pick(studentUserIds.length > 0 ? studentUserIds : allUserIds);
      if (recipientId === senderId && allUserIds.length > 1) {
        recipientId =
          allUserIds.find((id: string) => id !== senderId) || recipientId;
      }

      const conversation = await this.prisma.conversation.create({
        data: {
          subject: `Informace o prospěchu #${c + 1}`,
          type: 'DIRECT',
          schoolId,
          participants: {
            create: [{ userId: senderId }, { userId: recipientId }],
          },
        },
      });
      stats.conversations++;

      // Create messages
      const msgCount = randInt(3, 8);
      for (let m = 0; m < msgCount; m++) {
        const msgSenderId = m % 2 === 0 ? senderId : recipientId;
        const msgDate = new Date();
        msgDate.setHours(msgDate.getHours() - (msgCount - m) * 2);

        await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: msgSenderId,
            content: pick(MESSAGE_CONTENTS),
            createdAt: msgDate,
          },
        });
        stats.messages++;
      }
    }

    // Create 1 school broadcast if teacher exists
    if (teacherUserIds.length > 0) {
      const broadcastSender = teacherUserIds[0];
      const broadcastParticipants = [
        broadcastSender,
        ...studentUserIds.slice(0, 10),
        ...parentUserIds.slice(0, 10),
      ];
      const uniqueParticipants = [...new Set(broadcastParticipants)];

      if (uniqueParticipants.length >= 2) {
        const broadcast = await this.prisma.conversation.create({
          data: {
            subject: 'Oznámení – třídní schůzky',
            type: 'SCHOOL_BROADCAST',
            schoolId,
            participants: {
              create: uniqueParticipants.map((uid: string) => ({ userId: uid })),
            },
          },
        });
        stats.conversations++;

        await this.prisma.message.create({
          data: {
            conversationId: broadcast.id,
            senderId: broadcastSender,
            content:
              'Vážení rodiče, oznamujeme, že třídní schůzky se budou konat v pondělí 10. března od 17:00 v prostorách školy. Těšíme se na setkání.',
          },
        });
        stats.messages++;
      }
    }

    // Create notifications
    for (const userId of allUserIds.slice(0, 20)) {
      await this.prisma.notification.create({
        data: {
          userId,
          type: pick(['MESSAGE', 'GRADE', 'SYSTEM', 'ATTENDANCE']),
          title: pick([
            'Nová zpráva',
            'Nová známka',
            'Systémové oznámení',
            'Docházka',
          ]),
          body: pick([
            'Máte novou zprávu od učitele.',
            'Byla vám zadána nová známka.',
            'Systém byl aktualizován.',
            'Absence byla zaznamenána.',
          ]),
          read: Math.random() > 0.5,
        },
      });
      stats.notifications++;
    }
  }

  // ─── ATTENDANCE & EXCUSES ────────────────────────────────────

  private async createAttendance(
    schoolId: string,
    academicYear: any,
    classroomIds: string[],
    studentProfileIds: string[],
    teacherProfileIds: string[],
    parentUserIds: string[],
    stats: GenerateResult['stats'],
  ) {
    const students = await this.prisma.studentProfile.findMany({
      where: { id: { in: studentProfileIds } },
      select: {
        id: true,
        userId: true,
        classroomId: true,
        user: { select: { childOf: { select: { parentId: true } } } },
      },
    });

    for (const student of students) {
      for (let i = 0; i < 10; i++) {
        const isAbsent = Math.random() > 0.85;
        const isLate = !isAbsent && Math.random() > 0.9;
        const status = isAbsent ? 'ABSENT' : isLate ? 'LATE' : 'PRESENT';

        const dayOffset = randInt(0, 100);
        const date = new Date('2025-09-01');
        date.setDate(date.getDate() + dayOffset);

        try {
          await this.prisma.attendance.create({
            data: {
              status,
              date,
              lessonNumber: randInt(1, 6),
              schoolId,
              studentId: student.id,
              teacherId: pick(teacherProfileIds),
            },
          });
          stats.attendanceRecords++;

          if (
            status === 'ABSENT' &&
            student.user.childOf.length > 0 &&
            Math.random() > 0.5
          ) {
            const excuseStatus = Math.random() > 0.5 ? 'APPROVED' : 'PENDING';
            await this.prisma.absenceExcuse.create({
              data: {
                reason: pick(['Nemoc', 'Rodinné důvody', 'Návštěva lékaře']),
                dateFrom: date,
                dateTo: date,
                status: excuseStatus,
                parentId: student.user.childOf[0].parentId,
                studentId: student.id,
                schoolId,
              },
            });
            stats.excuses++;
          }
        } catch {
          // Skip duplicates
        }
      }
    }
  }

  // ─── REPORT CARDS & BEHAVIOR ─────────────────────────────────

  private async createReportCards(
    schoolId: string,
    academicYear: any,
    subjectInstanceIds: string[],
    studentProfileIds: string[],
    stats: GenerateResult['stats'],
  ) {
    if (!academicYear) return;
    const semesters = await this.prisma.semester.findMany({
      where: { academicYearId: academicYear.id },
      orderBy: { number: 'asc' },
    });
    if (semesters.length === 0) return;
    const firstSemester = semesters[0];

    const students = await this.prisma.studentProfile.findMany({
      where: { id: { in: studentProfileIds } },
      include: { classroom: true },
    });

    const instances = await this.prisma.subjectInstance.findMany({
      where: { id: { in: subjectInstanceIds } },
      include: { gradeLevel: true },
    });

    for (const student of students) {
      if (!student.classroom) continue;

      try {
        await this.prisma.behaviorGrade.create({
          data: {
            grade: 1,
            studentId: student.id,
            semesterId: firstSemester.id,
            schoolId,
          },
        });
        stats.behaviorGrades++;
      } catch {
        /* skip */
      }

      const relevantInstances = instances.filter(
        (i: any) => i.gradeLevel.levelNumber === student.classroom!.grade,
      );
      for (const instance of relevantInstances) {
        try {
          await this.prisma.reportCard.create({
            data: {
              finalGrade: String(randInt(1, 4)),
              studentId: student.id,
              subjectInstanceId: instance.id,
              semesterId: firstSemester.id,
              schoolId,
            },
          });
          stats.reportCards++;
        } catch {
          /* skip */
        }
      }
    }
  }

  // ─── COMMUNITY ───────────────────────────────────────────────

  private async createCommunity(
    schoolId: string,
    teacherUserIds: string[],
    studentUserIds: string[],
    parentUserIds: string[],
    stats: GenerateResult['stats'],
  ) {
    if (teacherUserIds.length === 0) return;

    for (let i = 0; i < 6; i++) {
      await this.prisma.bulletinPost.create({
        data: {
          title: pick([
            'Ředitelské volno',
            'Školní akademie',
            'Oznámení pro rodiče',
            'Výsledky soutěže',
            'Sběr papíru',
            'Jídelníček',
          ]),
          content:
            'Toto je vygenerované testovací oznámení pro školní nástěnku s důležitými informacemi.',
          pinned: i === 0,
          authorId: pick(teacherUserIds),
          schoolId,
        },
      });
      stats.bulletinPosts++;
    }

    for (let i = 0; i < 2; i++) {
      const poll = await this.prisma.poll.create({
        data: {
          question: pick([
            'Kam pojedeme na školní výlet?',
            'Jaké jídlo byste chtěli přidat do jídelníčku?',
            'Kdy uspořádat třídní schůzky?',
          ]),
          multiSelect: false,
          authorId: pick(teacherUserIds),
          schoolId,
          options: {
            create: [
              { text: 'Možnost A' },
              { text: 'Možnost B' },
              { text: 'Možnost C' },
            ],
          },
        },
        include: { options: true },
      });
      stats.polls++;

      const voters = [...studentUserIds, ...parentUserIds].slice(0, 15);
      for (const voterId of voters) {
        try {
          await this.prisma.pollVote.create({
            data: {
              userId: voterId,
              optionId: pick(poll.options).id,
            },
          });
        } catch {
          /* skip */
        }
      }
    }

    for (let i = 0; i < 4; i++) {
      const date = new Date();
      date.setDate(date.getDate() + randInt(-5, 20));

      await this.prisma.calendarEvent.create({
        data: {
          title: pick([
            'Třídní schůzky',
            'Den otevřených dveří',
            'Vánoční besídka',
            'Divadelní představení',
            'Sportovní den',
          ]),
          description:
            'Setkání se bude konat v odpoledních hodinách v budově školy.',
          startDate: date,
          location: 'Tělocvična / Aula',
          authorId: pick(teacherUserIds),
          schoolId,
        },
      });
      stats.calendarEvents++;
    }
  }

  // ═════════════════════════════════════════════════════════════
  // WIPE OPERATIONS
  // ═════════════════════════════════════════════════════════════

  async wipeSchoolData(schoolId: string): Promise<{ deletedSchool: string }> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) throw new Error(`School with ID '${schoolId}' not found`);

    this.logger.warn(
      `Wiping ALL data for school '${school.name}' (${schoolId})`,
    );

    // Delete in dependency order (children before parents)
    await this.prisma.$transaction(async (tx: any) => {
      // 1. Communication
      await tx.notification.deleteMany({
        where: {
          userId: {
            in: (
              await tx.conversationParticipant.findMany({
                where: { conversation: { schoolId } },
                select: { userId: true },
              })
            ).map((p: any) => p.userId),
          },
        },
      });
      await tx.message.deleteMany({ where: { conversation: { schoolId } } });
      await tx.conversationParticipant.deleteMany({
        where: { conversation: { schoolId } },
      });
      await tx.conversation.deleteMany({ where: { schoolId } });

      // 2. Grades & Report Cards
      await tx.grade.deleteMany({ where: { schoolId } });
      await tx.reportCard.deleteMany({ where: { schoolId } });

      // 3. Attendance
      await tx.attendance.deleteMany({ where: { schoolId } });

      // 4. Schedule
      await tx.scheduleSubstitution.deleteMany({ where: { schoolId } });
      await tx.scheduleEvent.deleteMany({ where: { schoolId } });
      await tx.lessonTimeSlot.deleteMany({ where: { schoolId } });

      // 5. Curriculum
      await tx.curriculumEntry.deleteMany({
        where: { curriculumVersion: { schoolId } },
      });
      await tx.curriculumVersion.deleteMany({ where: { schoolId } });

      // 6. Subject instances & templates
      await tx.subjectInstance.deleteMany({ where: { schoolId } });
      await tx.subjectTemplate.deleteMany({ where: { schoolId } });

      // 7. Staff
      await tx.staffSubjectAssignment.deleteMany({
        where: { staffWorkload: { academicYear: { schoolId } } },
      });
      await tx.staffWorkload.deleteMany({
        where: { academicYear: { schoolId } },
      });
      await tx.teacherWorkload.deleteMany({
        where: { academicYear: { schoolId } },
      });

      // 8. Enrollments
      await tx.studentEnrollment.deleteMany({
        where: { academicYear: { schoolId } },
      });

      // 9. Semesters & Academic Years
      await tx.semester.deleteMany({ where: { academicYear: { schoolId } } });
      await tx.academicYear.deleteMany({ where: { schoolId } });

      // 10. Get user IDs belonging to this school (not system admins)
      const memberships = await tx.schoolMembership.findMany({
        where: { schoolId },
        select: { userId: true },
      });
      const userIds = memberships.map((m: any) => m.userId);

      // Check which users ONLY belong to this school
      const userIdsOnlyInThisSchool: string[] = [];
      for (const uid of userIds) {
        const otherMemberships = await tx.schoolMembership.count({
          where: { userId: uid, schoolId: { not: schoolId } },
        });
        const user = await tx.user.findUnique({
          where: { id: uid },
          select: { isSystemAdmin: true },
        });
        if (otherMemberships === 0 && !user?.isSystemAdmin) {
          userIdsOnlyInThisSchool.push(uid);
        }
      }

      // 11. Profiles and parent links
      await tx.parentStudent.deleteMany({
        where: {
          OR: [
            { parentId: { in: userIdsOnlyInThisSchool } },
            { studentId: { in: userIdsOnlyInThisSchool } },
          ],
        },
      });
      await tx.teacherProfile.deleteMany({
        where: { userId: { in: userIdsOnlyInThisSchool } },
      });
      await tx.studentProfile.deleteMany({
        where: { userId: { in: userIdsOnlyInThisSchool } },
      });
      await tx.identity.deleteMany({
        where: { userId: { in: userIdsOnlyInThisSchool } },
      });

      // 12. Memberships
      await tx.schoolMembership.deleteMany({ where: { schoolId } });

      // 13. Rooms & Grade Levels & Classrooms
      await tx.room.deleteMany({ where: { schoolId } });
      await tx.classroom.deleteMany({ where: { schoolId } });
      await tx.gradeLevel.deleteMany({ where: { schoolId } });

      // 14. AI Usage
      await tx.aiTokenUsage.deleteMany({ where: { schoolId } });

      // 15. Users only in this school
      await tx.notification.deleteMany({
        where: { userId: { in: userIdsOnlyInThisSchool } },
      });
      await tx.user.deleteMany({
        where: { id: { in: userIdsOnlyInThisSchool } },
      });

      // 16. School
      await tx.school.delete({ where: { id: schoolId } });
    });

    return { deletedSchool: school.name };
  }

  async wipeAllData(): Promise<{
    deletedSchools: number;
    deletedUsers: number;
  }> {
    this.logger.warn('Wiping ALL data in the system');

    const result = await this.prisma.$transaction(async (tx: any) => {
      // Count before
      const schoolCount = await tx.school.count();
      const usersBefore = await tx.user.count();

      // Delete in dependency order
      await tx.notification.deleteMany();
      await tx.message.deleteMany();
      await tx.conversationParticipant.deleteMany();
      await tx.conversation.deleteMany();

      await tx.grade.deleteMany();
      await tx.reportCard.deleteMany();
      await tx.attendance.deleteMany();

      await tx.scheduleSubstitution.deleteMany();
      await tx.scheduleEvent.deleteMany();
      await tx.lessonTimeSlot.deleteMany();

      await tx.curriculumEntry.deleteMany();
      await tx.curriculumVersion.deleteMany();

      await tx.subjectInstance.deleteMany();
      await tx.subjectTemplate.deleteMany();

      await tx.staffSubjectAssignment.deleteMany();
      await tx.staffWorkload.deleteMany();
      await tx.teacherWorkload.deleteMany();
      await tx.studentEnrollment.deleteMany();

      await tx.semester.deleteMany();
      await tx.academicYear.deleteMany();

      await tx.parentStudent.deleteMany();
      await tx.teacherProfile.deleteMany();
      await tx.studentProfile.deleteMany();
      await tx.identity.deleteMany();
      await tx.schoolMembership.deleteMany();

      await tx.room.deleteMany();
      await tx.classroom.deleteMany();
      await tx.gradeLevel.deleteMany();
      await tx.aiTokenUsage.deleteMany();
      await tx.auditLog.deleteMany();

      await tx.school.deleteMany();

      // Delete non-admin users
      const deletedUsers = await tx.user.deleteMany({
        where: { isSystemAdmin: false },
      });

      return { deletedSchools: schoolCount, deletedUsers: deletedUsers.count };
    });

    return result;
  }
}
