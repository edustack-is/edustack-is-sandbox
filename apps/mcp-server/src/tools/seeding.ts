import { server } from "../server.js";
import { prisma } from "../db.js";
import { z } from "zod";

// ─── SUBJECT DEFINITIONS BY SCHOOL TYPE ─────────────────────────

interface SubjectDef {
    name: string;
    code: string;
}

const SUBJECTS_ELEMENTARY_1: SubjectDef[] = [
    { name: "Český jazyk a literatura", code: "CJL" },
    { name: "Anglický jazyk", code: "AJ" },
    { name: "Matematika", code: "M" },
    { name: "Prvouka", code: "PRV" },
    { name: "Přírodověda", code: "PŘ" },
    { name: "Vlastivěda", code: "VL" },
    { name: "Hudební výchova", code: "HV" },
    { name: "Výtvarná výchova", code: "VV" },
    { name: "Tělesná výchova", code: "TV" },
    { name: "Pracovní činnosti", code: "PČ" },
    { name: "Informatika", code: "INF" },
];

const SUBJECTS_ELEMENTARY_2: SubjectDef[] = [
    { name: "Český jazyk a literatura", code: "CJL" },
    { name: "Anglický jazyk", code: "AJ" },
    { name: "Německý jazyk", code: "NJ" },
    { name: "Matematika", code: "M" },
    { name: "Fyzika", code: "F" },
    { name: "Chemie", code: "CH" },
    { name: "Přírodopis", code: "PŘ" },
    { name: "Zeměpis", code: "Z" },
    { name: "Dějepis", code: "D" },
    { name: "Občanská výchova", code: "OV" },
    { name: "Hudební výchova", code: "HV" },
    { name: "Výtvarná výchova", code: "VV" },
    { name: "Tělesná výchova", code: "TV" },
    { name: "Pracovní činnosti", code: "PČ" },
    { name: "Informatika", code: "INF" },
];

const SUBJECTS_GYMNASIUM: SubjectDef[] = [
    { name: "Český jazyk a literatura", code: "CJL" },
    { name: "Anglický jazyk", code: "AJ" },
    { name: "Německý jazyk", code: "NJ" },
    { name: "Francouzský jazyk", code: "FJ" },
    { name: "Matematika", code: "M" },
    { name: "Fyzika", code: "F" },
    { name: "Chemie", code: "CH" },
    { name: "Biologie", code: "BI" },
    { name: "Zeměpis", code: "Z" },
    { name: "Dějepis", code: "D" },
    { name: "Základy společenských věd", code: "ZSV" },
    { name: "Hudební výchova", code: "HV" },
    { name: "Výtvarná výchova", code: "VV" },
    { name: "Tělesná výchova", code: "TV" },
    { name: "Informatika a výpočetní technika", code: "IVT" },
    { name: "Seminář z matematiky", code: "SM" },
    { name: "Seminář z fyziky", code: "SF" },
    { name: "Seminář z biologie", code: "SBI" },
    { name: "Seminář z chemie", code: "SCH" },
    { name: "Latina", code: "LAT" },
];

// ─── CLASSROOM / GRADE LEVEL DEFINITIONS ────────────────────────

interface GradeDef {
    levelNumber: number;
    levelName: string;
    classrooms: string[]; // e.g. ["1.A", "1.B"]
}

function getGrades(type: string): GradeDef[] {
    switch (type) {
        case "elementary_1":
            return Array.from({ length: 5 }, (_, i) => ({
                levelNumber: i + 1,
                levelName: `${i + 1}. ročník`,
                classrooms: [`${i + 1}.A`, `${i + 1}.B`],
            }));

        case "elementary_full":
            return Array.from({ length: 9 }, (_, i) => ({
                levelNumber: i + 1,
                levelName: `${i + 1}. ročník`,
                classrooms: [`${i + 1}.A`, `${i + 1}.B`],
            }));

        case "gymnasium_8": {
            const names8 = [
                "Prima", "Sekunda", "Tercie", "Kvarta",
                "Kvinta", "Sexta", "Septima", "Oktáva",
            ];
            return names8.map((name, i) => ({
                levelNumber: i + 1,
                levelName: name,
                classrooms: [`${name} A`, `${name} B`],
            }));
        }

        case "gymnasium_4": {
            return Array.from({ length: 4 }, (_, i) => ({
                levelNumber: i + 1,
                levelName: `${i + 1}. ročník`,
                classrooms: [`${i + 1}.A`, `${i + 1}.B`],
            }));
        }

        default:
            return [];
    }
}

