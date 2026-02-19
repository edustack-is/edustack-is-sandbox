import { Controller, Get, Post, Delete, UseGuards, Req, ForbiddenException, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('gdpr')
@ApiBearerAuth('JWT-auth')
@Controller('api/gdpr')
@UseGuards(JwtAuthGuard)
export class GdprController {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * GET /api/gdpr/my-data
     * GDPR Article 15 — Right of access. Returns all personal data of the authenticated user.
     */
    @Get('my-data')
    async getMyData(@Req() req: any) {
        const userId = req.user.userId;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true, email: true, firstName: true, lastName: true,
                isSystemAdmin: true, createdAt: true, lastLogin: true,
            },
        });

        const studentProfile = await this.prisma.studentProfile.findUnique({
            where: { userId },
            select: { id: true, firstName: true, lastName: true, rc: true },
        });

        const teacherProfile = await this.prisma.teacherProfile.findUnique({
            where: { userId },
            select: { id: true },
        });

        const memberships = await this.prisma.schoolMembership.findMany({
            where: { userId },
            include: { school: { select: { name: true } } },
        });

        const grades = studentProfile ? await this.prisma.grade.findMany({
            where: { studentId: studentProfile.id },
            select: { value: true, weight: true, description: true, date: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        }) : [];

        const attendance = studentProfile ? await this.prisma.attendance.findMany({
            where: { studentId: studentProfile.id },
            select: { date: true, status: true, note: true },
            orderBy: { date: 'desc' },
        }) : [];

        const messages = await this.prisma.message.findMany({
            where: { senderId: userId },
            select: { content: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });

        const auditLogs = await this.prisma.auditLog.findMany({
            where: { actorId: userId },
            select: { action: true, entity: true, ipAddress: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });

        return {
            exportDate: new Date().toISOString(),
            gdprArticle: 'Článek 15 GDPR — Právo na přístup',
            user,
            studentProfile,
            teacherProfile: teacherProfile ? { id: teacherProfile.id } : null,
            memberships: memberships.map(m => ({ school: m.school.name, role: m.role, joinedAt: m.createdAt })),
            grades,
            attendance,
            messages: messages.map(m => ({ content: m.content, sentAt: m.createdAt })),
            auditLogs,
        };
    }

    /**
     * GET /api/gdpr/my-data/download
     * Downloads personal data as JSON file.
     */
    @Get('my-data/download')
    async downloadMyData(@Req() req: any, @Res() res: Response) {
        const data = await this.getMyData(req);
        const json = JSON.stringify(data, null, 2);
        const filename = `gdpr-export-${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(json);
    }

    /**
     * DELETE /api/gdpr/my-data
     * GDPR Article 17 — Right to erasure ("right to be forgotten").
     * Anonymizes the user's personal data. Does NOT delete grades/attendance records
     * (school needs them), but removes PII.
     */
    @Delete('my-data')
    async deleteMyData(@Req() req: any) {
        const userId = req.user.userId;

        // Anonymize user record
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                email: `deleted-${userId.slice(0, 8)}@anonymized.local`,
                firstName: 'Smazaný',
                lastName: 'Uživatel',
                passwordHash: '',
                deletedAt: new Date(),
            },
        });

        // Anonymize student profile if exists
        const studentProfile = await this.prisma.studentProfile.findUnique({ where: { userId } });
        if (studentProfile) {
            await this.prisma.studentProfile.update({
                where: { id: studentProfile.id },
                data: {
                    firstName: 'Smazaný',
                    lastName: 'Žák',
                    rc: null,
                },
            });
        }

        // Delete messages sent by user
        await this.prisma.message.deleteMany({ where: { senderId: userId } });

        // Delete SSO identities
        await this.prisma.identity.deleteMany({ where: { userId } });

        // Log the GDPR deletion
        await this.prisma.auditLog.create({
            data: {
                actorId: userId,
                action: 'GDPR_DATA_DELETION',
                entity: 'User',
                entityId: userId,
                ipAddress: req.ip,
            },
        });

        return {
            success: true,
            message: 'Osobní údaje byly anonymizovány v souladu s čl. 17 GDPR.',
        };
    }
}
