import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
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
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/types';
import { AttendanceService } from './attendance.service';
import {
  CreateExcuseDto,
  RecordAttendanceDto,
  ReviewExcuseDto,
  SuccessResponseDto,
} from '../common/dto/api.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

import {
  AttendanceRecordResponseDto,
  AttendanceStatsResponseDto,
  ExcuseResponseDto,
  UnexcusedAlertDto,
} from '../common/dto/response.dto';

interface UserRequest extends Request {
  user: {
    userId: string;
    email: string;
    type: 'TENANT' | 'SYSTEM';
    schoolId?: string;
  };
}

@ApiTags('attendance')
@ApiBearerAuth('JWT-auth')
@Controller('api/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  private ensureTenant(req: UserRequest): string {
    if (req.user.type !== 'TENANT' || !req.user.schoolId) {
      throw new ForbiddenException('School context required.');
    }
    return req.user.schoolId;
  }

  @Post('record')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Záznam docházky třídy' })
  @ApiResponse({ status: 201, type: SuccessResponseDto })
  @ApiBody({ type: RecordAttendanceDto })
  async recordAttendance(@Req() req: UserRequest, @Body() body: any) {
    const schoolId = this.ensureTenant(req);
    return this.attendanceService.recordAttendance(req.user.userId, schoolId, body);
  }

  @Get('classroom/:classroomId')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Docházka třídy za den' })
  @ApiResponse({ status: 200, type: AttendanceRecordResponseDto, isArray: true })
  async getClassroomAttendance(@Req() req: UserRequest, @Param('classroomId') classroomId: string, @Query('date') date: string) {
    const schoolId = this.ensureTenant(req);
    return this.attendanceService.getClassroomAttendance(schoolId, classroomId, date);
  }

  @Post('excuses')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Omluvenka absence (rodič)' })
  @ApiResponse({ status: 201, type: ExcuseResponseDto })
  @ApiBody({ type: CreateExcuseDto })
  async createExcuse(@Req() req: UserRequest, @Body() body: any) {
    const schoolId = this.ensureTenant(req);
    return this.attendanceService.createExcuse(req.user.userId, schoolId, body);
  }

  @Get('excuses')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Seznam omluvenek' })
  @ApiResponse({ status: 200, type: ExcuseResponseDto, isArray: true })
  async getExcuses(@Req() req: UserRequest, @Query('classroomId') classroomId?: string, @Query('status') status?: string) {
    const schoolId = this.ensureTenant(req);
    return this.attendanceService.getExcuses(schoolId, { classroomId, status });
  }

  @Put('excuses/:id/review')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Schválení/zamítnutí omluvenky' })
  @ApiBody({ type: ReviewExcuseDto })
  async reviewExcuse(@Req() req: UserRequest, @Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED' }) {
    const schoolId = this.ensureTenant(req);
    return this.attendanceService.reviewExcuse(req.user.userId, schoolId, id, body.status);
  }

  @Get('stats/:classroomId')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiky docházky třídy' })
  @ApiResponse({ status: 200, type: AttendanceStatsResponseDto })
  async getClassStatistics(@Req() req: UserRequest, @Param('classroomId') classroomId: string, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    const schoolId = this.ensureTenant(req);
    return this.attendanceService.getClassStatistics(schoolId, classroomId, dateFrom, dateTo);
  }

  @Get('export/:classroomId')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Export docházky (CSV)' })
  async exportCsv(@Req() req: UserRequest, @Res() res: Response, @Param('classroomId') classroomId: string, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    const schoolId = this.ensureTenant(req);
    const csv = await this.attendanceService.exportAttendanceCsv(schoolId, classroomId, dateFrom, dateTo);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=dochazka.csv');
    res.send(csv);
  }

  @Get('unexcused-alerts')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Upozornění na neomluvené hodiny' })
  @ApiResponse({ status: 200, type: UnexcusedAlertDto, isArray: true })
  async getUnexcusedAlerts(@Req() req: UserRequest, @Query('threshold') threshold?: string) {
    const schoolId = this.ensureTenant(req);
    return this.attendanceService.getUnexcusedAlerts(schoolId, threshold ? parseInt(threshold) : 5);
  }
}
