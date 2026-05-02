import { server } from '../server.js';
import { db, transaction } from '../db.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// ═══════════════════════════════════════════════════════════════
// ACADEMIC YEAR
// ═══════════════════════════════════════════════════════════════

server.tool(
    'create_academic_year',
    'Vytvoří nový školní rok pro danou školu. Pokud je nastaven jako aktuální (isCurrent), ostatní roky se automaticky přepnou na neaktuální.',
    {
        schoolId: z.string().describe('ID školy'),
        name: z.string().describe("Název školního roku, např. '2025/2026'"),
        startDate: z.string().describe("Datum začátku (ISO 8601, např. '2025-09-01')"),
        endDate: z.string().describe("Datum konce (ISO 8601, např. '2026-06-30')"),
        isCurrent: z.boolean().optional().describe('Zda je to aktuální školní rok (výchozí: false)'),
    },
    async ({ schoolId, name, startDate, endDate, isCurrent }) => {
        try {
            const school = db.prepare('SELECT id FROM "School" WHERE id = ? AND deletedAt IS NULL').get(schoolId);
            if (!school) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Škola s ID '${schoolId}' nebyla nalezena.` }],
                };
            }

            const existing = db
                .prepare('SELECT id FROM "AcademicYear" WHERE name = ? AND schoolId = ?')
                .get(name, schoolId);
            if (existing) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: `Školní rok '${name}' pro tuto školu již existuje (ID: ${(existing as any).id}).`,
                        },
                    ],
                };
            }

            const now = new Date().toISOString();
            const id = randomUUID();

            transaction(() => {
                if (isCurrent) {
                    db.prepare('UPDATE "AcademicYear" SET isCurrent = 0 WHERE schoolId = ? AND isCurrent = 1').run(
                        schoolId,
                    );
                }
                db.prepare(
                    'INSERT INTO "AcademicYear" (id, name, startDate, endDate, isCurrent, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                ).run(id, name, startDate, endDate, isCurrent ? 1 : 0, schoolId, now, now);
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Školní rok '${name}' vytvořen (ID: ${id})${isCurrent ? ' – nastaven jako aktuální' : ''}.`,
                    },
                ],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);

