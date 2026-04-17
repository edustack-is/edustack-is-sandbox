import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, SubstitutionType } from '@prisma/client';
import { ScheduleService } from './schedule.service';
import {
  CreateScheduleEventDto,
  CreateSubstitutionDto,
  SuccessResponseDto,
  UpdateScheduleEventDto,
  UpsertTimeSlotsDto,
  TimeSlotDto,
} from '../common/dto/api.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

import {
  CollisionResultDto,
  GenerateScheduleResultDto,
  RecurringEventResponseDto,
  ScheduleDiffResponseDto,
  ScheduleEventResponseDto,
  ScheduleMatrixResponseDto,
  SnapshotResponseDto,
  SubstitutionResponseDto,
} from '../common/dto/response.dto';
@ApiTags('schedule')
@ApiBearerAuth('JWT-auth')
@Controller('api/schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  // ─── LESSON TIME SLOTS ──────────────────────────────────────

  @Get('slots')
  @Roles(
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.TEACHER,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Časové sloty (zvonění)' })
  @ApiResponse({
    status: 200,
    description: 'Časové sloty (zvonění) – pole.',
    type: TimeSlotDto,
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  async getTimeSlots(@Req() req: any) {
    this.ensureTenant(req);
    return this.scheduleService.getTimeSlots(req.user.schoolId);
  }

  @Put('slots')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Nastavení časových slotů' })
  @ApiResponse({
    status: 200,
    description: 'Uložené časové sloty.',
    type: TimeSlotDto,
    isArray: true,
  })
  @ApiBody({ type: UpsertTimeSlotsDto })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  async upsertTimeSlots(
    @Req() req: any,
    @Body()
    body: {
      slots: {
        lessonNumber: number;
        startTime: string;
        endTime: string;
        label?: string;
        breakAfter?: number;
      }[];
    },
  ) {
    this.ensureTenant(req);
    return this.scheduleService.upsertTimeSlots(req.user.schoolId, body.slots);
  }

  // ─── SCHEDULE EVENTS CRUD ───────────────────────────────────

  @Get('events')
  @Roles(
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.TEACHER,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Rozvrhové události' })
  @ApiResponse({
    status: 200,
    description: 'Rozvrhové události – pole.',
    type: ScheduleEventResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  async getEvents(
    @Req() req: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('classroomId') classroomId?: string,
    @Query('teacherId') teacherId?: string,
  ) {
    this.ensureTenant(req);
    return this.scheduleService.getEvents(req.user.schoolId, {
      academicYearId,
      classroomId,
      teacherId,
    });
  }

  @Post('events')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Vytvoření rozvrhové události' })
  @ApiResponse({
    status: 201,
    description: 'Vytvořená rozvrhová událost.',
    type: ScheduleEventResponseDto,
  })
  @ApiBody({ type: CreateScheduleEventDto })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  async createEvent(
    @Req() req: any,
    @Body()
    body: {
      dayOfWeek: number;
      lessonNumber: number;
      subjectInstanceId: string;
      classroomId: string;
      teacherId: string;
      roomId?: string;
      academicYearId: string;
    },
  ) {
    this.ensureTenant(req);
    return this.scheduleService.createEvent(req.user.schoolId, body);
  }

  @Put('events/:id')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Úprava rozvrhové události' })
  @ApiBody({ type: UpdateScheduleEventDto })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async updateEvent(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      dayOfWeek?: number;
      lessonNumber?: number;
      subjectInstanceId?: string;
      classroomId?: string;
      teacherId?: string;
      roomId?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.scheduleService.updateEvent(req.user.schoolId, id, body);
  }

  @Delete('events/:id')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Smazání rozvrhové události' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async deleteEvent(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.scheduleService.deleteEvent(req.user.schoolId, id);
  }

  @Post('events/bulk')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Hromadné vytvoření událostí' })
  @ApiResponse({
    status: 201,
    description: 'Hromadně vytvořené události – pole.',
    type: ScheduleEventResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  async bulkCreateEvents(
    @Req() req: any,
    @Body()
    body: {
      events: {
        dayOfWeek: number;
        lessonNumber: number;
        subjectInstanceId: string;
        classroomId: string;
        teacherId: string;
        roomId?: string;
        academicYearId: string;
      }[];
    },
  ) {
    this.ensureTenant(req);
    return this.scheduleService.bulkCreateEvents(
      req.user.schoolId,
      body.events,
    );
  }

  @Post('validate')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Kontrola kolizí rozvrhu' })
  @ApiResponse({
    status: 200,
    description: 'Výsledek kontroly kolizí.',
    type: CollisionResultDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  async validateCollision(
    @Req() req: any,
    @Body()
    body: {
      dayOfWeek: number;
      lessonNumber: number;
      teacherId: string;
      classroomId: string;
      roomId?: string;
      academicYearId: string;
      excludeEventId?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.scheduleService.validateCollision(
      body.dayOfWeek,
      body.lessonNumber,
      body.teacherId,
      body.classroomId,
      body.roomId,
      body.academicYearId,
      req.user.schoolId,
      body.excludeEventId,
    );
  }

  // ─── VIEW ENDPOINTS ─────────────────────────────────────────

  @Get('view/classroom/:id')
  @Roles(
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.TEACHER,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Rozvrh třídy' })
  @ApiResponse({
    status: 200,
    description: 'Rozvrh třídy – matice.',
    type: ScheduleMatrixResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async getClassroomSchedule(
    @Req() req: any,
    @Param('id') classroomId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    this.ensureTenant(req);
    return this.scheduleService.getClassroomSchedule(
      req.user.schoolId,
      classroomId,
      academicYearId,
    );
  }

  @Get('view/teacher/:id')
  @Roles(
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.TEACHER,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Rozvrh učitele' })
  @ApiResponse({
    status: 200,
    description: 'Rozvrh učitele – matice.',
    type: ScheduleMatrixResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async getTeacherSchedule(
    @Req() req: any,
    @Param('id') teacherId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    this.ensureTenant(req);
    return this.scheduleService.getTeacherSchedule(
      req.user.schoolId,
      teacherId,
      academicYearId,
    );
  }

  @Get('view/student/:id')
  @Roles(
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.TEACHER,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Rozvrh studenta' })
  @ApiResponse({
    status: 200,
    description: 'Rozvrh studenta – matice.',
    type: ScheduleMatrixResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async getStudentSchedule(
    @Req() req: any,
    @Param('id') studentUserId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    this.ensureTenant(req);
    return this.scheduleService.getStudentSchedule(
      req.user.schoolId,
      studentUserId,
      academicYearId,
    );
  }

  // ─── SUBSTITUTIONS ──────────────────────────────────────────

  @Get('substitutions')
  @Roles(
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.TEACHER,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Suplování' })
  @ApiResponse({
    status: 200,
    description: 'Suplování – pole.',
    type: SubstitutionResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  async getSubstitutions(
    @Req() req: any,
    @Query('date') date?: string,
    @Query('weekStart') weekStart?: string,
    @Query('weekEnd') weekEnd?: string,
  ) {
    this.ensureTenant(req);
    return this.scheduleService.getSubstitutions(req.user.schoolId, {
      date,
      weekStart,
      weekEnd,
    });
  }

  @Post('substitutions')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Vytvoření suplování' })
  @ApiResponse({
    status: 201,
    description: 'Vytvořené suplování.',
    type: SubstitutionResponseDto,
  })
  @ApiBody({ type: CreateSubstitutionDto })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  async createSubstitution(
    @Req() req: any,
    @Body()
    body: {
      date: string;
      originalEventId: string;
      type: SubstitutionType;
      note?: string;
      substituteTeacherId?: string;
      substituteRoomId?: string;
      substituteSubjectId?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.scheduleService.createSubstitution(
      req.user.schoolId,
      req.user.userId,
      body,
    );
  }

  @Put('substitutions/:id')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Úprava suplování' })
  @ApiResponse({
    status: 200,
    description: 'Aktualizované suplování.',
    type: SubstitutionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async updateSubstitution(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      type?: SubstitutionType;
      note?: string;
      substituteTeacherId?: string;
      substituteRoomId?: string;
      substituteSubjectId?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.scheduleService.updateSubstitution(req.user.schoolId, id, body);
  }

  @Delete('substitutions/:id')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Smazání suplování' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async deleteSubstitution(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.scheduleService.deleteSubstitution(req.user.schoolId, id);
  }

  // ─── AUTO-GENERATE ──────────────────────────────────────────

  @Post('generate')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Automatické generování rozvrhu' })
  @ApiResponse({
    status: 200,
    description: 'Výsledek generování rozvrhu.',
    type: GenerateScheduleResultDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  async generateSchedule(
    @Req() req: any,
    @Body() body: { academicYearId: string; clearExisting?: boolean },
  ) {
    this.ensureTenant(req);
    return this.scheduleService.generateSchedule(
      req.user.schoolId,
      body.academicYearId,
      body.clearExisting ?? false,
    );
  }

  // ─── EXPORT HTML ────────────────────────────────────────────

  @Get('export-html')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.TEACHER)
  @ApiOperation({ summary: 'Export rozvrhu (HTML tisk)' })
  @ApiResponse({ status: 200, description: 'HTML rozvrhu pro tisk.' })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  async exportHtml(
    @Req() req: any,
    @Query('classroomId') classroomId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    this.ensureTenant(req);
    const html = await this.scheduleService.getScheduleHtml(
      req.user.schoolId,
      classroomId,
      academicYearId,
    );
    return { html };
  }

  // ─── SNAPSHOTS & DIFF ───────────────────────────────────────

  @Get('snapshots')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Snapshoty rozvrhu' })
  @ApiResponse({
    status: 200,
    description: 'Snapshoty rozvrhu – pole.',
    type: SnapshotResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  async getSnapshots(
    @Req() req: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    this.ensureTenant(req);
    return this.scheduleService.getSnapshots(req.user.schoolId, academicYearId);
  }

  @Post('snapshots')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Vytvoření snapshotu' })
  @ApiResponse({
    status: 201,
    description: 'Vytvořený snapshot.',
    type: SnapshotResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async createSnapshot(
    @Req() req: any,
    @Body() body: { academicYearId: string; name: string },
  ) {
    this.ensureTenant(req);
    return this.scheduleService.createSnapshot(
      req.user.schoolId,
      body.academicYearId,
      body.name,
    );
  }

  @Get('snapshots/:id/diff')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  async diffSnapshot(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.scheduleService.diffSnapshot(req.user.schoolId, id);
  }

  @Delete('snapshots/:id')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  async deleteSnapshot(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.scheduleService.deleteSnapshot(req.user.schoolId, id);
  }

  // ─── RECURRING EVENTS ───────────────────────────────────────

  @Get('recurring-events')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.TEACHER)
  @ApiOperation({ summary: 'Opakující se události (kroužky)' })
  @ApiResponse({
    status: 200,
    description: 'Kroužky – pole.',
    type: RecurringEventResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  async getRecurringEvents(@Req() req: any) {
    this.ensureTenant(req);
    return this.scheduleService.getRecurringEvents(req.user.schoolId);
  }

  @Post('recurring-events')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Vytvoření kroužku' })
  @ApiResponse({
    status: 201,
    description: 'Vytvořený kroužek.',
    type: RecurringEventResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async createRecurringEvent(
    @Req() req: any,
    @Body()
    body: {
      title: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      roomId?: string;
      teacherId?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.scheduleService.createRecurringEvent(req.user.schoolId, body);
  }

  @Put('recurring-events/:id')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Úprava kroužku' })
  @ApiResponse({
    status: 200,
    description: 'Aktualizovaný kroužek.',
    type: RecurringEventResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async updateRecurringEvent(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      dayOfWeek?: number;
      startTime?: string;
      endTime?: string;
      roomId?: string | null;
      teacherId?: string | null;
    },
  ) {
    this.ensureTenant(req);
    return this.scheduleService.updateRecurringEvent(
      req.user.schoolId,
      id,
      body,
    );
  }

  @Delete('recurring-events/:id')
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
  @ApiOperation({ summary: 'Smazání kroužku' })
  @ApiResponse({
    status: 200,
    description: 'Kroužek smazán.',
    type: SuccessResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async deleteRecurringEvent(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.scheduleService.deleteRecurringEvent(req.user.schoolId, id);
  }

  // ─── HELPERS ────────────────────────────────────────────────

  private ensureTenant(req: any) {
    if (req.user.type !== 'TENANT' || !req.user.schoolId) {
      throw new ForbiddenException('School context required.');
    }
  }
}
