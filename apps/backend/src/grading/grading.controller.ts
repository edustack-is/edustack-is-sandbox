import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/types';
import { GradingService } from './grading.service';
import {
  BehaviorGradeDto,
  CompetencyGradeDto,
  CreateGradeDto,
  GradeResponseDto,
  MeasureDto,
  PolishTextDto,
  SuccessResponseDto,
  UpdateGradeDto,
  UpsertReportCardDto,
} from '../common/dto/api.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

import {
  AiTextResponseDto,
  BehaviorGradeResponseDto,
  CommissionExamResponseDto,
  CompetencyGradeResponseDto,
  GradeHistoryEntryDto,
  GradingDeadlineResponseDto,
  GradingTypeResponseDto,
  MeasureResponseDto,
  ReportCardResponseDto,
} from '../common/dto/response.dto';
@ApiTags('grading')
@ApiBearerAuth('JWT-auth')
@Controller('api/grading')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  private ensureTenant(req: any) {
    if (req.user.type !== 'TENANT' || !req.user.schoolId) {
      throw new ForbiddenException('School context required.');
    }
  }

  private isAdmin(req: any): boolean {
    const role = req.user.role;
    return (
      role === UserRole.PRINCIPAL ||
      role === UserRole.DEPUTY ||
      role === UserRole.ADMIN
    );
  }

  // ─── GRADE CRUD ─────────────────────────────────────────────

  /**
   * POST /api/grading/grades
   * Create a grade (teacher for subjects they teach; admin for any).
   */
  @Post('grades')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Vytvoření známky' })
  @ApiResponse({
    status: 201,
    description: 'Vytvořená známka.',
    type: GradeResponseDto,
  })
  @ApiResponse({ status: 200, type: GradeResponseDto })
  @ApiBody({ type: CreateGradeDto })
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
  async createGrade(
    @Req() req: any,
    @Body()
    body: {
      studentId: string;
      subjectInstanceId: string;
      value: string;
      weight: number;
      description?: string;
      type?: string;
      verbalText?: string;
      category?: string;
      semesterId?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.gradingService.createGrade(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  /**
   * PUT /api/grading/grades/:id
   * Update a grade (only the teacher who created it, or admin).
   */
  @Put('grades/:id')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Úprava známky' })
  @ApiResponse({ status: 200, type: GradeResponseDto })
  @ApiBody({ type: UpdateGradeDto })
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
  async updateGrade(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      value?: string;
      weight?: number;
      description?: string;
      verbalText?: string;
      category?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.gradingService.updateGrade(
      req.user.userId,
      req.user.schoolId,
      id,
      body,
    );
  }

  /**
   * DELETE /api/grading/grades/:id
   */
  @Delete('grades/:id')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Smazání známky' })
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
  async deleteGrade(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.gradingService.deleteGrade(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── GRADE QUERIES ──────────────────────────────────────────

  /**
   * GET /api/grading/classroom/:id
   * Get grades grid for a classroom (teacher sees own subjects; admin sees all).
   */
  @Get('classroom/:id')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Známky třídy' })
  @ApiResponse({
    status: 200,
    description: 'Známky třídy – pole objektů.',
    type: GradeResponseDto,
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
  async getGradesForClassroom(
    @Req() req: any,
    @Param('id') classroomId: string,
    @Query('semesterId') semesterId?: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getGradesForClassroom(
      req.user.userId,
      req.user.schoolId,
      classroomId,
      { semesterId, isAdmin: this.isAdmin(req) },
    );
  }

  /**
   * GET /api/grading/student/:id
   * Get all grades for a student.
   */
  @Get('student/:id')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
  )
  @ApiOperation({ summary: 'Známky studenta' })
  @ApiResponse({
    status: 200,
    description: 'Známky studenta – pole objektů.',
    type: GradeResponseDto,
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
  async getStudentGrades(
    @Req() req: any,
    @Param('id') studentId: string,
    @Query('semesterId') semesterId?: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getStudentGrades(
      req.user.schoolId,
      studentId,
      semesterId,
    );
  }

  /**
   * GET /api/grading/average/:studentId/:subjectInstanceId
   */
  @Get('average/:studentId/:subjectInstanceId')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
  )
  @ApiOperation({ summary: 'Vážený průměr studenta za předmět' })
  @ApiResponse({
    status: 200,
    description: 'Vážený průměr studenta.',
    type: GradeResponseDto,
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
  async getAverage(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Param('subjectInstanceId') subjectInstanceId: string,
  ) {
    this.ensureTenant(req);
    const average = await this.gradingService.calculateWeightedAverage(
      studentId,
      subjectInstanceId,
    );
    return { average };
  }

  // ─── REPORT CARDS ───────────────────────────────────────────

  /**
   * GET /api/grading/report-cards/:classroomId/:semesterId
   */
  @Get('report-cards/:classroomId/:semesterId')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Vysvědčení třídy za semestr' })
  @ApiResponse({
    status: 200,
    description: 'Vysvědčení třídy – pole.',
    type: ReportCardResponseDto,
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
  async getReportCards(
    @Req() req: any,
    @Param('classroomId') classroomId: string,
    @Param('semesterId') semesterId: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getReportCardsForClass(
      req.user.schoolId,
      classroomId,
      semesterId,
    );
  }

  /**
   * POST /api/grading/report-cards
   * Create or update a report card entry.
   */
  @Post('report-cards')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Uložení/aktualizace vysvědčení' })
  @ApiResponse({
    status: 200,
    description: 'Uložené vysvědčení.',
    type: ReportCardResponseDto,
  })
  @ApiBody({ type: UpsertReportCardDto })
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
  async upsertReportCard(
    @Req() req: any,
    @Body()
    body: {
      studentId: string;
      subjectInstanceId: string;
      semesterId: string;
      finalGrade?: string;
      verbalEvaluation?: string;
      aiPolished?: boolean;
    },
  ) {
    this.ensureTenant(req);
    return this.gradingService.upsertReportCard(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  // ─── AI POLISH ──────────────────────────────────────────────

  /**
   * POST /api/grading/ai-polish
   * AI polish verbal evaluation text.
   */
  @Post('ai-polish')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'AI vylepšení slovního hodnocení' })
  @ApiResponse({
    status: 200,
    description: 'AI vylepšený text.',
    type: AiTextResponseDto,
  })
  @ApiBody({ type: PolishTextDto })
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
  async polishVerbalEvaluation(
    @Req() req: any,
    @Body() body: { text: string; studentName: string; subjectName: string },
  ) {
    this.ensureTenant(req);
    return this.gradingService.polishVerbalEvaluation(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  // ─── GRADING TYPES ──────────────────────────────────────────

  /**
   * GET /api/grading/grading-types/:classroomId
   * Get grading type settings for subjects in a classroom.
   */
  @Get('grading-types/:classroomId')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Typy hodnocení třídy' })
  @ApiResponse({
    status: 200,
    description: 'Typy hodnocení pro třídu.',
    type: GradingTypeResponseDto,
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
  async getGradingTypes(
    @Req() req: any,
    @Param('classroomId') classroomId: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getGradingTypesForClassroom(
      req.user.schoolId,
      classroomId,
    );
  }

  // ─── BEHAVIOR GRADES ────────────────────────────────────────

  @Put('behavior')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Hodnocení chování' })
  @ApiBody({ type: BehaviorGradeDto })
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
  async upsertBehaviorGrade(
    @Req() req: any,
    @Body()
    body: {
      studentId: string;
      semesterId: string;
      grade: number;
      note?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.gradingService.upsertBehaviorGrade(req.user.schoolId, body);
  }

  @Get('behavior/:classroomId/:semesterId')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Hodnocení chování třídy' })
  @ApiResponse({
    status: 200,
    description: 'Hodnocení chování – pole.',
    type: BehaviorGradeResponseDto,
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
  async getBehaviorGrades(
    @Req() req: any,
    @Param('classroomId') classroomId: string,
    @Param('semesterId') semesterId: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getBehaviorGrades(
      req.user.schoolId,
      classroomId,
      semesterId,
    );
  }

  // ─── COMPETENCY GRADES ──────────────────────────────────────

  @Put('competency')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Hodnocení kompetence' })
  @ApiResponse({
    status: 200,
    description: 'Uložené hodnocení kompetence.',
    type: CompetencyGradeResponseDto,
  })
  @ApiBody({ type: CompetencyGradeDto })
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
  async upsertCompetencyGrade(
    @Req() req: any,
    @Body()
    body: {
      studentId: string;
      competencyId: string;
      subjectInstanceId: string;
      semesterId: string;
      level: number;
      note?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.gradingService.upsertCompetencyGrade(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Get('competency/:studentId')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
  )
  @ApiOperation({ summary: 'Kompetence studenta' })
  @ApiResponse({
    status: 200,
    description: 'Kompetence studenta – pole.',
    type: CompetencyGradeResponseDto,
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
  async getCompetencyGrades(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Query('semesterId') semesterId?: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getCompetencyGrades(
      req.user.schoolId,
      studentId,
      semesterId,
    );
  }

  // ─── EDUCATIONAL MEASURES ───────────────────────────────────

  @Post('measures')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Výchovné opatření (pochvala/důtka)' })
  @ApiResponse({
    status: 201,
    description: 'Vytvořené výchovné opatření.',
    type: MeasureResponseDto,
  })
  @ApiBody({ type: MeasureDto })
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
  async createMeasure(
    @Req() req: any,
    @Body()
    body: {
      studentId: string;
      type: string;
      reason: string;
      semesterId?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.gradingService.createMeasure(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Get('measures')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Seznam výchovných opatření' })
  @ApiResponse({
    status: 200,
    description: 'Seznam opatření – pole.',
    type: MeasureResponseDto,
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
  async getMeasures(
    @Req() req: any,
    @Query('classroomId') classroomId?: string,
    @Query('studentId') studentId?: string,
    @Query('semesterId') semesterId?: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getMeasures(req.user.schoolId, {
      classroomId,
      studentId,
      semesterId,
    });
  }

  @Delete('measures/:id')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Smazání výchovného opatření' })
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
  async deleteMeasure(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.gradingService.deleteMeasure(req.user.schoolId, id);
  }

  // ─── GRADE HISTORY ──────────────────────────────────────────

  @Get('history/:studentId/:subjectInstanceId')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Historie známek studenta' })
  @ApiResponse({
    status: 200,
    description: 'Historie změn známek – pole.',
    type: GradeHistoryEntryDto,
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
  async getGradeHistory(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Param('subjectInstanceId') subjectInstanceId: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getGradeHistory(
      req.user.schoolId,
      studentId,
      subjectInstanceId,
    );
  }

  // ─── REPORT CARD HTML EXPORT ────────────────────────────────

  @Get('report-cards-html/:classroomId/:semesterId')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Vysvědčení třídy (tisk HTML)' })
  @ApiResponse({ status: 200, description: 'HTML pro tisk vysvědčení.' })
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
  async getReportCardHtml(
    @Req() req: any,
    @Param('classroomId') classroomId: string,
    @Param('semesterId') semesterId: string,
  ) {
    this.ensureTenant(req);
    const html = await this.gradingService.getReportCardHtml(
      req.user.schoolId,
      classroomId,
      semesterId,
    );
    return { html };
  }

  // ─── COMMISSION EXAMS ───────────────────────────────────────

  @Post('commission-exams')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Vytvoření komisionálního přezkoušení' })
  @ApiResponse({
    status: 201,
    description: 'Vytvořené komisionální přezkoušení.',
    type: CommissionExamResponseDto,
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
  async createCommissionExam(
    @Req() req: any,
    @Body()
    body: {
      date: string;
      originalGrade: string;
      studentId: string;
      subjectInstanceId: string;
      semesterId: string;
      note?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.gradingService.createCommissionExam(req.user.schoolId, body);
  }

  @Get('commission-exams')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Komisionální přezkoušení' })
  @ApiResponse({
    status: 200,
    description: 'Komisionální přezkoušení – pole.',
    type: CommissionExamResponseDto,
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
  async getCommissionExams(
    @Req() req: any,
    @Query('classroomId') classroomId?: string,
    @Query('semesterId') semesterId?: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getCommissionExams(req.user.schoolId, {
      classroomId,
      semesterId,
    });
  }

  @Put('commission-exams/:id')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Aktualizace komisionálního přezkoušení' })
  @ApiResponse({
    status: 200,
    description: 'Aktualizované přezkoušení.',
    type: CommissionExamResponseDto,
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
  async updateCommissionExam(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { newGrade?: string; note?: string; date?: string },
  ) {
    this.ensureTenant(req);
    return this.gradingService.updateCommissionExam(
      req.user.schoolId,
      id,
      body,
    );
  }

  @Delete('commission-exams/:id')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Smazání komisionálního přezkoušení' })
  @ApiResponse({
    status: 200,
    description: 'Přezkoušení smazáno.',
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
  async deleteCommissionExam(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.gradingService.deleteCommissionExam(req.user.schoolId, id);
  }

  // ─── CLASSIFICATION DEADLINE ────────────────────────────────

  @Get('deadline/:semesterId')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.TEACHER)
  async getDeadline(@Req() req: any, @Param('semesterId') semesterId: string) {
    this.ensureTenant(req);
    return this.gradingService.getDeadline(req.user.schoolId, semesterId);
  }

  @Put('deadline')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  async upsertDeadline(
    @Req() req: any,
    @Body() body: { semesterId: string; deadline: string; isLocked?: boolean },
  ) {
    this.ensureTenant(req);
    return this.gradingService.upsertDeadline(req.user.schoolId, body);
  }

  @Post('deadline/lock')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  async lockClassification(
    @Req() req: any,
    @Body() body: { semesterId: string; lock: boolean },
  ) {
    this.ensureTenant(req);
    return this.gradingService.lockClassification(
      req.user.schoolId,
      body.semesterId,
      body.lock,
    );
  }
}