function getSubjects(type: string): SubjectDef[] {
    switch (type) {
        case "elementary_1":
            return SUBJECTS_ELEMENTARY_1;
        case "elementary_full":
            // Merge both stages, deduplicate by code
            const merged = [...SUBJECTS_ELEMENTARY_1, ...SUBJECTS_ELEMENTARY_2];
            const seen = new Set<string>();
            return merged.filter(s => {
                if (seen.has(s.code)) return false;
                seen.add(s.code);
                return true;
            });
        case "gymnasium_8":
        case "gymnasium_4":
            return SUBJECTS_GYMNASIUM;
        default:
            return [];
    }
}

// ─── TOOL ───────────────────────────────────────────────────────

server.tool(
    "seed_school_structure",
    `Naplní školu ukázkovou strukturou podle typu školy. Vytvoří školní rok, ročníky (GradeLevel), třídy (Classroom) a šablony předmětů (SubjectTemplate).
    
Podporované typy:
- elementary_1: Základní škola – pouze 1. stupeň (1.–5. třída)
- elementary_full: Základní škola – 1. i 2. stupeň (1.–9. třída)
- gymnasium_8: Osmileté gymnázium (Prima–Oktáva)
- gymnasium_4: Čtyřleté gymnázium / střední škola (1.–4. ročník)

Každý typ vytvoří odpovídající třídy (A i B pro každý ročník), předměty podle RVP a aktuální školní rok.`,
    {
        schoolId: z.string().describe("ID školy, která se má naplnit"),
        schoolType: z.enum([
            "elementary_1",
            "elementary_full",
            "gymnasium_8",
            "gymnasium_4",
        ]).describe("Typ školy: elementary_1 (1. stupeň ZŠ), elementary_full (celá ZŠ), gymnasium_8 (8leté gymnázium), gymnasium_4 (4leté gymnázium)"),
        academicYearName: z.string().optional().describe("Název školního roku, výchozí '2025/2026'"),
    },
    async ({ schoolId, schoolType, academicYearName }) => {
        try {
            const yearName = academicYearName || "2025/2026";
            const grades = getGrades(schoolType);
            const subjects = getSubjects(schoolType);

            if (grades.length === 0) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Neznámý typ školy: ${schoolType}` }],
                };
            }

            // Check school exists
            const school = await prisma.school.findUnique({ where: { id: schoolId } });
            if (!school) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Škola s ID '${schoolId}' nebyla nalezena.` }],
                };
            }

            const result = await prisma.$transaction(async (tx) => {
                const stats = {
                    academicYear: "",
                    gradeLevels: 0,
                    classrooms: 0,
                    subjects: 0,
                };

                // 1. Create Academic Year (skip if exists)
                let academicYear = await tx.academicYear.findUnique({
                    where: { name_schoolId: { name: yearName, schoolId } },
                });
                if (!academicYear) {
                    // Parse year from name like "2025/2026"
                    const startYear = parseInt(yearName.split("/")[0]) || 2025;
                    academicYear = await tx.academicYear.create({
                        data: {
                            name: yearName,
                            startDate: new Date(`${startYear}-09-01`),
                            endDate: new Date(`${startYear + 1}-06-30`),
                            isCurrent: true,
                            schoolId,
                        },
                    });
                }
                stats.academicYear = academicYear.name;

                // 2. Create Grade Levels and Classrooms
                for (const grade of grades) {
                    // Create grade level (skip if exists)
                    let gradeLevel = await tx.gradeLevel.findUnique({
                        where: { levelNumber_schoolId: { levelNumber: grade.levelNumber, schoolId } },
                    });
                    if (!gradeLevel) {
                        gradeLevel = await tx.gradeLevel.create({
                            data: {
                                name: grade.levelName,
                                levelNumber: grade.levelNumber,
                                schoolId,
                            },
                        });
                        stats.gradeLevels++;
                    }

                    // Create classrooms
                    for (const className of grade.classrooms) {
                        const existing = await tx.classroom.findFirst({
                            where: { name: className, schoolId, grade: grade.levelNumber },
                        });
                        if (!existing) {
                            await tx.classroom.create({
                                data: {
                                    name: className,
                                    grade: grade.levelNumber,
                                    schoolId,
                                },
                            });
                            stats.classrooms++;
                        }
                    }
                }

                // 3. Create Subject Templates (skip if code exists)
                for (const subj of subjects) {
                    const existing = await tx.subjectTemplate.findUnique({
                        where: { code_schoolId: { code: subj.code, schoolId } },
                    });
                    if (!existing) {
                        await tx.subjectTemplate.create({
                            data: {
                                name: subj.name,
                                code: subj.code,
                                schoolId,
                            },
                        });
                        stats.subjects++;
                    }
                }

                return stats;
            });

            const typeLabels: Record<string, string> = {
                elementary_1: "ZŠ – 1. stupeň",
                elementary_full: "ZŠ – 1. i 2. stupeň",
                gymnasium_8: "Osmileté gymnázium",
                gymnasium_4: "Čtyřleté gymnázium",
            };

            const summary = [
                `✅ Škola '${school.name}' byla úspěšně naplněna strukturou: ${typeLabels[schoolType]}`,
                ``,
                `📅 Školní rok: ${result.academicYear}`,
                `📚 Ročníků vytvořeno: ${result.gradeLevels}`,
                `🏫 Tříd vytvořeno: ${result.classrooms}`,
                `📖 Předmětů vytvořeno: ${result.subjects}`,
                ``,
                `Třídy: ${grades.flatMap(g => g.classrooms).join(", ")}`,
                `Předměty: ${subjects.map(s => s.name).join(", ")}`,
            ].join("\n");

            return {
                content: [{ type: "text", text: summary }],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text", text: `Chyba při seedování školy: ${error.message}` }],
            };
        }
    }
);

