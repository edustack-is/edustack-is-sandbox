import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
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
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/types';
import { DeputyService } from './deputy.service';
import {
  CreateClassroomDto,
  CreateRoomDto,
  CreateSchoolEventDto,
  CreateSubjectDto,
  InviteSchoolUserDto,
  SuccessResponseDto,
} from '../common/dto/api.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

import {
  AuditLogEntryDto,
  BuildingResponseDto,
  ClassroomResponseDto,
  RoomResponseDto,
  SchoolDashboardResponseDto,
  SchoolEventResponseDto,
  SchoolSettingsResponseDto,
  SchoolUserResponseDto,
  SharedRoomResponseDto,
  StudentFamilyResponseDto,
  SubjectResponseDto,
} from '../common/dto/response.dto';
@ApiTags('deputy')
@ApiBearerAuth('JWT-auth')
@Controller('api/deputy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.DEPUTY, UserRole.PRINCIPAL)
export class DeputyController {
  constructor(
    private readonly deputyService: DeputyService,
    private readonly jwtService: JwtService,
  ) {}

  // ─── SCHOOL DASHBOARD (all roles) ────────────────────────────────

  @Get('dashboard')
  @Roles(
    UserRole.ADMIN,
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.TEACHER,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Dashboard školy' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard školy – statistiky.',
    type: SchoolDashboardResponseDto,
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
  async getSchoolDashboard(@Req() req: any) {
    this.ensureTenant(req);
    return this.deputyService.getSchoolDashboard(
      req.user.schoolId,
      req.user.sub,
      req.user.role,
    );
  }

  @Get('tasks')
  @Roles(
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.TEACHER,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Seznam úkolů na dashboardu' })
  async getTasks(@Req() req: any) {
    this.ensureTenant(req);
    return this.deputyService.getTasks(req.user.sub, req.user.schoolId);
  }

  @Post('tasks')
  @Roles(
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.TEACHER,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Vytvořit úkol' })
  async createTask(@Req() req: any, @Body('title') title: string) {
    this.ensureTenant(req);
    return this.deputyService.createTask(
      req.user.sub,
      req.user.schoolId,
      title,
    );
  }

  @Patch('tasks/:id/toggle')
  @Roles(
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.TEACHER,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Přepnout stav úkolu' })
  async toggleTask(@Req() req: any, @Param('id') id: string) {
    return this.deputyService.toggleTask(id, req.user.sub);
  }

  @Delete('tasks/:id')
  @Roles(
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.TEACHER,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Smazat úkol' })
  async deleteTask(@Req() req: any, @Param('id') id: string) {
    return this.deputyService.deleteTask(id, req.user.sub);
  }

  // ─── CLASSROOM ───────────────────────────────────────────────────

  @Get('classrooms')
  @ApiOperation({ summary: 'Seznam tříd' })
  @ApiResponse({
    status: 200,
    description: 'Třídy školy – pole.',
    type: ClassroomResponseDto,
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
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async getClassrooms(@Req() req: any) {
    this.ensureTenant(req);
    return this.deputyService.getClassrooms(req.user.schoolId);
  }

  @Post('classrooms')
  @ApiOperation({ summary: 'Vytvoření třídy' })
  @ApiBody({ type: CreateClassroomDto })
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
  async createClassroom(
    @Req() req: any,
    @Body() body: { name: string; grade: number },
  ) {
    this.ensureTenant(req);
    return this.deputyService.createClassroom(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Put('classrooms/:id')
  @ApiOperation({ summary: 'Úprava třídy' })
  @ApiResponse({
    status: 200,
    description: 'Aktualizovaná třída.',
    type: ClassroomResponseDto,
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
  async updateClassroom(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; grade?: number },
  ) {
    this.ensureTenant(req);
    return this.deputyService.updateClassroom(
      req.user.userId,
      req.user.schoolId,
      id,
      body,
    );
  }

  @Delete('classrooms/:id')
  @ApiOperation({ summary: 'Smazání třídy' })
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
  async deleteClassroom(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.deleteClassroom(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── SUBJECT ─────────────────────────────────────────────────────

  @Get('subjects')
  @ApiOperation({ summary: 'Šablony předmětů' })
  @ApiResponse({
    status: 200,
    description: 'Šablony předmětů – pole.',
    type: SubjectResponseDto,
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
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async getSubjects(@Req() req: any) {
    this.ensureTenant(req);
    return this.deputyService.getSubjects(req.user.schoolId);
  }

  @Post('subjects')
  @ApiOperation({ summary: 'Vytvoření šablony předmětu' })
  @ApiBody({ type: CreateSubjectDto })
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
  async createSubject(
    @Req() req: any,
    @Body() body: { name: string; code: string; svpDescription?: string },
  ) {
    this.ensureTenant(req);
    return this.deputyService.createSubject(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Put('subjects/:id')
  @ApiOperation({ summary: 'Úprava šablony předmětu' })
  @ApiResponse({
    status: 200,
    description: 'Aktualizovaný předmět.',
    type: SubjectResponseDto,
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
  async updateSubject(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; code?: string; svpDescription?: string },
  ) {
    this.ensureTenant(req);
    return this.deputyService.updateSubject(
      req.user.userId,
      req.user.schoolId,
      id,
      body,
    );
  }

  @Delete('subjects/:id')
  @ApiOperation({ summary: 'Smazání šablony předmětu' })
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
  async deleteSubject(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.deleteSubject(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── ROOM ────────────────────────────────────────────────────────

  @Get('rooms')
  @ApiOperation({ summary: 'Seznam místností' })
  @ApiResponse({
    status: 200,
    description: 'Místnosti – pole.',
    type: RoomResponseDto,
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
  async getRooms(@Req() req: any) {
    this.ensureTenant(req);
    return this.deputyService.getRooms(req.user.schoolId);
  }

  @Post('rooms')
  @ApiOperation({ summary: 'Vytvoření místnosti' })
  @ApiBody({ type: CreateRoomDto })
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
  async createRoom(
    @Req() req: any,
    @Body()
    body: {
      name: string;
      capacity?: number;
      isComputerLab?: boolean;
      specialEquipment?: string[];
      buildingId?: string;
      floor?: number;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.createRoom(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Put('rooms/:id')
  @ApiOperation({ summary: 'Úprava místnosti' })
  @ApiResponse({
    status: 200,
    description: 'Aktualizovaná místnost.',
    type: RoomResponseDto,
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
  async updateRoom(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      capacity?: number;
      isComputerLab?: boolean;
      specialEquipment?: string[];
      buildingId?: string | null;
      floor?: number | null;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.updateRoom(
      req.user.userId,
      req.user.schoolId,
      id,
      body,
    );
  }

  @Delete('rooms/:id')
  @ApiOperation({ summary: 'Smazání místnosti' })
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
  async deleteRoom(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.deleteRoom(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── BUILDING ────────────────────────────────────────────────────

  @Get('buildings')
  @ApiOperation({ summary: 'Seznam budov' })
  @ApiResponse({
    status: 200,
    description: 'Budovy – pole.',
    type: BuildingResponseDto,
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
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async getBuildings(@Req() req: any) {
    this.ensureTenant(req);
    return this.deputyService.getBuildings(req.user.schoolId);
  }

  @Post('buildings')
  @ApiOperation({ summary: 'Vytvoření budovy' })
  @ApiResponse({
    status: 201,
    description: 'Vytvořená budova.',
    type: BuildingResponseDto,
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
  async createBuilding(
    @Req() req: any,
    @Body() body: { name: string; address?: string; floors?: number },
  ) {
    this.ensureTenant(req);
    return this.deputyService.createBuilding(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Put('buildings/:id')
  @ApiOperation({ summary: 'Úprava budovy' })
  @ApiResponse({
    status: 200,
    description: 'Aktualizovaná budova.',
    type: BuildingResponseDto,
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
  async updateBuilding(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; address?: string; floors?: number },
  ) {
    this.ensureTenant(req);
    return this.deputyService.updateBuilding(
      req.user.userId,
      req.user.schoolId,
      id,
      body,
    );
  }

  @Delete('buildings/:id')
  @ApiOperation({ summary: 'Smazání budovy' })
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
  async deleteBuilding(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.deleteBuilding(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── ROOM SHARING ────────────────────────────────────────────────

  @Post('rooms/:id/share')
  @ApiOperation({ summary: 'Sdílení místnosti s jinou školou' })
  @ApiResponse({
    status: 200,
    description: 'Místnost sdílena.',
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
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async shareRoom(
    @Req() req: any,
    @Param('id') roomId: string,
    @Body() body: { targetSchoolId: string },
  ) {
    this.ensureTenant(req);
    return this.deputyService.shareRoom(
      req.user.userId,
      req.user.schoolId,
      roomId,
      body.targetSchoolId,
    );
  }

  @Delete('rooms/:id/share/:schoolId')
  @ApiOperation({ summary: 'Zrušení sdílení místnosti' })
  @ApiResponse({
    status: 200,
    description: 'Sdílení zrušeno.',
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
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async unshareRoom(
    @Req() req: any,
    @Param('id') roomId: string,
    @Param('schoolId') targetSchoolId: string,
  ) {
    this.ensureTenant(req);
    return this.deputyService.unshareRoom(
      req.user.userId,
      req.user.schoolId,
      roomId,
      targetSchoolId,
    );
  }

  @Get('shared-rooms')
  @ApiOperation({ summary: 'Sdílené místnosti' })
  @ApiResponse({
    status: 200,
    description: 'Sdílené místnosti – pole.',
    type: SharedRoomResponseDto,
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
  async getSharedRooms(@Req() req: any) {
    this.ensureTenant(req);
    return this.deputyService.getSharedRooms(req.user.schoolId);
  }

  // ─── SCHOOL EVENTS ───────────────────────────────────────────────

  @Get('events')
  @Roles(
    UserRole.ADMIN,
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.TEACHER,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Události školního roku' })
  @ApiResponse({
    status: 200,
    description: 'Události – pole.',
    type: SchoolEventResponseDto,
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
  async getEvents(@Req() req: any) {
    this.ensureTenant(req);
    return this.deputyService.getEvents(req.user.schoolId);
  }

  @Get('events/upcoming')
  @Roles(
    UserRole.ADMIN,
    UserRole.ADMIN,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.TEACHER,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Nadcházející události' })
  @ApiResponse({
    status: 200,
    description: 'Nadcházející události – pole.',
    type: SchoolEventResponseDto,
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
  async getUpcomingEvents(@Req() req: any, @Query('limit') limit?: string) {
    this.ensureTenant(req);
    return this.deputyService.getUpcomingEvents(
      req.user.schoolId,
      limit ? Number(limit) : 10,
    );
  }

  @Post('events')
  @ApiOperation({ summary: 'Vytvoření události' })
  @ApiBody({ type: CreateSchoolEventDto })
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
  async createEvent(
    @Req() req: any,
    @Body()
    body: {
      title: string;
      description?: string;
      date: string;
      endDate?: string;
      type?: string;
      allDay?: boolean;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.createEvent(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Put('events/:id')
  @ApiOperation({ summary: 'Úprava události' })
  @ApiResponse({
    status: 200,
    description: 'Aktualizovaná událost.',
    type: SchoolEventResponseDto,
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
  async updateEvent(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      date?: string;
      endDate?: string;
      type?: string;
      allDay?: boolean;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.updateEvent(
      req.user.userId,
      req.user.schoolId,
      id,
      body,
    );
  }

  @Delete('events/:id')
  @ApiOperation({ summary: 'Smazání události' })
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
    return this.deputyService.deleteEvent(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── USER INVITATION ─────────────────────────────────────────────

  @Post('users/invite')
  @ApiOperation({ summary: 'Pozvání uživatele do školy' })
  @ApiResponse({
    status: 201,
    description: 'Uživatel pozván.',
    type: SuccessResponseDto,
  })
  @ApiBody({ type: InviteSchoolUserDto })
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
  async inviteUser(
    @Req() req: any,
    @Body()
    body: {
      email: string;
      firstName: string;
      lastName: string;
      role: UserRole;
      workloadPercentage?: number;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.inviteUser(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  // ─── CSV EXPORT (must be before :id routes) ────────────────────

  @Get('users/export')
  async exportUsersCSV(@Req() req: any, @Res() res: Response) {
    this.ensureTenant(req);
    const csv = await this.deputyService.exportUsersCSV(req.user.schoolId);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename=uzivatele.csv',
    });
    res.send('\uFEFF' + csv); // BOM for Excel
  }

  // ─── SCHOOL-SCOPED USERS ────────────────────────────────────────

  @Get('users')
  async getSchoolUsers(@Req() req: any) {
    this.ensureTenant(req);
    return this.deputyService.getSchoolUsers(req.user.schoolId);
  }

  // ─── STUDENT + FAMILY CREATION ──────────────────────────────────

  @Post('users/student-family')
  async createStudentFamily(
    @Req() req: any,
    @Body()
    body: {
      student: { firstName: string; lastName: string; email?: string };
      parents: Array<{
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
      }>;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.createStudentFamily(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  // ─── STAFF CREATION ─────────────────────────────────────────────

  @Post('users/staff')
  async createStaff(
    @Req() req: any,
    @Body()
    body: {
      firstName: string;
      lastName: string;
      email: string;
      role: 'TEACHER' | 'DEPUTY';
      workloadPercentage: number;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.createStaff(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Post('users/:id/resend-invitation')
  async resendInvitation(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.resendInvitation(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── REMOVE USER FROM SCHOOL ────────────────────────────────────

  @Delete('users/:id')
  @ApiOperation({ summary: 'Odebrání uživatele ze školy' })
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
  async removeUser(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.removeSchoolUser(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── SET STUDENT AS ALUMNI ────────────────────────────────────────

  @Patch('users/:id/alumni')
  @ApiOperation({ summary: 'Nastavení absolventa' })
  @ApiResponse({
    status: 200,
    description: 'Status absolventa nastaven.',
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
  async setAlumni(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.setAlumniStatus(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── IMPERSONATE SCHOOL USER ─────────────────────────────────────

  @Post('users/:id/impersonate')
  async impersonateUser(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.impersonateSchoolUser(
      req.user.userId,
      req.user.schoolId,
      id,
      this.jwtService,
    );
  }

  // ─── EDIT USER ──────────────────────────────────────────────────

  @Put('users/:id')
  async updateSchoolUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      workloadPercentage?: number;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.updateSchoolUser(
      req.user.userId,
      req.user.schoolId,
      id,
      body,
    );
  }

  // ─── SUSPEND / REACTIVATE ───────────────────────────────────────

  @Patch('users/:id/suspend')
  @ApiOperation({ summary: 'Suspendování uživatele' })
  @ApiResponse({
    status: 200,
    description: 'Uživatel suspendován.',
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
  async suspendUser(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.suspendUser(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  @Patch('users/:id/reactivate')
  @ApiOperation({ summary: 'Reaktivace uživatele' })
  @ApiResponse({
    status: 200,
    description: 'Uživatel reaktivován.',
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
  async reactivateUser(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.reactivateUser(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── CHANGE ROLE ────────────────────────────────────────────────

  @Patch('users/:id/role')
  async changeUserRole(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { role: string },
  ) {
    this.ensureTenant(req);
    return this.deputyService.changeUserRole(
      req.user.userId,
      req.user.schoolId,
      id,
      body.role,
    );
  }

  // ─── THEMATIC PLANS ──────────────────────────────────────────────

  @Get('thematic-plans')
  async getThematicPlans(@Req() req: any) {
    this.ensureTenant(req);
    return this.deputyService.getThematicPlans(req.user.schoolId);
  }

  @Get('thematic-plans/:id')
  async getThematicPlan(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.getThematicPlan(req.user.schoolId, id);
  }

  @Post('thematic-plans')
  async createThematicPlan(
    @Req() req: any,
    @Body()
    body: {
      title: string;
      subjectTemplateId: string;
      academicYearId: string;
      gradeLevelId: string;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.createThematicPlan(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Put('thematic-plans/:id')
  async updateThematicPlan(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { title?: string },
  ) {
    this.ensureTenant(req);
    return this.deputyService.updateThematicPlan(
      req.user.userId,
      req.user.schoolId,
      id,
      body,
    );
  }

  @Delete('thematic-plans/:id')
  async deleteThematicPlan(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.deleteThematicPlan(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  @Put('thematic-plans/:id/weeks')
  async saveThematicPlanWeeks(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      weeks: Array<{
        weekNumber: number;
        topic: string;
        objectives?: string;
        methods?: string;
        resources?: string;
        crossCurricular?: string;
        notes?: string;
      }>;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.saveThematicPlanWeeks(
      req.user.userId,
      req.user.schoolId,
      id,
      body.weeks,
    );
  }

  // ─── LESSON PREPARATIONS ─────────────────────────────────────────

  @Get('lesson-preparations')
  async getLessonPreparations(
    @Req() req: any,
    @Query('subjectTemplateId') subjectTemplateId?: string,
  ) {
    this.ensureTenant(req);
    return this.deputyService.getLessonPreparations(req.user.schoolId, {
      subjectTemplateId,
      teacherId: req.user.userId,
    });
  }

  @Post('lesson-preparations')
  async createLessonPreparation(
    @Req() req: any,
    @Body()
    body: {
      title: string;
      date: string;
      duration?: number;
      topic: string;
      objectives?: string;
      activities?: string;
      materials?: string;
      homework?: string;
      evaluation?: string;
      subjectTemplateId: string;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.createLessonPreparation(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Put('lesson-preparations/:id')
  async updateLessonPreparation(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      date?: string;
      duration?: number;
      topic?: string;
      objectives?: string;
      activities?: string;
      materials?: string;
      homework?: string;
      evaluation?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.updateLessonPreparation(
      req.user.userId,
      req.user.schoolId,
      id,
      body,
    );
  }

  @Delete('lesson-preparations/:id')
  async deleteLessonPreparation(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.deleteLessonPreparation(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── TEACHING MATERIALS ──────────────────────────────────────────

  @Get('teaching-materials')
  async getTeachingMaterials(
    @Req() req: any,
    @Query('subjectTemplateId') sub?: string,
    @Query('type') type?: string,
  ) {
    this.ensureTenant(req);
    return this.deputyService.getTeachingMaterials(req.user.schoolId, {
      subjectTemplateId: sub,
      type,
    });
  }

  @Post('teaching-materials')
  async createTeachingMaterial(
    @Req() req: any,
    @Body()
    body: {
      title: string;
      description?: string;
      url: string;
      type?: string;
      subjectTemplateId?: string;
      gradeLevelId?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.createTeachingMaterial(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Put('teaching-materials/:id')
  async updateTeachingMaterial(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      url?: string;
      type?: string;
      subjectTemplateId?: string | null;
      gradeLevelId?: string | null;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.updateTeachingMaterial(
      req.user.userId,
      req.user.schoolId,
      id,
      body,
    );
  }

  @Delete('teaching-materials/:id')
  async deleteTeachingMaterial(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.deleteTeachingMaterial(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── RVP COMPETENCIES & MAPPINGS ─────────────────────────────────

  @Get('competencies')
  async getRvpCompetencies(@Req() req: any) {
    this.ensureTenant(req);
    return this.deputyService.getRvpCompetencies(req.user.schoolId);
  }

  @Post('competencies')
  async createRvpCompetency(
    @Req() req: any,
    @Body()
    body: {
      code: string;
      name: string;
      area: string;
      description?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.createRvpCompetency(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Put('competencies/:id')
  async updateRvpCompetency(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      code?: string;
      name?: string;
      area?: string;
      description?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.updateRvpCompetency(
      req.user.userId,
      req.user.schoolId,
      id,
      body,
    );
  }

  @Delete('competencies/:id')
  async deleteRvpCompetency(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.deleteRvpCompetency(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  @Get('competency-mappings')
  async getCompetencyMappings(
    @Req() req: any,
    @Query('subjectTemplateId') sub?: string,
    @Query('gradeLevelId') gl?: string,
  ) {
    this.ensureTenant(req);
    return this.deputyService.getCompetencyMappings(req.user.schoolId, {
      subjectTemplateId: sub,
      gradeLevelId: gl,
    });
  }

  @Post('competency-mappings')
  async upsertCompetencyMapping(
    @Req() req: any,
    @Body()
    body: {
      competencyId: string;
      subjectTemplateId: string;
      gradeLevelId: string;
      fulfilled: boolean;
      note?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.deputyService.upsertCompetencyMapping(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Delete('competency-mappings/:id')
  async deleteCompetencyMapping(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.deputyService.deleteCompetencyMapping(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── HELPER ──────────────────────────────────────────────────────

  private ensureTenant(req: any) {
    if (req.user.type !== 'TENANT' || !req.user.schoolId) {
      throw new ForbiddenException('School context required.');
    }
  }
}
