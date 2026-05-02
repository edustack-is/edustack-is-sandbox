import { server } from '../server.js';
import { db } from '../db.js';
import { z } from 'zod';

server.tool(
    'get_attendance_summary',
    'Vypočítá sumář docházky pro konkrétního studenta v daném období.',
    {
        studentId: z.string().describe('ID studenta (User ID)'),
        startDate: z.string().describe('Počáteční datum (ISO)'),
        endDate: z.string().describe('Koncové datum (ISO)'),
    },
    async ({ studentId, startDate, endDate }: { studentId: string; startDate: string; endDate: string }) => {
        try {
            const start = new Date(startDate).toISOString().split('T')[0];
            const end = new Date(endDate).toISOString().split('T')[0];

            const summary = db
                .prepare(
                    `
                SELECT status, COUNT(*) as count
                FROM "Attendance"
                WHERE studentId = ? AND date >= ? AND date <= ?
                GROUP BY status
            `,
                )
                .all(studentId, start, end);

            return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);

server.tool(
    'get_academic_performance',
    'Vypočítá studijní průměry žáka podle předmětů pro daný školní rok.',
    {
        studentId: z.string().describe('ID studenta (User ID)'),
        academicYearId: z.string().describe('ID školního roku'),
    },
    async ({ studentId, academicYearId }: { studentId: string; academicYearId: string }) => {
        try {
            const grades = db
                .prepare(
                    `
                SELECT g.value, g.weight, t.name as subjectName
                FROM "Grade" g
                JOIN "SubjectInstance" i ON g.subjectInstanceId = i.id
                JOIN "SubjectTemplate" t ON i.templateId = t.id
                WHERE g.studentId = ? AND i.academicYearId = ?
            `,
                )
                .all(studentId, academicYearId) as any[];

            const performance: Record<string, { total: number; count: number; average: number }> = {};

            for (const g of grades) {
                const val = parseFloat(g.value);
                if (isNaN(val)) continue;

                if (!performance[g.subjectName]) {
                    performance[g.subjectName] = { total: 0, count: 0, average: 0 };
                }
                performance[g.subjectName].total += val * g.weight;
                performance[g.subjectName].count += g.weight;
            }

            for (const subject in performance) {
                performance[subject].average = performance[subject].total / performance[subject].count;
            }

            return { content: [{ type: 'text', text: JSON.stringify(performance, null, 2) }] };
        } catch (error: any) {
            return { isError: true, content: [{ type: 'text', text: `Chyba: ${error.message}` }] };
        }
    },
);