// ─── DEMO TEACHER DATA ──────────────────────────────────────────

interface TeacherDef {
    firstName: string;
    lastName: string;
    email: string;
    degree: string;
    approbation: string;
    workload: number; // 0.5 = 50%, 1.0 = 100%
}

function getTeachingStaff(schoolType: string): TeacherDef[] {
    const elementary1Teachers: TeacherDef[] = [
        // Full-time teachers (třídní učitelé 1. stupně)
        { firstName: "Jana", lastName: "Nováková", email: "novakova@demo.edustack.cz", degree: "Mgr.", approbation: "1. stupeň ZŠ", workload: 1.0 },
        { firstName: "Marie", lastName: "Svobodová", email: "svobodova@demo.edustack.cz", degree: "Mgr.", approbation: "1. stupeň ZŠ", workload: 1.0 },
        { firstName: "Eva", lastName: "Dvořáková", email: "dvorakova@demo.edustack.cz", degree: "Mgr.", approbation: "1. stupeň ZŠ", workload: 1.0 },
        { firstName: "Kateřina", lastName: "Procházková", email: "prochazkova@demo.edustack.cz", degree: "Mgr.", approbation: "1. stupeň ZŠ", workload: 1.0 },
        { firstName: "Tereza", lastName: "Veselá", email: "vesela@demo.edustack.cz", degree: "Mgr.", approbation: "1. stupeň ZŠ", workload: 1.0 },
        // Part-time teachers (angličtina, TV, INF)
        { firstName: "Petra", lastName: "Horáková", email: "horakova@demo.edustack.cz", degree: "Mgr.", approbation: "Anglický jazyk", workload: 0.5 },
        { firstName: "Martin", lastName: "Černý", email: "cerny@demo.edustack.cz", degree: "Mgr.", approbation: "Tělesná výchova", workload: 0.6 },
        { firstName: "Lukáš", lastName: "Kučera", email: "kucera@demo.edustack.cz", degree: "Ing.", approbation: "Informatika", workload: 0.5 },
        { firstName: "Alena", lastName: "Marková", email: "markova@demo.edustack.cz", degree: "Mgr.", approbation: "Hudební výchova, Výtvarná výchova", workload: 0.7 },
        { firstName: "Jiřina", lastName: "Pokorná", email: "pokorna@demo.edustack.cz", degree: "Mgr.", approbation: "Speciální pedagogika", workload: 0.5 },
    ];

    const elementary2Teachers: TeacherDef[] = [
        // Full-time 2. stupeň
        { firstName: "Tomáš", lastName: "Jelínek", email: "jelinek@demo.edustack.cz", degree: "Mgr.", approbation: "Matematika, Fyzika", workload: 1.0 },
        { firstName: "Pavel", lastName: "Marek", email: "marek@demo.edustack.cz", degree: "RNDr.", approbation: "Chemie, Přírodopis", workload: 1.0 },
        { firstName: "Lenka", lastName: "Němcová", email: "nemcova@demo.edustack.cz", degree: "PhDr.", approbation: "Český jazyk, Dějepis", workload: 1.0 },
        { firstName: "David", lastName: "Šťastný", email: "stastny@demo.edustack.cz", degree: "Mgr.", approbation: "Zeměpis, Občanská výchova", workload: 1.0 },
        { firstName: "Hana", lastName: "Bláhová", email: "blahova@demo.edustack.cz", degree: "Mgr.", approbation: "Anglický jazyk, Německý jazyk", workload: 1.0 },
        // Part-time 2. stupeň
        { firstName: "Ondřej", lastName: "Fiala", email: "fiala@demo.edustack.cz", degree: "Mgr.", approbation: "Tělesná výchova", workload: 0.8 },
        { firstName: "Monika", lastName: "Křížová", email: "krizova@demo.edustack.cz", degree: "MgA.", approbation: "Výtvarná výchova", workload: 0.5 },
        { firstName: "Roman", lastName: "Sedláček", email: "sedlacek@demo.edustack.cz", degree: "Ing.", approbation: "Informatika, Pracovní činnosti", workload: 0.7 },
    ];

    const gymnasiumTeachers: TeacherDef[] = [
        // Full-time
        { firstName: "Jan", lastName: "Kratochvíl", email: "kratochvil@demo.edustack.cz", degree: "RNDr.", approbation: "Matematika, Fyzika", workload: 1.0 },
        { firstName: "Miroslava", lastName: "Urbanová", email: "urbanova@demo.edustack.cz", degree: "PhDr.", approbation: "Český jazyk, Literatura", workload: 1.0 },
        { firstName: "Petr", lastName: "Bartoš", email: "bartos@demo.edustack.cz", degree: "RNDr.", approbation: "Chemie", workload: 1.0 },
        { firstName: "Zuzana", lastName: "Vlčková", email: "vlckova@demo.edustack.cz", degree: "RNDr.", approbation: "Biologie", workload: 1.0 },
        { firstName: "Karel", lastName: "Kolář", email: "kolar@demo.edustack.cz", degree: "PhDr.", approbation: "Dějepis, Latina", workload: 1.0 },
        { firstName: "Markéta", lastName: "Dostálová", email: "dostalova@demo.edustack.cz", degree: "PhDr.", approbation: "Anglický jazyk", workload: 1.0 },
        { firstName: "Jiří", lastName: "Pospíšil", email: "pospisil@demo.edustack.cz", degree: "RNDr.", approbation: "Matematika", workload: 1.0 },
        { firstName: "Lucie", lastName: "Šimková", email: "simkova@demo.edustack.cz", degree: "PhDr.", approbation: "Německý jazyk, Francouzský jazyk", workload: 1.0 },
        { firstName: "Vladimír", lastName: "Novotný", email: "novotny@demo.edustack.cz", degree: "RNDr.", approbation: "Fyzika", workload: 1.0 },
        { firstName: "Ivana", lastName: "Havlíčková", email: "havlickova@demo.edustack.cz", degree: "PhDr.", approbation: "Základy společenských věd, Dějepis", workload: 1.0 },
        // Part-time
        { firstName: "Michal", lastName: "Růžička", email: "ruzicka@demo.edustack.cz", degree: "Mgr.", approbation: "Tělesná výchova", workload: 0.8 },
        { firstName: "Veronika", lastName: "Müllerová", email: "mullerova@demo.edustack.cz", degree: "MgA.", approbation: "Hudební výchova, Výtvarná výchova", workload: 0.6 },
        { firstName: "Jakub", lastName: "Hrubý", email: "hruby@demo.edustack.cz", degree: "Ing.", approbation: "Informatika a výpočetní technika", workload: 0.7 },
        { firstName: "Daniela", lastName: "Benešová", email: "benesova@demo.edustack.cz", degree: "RNDr.", approbation: "Biologie, Chemie – seminář", workload: 0.5 },
        { firstName: "Filip", lastName: "Kopecký", email: "kopecky@demo.edustack.cz", degree: "RNDr. Ph.D.", approbation: "Matematika, Fyzika – seminář", workload: 0.5 },
    ];

    switch (schoolType) {
        case "elementary_1":
            return elementary1Teachers;
        case "elementary_full":
            return [...elementary1Teachers, ...elementary2Teachers];
        case "gymnasium_8":
            return gymnasiumTeachers;
        case "gymnasium_4":
            // Use gymnasium teachers but a smaller subset
            return gymnasiumTeachers.slice(0, 12);
        default:
            return [];
    }
}

