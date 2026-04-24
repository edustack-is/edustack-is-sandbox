import { server } from '../server.js';
import { prisma } from '../db.js';
import { z } from 'zod';

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
            const school = await prisma.school.findFirst({ where: { id: schoolId, deletedAt: null } });
            if (!school) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Škola s ID '${schoolId}' nebyla nalezena.` }],
                };
            }

            // Check uniqueness
            const existing = await prisma.academicYear.findUnique({
                where: { name_schoolId: { name, schoolId } },
            });
            if (existing) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: `Školní rok '${name}' pro tuto školu již existuje (ID: ${existing.id}).`,
                        },
                    ],
                };
            }

            const result = await prisma.$transaction(async (tx) => {
                // If setting as current, unset others
                if (isCurrent) {
                    await tx.academicYear.updateMany({
                        where: { schoolId, isCurrent: true },
                        data: { isCurrent: false },
                    });
                }

                return tx.academicYear.create({
                    data: {
                        name,
                        startDate: new Date(startDate),
                        endDate: new Date(endDate),
                        isCurrent: isCurrent || false,
                        schoolId,
                    },
                });
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Školní rok '${name}' vytvořen (ID: ${result.id})${isCurrent ? ' – nastaven jako aktuální' : ''}.`,
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
            const years = await prisma.academicYear.findMany({
                where: { schoolId },
                orderBy: { startDate: 'desc' },
                include: {
                    _count: { select: { studentEnrollments: true, subjectInstances: true } },
                },
            });

            if (years.length === 0) {
                return { content: [{ type: 'text', text: 'Škola nemá žádné školní roky.' }] };
            }

            const lines = years.map(
                (y) =>
                    `- ${y.name} (${y.startDate.toISOString().slice(0, 10)} – ${y.endDate.toISOString().slice(0, 10)})${y.isCurrent ? ' ★ aktuální' : ''} | zápisů: ${y._count.studentEnrollments}, instancí: ${y._count.subjectInstances} | ID: ${y.id}`,
            );

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
            const levels = await prisma.gradeLevel.findMany({
                where: { schoolId },
                orderBy: { levelNumber: 'asc' },
                include: {
                    _count: { select: { studentEnrollments: true, subjectInstances: true } },
                },
            });

            if (levels.length === 0) {
                return {
                    content: [
                        { type: 'text', text: 'Škola nemá žádné ročníky. Použij seed_school_structure pro vytvoření.' },
                    ],
                };
            }

            const lines = levels.map(
                (l) =>
                    `- ${l.name} (úroveň ${l.levelNumber}) | zápisů: ${l._count.studentEnrollments}, předmětů: ${l._count.subjectInstances} | ID: ${l.id}`,
            );

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
            const templates = await prisma.subjectTemplate.findMany({
                where: { schoolId },
                orderBy: { name: 'asc' },
                include: {
                    _count: { select: { instances: true } },
                },
            });

            if (templates.length === 0) {
                return { content: [{ type: 'text', text: 'Škola nemá žádné šablony předmětů.' }] };
            }

            const lines = templates.map(
                (t) =>
                    `- ${t.name} (${t.code})${t.svpDescription ? ` – ${t.svpDescription}` : ''} | instancí: ${t._count.instances} | ID: ${t.id}`,
            );

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
            const existing = await prisma.subjectTemplate.findUnique({
                where: { code_schoolId: { code, schoolId } },
            });
            if (existing) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: `Předmět s kódem '${code}' v této škole již existuje (ID: ${existing.id}).`,
                        },
                    ],
                };
            }

            const template = await prisma.subjectTemplate.create({
                data: { name, code, svpDescription, schoolId },
            });

            return {
                content: [{ type: 'text', text: `Předmět '${name}' (${code}) vytvořen s ID: ${template.id}` }],
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
            // Validate references
            const [template, year, grade] = await Promise.all([
                prisma.subjectTemplate.findFirst({ where: { id: templateId, schoolId } }),
                prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId } }),
                prisma.gradeLevel.findFirst({ where: { id: gradeLevelId, schoolId } }),
            ]);

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

            // Check uniqueness
            const existing = await prisma.subjectInstance.findUnique({
                where: { templateId_academicYearId_gradeLevelId: { templateId, academicYearId, gradeLevelId } },
            });
            if (existing) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: `Instance '${template.name}' pro ${grade.name} v ${year.name} již existuje (ID: ${existing.id}).`,
                        },
                    ],
                };
            }

            const instance = await prisma.subjectInstance.create({
                data: { templateId, academicYearId, gradeLevelId, schoolId, hoursPerWeek },
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Instance předmětu vytvořena: ${template.name} (${template.code}) → ${grade.name}, ${year.name}, ${hoursPerWeek}h/týden. ID: ${instance.id}`,
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
            const where: any = { schoolId };
            if (academicYearId) where.academicYearId = academicYearId;
            if (gradeLevelId) where.gradeLevelId = gradeLevelId;

            const instances = await prisma.subjectInstance.findMany({
                where,
                include: {
                    template: true,
                    academicYear: true,
                    gradeLevel: true,
                    _count: { select: { grades: true, scheduleEvents: true } },
                },
                orderBy: [{ gradeLevel: { levelNumber: 'asc' } }, { template: { name: 'asc' } }],
            });

            if (instances.length === 0) {
                return { content: [{ type: 'text', text: 'Žádné instance předmětů nenalezeny.' }] };
            }

            const lines = instances.map(
                (i) =>
                    `- ${i.template.name} (${i.template.code}) | ${i.gradeLevel.name} | ${i.academicYear.name} | ${i.hoursPerWeek}h/tý | známek: ${i._count.grades}, rozvrh: ${i._count.scheduleEvents} | ID: ${i.id}`,
            );

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
            // Validate references
            const [year, grade] = await Promise.all([
                prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId } }),
                prisma.gradeLevel.findFirst({ where: { id: gradeLevelId, schoolId } }),
            ]);
            if (!year)
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Školní rok '${academicYearId}' nebyl nalezen.` }],
                };
            if (!grade)
                return { isError: true, content: [{ type: 'text', text: `Ročník '${gradeLevelId}' nebyl nalezen.` }] };

            if (classroomId) {
                const classroom = await prisma.classroom.findFirst({ where: { id: classroomId, schoolId } });
                if (!classroom)
                    return {
                        isError: true,
                        content: [{ type: 'text', text: `Třída '${classroomId}' nebyla nalezena.` }],
                    };
            }

            let enrolled = 0;
            let skipped = 0;
            const errors: string[] = [];

            for (const studentId of studentIds) {
                try {
                    // Check if already enrolled
                    const existing = await prisma.studentEnrollment.findUnique({
                        where: { studentId_academicYearId: { studentId, academicYearId } },
                    });
                    if (existing) {
                        skipped++;
                        continue;
                    }

                    await prisma.studentEnrollment.create({
                        data: { studentId, academicYearId, gradeLevelId, classroomId },
                    });
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
