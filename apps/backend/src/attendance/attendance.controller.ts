import {
    Controller, Get, Post, Put, Body, Param, Query, Res,
    UseGuards, Req, ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AttendanceService } from './attendance.service';

@Controller('api/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
    constructor(private readonly attendanceService: AttendanceService) { }

    private ensureTenant(req: any) {
        if (req.user.type !== 'TENANT' || !req.user.schoolId) {
            throw new ForbiddenException('School context required.');
        }
    }

    // ─── RECORD ATTENDANCE ──────────────────────────────────────

    @Post('record')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    async recordAttendance(
        @Req() req: any,
        @Body() body: {
            date: string;
            lessonNumber: number;
            classroomId: string;
            records: Array<{ studentId: string; status: string; note?: string }>;
        },
    ) {
        this.ensureTenant(req);
        return this.attendanceService.recordAttendance(req.user.userId, req.user.schoolId, body);
    }

    // ─── GET CLASSROOM ATTENDANCE ───────────────────────────────

    @Get('classroom/:classroomId')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    async getClassroomAttendance(
        @Req() req: any,
        @Param('classroomId') classroomId: string,
        @Query('date') date: string,
    ) {
        this.ensureTenant(req);
        return this.attendanceService.getClassroomAttendance(req.user.schoolId, classroomId, date);
    }

    // ─── ABSENCE EXCUSES ────────────────────────────────────────

    @Post('excuses')
    @Roles(UserRole.PARENT)
    async createExcuse(
        @Req() req: any,
        @Body() body: { studentId: string; reason: string; dateFrom: string; dateTo: string },
    ) {
        this.ensureTenant(req);
        return this.attendanceService.createExcuse(req.user.userId, req.user.schoolId, body);
    }

    @Get('excuses')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    async getExcuses(
        @Req() req: any,
        @Query('classroomId') classroomId?: string,
        @Query('status') status?: string,
    ) {
        this.ensureTenant(req);
        return this.attendanceService.getExcuses(req.user.schoolId, { classroomId, status });
    }

    @Put('excuses/:id/review')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    async reviewExcuse(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: { status: 'APPROVED' | 'REJECTED' },
    ) {
        this.ensureTenant(req);
        return this.attendanceService.reviewExcuse(req.user.userId, req.user.schoolId, id, body.status);
    }

    // ─── STATISTICS ─────────────────────────────────────────────

    @Get('stats/:classroomId')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    async getClassStatistics(
        @Req() req: any,
        @Param('classroomId') classroomId: string,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
    ) {
        this.ensureTenant(req);
        return this.attendanceService.getClassStatistics(req.user.schoolId, classroomId, dateFrom, dateTo);
    }

    // ─── CSV EXPORT ─────────────────────────────────────────────

    @Get('export/:classroomId')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    async exportCsv(
        @Req() req: any,
        @Res() res: Response,
        @Param('classroomId') classroomId: string,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
    ) {
        this.ensureTenant(req);
        const csv = await this.attendanceService.exportAttendanceCsv(req.user.schoolId, classroomId, dateFrom, dateTo);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=dochazka.csv');
        res.send(csv);
    }

    // ─── UNEXCUSED ALERTS ───────────────────────────────────────

    @Get('unexcused-alerts')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    async getUnexcusedAlerts(
        @Req() req: any,
        @Query('threshold') threshold?: string,
    ) {
        this.ensureTenant(req);
        return this.attendanceService.getUnexcusedAlerts(req.user.schoolId, threshold ? parseInt(threshold) : 5);
    }
}
