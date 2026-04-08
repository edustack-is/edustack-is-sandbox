import { server } from "../server.js";
import { prisma } from "../db.js";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════
// GRADES (ZNÁMKY)
// ═══════════════════════════════════════════════════════════════

server.tool(
    "create_grade",
    "Zadá známku studentovi v dané instanci předmětu. Vyžaduje ID studenta (StudentProfile), instance předmětu a učitele (TeacherProfile).",
    {
        schoolId: z.string().describe("ID školy"),
        studentId: z.string().describe("ID StudentProfile (ne User ID!)"),
        subjectInstanceId: z.string().describe("ID instance předmětu (SubjectInstance)"),
        teacherId: z.string().describe("ID TeacherProfile (ne User ID!)"),
        value: z.string().describe("Hodnota známky (1-5, nebo textový popis)"),
        weight: z.number().min(0.1).max(1.0).describe("Váha známky (0.1–1.0, výchozí 1.0 pro klasický test)"),
        description: z.string().optional().describe("Popis (např. 'Písemka z rovnic', 'Ústní zkoušení')"),
        academicYearId: z.string().optional().describe("ID školního roku (volitelné, pro filtraci)"),
    },
    async ({ schoolId, studentId, subjectInstanceId, teacherId, value, weight, description, academicYearId }) => {
        try {
            // Validate references
            const [student, subject, teacher] = await Promise.all([
                prisma.studentProfile.findUnique({ where: { id: studentId }, include: { user: true } }),
                prisma.subjectInstance.findFirst({ where: { id: subjectInstanceId, schoolId }, include: { template: true } }),
                prisma.teacherProfile.findUnique({ where: { id: teacherId }, include: { user: true } }),
            ]);

            if (!student) return { isError: true, content: [{ type: "text", text: `StudentProfile '${studentId}' nebyl nalezen. Použij list_users pro zjištění správného ID.` }] };
            if (!subject) return { isError: true, content: [{ type: "text", text: `Instance předmětu '${subjectInstanceId}' nebyla nalezena.` }] };
            if (!teacher) return { isError: true, content: [{ type: "text", text: `TeacherProfile '${teacherId}' nebyl nalezen.` }] };

            const grade = await prisma.grade.create({
                data: {
                    value,
                    weight,
                    description,
                    schoolId,
                    studentId,
                    subjectInstanceId,
                    teacherId,
                    academicYearId,
                },
            });

            return {
                content: [{
                    type: "text",
                    text: `Známka '${value}' (váha ${weight}) zadána pro ${student.firstName} ${student.lastName} z ${subject.template.name}. ID: ${grade.id}`,
                }],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: "text", text: `Chyba při zadávání známky: ${error.message}` }] };
        }
    }
);

server.tool(
    "list_student_grades",
    "Vypíše známky studenta, volitelně filtrované podle předmětu nebo školního roku.",
    {
        studentId: z.string().describe("ID StudentProfile"),
        subjectInstanceId: z.string().optional().describe("Filtr: ID instance předmětu"),
        academicYearId: z.string().optional().describe("Filtr: ID školního roku"),
    },
    async ({ studentId, subjectInstanceId, academicYearId }) => {
        try {
            const where: any = { studentId };
            if (subjectInstanceId) where.subjectInstanceId = subjectInstanceId;
            if (academicYearId) where.academicYearId = academicYearId;

            const grades = await prisma.grade.findMany({
                where,
                include: {
                    subjectInstance: { include: { template: true, academicYear: true } },
                    teacherProfile: { include: { user: true } },
                },
                orderBy: { date: "desc" },
                take: 50,
            });

            if (grades.length === 0) {
                return { content: [{ type: "text", text: "Žádné známky nenalezeny." }] };
            }

            const student = await prisma.studentProfile.findUnique({
                where: { id: studentId },
                include: { user: true },
            });

            const lines = grades.map(g =>
                `- ${g.subjectInstance.template.name}: ${g.value} (váha ${g.weight})${g.description ? ` – ${g.description}` : ''} | ${g.date.toISOString().slice(0, 10)} | učitel: ${g.teacherProfile.user.firstName} ${g.teacherProfile.user.lastName}`
            );

            return {
                content: [{
                    type: "text",
                    text: `Známky ${student ? `– ${student.firstName} ${student.lastName}` : ''} (${grades.length}):\n${lines.join("\n")}`,
                }],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: "text", text: `Chyba: ${error.message}` }] };
        }
    }
);

// ═══════════════════════════════════════════════════════════════
// ATTENDANCE (DOCHÁZKA)
// ═══════════════════════════════════════════════════════════════

server.tool(
    "record_attendance",
    "Zaznamená docházku studenta. Status může být: PRESENT (přítomen), ABSENT (nepřítomen), LATE (pozdní příchod), EXCUSED (omluven).",
    {
        schoolId: z.string().describe("ID školy"),
        studentId: z.string().describe("ID StudentProfile"),
        teacherId: z.string().describe("ID TeacherProfile"),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]).describe("Status docházky"),
        date: z.string().optional().describe("Datum (ISO 8601, výchozí: dnes)"),
        lessonNumber: z.number().int().optional().describe("Číslo vyučovací hodiny (1-10)"),
        note: z.string().optional().describe("Poznámka"),
    },
    async ({ schoolId, studentId, teacherId, status, date, lessonNumber, note }) => {
        try {
            const attendanceDate = date ? new Date(date) : new Date();

            // Upsert – update if exists for same student+date+lesson+school
            const attendance = await prisma.attendance.upsert({
                where: {
                    studentId_date_lessonNumber_schoolId: {
                        studentId,
                        date: attendanceDate,
                        lessonNumber: lessonNumber || 0, // Fallback to 0 if not provided
                        schoolId,
                    },
                },
                update: { status, note, teacherId },
                create: {
                    date: attendanceDate,
                    status,
                    lessonNumber: lessonNumber || 0,
                    note,
                    schoolId,
                    studentId,
                    teacherId,
                },
            });

            const statusLabels: Record<string, string> = {
                PRESENT: "přítomen",
                ABSENT: "nepřítomen",
                LATE: "pozdní příchod",
                EXCUSED: "omluven",
            };

            return {
                content: [{
                    type: "text",
                    text: `Docházka zaznamenána: ${statusLabels[status]} (${attendanceDate.toISOString().slice(0, 10)})${note ? `, poznámka: ${note}` : ''}. ID: ${attendance.id}`,
                }],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: "text", text: `Chyba: ${error.message}` }] };
        }
    }
);
