import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiProduces,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/types';
import { ReportsService } from './reports.service';

import { ReportStatsResponseDto } from '../common/dto/response.dto';

@ApiTags('reports')
@ApiBearerAuth('JWT-auth')
@Controller('api/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.DEPUTY, UserRole.PRINCIPAL, UserRole.TEACHER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('grades/classroom')
  @ApiOperation({
    summary: 'Statistiky prospěchu třídy',
    description:
      'Průměr, medián, distribuce známek a úspěšnost per předmět a student.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiky prospěchu třídy.',
    type: ReportStatsResponseDto,
  })
  @ApiQuery({ name: 'classroomId', required: true, description: 'ID třídy' })
  @ApiQuery({
    name: 'semesterId',
    required: false,
    description: 'ID semestru (volitelné)',
  })
  async gradeStatsByClassroom(
    @Req() req: any,
    @Query('classroomId') classroomId: string,
    @Query('semesterId') semesterId?: string,
  ) {
    this.ensureTenant(req);
    return this.reportsService.getGradeStatsByClassroom(
      req.user.schoolId,
      classroomId,
      semesterId,
    );
  }

  @Get('grades/school')
  @ApiOperation({
    summary: 'Statistiky prospěchu školy',
    description: 'Přehled průměrů a počtu známek per třída.',
  })
  @ApiQuery({
    name: 'semesterId',
    required: false,
    description: 'ID semestru (volitelné)',
  })
  async gradeStatsBySchool(
    @Req() req: any,
    @Query('semesterId') semesterId?: string,
  ) {
    this.ensureTenant(req);
    return this.reportsService.getGradeStatsBySchool(
      req.user.schoolId,
      semesterId,
    );
  }

  @Get('attendance')
  @ApiOperation({
    summary: 'Statistiky docházky',
    description: 'Celkový přehled + per-student breakdown s mírou účasti.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiky docházky.',
    type: ReportStatsResponseDto,
  })
  @ApiQuery({
    name: 'classroomId',
    required: false,
    description: 'Filtr dle ID třídy',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Od data (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'Do data (YYYY-MM-DD)',
  })
  async attendanceStats(
    @Req() req: any,
    @Query('classroomId') classroomId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    this.ensureTenant(req);
    return this.reportsService.getAttendanceStats(
      req.user.schoolId,
      classroomId,
      dateFrom,
      dateTo,
    );
  }

  @Get('csi')
  @ApiOperation({
    summary: 'Výkaz pro ČŠI (JSON)',
    description:
      'Data pro Českou školní inspekci: personální zajištění, třídy, klasifikace, docházka.',
  })
  @ApiQuery({
    name: 'academicYearId',
    required: false,
    description: 'ID školního roku (volitelné)',
  })
  async csiReport(
    @Req() req: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    this.ensureTenant(req);
    return this.reportsService.generateCsiReport(
      req.user.schoolId,
      academicYearId,
    );
  }

  @Get('csi/print')
  @ApiOperation({
    summary: 'Výkaz pro ČŠI (HTML)',
    description: 'Tisknutelná HTML verze výkazu pro ČŠI.',
  })
  @ApiQuery({
    name: 'academicYearId',
    required: false,
    description: 'ID školního roku (volitelné)',
  })
  @ApiProduces('text/html')
  async csiReportHtml(
    @Req() req: any,
    @Res() res: Response,
    @Query('academicYearId') academicYearId?: string,
  ) {
    this.ensureTenant(req);
    const report = await this.reportsService.generateCsiReport(
      req.user.schoolId,
      academicYearId,
    );
    const html = this.reportsService.renderReportHtml(report, 'csi');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  private ensureTenant(req: any) {
    if (req.user.type !== 'TENANT' || !req.user.schoolId) {
      throw new ForbiddenException('School context required.');
    }
  }
}