server.tool(
    'list_academic_years',
    'Vypíše všechny školní roky dané školy.',
    {
        schoolId: z.string().describe('ID školy'),
    },
    async ({ schoolId }) => {
        try {
            const years = db
                .prepare('SELECT * FROM "AcademicYear" WHERE schoolId = ? ORDER BY startDate DESC')
                .all(schoolId) as any[];

            if (years.length === 0) {
                return { content: [{ type: 'text', text: 'Škola nemá žádné školní roky.' }] };
            }

            const lines = years.map((y) => {
                const enrollmentCount = (
                    db
                        .prepare('SELECT COUNT(*) as count FROM "StudentEnrollment" WHERE academicYearId = ?')
                        .get(y.id) as any
                ).count;
                const instanceCount = (
                    db
                        .prepare('SELECT COUNT(*) as count FROM "SubjectInstance" WHERE academicYearId = ?')
                        .get(y.id) as any
                ).count;
                return `- ${y.name} (${y.startDate} – ${y.endDate})${y.isCurrent ? ' ★ aktuální' : ''} | zápisů: ${enrollmentCount}, instancí: ${instanceCount} | ID: ${y.id}`;
            });

            return { content: [{ type: 'text', text: `Školní roky (${years.length}):\n${lines.join('\n')}` }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);

// ═══════════════════════════════════════════════════════════════
// GRADE LEVELS
// ═══════════════════════════════════════════════════════════════

server.tool(
    'list_grade_levels',
    'Vypíše všechny ročníky (GradeLevel) dané školy, seřazené podle čísla.',
    {
        schoolId: z.string().describe('ID školy'),
    },
    async ({ schoolId }) => {
        try {
            const levels = db
                .prepare('SELECT * FROM "GradeLevel" WHERE schoolId = ? ORDER BY levelNumber ASC')
                .all(schoolId) as any[];

            if (levels.length === 0) {
                return {
                    content: [
                        { type: 'text', text: 'Škola nemá žádné ročníky. Použij seed_school_structure pro vytvoření.' },
                    ],
                };
            }

            const lines = levels.map((l) => {
                const enrollmentCount = (
                    db
                        .prepare('SELECT COUNT(*) as count FROM "StudentEnrollment" WHERE gradeLevelId = ?')
                        .get(l.id) as any
                ).count;
                const instanceCount = (
                    db
                        .prepare('SELECT COUNT(*) as count FROM "SubjectInstance" WHERE gradeLevelId = ?')
                        .get(l.id) as any
                ).count;
                return `- ${l.name} (úroveň ${l.levelNumber}) | zápisů: ${enrollmentCount}, předmětů: ${instanceCount} | ID: ${l.id}`;
            });

            return { content: [{ type: 'text', text: `Ročníky (${levels.length}):\n${lines.join('\n')}` }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);

// ═══════════════════════════════════════════════════════════════
// SUBJECT TEMPLATES
// ═══════════════════════════════════════════════════════════════

server.tool(
    'list_subject_templates',
    'Vypíše všechny šablony předmětů (SubjectTemplate) dané školy.',
    {
        schoolId: z.string().describe('ID školy'),
    },
    async ({ schoolId }) => {
        try {
            const templates = db
                .prepare('SELECT * FROM "SubjectTemplate" WHERE schoolId = ? ORDER BY name ASC')
                .all(schoolId) as any[];

            if (templates.length === 0) {
                return { content: [{ type: 'text', text: 'Škola nemá žádné šablony předmětů.' }] };
            }

            const lines = templates.map((t) => {
                const instanceCount = (
                    db.prepare('SELECT COUNT(*) as count FROM "SubjectInstance" WHERE templateId = ?').get(t.id) as any
                ).count;
                return `- ${t.name} (${t.code})${t.svpDescription ? ` – ${t.svpDescription}` : ''} | instancí: ${instanceCount} | ID: ${t.id}`;
            });

            return {
                content: [{ type: 'text', text: `Šablony předmětů (${templates.length}):\n${lines.join('\n')}` }],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);

server.tool(
    'create_subject_template',
    'Vytvoří novou šablonu předmětu pro školu.',
    {
        schoolId: z.string().describe('ID školy'),
        name: z.string().describe("Název předmětu, např. 'Matematika'"),
        code: z.string().describe("Kód předmětu, např. 'M'"),
        svpDescription: z.string().optional().describe('Popis ze ŠVP (volitelný)'),
    },
    async ({ schoolId, name, code, svpDescription }) => {
        try {
            const existing = db
                .prepare('SELECT id FROM "SubjectTemplate" WHERE code = ? AND schoolId = ?')
                .get(code, schoolId);
            if (existing) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: `Předmět s kódem '${code}' v této škole již existuje (ID: ${(existing as any).id}).`,
                        },
                    ],
                };
            }

            const id = randomUUID();
            db.prepare(
                'INSERT INTO "SubjectTemplate" (id, name, code, svpDescription, schoolId) VALUES (?, ?, ?, ?, ?)',
            ).run(id, name, code, svpDescription || null, schoolId);

            return {
                content: [{ type: 'text', text: `Předmět '${name}' (${code}) vytvořen s ID: ${id}` }],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);

// ═══════════════════════════════════════════════════════════════
// SUBJECT INSTANCES
// ═══════════════════════════════════════════════════════════════

server.tool(
    'create_subject_instance',
    "Přiřadí šablonu předmětu ke konkrétnímu ročníku a školnímu roku s daným počtem hodin/týden. Tím vznikne 'instance předmětu' – např. 'Matematika v 1. ročníku 2025/2026, 4h/týden'.",
    {
        schoolId: z.string().describe('ID školy'),
        templateId: z.string().describe('ID šablony předmětu (SubjectTemplate)'),
        academicYearId: z.string().describe('ID školního roku'),
        gradeLevelId: z.string().describe('ID ročníku (GradeLevel)'),
        hoursPerWeek: z.number().int().min(1).max(20).describe('Počet vyučovacích hodin týdně'),
    },
    async ({ schoolId, templateId, academicYearId, gradeLevelId, hoursPerWeek }) => {
        try {
            const template = db
                .prepare('SELECT name, code FROM "SubjectTemplate" WHERE id = ? AND schoolId = ?')
                .get(templateId, schoolId) as any;
            const year = db
                .prepare('SELECT name FROM "AcademicYear" WHERE id = ? AND schoolId = ?')
                .get(academicYearId, schoolId) as any;
            const grade = db
                .prepare('SELECT name FROM "GradeLevel" WHERE id = ? AND schoolId = ?')
                .get(gradeLevelId, schoolId) as any;

            if (!template)
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Šablona předmětu '${templateId}' nebyla nalezena.` }],
                };
            if (!year)
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Školní rok '${academicYearId}' nebyl nalezen.` }],
                };
            if (!grade)
                return { isError: true, content: [{ type: 'text', text: `Ročník '${gradeLevelId}' nebyl nalezen.` }] };

            const existing = db
                .prepare(
                    'SELECT id FROM "SubjectInstance" WHERE templateId = ? AND academicYearId = ? AND gradeLevelId = ?',
                )
                .get(templateId, academicYearId, gradeLevelId);
            if (existing) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Instance již existuje (ID: ${(existing as any).id}).` }],
                };
            }

            const id = randomUUID();
            const now = new Date().toISOString();
            db.prepare(
                'INSERT INTO "SubjectInstance" (id, templateId, academicYearId, gradeLevelId, schoolId, hoursPerWeek, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            ).run(id, templateId, academicYearId, gradeLevelId, schoolId, hoursPerWeek, now, now);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Instance předmětu vytvořena: ${template.name} (${template.code}) → ${grade.name}, ${year.name}, ${hoursPerWeek}h/týden. ID: ${id}`,
                    },
                ],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);

server.tool(
    'list_subject_instances',
    'Vypíše instance předmětů pro danou školu, volitelně filtrované podle školního roku nebo ročníku.',
    {
        schoolId: z.string().describe('ID školy'),
        academicYearId: z.string().optional().describe('Filtr: ID školního roku'),
        gradeLevelId: z.string().optional().describe('Filtr: ID ročníku'),
    },
    async ({ schoolId, academicYearId, gradeLevelId }) => {
        try {
            let sql = `
                SELECT i.*, t.name as templateName, t.code as templateCode, y.name as yearName, g.name as gradeName
                FROM "SubjectInstance" i
                JOIN "SubjectTemplate" t ON i.templateId = t.id
                JOIN "AcademicYear" y ON i.academicYearId = y.id
                JOIN "GradeLevel" g ON i.gradeLevelId = g.id
                WHERE i.schoolId = ?
            `;
            const params: any[] = [schoolId];

            if (academicYearId) {
                sql += ' AND i.academicYearId = ?';
                params.push(academicYearId);
            }
            if (gradeLevelId) {
                sql += ' AND i.gradeLevelId = ?';
                params.push(gradeLevelId);
            }

            sql += ' ORDER BY g.levelNumber ASC, t.name ASC';

            const instances = db.prepare(sql).all(...params) as any[];

            if (instances.length === 0) {
                return { content: [{ type: 'text', text: 'Žádné instance předmětů nenalezeny.' }] };
            }

            const lines = instances.map((i) => {
                const gradeCount = (
                    db.prepare('SELECT COUNT(*) as count FROM "Grade" WHERE subjectInstanceId = ?').get(i.id) as any
                ).count;
                const scheduleCount = (
                    db
                        .prepare('SELECT COUNT(*) as count FROM "ScheduleEvent" WHERE subjectInstanceId = ?')
                        .get(i.id) as any
                ).count;
                return `- ${i.templateName} (${i.templateCode}) | ${i.gradeName} | ${i.yearName} | ${i.hoursPerWeek}h/tý | známek: ${gradeCount}, rozvrh: ${scheduleCount} | ID: ${i.id}`;
            });

            return {
                content: [{ type: 'text', text: `Instance předmětů (${instances.length}):\n${lines.join('\n')}` }],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);

// ═══════════════════════════════════════════════════════════════
// STUDENT ENROLLMENT
// ═══════════════════════════════════════════════════════════════

server.tool(
    'enroll_students',
    'Hromadně zapíše studenty do školního roku a ročníku, volitelně do třídy. Pokud zápis pro studenta a rok již existuje, přeskočí ho.',
    {
        schoolId: z.string().describe('ID školy'),
        studentIds: z.array(z.string()).describe('Pole ID studentů (User IDs)'),
        academicYearId: z.string().describe('ID školního roku'),
        gradeLevelId: z.string().describe('ID ročníku'),
        classroomId: z.string().optional().describe('ID třídy (volitelné)'),
    },
    async ({ schoolId, studentIds, academicYearId, gradeLevelId, classroomId }) => {
        try {
            const year = db
                .prepare('SELECT name FROM "AcademicYear" WHERE id = ? AND schoolId = ?')
                .get(academicYearId, schoolId) as any;
            const grade = db
                .prepare('SELECT name FROM "GradeLevel" WHERE id = ? AND schoolId = ?')
                .get(gradeLevelId, schoolId) as any;

            if (!year)
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Školní rok '${academicYearId}' nebyl nalezen.` }],
                };
            if (!grade)
                return { isError: true, content: [{ type: 'text', text: `Ročník '${gradeLevelId}' nebyl nalezen.` }] };

            if (classroomId) {
                const classroom = db
                    .prepare('SELECT name FROM "Classroom" WHERE id = ? AND schoolId = ?')
                    .get(classroomId, schoolId);
                if (!classroom)
                    return {
                        isError: true,
                        content: [{ type: 'text', text: `Třída '${classroomId}' nebyla nalezena.` }],
                    };
            }

            let enrolled = 0;
            let skipped = 0;
            const errors: string[] = [];
            const now = new Date().toISOString();

            for (const studentId of studentIds) {
                try {
                    const existing = db
                        .prepare('SELECT id FROM "StudentEnrollment" WHERE studentId = ? AND academicYearId = ?')
                        .get(studentId, academicYearId);
                    if (existing) {
                        skipped++;
                        continue;
                    }

                    db.prepare(
                        'INSERT INTO "StudentEnrollment" (id, studentId, academicYearId, gradeLevelId, classroomId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    ).run(randomUUID(), studentId, academicYearId, gradeLevelId, classroomId || null, now, now);
                    enrolled++;
                } catch (err: any) {
                    errors.push(`${studentId}: ${err.message}`);
                }
            }

            const parts = [`Zapsáno: ${enrolled}/${studentIds.length} studentů do ${grade.name}, ${year.name}.`];
            if (skipped > 0) parts.push(`Přeskočeno (již zapsáni): ${skipped}.`);
            if (errors.length > 0) parts.push(`Chyby: ${errors.join('; ')}`);

            return { content: [{ type: 'text', text: parts.join(' ') }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);