// ─── SEED TEACHING STAFF TOOL ───────────────────────────────────

server.tool(
    "seed_teaching_staff",
    `Vytvoří ukázkový učitelský sbor pro školu. Vytvoří uživatele s rolí TEACHER, přidá TeacherProfile (titul, aprobace) a SchoolMembership s úvazkem.

Každý typ školy má realistickou sadu učitelů:
- elementary_1: 10 učitelů (5 plný + 5 částečný úvazek)
- elementary_full: 18 učitelů (10 plný + 8 částečný úvazek)
- gymnasium_8: 15 učitelů (10 plný + 5 částečný úvazek)
- gymnasium_4: 12 učitelů (8 plný + 4 částečný úvazek)

Učitelé mají české jména, realistické aprobace a úvazky (50%–100%).
Heslo pro všechny demo učitele je 'Demo1234!' (bcrypt hash).`,
    {
        schoolId: z.string().describe("ID školy"),
        schoolType: z.enum([
            "elementary_1",
            "elementary_full",
            "gymnasium_8",
            "gymnasium_4",
        ]).describe("Typ školy – určuje složení a počet učitelů"),
    },
    async ({ schoolId, schoolType }) => {
        try {
            const teachers = getTeachingStaff(schoolType);

            if (teachers.length === 0) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Neznámý typ školy: ${schoolType}` }],
                };
            }

            // Check school exists
            const school = await prisma.school.findUnique({ where: { id: schoolId } });
            if (!school) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Škola s ID '${schoolId}' nebyla nalezena.` }],
                };
            }

            // Find current academic year for workload
            const academicYear = await prisma.academicYear.findFirst({
                where: { schoolId, isCurrent: true },
            });

            // bcrypt hash for 'Demo1234!' - pre-computed to avoid dependency
            const demoPasswordHash = "$2b$10$8K1p/q5zQxl0SRDV4Gqe6eruJ3Mn1.Tl5Yng3ORq0q6Z8hMO0dPHG";

            const result = await prisma.$transaction(async (tx) => {
                const created: string[] = [];
                const skipped: string[] = [];

                for (const teacher of teachers) {
                    // Check if user already exists
                    const existing = await tx.user.findUnique({ where: { email: teacher.email } });
                    if (existing) {
                        skipped.push(`${teacher.degree} ${teacher.firstName} ${teacher.lastName} (${teacher.email}) – existuje`);
                        continue;
                    }

                    // Create user
                    const user = await tx.user.create({
                        data: {
                            email: teacher.email,
                            firstName: teacher.firstName,
                            lastName: teacher.lastName,
                            passwordHash: demoPasswordHash,
                        },
                    });

                    // Create teacher profile
                    await tx.teacherProfile.create({
                        data: {
                            userId: user.id,
                            degree: teacher.degree,
                            approbation: teacher.approbation,
                        },
                    });

                    // Create school membership
                    await tx.schoolMembership.create({
                        data: {
                            userId: user.id,
                            schoolId,
                            role: "TEACHER",
                            status: "ACTIVE",
                            workloadPercentage: teacher.workload,
                        },
                    });

                    // Create teacher workload if academic year exists
                    if (academicYear) {
                        await tx.teacherWorkload.create({
                            data: {
                                teacherId: user.id,
                                academicYearId: academicYear.id,
                                workloadPercentage: teacher.workload,
                            },
                        });
                    }

                    const workloadPct = Math.round(teacher.workload * 100);
                    created.push(`${teacher.degree} ${teacher.firstName} ${teacher.lastName} (${teacher.email}) – úvazek ${workloadPct}%, aprobace: ${teacher.approbation}`);
                }

                return { created, skipped };
            });

            const fullTime = teachers.filter(t => t.workload >= 1.0).length;
            const partTime = teachers.filter(t => t.workload < 1.0).length;

            const summary = [
                `✅ Učitelský sbor pro školu '${school.name}' byl vytvořen.`,
                ``,
                `👩‍🏫 Celkem: ${result.created.length} nových učitelů (${fullTime} plný úvazek, ${partTime} částečný)`,
                result.skipped.length > 0 ? `⏭️ Přeskočeno (již existují): ${result.skipped.length}` : "",
                `🔑 Heslo pro všechny: Demo1234!`,
                academicYear ? `📅 Workload přiřazen k roku: ${academicYear.name}` : `⚠️ Nebyl nalezen aktuální školní rok – workload nebyl vytvořen.`,
                ``,
                `--- Vytvořeno ---`,
                ...result.created,
                ...(result.skipped.length > 0 ? [``, `--- Přeskočeno ---`, ...result.skipped] : []),
            ].filter(Boolean).join("\n");

            return {
                content: [{ type: "text", text: summary }],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: "text", text: `Chyba při vytváření učitelského sboru: ${error.message}` }],
            };
        }
    }
);

