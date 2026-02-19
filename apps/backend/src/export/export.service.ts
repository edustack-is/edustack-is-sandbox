import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── DATA LOADERS ───────────────────────────────────────

    async getStudentsData(schoolId: string) {
        const students = await this.prisma.studentProfile.findMany({
            where: { classroom: { schoolId } },
            include: {
                classroom: { select: { name: true } },
                user: { select: { email: true, firstName: true, lastName: true } },
            },
            orderBy: [{ classroom: { name: 'asc' } }, { lastName: 'asc' }],
        });
        return students.map((s: any) => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            email: s.user?.email || '',
            classroom: s.classroom?.name || '',
        }));
    }

    async getGradesData(schoolId: string, classroomId?: string) {
        const where: any = { schoolId };
        if (classroomId) where.studentProfile = { classroomId };
        const grades = await this.prisma.grade.findMany({
            where,
            include: {
                studentProfile: { select: { firstName: true, lastName: true, classroom: { select: { name: true } } } },
                subjectInstance: { include: { template: { select: { name: true } } } },
                teacherProfile: { select: { user: { select: { firstName: true, lastName: true } } } },
            },
            orderBy: { createdAt: 'desc' },
            take: 5000,
        });
        return grades.map((g: any) => ({
            student: `${g.studentProfile.lastName} ${g.studentProfile.firstName}`,
            classroom: g.studentProfile.classroom?.name || '',
            subject: g.subjectInstance?.template?.name || '',
            value: g.value,
            weight: g.weight,
            description: g.description || '',
            teacher: g.teacherProfile ? `${g.teacherProfile.user.lastName} ${g.teacherProfile.user.firstName}` : '',
            date: g.createdAt.toISOString().slice(0, 10),
        }));
    }

    async getAttendanceData(schoolId: string, classroomId?: string, dateFrom?: string, dateTo?: string) {
        const where: any = { schoolId };
        if (classroomId) where.studentProfile = { classroomId };
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) where.date.gte = new Date(dateFrom);
            if (dateTo) where.date.lte = new Date(dateTo);
        }
        const records = await this.prisma.attendance.findMany({
            where,
            include: {
                studentProfile: { select: { firstName: true, lastName: true, classroom: { select: { name: true } } } },
            },
            orderBy: { date: 'desc' },
            take: 10000,
        });
        return records.map((r: any) => ({
            student: `${r.studentProfile.lastName} ${r.studentProfile.firstName}`,
            classroom: r.studentProfile.classroom?.name || '',
            date: r.date.toISOString().slice(0, 10),
            status: r.status,
            note: r.note || '',
        }));
    }

    async getScheduleData(schoolId: string, classroomId?: string) {
        const where: any = { schoolId };
        if (classroomId) where.classroomId = classroomId;
        const events = await this.prisma.scheduleEvent.findMany({
            where,
            include: {
                classroom: { select: { name: true } },
                teacherProfile: { select: { user: { select: { firstName: true, lastName: true } } } },
                subject: { include: { template: { select: { name: true } } } },
            },
            orderBy: [{ dayOfWeek: 'asc' }, { lessonNumber: 'asc' }],
        });
        const dayNames = ['', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
        return events.map((e: any) => ({
            day: dayNames[e.dayOfWeek] || String(e.dayOfWeek),
            lessonNumber: e.lessonNumber,
            subject: e.subject?.template?.name || '',
            teacher: e.teacherProfile ? `${e.teacherProfile.user.lastName} ${e.teacherProfile.user.firstName}` : '',
            classroom: e.classroom?.name || '',
        }));
    }

    async getClassbookData(schoolId: string, classroomId: string, dateFrom?: string, dateTo?: string) {
        const where: any = { classroomId, classroom: { schoolId } };
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) where.date.gte = new Date(dateFrom);
            if (dateTo) where.date.lte = new Date(dateTo);
        }
        const entries = await this.prisma.classBookEntry.findMany({
            where,
            include: {
                teacher: { select: { firstName: true, lastName: true } },
            },
            orderBy: [{ date: 'desc' }, { lessonNumber: 'asc' }],
            take: 5000,
        });
        return entries.map((e: any) => ({
            date: e.date.toISOString().slice(0, 10),
            lessonNumber: e.lessonNumber,
            subject: e.subjectName || '',
            topic: e.topic || '',
            notes: e.notes || '',
            absentCount: e.absentCount ?? '',
            teacher: e.teacher ? `${e.teacher.lastName} ${e.teacher.firstName}` : '',
        }));
    }

    // ─── FORMAT CONVERTERS ──────────────────────────────────

    toCsv(data: Record<string, any>[]): string {
        if (data.length === 0) return '';
        const headers = Object.keys(data[0]);
        const escape = (v: any) => {
            const s = String(v ?? '');
            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const lines = [
            headers.join(','),
            ...data.map(row => headers.map(h => escape(row[h])).join(',')),
        ];
        return '\ufeff' + lines.join('\n'); // BOM for Excel
    }

    toXml(data: Record<string, any>[], rootName: string, itemName: string): string {
        const escXml = (v: any) => String(v ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const items = data.map(row => {
            const fields = Object.entries(row)
                .map(([k, v]) => `    <${k}>${escXml(v)}</${k}>`)
                .join('\n');
            return `  <${itemName}>\n${fields}\n  </${itemName}>`;
        }).join('\n');
        return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>\n${items}\n</${rootName}>`;
    }

    toJson(data: Record<string, any>[]): string {
        return JSON.stringify(data, null, 2);
    }
}
