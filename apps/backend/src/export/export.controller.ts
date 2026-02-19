import { Controller, Get, Query, Res, UseGuards, Req, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiProduces , ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ExportService } from './export.service';

type ExportFormat = 'csv' | 'xml' | 'json';

const CONTENT_TYPES: Record<ExportFormat, string> = {
    csv: 'text/csv; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    json: 'application/json; charset=utf-8',
};

const FILE_EXT: Record<ExportFormat, string> = { csv: 'csv', xml: 'xml', json: 'json' };

@ApiTags('export')
@ApiBearerAuth('JWT-auth')
@Controller('api/export')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.DEPUTY, UserRole.PRINCIPAL, UserRole.TEACHER)
export class ExportController {
    constructor(private readonly exportService: ExportService) { }

    @Get('students')
    @ApiOperation({ summary: 'Export studentů', description: 'Stáhne seznam studentů ve zvoleném formátu.' })
    @ApiResponse({ status: 200, description: 'Export studentů ve zvoleném formátu.' })
    @ApiQuery({ name: 'format', enum: ['csv', 'xml', 'json'], required: false, description: 'Výstupní formát (výchozí: csv)' })
    @ApiProduces('text/csv', 'application/xml', 'application/json')
    async exportStudents(
        @Req() req: any, @Res() res: Response,
        @Query('format') format: string = 'csv',
    ) {
        this.ensureTenant(req);
        const fmt = this.validateFormat(format);
        const data = await this.exportService.getStudentsData(req.user.schoolId);
        this.sendExport(res, data, fmt, 'students', 'student');
    }

    @Get('grades')
    @ApiOperation({ summary: 'Export známek', description: 'Stáhne známky, volitelně filtrované dle třídy.' })
    @ApiResponse({ status: 200, description: 'Export známek.' })
    @ApiQuery({ name: 'format', enum: ['csv', 'xml', 'json'], required: false, description: 'Výstupní formát (výchozí: csv)' })
    @ApiQuery({ name: 'classroomId', required: false, description: 'Filtr dle ID třídy' })
    @ApiProduces('text/csv', 'application/xml', 'application/json')
    async exportGrades(
        @Req() req: any, @Res() res: Response,
        @Query('format') format: string = 'csv',
        @Query('classroomId') classroomId?: string,
    ) {
        this.ensureTenant(req);
        const fmt = this.validateFormat(format);
        const data = await this.exportService.getGradesData(req.user.schoolId, classroomId);
        this.sendExport(res, data, fmt, 'grades', 'grade');
    }

    @Get('attendance')
    @ApiOperation({ summary: 'Export docházky', description: 'Stáhne záznamy docházky s filtry.' })
    @ApiResponse({ status: 200, description: 'Export docházky.' })
    @ApiQuery({ name: 'format', enum: ['csv', 'xml', 'json'], required: false, description: 'Výstupní formát (výchozí: csv)' })
    @ApiQuery({ name: 'classroomId', required: false, description: 'Filtr dle ID třídy' })
    @ApiQuery({ name: 'dateFrom', required: false, description: 'Od data (YYYY-MM-DD)' })
    @ApiQuery({ name: 'dateTo', required: false, description: 'Do data (YYYY-MM-DD)' })
    @ApiProduces('text/csv', 'application/xml', 'application/json')
    async exportAttendance(
        @Req() req: any, @Res() res: Response,
        @Query('format') format: string = 'csv',
        @Query('classroomId') classroomId?: string,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
    ) {
        this.ensureTenant(req);
        const fmt = this.validateFormat(format);
        const data = await this.exportService.getAttendanceData(req.user.schoolId, classroomId, dateFrom, dateTo);
        this.sendExport(res, data, fmt, 'attendance', 'record');
    }

    @Get('schedule')
    @ApiOperation({ summary: 'Export rozvrhu', description: 'Stáhne rozvrhové události.' })
    @ApiQuery({ name: 'format', enum: ['csv', 'xml', 'json'], required: false, description: 'Výstupní formát (výchozí: csv)' })
    @ApiQuery({ name: 'classroomId', required: false, description: 'Filtr dle ID třídy' })
    @ApiProduces('text/csv', 'application/xml', 'application/json')
    async exportSchedule(
        @Req() req: any, @Res() res: Response,
        @Query('format') format: string = 'csv',
        @Query('classroomId') classroomId?: string,
    ) {
        this.ensureTenant(req);
        const fmt = this.validateFormat(format);
        const data = await this.exportService.getScheduleData(req.user.schoolId, classroomId);
        this.sendExport(res, data, fmt, 'schedule', 'event');
    }

    @Get('classbook')
    @ApiOperation({ summary: 'Export třídní knihy', description: 'Stáhne záznamy třídní knihy.' })
    @ApiQuery({ name: 'format', enum: ['csv', 'xml', 'json'], required: false, description: 'Výstupní formát (výchozí: csv)' })
    @ApiQuery({ name: 'classroomId', required: true, description: 'ID třídy (povinné)' })
    @ApiQuery({ name: 'dateFrom', required: false, description: 'Od data (YYYY-MM-DD)' })
    @ApiQuery({ name: 'dateTo', required: false, description: 'Do data (YYYY-MM-DD)' })
    @ApiProduces('text/csv', 'application/xml', 'application/json')
    async exportClassbook(
        @Req() req: any, @Res() res: Response,
        @Query('format') format: string = 'csv',
        @Query('classroomId') classroomId?: string,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
    ) {
        this.ensureTenant(req);
        if (!classroomId) throw new BadRequestException('classroomId is required');
        const fmt = this.validateFormat(format);
        const data = await this.exportService.getClassbookData(req.user.schoolId, classroomId, dateFrom, dateTo);
        this.sendExport(res, data, fmt, 'classbook', 'entry');
    }

    // ─── HELPERS ────────────────────────────────────────────

    private validateFormat(format: string): ExportFormat {
        const f = (format || 'csv').toLowerCase() as ExportFormat;
        if (!['csv', 'xml', 'json'].includes(f)) {
            throw new BadRequestException('format must be csv, xml, or json');
        }
        return f;
    }

    private sendExport(res: Response, data: Record<string, any>[], format: ExportFormat, entity: string, itemName: string) {
        const now = new Date().toISOString().slice(0, 10);
        const filename = `${entity}_${now}.${FILE_EXT[format]}`;
        let content: string;

        switch (format) {
            case 'csv': content = this.exportService.toCsv(data); break;
            case 'xml': content = this.exportService.toXml(data, entity, itemName); break;
            case 'json': content = this.exportService.toJson(data); break;
        }

        res.setHeader('Content-Type', CONTENT_TYPES[format]);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(content);
    }

    private ensureTenant(req: any) {
        if (req.user.type !== 'TENANT' || !req.user.schoolId) {
            throw new ForbiddenException('School context required.');
        }
    }
}
