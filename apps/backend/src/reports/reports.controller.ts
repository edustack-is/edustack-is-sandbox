import { Controller, Get, Query, Res, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth('JWT-auth')
@Controller('api/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.DEPUTY, UserRole.PRINCIPAL, UserRole.TEACHER)
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    // ─── GRADE STATISTICS ───────────────────────────────────

    /** Grade statistics for a single classroom */
    @Get('grades/classroom')
    async gradeStatsByClassroom(
        @Req() req: any,
        @Query('classroomId') classroomId: string,
        @Query('semesterId') semesterId?: string,
    ) {
        this.ensureTenant(req);
        return this.reportsService.getGradeStatsByClassroom(req.user.schoolId, classroomId, semesterId);
    }

    /** Grade statistics overview for the whole school */
    @Get('grades/school')
    async gradeStatsBySchool(
        @Req() req: any,
        @Query('semesterId') semesterId?: string,
    ) {
        this.ensureTenant(req);
        return this.reportsService.getGradeStatsBySchool(req.user.schoolId, semesterId);
    }

    // ─── ATTENDANCE STATISTICS ──────────────────────────────

    /** Attendance statistics with per-student breakdown */
    @Get('attendance')
    async attendanceStats(
        @Req() req: any,
        @Query('classroomId') classroomId?: string,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
    ) {
        this.ensureTenant(req);
        return this.reportsService.getAttendanceStats(req.user.schoolId, classroomId, dateFrom, dateTo);
    }

    // ─── ČŠI REPORT ────────────────────────────────────────

    /** JSON data for Czech School Inspectorate report */
    @Get('csi')
    async csiReport(
        @Req() req: any,
        @Query('academicYearId') academicYearId?: string,
    ) {
        this.ensureTenant(req);
        return this.reportsService.generateCsiReport(req.user.schoolId, academicYearId);
    }

    /** Printable HTML version of ČŠI report */
    @Get('csi/print')
    async csiReportHtml(
        @Req() req: any, @Res() res: Response,
        @Query('academicYearId') academicYearId?: string,
    ) {
        this.ensureTenant(req);
        const report = await this.reportsService.generateCsiReport(req.user.schoolId, academicYearId);
        const html = this.reportsService.renderReportHtml(report, 'csi');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    }

    // ─── MŠMT REPORT ───────────────────────────────────────

    /** JSON data for Ministry of Education report */
    @Get('msmt')
    async msmtReport(@Req() req: any) {
        this.ensureTenant(req);
        return this.reportsService.generateMsmtReport(req.user.schoolId);
    }

    /** Printable HTML version of MŠMT report */
    @Get('msmt/print')
    async msmtReportHtml(@Req() req: any, @Res() res: Response) {
        this.ensureTenant(req);
        const report = await this.reportsService.generateMsmtReport(req.user.schoolId);
        const html = this.reportsService.renderReportHtml(report, 'msmt');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    }

    private ensureTenant(req: any) {
        if (req.user.type !== 'TENANT' || !req.user.schoolId) {
            throw new ForbiddenException('School context required.');
        }
    }
}
