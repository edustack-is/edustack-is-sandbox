import {
    Controller, Get, Post, Put, Body, Param, Query, Res,
    UseGuards, Req, ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ClassBookService } from './classbook.service';

@Controller('api/classbook')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassBookController {
    constructor(private readonly classBookService: ClassBookService) { }

    private ensureTenant(req: any) {
        if (!req.user?.schoolId) throw new ForbiddenException('School context required.');
    }

    @Get('entries/:classroomId')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    async getEntries(
        @Req() req: any,
        @Param('classroomId') classroomId: string,
        @Query('date') date: string,
    ) {
        this.ensureTenant(req);
        return this.classBookService.getEntriesForDate(req.user.schoolId, classroomId, date);
    }

    @Post('entries')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    async upsertEntry(
        @Req() req: any,
        @Body() body: {
            classroomId: string; date: string; lessonNumber: number;
            topic?: string; notes?: string; absentCount?: number;
            scheduleEventId?: string; subjectName?: string;
        },
    ) {
        this.ensureTenant(req);
        return this.classBookService.upsertEntry(req.user.userId, req.user.schoolId, body);
    }

    @Post('sign/:entryId')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    async signEntry(@Req() req: any, @Param('entryId') entryId: string) {
        const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
        return this.classBookService.signEntry(req.user.userId, entryId, ip);
    }

    @Get('range/:classroomId')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    async getEntriesRange(
        @Req() req: any,
        @Param('classroomId') classroomId: string,
        @Query('dateFrom') dateFrom: string,
        @Query('dateTo') dateTo: string,
    ) {
        this.ensureTenant(req);
        return this.classBookService.getEntriesForRange(req.user.schoolId, classroomId, dateFrom, dateTo);
    }

    @Get('print/:classroomId')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    async printClassBook(
        @Req() req: any,
        @Res() res: Response,
        @Param('classroomId') classroomId: string,
        @Query('dateFrom') dateFrom: string,
        @Query('dateTo') dateTo: string,
    ) {
        this.ensureTenant(req);
        const html = await this.classBookService.generatePrintHtml(req.user.schoolId, classroomId, dateFrom, dateTo);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    }

    @Get('attendance/:classroomId')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    async getAttendance(
        @Req() req: any,
        @Param('classroomId') classroomId: string,
        @Query('date') date: string,
        @Query('lessonNumber') lessonNumber: string,
    ) {
        this.ensureTenant(req);
        return this.classBookService.getAttendanceForLesson(
            req.user.schoolId, classroomId, date, parseInt(lessonNumber),
        );
    }
}
