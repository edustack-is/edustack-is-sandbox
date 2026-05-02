import { server } from '../server.js';
import { db, transaction } from '../db.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// ═══════════════════════════════════════════════════════════════
// GRADES (ZNÁMKY)
// ═══════════════════════════════════════════════════════════════

server.tool(
    'create_grade',
    'Zadá známku studentovi v dané instanci předmětu. Vyžaduje ID studenta (StudentProfile), instance předmětu a učitele (TeacherProfile).',
    {
        schoolId: z.string().describe('ID školy'),
        studentId: z.string().describe('ID StudentProfile (ne User ID!)'),
        subjectInstanceId: z.string().describe('ID instance předmětu (SubjectInstance)'),
        teacherId: z.string().describe('ID TeacherProfile (ne User ID!)'),
        value: z.string().describe('Hodnota známky (1-5, nebo textový popis)'),
        weight: z.number().min(0.1).max(1.0).describe('Váha známky (0.1–1.0, výchozí 1.0 pro klasický test)'),
        description: z.string().optional().describe("Popis (např. 'Písemka z rovnic', 'Ústní zkoušení')"),
        academicYearId: z.string().optional().describe('ID školního roku (volitelné, pro filtraci)'),
    },
    async ({ schoolId, studentId, subjectInstanceId, teacherId, value, weight, description, academicYearId }) => {
        try {
            const student = db
                .prepare('SELECT firstName, lastName FROM "StudentProfile" WHERE id = ?')
                .get(studentId) as any;
            const subject = db
                .prepare(
                    'SELECT t.name FROM "SubjectInstance" i JOIN "SubjectTemplate" t ON i.templateId = t.id WHERE i.id = ? AND i.schoolId = ?',
                )
                .get(subjectInstanceId, schoolId) as any;
            const teacher = db
                .prepare(
                    'SELECT u.firstName, u.lastName FROM "TeacherProfile" tp JOIN "User" u ON tp.userId = u.id WHERE tp.id = ?',
                )
                .get(teacherId) as any;

            if (!student)
                return {
                    isError: true,
                    content: [{ type: 'text', text: `StudentProfile '${studentId}' nebyl nalezen.` }],
                };
            if (!subject)
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Instance předmětu '${subjectInstanceId}' nebyla nalezena.` }],
                };
            if (!teacher)
                return {
                    isError: true,
                    content: [{ type: 'text', text: `TeacherProfile '${teacherId}' nebyl nalezen.` }],
                };

            const id = randomUUID();
            const now = new Date().toISOString();
            const date = now.split('T')[0];

            db.prepare(
                `
                INSERT INTO "Grade" (id, value, weight, description, date, schoolId, studentId, subjectInstanceId, teacherId, academicYearId, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            ).run(
                id,
                value,
                weight,
                description || null,
                date,
                schoolId,
                studentId,
                subjectInstanceId,
                teacherId,
                academicYearId || null,
                now,
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: `Známka '${value}' (váha ${weight}) zadána pro ${student.firstName} ${student.lastName} z ${subject.name}. ID: ${id}`,
                    },
                ],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);

server.tool(
    'list_student_grades',
    'Vypíše známky studenta, volitelně filtrované podle předmětu nebo školního roku.',
    {
        studentId: z.string().describe('ID StudentProfile'),
        subjectInstanceId: z.string().optional().describe('Filtr: ID instance předmětu'),
        academicYearId: z.string().optional().describe('Filtr: ID školního roku'),
    },
    async ({ studentId, subjectInstanceId, academicYearId }) => {
        try {
            let sql = `
                SELECT g.*, t.name as subjectName, u.firstName as tFirst, u.lastName as tLast
                FROM "Grade" g
                JOIN "SubjectInstance" i ON g.subjectInstanceId = i.id
                JOIN "SubjectTemplate" t ON i.templateId = t.id
                JOIN "TeacherProfile" tp ON g.teacherId = tp.id
                JOIN "User" u ON tp.userId = u.id
                WHERE g.studentId = ?
            `;
            const params: any[] = [studentId];

            if (subjectInstanceId) {
                sql += ' AND g.subjectInstanceId = ?';
                params.push(subjectInstanceId);
            }
            if (academicYearId) {
                sql += ' AND g.academicYearId = ?';
                params.push(academicYearId);
            }

            sql += ' ORDER BY g.date DESC LIMIT 50';

            const grades = db.prepare(sql).all(...params) as any[];

            if (grades.length === 0) {
                return { content: [{ type: 'text', text: 'Žádné známky nenalezeny.' }] };
            }

            const student = db
                .prepare('SELECT firstName, lastName FROM "StudentProfile" WHERE id = ?')
                .get(studentId) as any;

            const lines = grades.map(
                (g) =>
                    `- ${g.subjectName}: ${g.value} (váha ${g.weight})${g.description ? ` – ${g.description}` : ''} | ${g.date} | učitel: ${g.tFirst} ${g.tLast}`,
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: `Známky ${student ? `– ${student.firstName} ${student.lastName}` : ''} (${grades.length}):\n${lines.join('\n')}`,
                    },
                ],
            };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);

// ═══════════════════════════════════════════════════════════════
// ATTENDANCE (DOCHÁZKA)
// ═══════════════════════════════════════════════════════════════

server.tool(
    'record_attendance',
    'Zaznamená docházku studenta. Status může být: PRESENT (přítomen), ABSENT (nepřítomen), LATE (pozdní příchod), EXCUSED (omluven).',
    {
        schoolId: z.string().describe('ID školy'),
        studentId: z.string().describe('ID StudentProfile'),
        teacherId: z.string().describe('ID TeacherProfile'),
        status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).describe('Status docházky'),
        date: z.string().optional().describe('Datum (ISO 8601, výchozí: dnes)'),
        lessonNumber: z.number().int().optional().describe('Číslo vyučovací hodiny (1-10)'),
        note: z.string().optional().describe('Poznámka'),
    },
    async ({ schoolId, studentId, teacherId, status, date, lessonNumber, note }) => {
        try {
            const now = new Date().toISOString();
            const attendanceDate = (date ? new Date(date) : new Date()).toISOString().split('T')[0];
            const lNum = lessonNumber || 0;

            const existing = db
                .prepare(
                    'SELECT id FROM "Attendance" WHERE studentId = ? AND date = ? AND lessonNumber = ? AND schoolId = ?',
                )
                .get(studentId, attendanceDate, lNum, schoolId) as any;

            if (existing) {
                db.prepare('UPDATE "Attendance" SET status = ?, note = ?, teacherId = ? WHERE id = ?').run(
                    status,
                    note || null,
                    teacherId,
                    existing.id,
                );
            } else {
                db.prepare(
                    'INSERT INTO "Attendance" (id, date, status, lessonNumber, note, schoolId, studentId, teacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                ).run(randomUUID(), attendanceDate, status, lNum, note || null, schoolId, studentId, teacherId, now);
            }

            return { content: [{ type: 'text', text: `Docházka zaznamenána: ${status} (${attendanceDate}).` }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);