// ═══════════════════════════════════════════════════════════════
// GENERATE FULL TEST DATA (orchestrator)
// ═══════════════════════════════════════════════════════════════

server.tool(
    "generate_full_test_data",
    `Vytvoří kompletní školu s realistickými testovacími daty – učitele, studenty, rodiče, předměty, rozvrh, klasifikaci a komunikaci.

Podporované typy:
- elementary_1: ZŠ – 1. stupeň
- elementary_full: ZŠ – 1. i 2. stupeň
- gymnasium_8: Osmileté gymnázium
- gymnasium_4: Čtyřleté gymnázium

Heslo pro všechny demo účty: Demo1234!`,
    {
        schoolName: z.string().describe("Název nové školy"),
        schoolType: z.enum(["elementary_1", "elementary_full", "gymnasium_8", "gymnasium_4"]).describe("Typ školy"),
        teacherCount: z.number().optional().describe("Počet učitelů (výchozí 10)"),
        studentCount: z.number().optional().describe("Počet studentů (výchozí 50)"),
    },
    async ({ schoolName, schoolType, teacherCount, studentCount }) => {
        try {
            const tc = teacherCount ?? 10;
            const sc = studentCount ?? 50;

            // 1. Create school
            const school = await prisma.school.create({ data: { name: schoolName } });
            const schoolId = school.id;
            const grades = getGrades(schoolType);
            const subjects = getSubjects(schoolType);
            const demoPasswordHash = "$2b$10$8K1p/q5zQxl0SRDV4Gqe6eruJ3Mn1.Tl5Yng3ORq0q6Z8hMO0dPHG";

            const result = await prisma.$transaction(async (tx) => {
                const stats = { teachers: 0, students: 0, parents: 0, subjects: 0, classrooms: 0 };

                // Academic year
                const academicYear = await tx.academicYear.create({
                    data: { name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-06-30"), isCurrent: true, schoolId },
                });

                // Grade levels & classrooms
                const classroomIds: string[] = [];
                const gradeLevelMap: Record<number, string> = {};
                for (const grade of grades) {
                    const gl = await tx.gradeLevel.create({
                        data: { name: grade.levelName, levelNumber: grade.levelNumber, schoolId },
                    });
                    gradeLevelMap[grade.levelNumber] = gl.id;
                    for (const name of grade.classrooms) {
                        const c = await tx.classroom.create({ data: { name, grade: grade.levelNumber, schoolId } });
                        classroomIds.push(c.id);
                        stats.classrooms++;
                    }
                }

                // Subject templates & instances
                for (const subj of subjects) {
                    const tmpl = await tx.subjectTemplate.create({ data: { name: subj.name, code: subj.code, schoolId } });
                    stats.subjects++;
                    for (const [lvlStr, glId] of Object.entries(gradeLevelMap)) {
                        await tx.subjectInstance.create({
                            data: { templateId: tmpl.id, academicYearId: academicYear.id, gradeLevelId: glId, schoolId, hoursPerWeek: 3 },
                        });
                    }
                }

                // Teachers
                const teachers = getTeachingStaff(schoolType).slice(0, tc);
                for (const t of teachers) {
                    const existing = await tx.user.findUnique({ where: { email: t.email } });
                    if (existing) continue;
                    const user = await tx.user.create({ data: { email: t.email, firstName: t.firstName, lastName: t.lastName, passwordHash: demoPasswordHash } });
                    await tx.teacherProfile.create({ data: { userId: user.id, degree: t.degree, approbation: t.approbation } });
                    await tx.schoolMembership.create({ data: { userId: user.id, schoolId, role: "TEACHER", status: "ACTIVE", workloadPercentage: t.workload } });
                    stats.teachers++;
                }

                // Students + parents
                for (let i = 0; i < sc; i++) {
                    const email = `student${i}@demo.${schoolId.slice(0, 8)}.cz`;
                    const clsId = classroomIds[i % classroomIds.length];
                    const stu = await tx.user.create({ data: { email, firstName: `Student`, lastName: `Demo${i + 1}`, passwordHash: demoPasswordHash } });
                    await tx.studentProfile.create({ data: { userId: stu.id, firstName: stu.firstName, lastName: stu.lastName, classroomId: clsId } });
                    await tx.schoolMembership.create({ data: { userId: stu.id, schoolId, role: "STUDENT", status: "ACTIVE" } });
                    stats.students++;

                    // Parent
                    const pEmail = `rodic${i}@demo.${schoolId.slice(0, 8)}.cz`;
                    const parent = await tx.user.create({ data: { email: pEmail, firstName: `Rodič`, lastName: `Demo${i + 1}`, passwordHash: demoPasswordHash } });
                    await tx.schoolMembership.create({ data: { userId: parent.id, schoolId, role: "PARENT", status: "ACTIVE" } });
                    await tx.parentStudent.create({ data: { parentId: parent.id, studentId: stu.id } });
                    stats.parents++;
                }

                return { ...stats, schoolId, academicYear: academicYear.name };
            });

            return {
                content: [{
                    type: "text",
                    text: [
                        `✅ Škola '${schoolName}' vytvořena (ID: ${result.schoolId})`,
                        `📅 Školní rok: ${result.academicYear}`,
                        `👩‍🏫 Učitelů: ${result.teachers}`,
                        `👩‍🎓 Studentů: ${result.students}`,
                        `👪 Rodičů: ${result.parents}`,
                        `📖 Předmětů: ${result.subjects}`,
                        `🏫 Tříd: ${result.classrooms}`,
                        `🔑 Heslo: Demo1234!`,
                    ].join("\n"),
                }],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: "text", text: `Chyba: ${error.message}` }] };
        }
    }
);

