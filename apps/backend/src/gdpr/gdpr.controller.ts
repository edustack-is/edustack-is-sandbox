import { Controller, Get, Delete, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiProduces, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SuccessResponseDto } from '../common/dto/api.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

@ApiTags('gdpr')
@ApiBearerAuth('JWT-auth')
@Controller('api/gdpr')
@UseGuards(JwtAuthGuard)
export class GdprController {
    constructor(private readonly prisma: PrismaService) { }

    @Get('my-data')
    @ApiOperation({ summary: 'Export osobních dat (čl. 15 GDPR)', description: 'Vrátí veškerá osobní data přihlášeného uživatele: profil, známky, docházku, zprávy, audit log.' })
    @ApiResponse({ status: 200, description: 'JSON objekt se všemi osobními daty uživatele.' })
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

    @Get('my-data/download')
    @ApiOperation({ summary: 'Stáhnout osobní data jako JSON', description: 'Stáhne JSON soubor se všemi osobními daty (Content-Disposition: attachment).' })
    @ApiProduces('application/json')
    @ApiResponse({ status: 200, description: 'JSON soubor ke stažení.' })
    async downloadMyData(@Req() req: any, @Res() res: Response) {
        const data = await this.getMyData(req);
        const json = JSON.stringify(data, null, 2);
        const filename = `gdpr-export-${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(json);
    }

    @Delete('my-data')
    @ApiOperation({ summary: 'Smazání osobních dat (čl. 17 GDPR)', description: 'Anonymizuje PII uživatele. Školní záznamy (známky, docházka) zůstanou, ale bez identifikace.' })
    @ApiResponse({ status: 200, type: SuccessResponseDto, description: 'Potvrzení anonymizace.' })
    async deleteMyData(@Req() req: any) {
        const userId = req.user.userId;

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

        const studentProfile = await this.prisma.studentProfile.findUnique({ where: { userId } });
        if (studentProfile) {
            await this.prisma.studentProfile.update({
                where: { id: studentProfile.id },
                data: { firstName: 'Smazaný', lastName: 'Žák', rc: null },
            });
        }

        await this.prisma.message.deleteMany({ where: { senderId: userId } });
        await this.prisma.identity.deleteMany({ where: { userId } });

        await this.prisma.auditLog.create({
            data: {
                actorId: userId,
                action: 'GDPR_DATA_DELETION',
                entity: 'User',
                entityId: userId,
                ipAddress: req.ip,
            },
        });

        return { success: true, message: 'Osobní údaje byly anonymizovány v souladu s čl. 17 GDPR.' };
    }
}
