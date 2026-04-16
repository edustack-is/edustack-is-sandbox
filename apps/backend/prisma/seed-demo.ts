import { 
    PrismaClient, 
    UserRole, 
    UserStatus, 
    AttendanceStatus, 
    MeasureType
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

// ─── DYNAMIC PRISMA CLIENT INITIALIZATION ──────────────────────
let options: any = { log: ['warn', 'error'] };
const dbAdapter = process.env.DB_ADAPTER || 'native';

if (dbAdapter === 'sqlite') {
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '../../data/dev.db';
    options.adapter = new PrismaBetterSqlite3({ url: dbPath });
    console.log('Seed: using SQLite adapter');
} else {
    console.log('Seed: using native Postgres driver');
}

const prisma = new PrismaClient(options);
// ────────────────────────────────────────────────────────────────

async function main() {
    console.log('🧹 Cleaning up database...');
    
    const cleanupTables = [
        'AuditLog', 'AiTokenUsage', 'MessageAttachment', 'Message', 'ConversationParticipant', 'Conversation',
        'Notification', 'ThematicPlanWeek', 'ThematicPlan', 'LessonPreparation', 'TeachingMaterial',
        'CompetencyMapping', 'RvpCompetency', 'ScheduleSnapshot', 'RecurringEvent', 'BehaviorGrade',
        'CompetencyGrade', 'EducationalMeasure', 'CommissionExam', 'ClassificationDeadline',
        'BulletinPost', 'PollVote', 'PollOption', 'Poll', 'EventRsvp', 'CalendarEvent',
        'TeacherSignature', 'ClassBookEntry', 'ScheduleSubstitution', 'Attendance', 'AbsenceExcuse',
        'Grade', 'ReportCard', 'ScheduleEvent', 'LessonTimeSlot', 'SubjectInstance', 'CurriculumEntry',
        'CurriculumVersion', 'SubjectTemplate', 'StudentEnrollment', 'TeacherWorkload', 'StaffSubjectAssignment',
        'StaffWorkload', 'ParentStudent', 'Identity', 'SchoolMembership', 'StudentProfile', 'TeacherProfile',
        'Classroom', 'GradeLevel', 'Semester', 'AcademicYear', 'Room', 'Building', 'School', 'User'
    ];

    const isSqlite = dbAdapter === 'sqlite';
    if (isSqlite) {
        await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
    } else {
        await prisma.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED;');
    }

    for (const table of cleanupTables) {
        try {
            if (isSqlite) {
                await prisma.$executeRawUnsafe(`DELETE FROM "${table}";`);
            } else {
                await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
            }
        } catch (e) {
            // Table might not exist or other issue, skip
        }
    }

    if (isSqlite) {
        await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
    }
    console.log('✅ Database cleaned');

    const saltRounds = 10;
    const defaultPassword = 'password123';
    const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

    // 1. SYSTEM ADMIN
    const admin = await prisma.user.create({
        data: {
            email: 'admin@edustack.cz',
            passwordHash,
            firstName: 'EduStack',
            lastName: 'Admin',
            isSystemAdmin: true,
        },
    });

    // 2. SCHOOLS
    const school1 = await prisma.school.create({
        data: {
            name: 'Základní škola T. G. Masaryka',
            address: 'Školní 123, 150 00 Praha 5',
            contactEmail: 'info@tgmasaryk.cz',
        },
    });

    const school2 = await prisma.school.create({
        data: {
            name: 'Gymnázium Jana Nerudy',
            address: 'Hellichova 3, 118 00 Praha 1',
            contactEmail: 'info@gjnerudy.cz',
        },
    });
    console.log('✅ Schools created');

    // 3. ACADEMIC YEARS (Past, Current, Future)
    const schools = [school1, school2];
    const yearConfigs = [
        { name: '2024/2025', isCurrent: false, start: '2024-09-01', end: '2025-06-30' },
        { name: '2025/2026', isCurrent: true, start: '2025-09-01', end: '2026-06-30' },
        { name: '2026/2027', isCurrent: false, start: '2026-09-01', end: '2027-06-30' },
    ];

    for (const s of schools) {
        for (const yc of yearConfigs) {
            const ay = await prisma.academicYear.create({
                data: {
                    name: yc.name,
                    startDate: new Date(yc.start),
                    endDate: new Date(yc.end),
                    isCurrent: yc.isCurrent,
                    schoolId: s.id,
                },
            });

            // Add basic Semesters
            await prisma.semester.create({
                data: {
                    number: 1,
                    name: '1. pololetí',
                    startDate: new Date(yc.start),
                    endDate: new Date(new Date(yc.start).setMonth(new Date(yc.start).getMonth() + 5)),
                    academicYearId: ay.id,
                }
            });
        }

        // Grade Levels
        for (let i = 1; i <= 9; i++) {
            await prisma.gradeLevel.create({
                data: { name: `${i}. ročník`, levelNumber: i, schoolId: s.id },
            });
        }
    }
    console.log('✅ Academic Years and Grade Levels created for all schools');

    // 4. PRINCIPALS
    await prisma.user.create({
        data: {
            email: 'headmaster@tgmasaryk.cz',
            passwordHash,
            firstName: 'Jan',
            lastName: 'Novák',
            schoolMemberships: {
                create: { schoolId: school1.id, role: UserRole.PRINCIPAL, status: UserStatus.ACTIVE }
            }
        }
    });

    await prisma.user.create({
        data: {
            email: 'headmaster@gjnerudy.cz',
            passwordHash,
            firstName: 'Libuše',
            lastName: 'Nerudová',
            schoolMemberships: {
                create: { schoolId: school2.id, role: UserRole.PRINCIPAL, status: UserStatus.ACTIVE }
            }
        }
    });

    // 5. FULL SETUP FOR SCHOOL 1 (ZŠ TGM)
    const currentAY1 = await prisma.academicYear.findFirst({ where: { schoolId: school1.id, isCurrent: true } });
    const pastAY1 = await prisma.academicYear.findFirst({ where: { schoolId: school1.id, name: '2024/2025' } });
    const gradeLevels1 = await prisma.gradeLevel.findMany({ where: { schoolId: school1.id }, orderBy: { levelNumber: 'asc' } });

    // Teacher
    const teacher1 = await prisma.user.create({
        data: {
            email: 'dana.bila@tgmasaryk.cz',
            passwordHash,
            firstName: 'Dana',
            lastName: 'Bílá',
            schoolMemberships: {
                create: { schoolId: school1.id, role: UserRole.TEACHER, status: UserStatus.ACTIVE }
            },
            teacherProfile: {
                create: { degree: 'Mgr.', approbation: 'M, INF' }
            }
        },
        include: { teacherProfile: true }
    });

    // Classroom
    const classroom1 = await prisma.classroom.create({
        data: {
            name: '1.A',
            grade: 1,
            schoolId: school1.id,
        }
    });
    await prisma.teacherProfile.update({
        where: { id: teacher1.teacherProfile!.id },
        data: { homeroomClassId: classroom1.id }
    });

    // Student (Current)
    const student1 = await prisma.user.create({
        data: {
            email: 'student1@tgmasaryk.cz',
            passwordHash,
            firstName: 'Adam',
            lastName: 'Mladý',
            schoolMemberships: {
                create: { schoolId: school1.id, role: UserRole.STUDENT, status: UserStatus.ACTIVE }
            },
            studentProfile: {
                create: { firstName: 'Adam', lastName: 'Mladý', classroomId: classroom1.id }
            }
        },
        include: { studentProfile: true }
    });

    await prisma.studentEnrollment.create({
        data: {
            studentId: student1.id,
            academicYearId: currentAY1!.id,
            gradeLevelId: gradeLevels1[0].id,
            classroomId: classroom1.id
        }
    });

    // Alumnus (Past year graduated)
    const alumnus = await prisma.user.create({
        data: {
            email: 'alumnus1@tgmasaryk.cz',
            passwordHash,
            firstName: 'Petr',
            lastName: 'Starý',
            schoolMemberships: {
                create: { schoolId: school1.id, role: UserRole.STUDENT, status: UserStatus.ALUMNI }
            },
            studentProfile: {
                create: { firstName: 'Petr', lastName: 'Starý' }
            }
        }
    });
    await prisma.studentEnrollment.create({
        data: {
            studentId: alumnus.id,
            academicYearId: pastAY1!.id,
            gradeLevelId: gradeLevels1[8].id, // 9th grade
        }
    });

    // SUBJECTS & CURRICULUM
    const svp1 = await prisma.curriculumVersion.create({
        data: {
            name: 'ŠVP 2025',
            validFrom: new Date('2025-09-01'),
            schoolId: school1.id,
        }
    });

    const subjectT1 = await prisma.subjectTemplate.create({
        data: {
            name: 'Matematika',
            code: 'M',
            schoolId: school1.id,
            curriculumVersionId: svp1.id,
        }
    });

    const subjectI1 = await prisma.subjectInstance.create({
        data: {
            hoursPerWeek: 5,
            templateId: subjectT1.id,
            academicYearId: currentAY1!.id,
            gradeLevelId: gradeLevels1[0].id,
            schoolId: school1.id,
        }
    });

    // 6. EXTRA ENTITIES (sidebar items)
    const room101 = await prisma.room.create({
        data: { name: 'Učebna 101', capacity: 30, schoolId: school1.id }
    });

    await prisma.scheduleEvent.create({
        data: {
            dayOfWeek: 1,
            lessonNumber: 1,
            startTime: '08:00',
            endTime: '08:45',
            schoolId: school1.id,
            subjectInstanceId: subjectI1.id,
            classroomId: classroom1.id,
            teacherId: teacher1.teacherProfile!.id,
            roomId: room101.id,
            academicYearId: currentAY1!.id,
        }
    });

    await prisma.bulletinPost.create({
        data: {
            title: 'Vítejte!',
            content: 'Systém byl úspěšně nasazen.',
            authorId: admin.id,
            schoolId: school1.id,
        }
    });

    const sem1 = await prisma.semester.findFirst({ where: { academicYearId: currentAY1!.id } });
    await prisma.grade.create({
        data: {
            value: '1',
            weight: 1.0,
            description: 'Vstupní test',
            schoolId: school1.id,
            studentId: student1.studentProfile!.id,
            subjectInstanceId: subjectI1.id,
            teacherId: teacher1.teacherProfile!.id,
            semesterId: sem1!.id,
        }
    });

    await prisma.auditLog.create({
        data: {
            actorId: admin.id,
            action: 'FULL_DEMO_SEED',
            entity: 'System',
            schoolId: school1.id,
        }
    });

    console.log('✨ Expanded Seeding completed successfully!');
    console.log('--------------------------------------------------');
    console.log('Credentials (password: password123):');
    console.log('- Admin: admin@edustack.cz');
    console.log('- Principal (TGM): headmaster@tgmasaryk.cz');
    console.log('- Principal (G Nerudy): headmaster@gjnerudy.cz');
    console.log('- Teacher (TGM): dana.bila@tgmasaryk.cz');
    console.log('- Alumnus (TGM): alumnus1@tgmasaryk.cz');
    console.log('--------------------------------------------------');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