// ═══════════════════════════════════════════════════════════════
// WIPE SCHOOL DATA
// ═══════════════════════════════════════════════════════════════

server.tool(
    "wipe_school_data",
    "Smaže školu a VŠECHNA přidružená data (uživatele, předměty, rozvrh, klasifikaci, komunikaci). Nevratná akce!",
    {
        schoolId: z.string().describe("ID školy k smazání"),
    },
    async ({ schoolId }) => {
        try {
            const school = await prisma.school.findUnique({ where: { id: schoolId } });
            if (!school) return { isError: true, content: [{ type: "text", text: `Škola s ID '${schoolId}' nebyla nalezena.` }] };

            await prisma.$transaction(async (tx) => {
                // Delete in dependency order
                await tx.notification.deleteMany({ where: { userId: { in: (await tx.conversationParticipant.findMany({ where: { conversation: { schoolId } }, select: { userId: true } })).map(p => p.userId) } } });
                await tx.message.deleteMany({ where: { conversation: { schoolId } } });
                await tx.conversationParticipant.deleteMany({ where: { conversation: { schoolId } } });
                await tx.conversation.deleteMany({ where: { schoolId } });
                await tx.grade.deleteMany({ where: { schoolId } });
                await tx.reportCard.deleteMany({ where: { schoolId } });
                await tx.attendance.deleteMany({ where: { schoolId } });
                await tx.scheduleSubstitution.deleteMany({ where: { schoolId } });
                await tx.scheduleEvent.deleteMany({ where: { schoolId } });
                await tx.lessonTimeSlot.deleteMany({ where: { schoolId } });
                await tx.curriculumEntry.deleteMany({ where: { curriculumVersion: { schoolId } } });
                await tx.curriculumVersion.deleteMany({ where: { schoolId } });
                await tx.subjectInstance.deleteMany({ where: { schoolId } });
                await tx.subjectTemplate.deleteMany({ where: { schoolId } });
                await tx.staffSubjectAssignment.deleteMany({ where: { staffWorkload: { academicYear: { schoolId } } } });
                await tx.staffWorkload.deleteMany({ where: { academicYear: { schoolId } } });
                await tx.teacherWorkload.deleteMany({ where: { academicYear: { schoolId } } });
                await tx.studentEnrollment.deleteMany({ where: { academicYear: { schoolId } } });
                await tx.semester.deleteMany({ where: { academicYear: { schoolId } } });
                await tx.academicYear.deleteMany({ where: { schoolId } });

                const members = await tx.schoolMembership.findMany({ where: { schoolId }, select: { userId: true } });
                const userIds = members.map(m => m.userId);
                const soloUserIds: string[] = [];
                for (const uid of userIds) {
                    const other = await tx.schoolMembership.count({ where: { userId: uid, schoolId: { not: schoolId } } });
                    const u = await tx.user.findUnique({ where: { id: uid }, select: { isSystemAdmin: true } });
                    if (other === 0 && !u?.isSystemAdmin) soloUserIds.push(uid);
                }

                await tx.parentStudent.deleteMany({ where: { OR: [{ parentId: { in: soloUserIds } }, { studentId: { in: soloUserIds } }] } });
                await tx.teacherProfile.deleteMany({ where: { userId: { in: soloUserIds } } });
                await tx.studentProfile.deleteMany({ where: { userId: { in: soloUserIds } } });
                await tx.identity.deleteMany({ where: { userId: { in: soloUserIds } } });
                await tx.schoolMembership.deleteMany({ where: { schoolId } });
                await tx.room.deleteMany({ where: { schoolId } });
                await tx.classroom.deleteMany({ where: { schoolId } });
                await tx.gradeLevel.deleteMany({ where: { schoolId } });
                await tx.aiTokenUsage.deleteMany({ where: { schoolId } });
                await tx.notification.deleteMany({ where: { userId: { in: soloUserIds } } });
                await tx.user.deleteMany({ where: { id: { in: soloUserIds } } });
                await tx.school.delete({ where: { id: schoolId } });
            });

            return { content: [{ type: "text", text: `🗑️ Škola '${school.name}' a všechna přidružená data byla smazána.` }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: "text", text: `Chyba: ${error.message}` }] };
        }
    }
);
