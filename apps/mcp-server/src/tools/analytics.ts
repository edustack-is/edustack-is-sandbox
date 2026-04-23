import { server } from '../server.js';
import { prisma } from '../db.js';
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
            const summary = await prisma.attendance.groupBy({
                by: ['status'],
                where: {
                    studentId,
                    date: {
                        gte: new Date(startDate),
                        lte: new Date(endDate),
                    },
                },
                _count: {
                    status: true,
                },
            });

            return {
                content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při načítání docházky: ${error.message}` }],
            };
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
            const grades = await prisma.grade.findMany({
                where: {
                    studentId,
                    subjectInstance: {
                        academicYearId,
                    },
                },
                include: {
                    subjectInstance: {
                        include: {
                            template: true,
                        },
                    },
                },
            });

            const performance: Record<string, { total: number; count: number; average: number }> = {};

            for (const g of grades) {
                const subjectName = g.subjectInstance.template.name;
                if (!performance[subjectName]) {
                    performance[subjectName] = { total: 0, count: 0, average: 0 };
                }
                performance[subjectName].total += Number(g.value) * Number(g.weight);
                performance[subjectName].count += Number(g.weight);
            }

            for (const subject in performance) {
                performance[subject].average = performance[subject].total / performance[subject].count;
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(performance, null, 2) }],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Chyba při výpočtu prospěchu: ${error.message}` }],
            };
        }
    },
);
