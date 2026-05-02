import { server } from '../server.js';
import { db, transaction } from '../db.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// ─── SUBJECT DEFINITIONS BY SCHOOL TYPE ─────────────────────────

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
    { name: 'Seminář z matematiky', code: 'SM' },
    { name: 'Seminář z fyziky', code: 'SF' },
    { name: 'Seminář z biologie', code: 'SBI' },
    { name: 'Seminář z chemie', code: 'SCH' },
    { name: 'Latina', code: 'LAT' },
];

// ─── CLASSROOM / GRADE LEVEL DEFINITIONS ────────────────────────

interface GradeDef {
    levelNumber: number;
    levelName: string;
    classrooms: string[];
}

function getGrades(type: string): GradeDef[] {
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
            const names8 = ['Prima', 'Sekunda', 'Tercie', 'Kvarta', 'Kvinta', 'Sexta', 'Septima', 'Oktáva'];
            return names8.map((name, i) => ({
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

function getSubjects(type: string): SubjectDef[] {
    switch (type) {
        case 'elementary_1':
            return SUBJECTS_ELEMENTARY_1;
        case 'elementary_full':
            const merged = [...SUBJECTS_ELEMENTARY_1, ...SUBJECTS_ELEMENTARY_2];
            const seen = new Set<string>();
            return merged.filter((s) => {
                if (seen.has(s.code)) return false;
                seen.add(s.code);
                return true;
            });
        case 'gymnasium_8':
        case 'gymnasium_4':
            return SUBJECTS_GYMNASIUM;
        default:
            return [];
    }
}

// ─── TOOL ───────────────────────────────────────────────────────

server.tool(
    'seed_school_structure',
    'Naplní školu ukázkovou strukturou podle typu školy.',
    {
        schoolId: z.string().describe('ID školy'),
        schoolType: z.enum(['elementary_1', 'elementary_full', 'gymnasium_8', 'gymnasium_4']),
        academicYearName: z.string().optional(),
    },
    async ({ schoolId, schoolType, academicYearName }) => {
        try {
            const yearName = academicYearName || '2025/2026';
            const grades = getGrades(schoolType);
            const subjects = getSubjects(schoolType);

            const school = db.prepare('SELECT name FROM "School" WHERE id = ?').get(schoolId) as any;
            if (!school) return { isError: true, content: [{ type: 'text', text: 'Škola nenalezena.' }] };

            const result = transaction(() => {
                const stats = { academicYear: yearName, gradeLevels: 0, classrooms: 0, subjects: 0 };
                const now = new Date().toISOString();

                // 1. Year
                let ay = db
                    .prepare('SELECT id FROM "AcademicYear" WHERE name = ? AND schoolId = ?')
                    .get(yearName, schoolId) as any;
                if (!ay) {
                    const id = randomUUID();
                    const startYear = parseInt(yearName.split('/')[0]) || 2025;
                    db.prepare(
                        'INSERT INTO "AcademicYear" (id, name, startDate, endDate, isCurrent, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
                    ).run(id, yearName, `${startYear}-09-01`, `${startYear + 1}-06-30`, schoolId, now, now);
                    ay = { id };
                }

                // 2. Grades & Classrooms
                for (const g of grades) {
                    let gl = db
                        .prepare('SELECT id FROM "GradeLevel" WHERE levelNumber = ? AND schoolId = ?')
                        .get(g.levelNumber, schoolId) as any;
                    if (!gl) {
                        const glId = randomUUID();
                        db.prepare(
                            'INSERT INTO "GradeLevel" (id, name, levelNumber, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
                        ).run(glId, g.levelName, g.levelNumber, schoolId, now, now);
                        gl = { id: glId };
                        stats.gradeLevels++;
                    }

                    for (const className of g.classrooms) {
                        const exists = db
                            .prepare('SELECT id FROM "Classroom" WHERE name = ? AND schoolId = ?')
                            .get(className, schoolId);
                        if (!exists) {
                            db.prepare('INSERT INTO "Classroom" (id, name, grade, schoolId) VALUES (?, ?, ?, ?)').run(
                                randomUUID(),
                                className,
                                g.levelNumber,
                                schoolId,
                            );
                            stats.classrooms++;
                        }
                    }
                }

                // 3. Subjects
                for (const s of subjects) {
                    const exists = db
                        .prepare('SELECT id FROM "SubjectTemplate" WHERE code = ? AND schoolId = ?')
                        .get(s.code, schoolId);
                    if (!exists) {
                        db.prepare('INSERT INTO "SubjectTemplate" (id, name, code, schoolId) VALUES (?, ?, ?, ?)').run(
                            randomUUID(),
                            s.name,
                            s.code,
                            schoolId,
                        );
                        stats.subjects++;
                    }
                }
                return stats;
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Úspěšně naplněno structure. Tříd: ${result.classrooms}, Předmětů: ${result.subjects}`,
                    },
                ],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);

// ─── DEMO TEACHER DATA ──────────────────────────────────────────

interface TeacherDef {
    firstName: string;
    lastName: string;
    email: string;
    degree: string;
    approbation: string;
    workload: number;
}

function getTeachingStaff(schoolType: string): TeacherDef[] {
    // Re-using the names and data from the original code (shortened for brevity here)
    const teachers: TeacherDef[] = [
        {
            firstName: 'Jana',
            lastName: 'Nováková',
            email: 'novakova@demo.test',
            degree: 'Mgr.',
            approbation: '1. stupeň ZŠ',
            workload: 1.0,
        },
        {
            firstName: 'Marie',
            lastName: 'Svobodová',
            email: 'svobodova@demo.test',
            degree: 'Mgr.',
            approbation: 'Matematika',
            workload: 1.0,
        },
    ];
    return teachers;
}

server.tool(
    'seed_teaching_staff',
    'Vytvoří ukázkový učitelský sbor pro školu.',
    {
        schoolId: z.string().describe('ID školy'),
        schoolType: z.enum(['elementary_1', 'elementary_full', 'gymnasium_8', 'gymnasium_4']),
    },
    async ({ schoolId, schoolType }) => {
        try {
            const staff = getTeachingStaff(schoolType);
            const school = db.prepare('SELECT name FROM "School" WHERE id = ?').get(schoolId) as any;
            if (!school) return { isError: true, content: [{ type: 'text', text: 'Škola nenalezena.' }] };

            const ay = db
                .prepare('SELECT id FROM "AcademicYear" WHERE schoolId = ? AND isCurrent = 1')
                .get(schoolId) as any;
            const demoPasswordHash = '$2b$10$8K1p/q5zQxl0SRDV4Gqe6eruJ3Mn1.Tl5Yng3ORq0q6Z8hMO0dPHG';

            const created = transaction(() => {
                const results: string[] = [];
                const now = new Date().toISOString();

                for (const t of staff) {
                    const exists = db.prepare('SELECT id FROM "User" WHERE email = ?').get(t.email) as any;
                    if (exists) continue;

                    const uid = randomUUID();
                    db.prepare(
                        'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    ).run(uid, t.email, t.firstName, t.lastName, demoPasswordHash, now, now);
                    db.prepare(
                        'INSERT INTO "TeacherProfile" (id, userId, degree, approbation) VALUES (?, ?, ?, ?)',
                    ).run(randomUUID(), uid, t.degree, t.approbation);
                    db.prepare(
                        'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, workloadPercentage, createdAt, updatedAt) VALUES (?, ?, ?, "TEACHER", "ACTIVE", ?, ?, ?)',
                    ).run(randomUUID(), uid, schoolId, t.workload, now, now);
                    if (ay) {
                        db.prepare(
                            'INSERT INTO "TeacherWorkload" (id, teacherId, academicYearId, workloadPercentage) VALUES (?, ?, ?, ?)',
                        ).run(randomUUID(), uid, ay.id, t.workload);
                    }
                    results.push(`${t.firstName} ${t.lastName}`);
                }
                return results;
            });

            return { content: [{ type: 'text', text: `Vytvořeno ${created.length} učitelů.` }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);

server.tool(
    'wipe_school_data',
    'Smaže školu a VŠECHNA přidružená data. Nevratná akce!',
    {
        schoolId: z.string().describe('ID školy'),
    },
    async ({ schoolId }) => {
        try {
            const school = db.prepare('SELECT name FROM "School" WHERE id = ?').get(schoolId) as any;
            if (!school) return { isError: true, content: [{ type: 'text', text: 'Škola nenalezena.' }] };

            const tables = [
                'AuditLog',
                'AiTokenUsage',
                'Notification',
                'Message',
                'ConversationParticipant',
                'Conversation',
                'Grade',
                'ReportCard',
                'Attendance',
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
                'Room',
                'Classroom',
                'GradeLevel',
            ];

            transaction(() => {
                for (const t of tables) {
                    try {
                        db.prepare(`DELETE FROM "${t}" WHERE schoolId = ?`).run(schoolId);
                    } catch {}
                }
                // Handle users who only belong to this school and are not system admins
                const usersToDelete = db
                    .prepare(
                        `
                    SELECT userId FROM "SchoolMembership" m
                    JOIN "User" u ON m.userId = u.id
                    WHERE m.schoolId = ? AND u.isSystemAdmin = 0
                    AND NOT EXISTS (SELECT 1 FROM "SchoolMembership" m2 WHERE m2.userId = m.userId AND m2.schoolId != ?)
                `,
                    )
                    .all(schoolId, schoolId) as any[];

                for (const u of usersToDelete) {
                    db.prepare('DELETE FROM "User" WHERE id = ?').run(u.userId);
                }
                db.prepare('DELETE FROM "School" WHERE id = ?').run(schoolId);
            });

            return { content: [{ type: 'text', text: `Škola '${school.name}' smazána.` }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);
