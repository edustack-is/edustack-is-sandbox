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
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/types';
import { ClassBookService } from './classbook.service';
import {
  SuccessResponseDto,
  UpsertClassbookEntryDto,
} from '../common/dto/api.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

import {
  AttendanceRecordResponseDto,
  ClassbookEntryResponseDto,
} from '../common/dto/response.dto';

@ApiTags('classbook')
@ApiBearerAuth('JWT-auth')
@Controller('api/classbook')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassBookController {
  constructor(private readonly classBookService: ClassBookService) {}

  private ensureTenant(req: any) {
    if (!req.user?.schoolId)
      throw new ForbiddenException('School context required.');
  }

  @Get('entries/:classroomId')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Záznamy třídní knihy za den' })
  @ApiResponse({
    status: 200,
    description: 'Záznamy třídní knihy za den – pole.',
    type: ClassbookEntryResponseDto,
    isArray: true,
  })
  async getEntries(
    @Req() req: any,
    @Param('classroomId') classroomId: string,
    @Query('date') date: string,
  ) {
    this.ensureTenant(req);
    return this.classBookService.getEntriesForDate(
      req.user.schoolId,
      classroomId,
      date,
    );
  }

  @Post('entries')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Uložení záznamu do třídní knihy' })
  @ApiResponse({
    status: 200,
    description: 'Uložený záznam třídní knihy.',
    type: ClassbookEntryResponseDto,
  })
  @ApiBody({ type: UpsertClassbookEntryDto })
  async upsertEntry(@Req() req: any, @Body() body: UpsertClassbookEntryDto) {
    this.ensureTenant(req);
    return this.classBookService.upsertEntry(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Post('sign/:entryId')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Elektronický podpis záznamu' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  async signEntry(@Req() req: any, @Param('entryId') entryId: string) {
    const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    return this.classBookService.signEntry(
      req.user.userId,
      entryId,
      ip as string,
    );
  }

  @Get('range/:classroomId')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Záznamy třídní knihy za období' })
  @ApiResponse({
    status: 200,
    description: 'Záznamy za období – pole.',
    type: ClassbookEntryResponseDto,
    isArray: true,
  })
  async getEntriesRange(
    @Req() req: any,
    @Param('classroomId') classroomId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    this.ensureTenant(req);
    return this.classBookService.getEntriesForRange(
      req.user.schoolId,
      classroomId,
      dateFrom,
      dateTo,
    );
  }

  @Get('attendance/:classroomId')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Docházka pro hodinu v třídní knize' })
  @ApiResponse({
    status: 200,
    description: 'Docházka pro hodinu – pole.',
    type: AttendanceRecordResponseDto,
    isArray: true,
  })
  async getAttendance(
    @Req() req: any,
    @Param('classroomId') classroomId: string,
    @Query('date') date: string,
    @Query('lessonNumber') lessonNumber: string,
  ) {
    this.ensureTenant(req);
    return this.classBookService.getAttendanceForLesson(
      req.user.schoolId,
      classroomId,
      date,
      parseInt(lessonNumber),
    );
  }
}
