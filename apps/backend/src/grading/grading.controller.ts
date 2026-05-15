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
  CreateCommissionExamDto,
  CreateGradeDto,
  GradeResponseDto,
  LockClassificationDto,
  MeasureDto,
  PolishTextDto,
  SuccessResponseDto,
  UpdateCommissionExamDto,
  UpdateGradeDto,
  UpsertDeadlineDto,
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
  StudentDataResponseDto,
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

  @Post('grades')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Vytvoření známky' })
  @ApiResponse({ status: 201, type: GradeResponseDto })
  @ApiBody({ type: CreateGradeDto })
  async createGrade(@Req() req: any, @Body() body: CreateGradeDto) {
    this.ensureTenant(req);
    return this.gradingService.createGrade(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Put('grades/:id')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Úprava známky' })
  @ApiResponse({ status: 200, type: GradeResponseDto })
  @ApiBody({ type: UpdateGradeDto })
  async updateGrade(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateGradeDto,
  ) {
    this.ensureTenant(req);
    return this.gradingService.updateGrade(
      req.user.userId,
      req.user.schoolId,
      id,
      body,
    );
  }

  @Delete('grades/:id')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Smazání známky' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  async deleteGrade(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.gradingService.deleteGrade(
      req.user.userId,
      req.user.schoolId,
      id,
    );
  }

  // ─── GRADE QUERIES ──────────────────────────────────────────

  @Get('classroom/:id')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Známky třídy' })
  @ApiResponse({ status: 200, type: GradeResponseDto, isArray: true })
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

  @Get('student/:id')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Známky studenta' })
  @ApiResponse({ status: 200, type: StudentDataResponseDto })
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

  @Get('average/:studentId/:subjectInstanceId')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
  )
  @ApiOperation({ summary: 'Vážený průměr studenta za předmět' })
  async getAverage(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Param('subjectInstanceId') subjectInstanceId: string,
    @Query('semesterId') semesterId?: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getWeightedAverage(
      req.user.schoolId,
      studentId,
      subjectInstanceId,
      semesterId,
    );
  }

  // ─── REPORT CARDS ───────────────────────────────────────────

  @Get('report-cards/:classroomId/:semesterId')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Vysvědčení třídy za semestr' })
  @ApiResponse({ status: 200, type: ReportCardResponseDto, isArray: true })
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

  @Post('report-cards')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Uložení/aktualizace vysvědčení' })
  @ApiResponse({ status: 200, type: ReportCardResponseDto })
  @ApiBody({ type: UpsertReportCardDto })
  async upsertReportCard(@Req() req: any, @Body() body: UpsertReportCardDto) {
    this.ensureTenant(req);
    return this.gradingService.upsertReportCard(req.user.schoolId, body);
  }

  // ─── AI POLISH ──────────────────────────────────────────────

  @Post('ai-polish')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'AI vylepšení slovního hodnocení' })
  @ApiResponse({ status: 200, type: AiTextResponseDto })
  @ApiBody({ type: PolishTextDto })
  async polishVerbalEvaluation(
    @Req() req: any,
    @Body() body: { text: string },
  ) {
    this.ensureTenant(req);
    return this.gradingService.polishVerbalEvaluation(body.text);
  }

  // ─── GRADING TYPES ──────────────────────────────────────────

  @Get('grading-types/:classroomId')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Typy hodnocení třídy' })
  @ApiResponse({ status: 200, type: GradingTypeResponseDto, isArray: true })
  async getGradingTypes(
    @Req() req: any,
    @Param('classroomId') classroomId: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getGradingTypesForClassroom(classroomId);
  }

  // ─── BEHAVIOR GRADES ────────────────────────────────────────

  @Put('behavior')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Hodnocení chování' })
  @ApiBody({ type: BehaviorGradeDto })
  async upsertBehaviorGrade(@Req() req: any, @Body() body: BehaviorGradeDto) {
    this.ensureTenant(req);
    return this.gradingService.upsertBehaviorGrade(req.user.schoolId, body);
  }

  @Get('behavior/:classroomId/:semesterId')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Hodnocení chování třídy' })
  @ApiResponse({ status: 200, type: BehaviorGradeResponseDto, isArray: true })
  async getBehaviorGrades(
    @Req() req: any,
    @Param('classroomId') classroomId: string,
    @Param('semesterId') semesterId: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getBehaviorGrades(req.user.schoolId, {
      classroomId,
      semesterId,
    });
  }

  // ─── COMPETENCY GRADES ──────────────────────────────────────

  @Put('competency')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Hodnocení kompetence' })
  @ApiResponse({ status: 200, type: CompetencyGradeResponseDto })
  @ApiBody({ type: CompetencyGradeDto })
  async upsertCompetencyGrade(
    @Req() req: any,
    @Body() body: CompetencyGradeDto,
  ) {
    this.ensureTenant(req);
    return this.gradingService.upsertCompetencyGrade(
      req.user.schoolId,
      req.user.userId,
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
  @ApiResponse({ status: 200, type: CompetencyGradeResponseDto, isArray: true })
  async getCompetencyGrades(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Query('semesterId') semesterId?: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getCompetencyGrades(req.user.schoolId, {
      studentId,
      semesterId,
    });
  }

  // ─── EDUCATIONAL MEASURES ───────────────────────────────────

  @Post('measures')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Výchovné opatření (pochvala/důtka)' })
  @ApiResponse({ status: 201, type: MeasureResponseDto })
  @ApiBody({ type: MeasureDto })
  async createMeasure(@Req() req: any, @Body() body: MeasureDto) {
    this.ensureTenant(req);
    return this.gradingService.createMeasure(
      req.user.schoolId,
      req.user.userId,
      body,
    );
  }

  @Get('measures')
  @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Seznam výchovných opatření' })
  @ApiResponse({ status: 200, type: MeasureResponseDto, isArray: true })
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
  async deleteMeasure(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.gradingService.deleteMeasure(req.user.schoolId, id);
  }

  // ─── GRADE HISTORY ──────────────────────────────────────────

  @Get('history/:studentId')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'Historie známek studenta' })
  @ApiResponse({ status: 200, type: GradeHistoryEntryDto, isArray: true })
  async getGradeHistory(
    @Req() req: any,
    @Param('studentId') studentId: string,
  ) {
    this.ensureTenant(req);
    return this.gradingService.getGradeHistory(req.user.schoolId, studentId);
  }

  // ─── REPORT CARD HTML EXPORT ────────────────────────────────

  @Get('report-cards-html/:studentId/:semesterId')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Vysvědčení (tisk HTML)' })
  @ApiResponse({ status: 200, description: 'HTML pro tisk vysvědčení.' })
  async getReportCardHtml(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Param('semesterId') semesterId: string,
  ) {
    this.ensureTenant(req);
    const html = await this.gradingService.getReportCardHtml(
      studentId,
      semesterId,
    );
    return { html };
  }

  // ─── COMMISSION EXAMS ───────────────────────────────────────

  @Post('commission-exams')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Vytvoření komisionálního přezkoušení' })
  @ApiResponse({ status: 201, type: CommissionExamResponseDto })
  async createCommissionExam(
    @Req() req: any,
    @Body() body: CreateCommissionExamDto,
  ) {
    this.ensureTenant(req);
    return this.gradingService.createCommissionExam(req.user.schoolId, body);
  }

  @Get('commission-exams')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Komisionální přezkoušení' })
  @ApiResponse({ status: 200, type: CommissionExamResponseDto, isArray: true })
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
  @ApiResponse({ status: 200, type: CommissionExamResponseDto })
  async updateCommissionExam(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateCommissionExamDto,
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
  @ApiResponse({ status: 200, type: SuccessResponseDto })
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
  async upsertDeadline(@Req() req: any, @Body() body: UpsertDeadlineDto) {
    this.ensureTenant(req);
    return this.gradingService.upsertDeadline(req.user.schoolId, body);
  }

  @Post('deadline/lock')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  async lockClassification(
    @Req() req: any,
    @Body() body: LockClassificationDto,
  ) {
    this.ensureTenant(req);
    return this.gradingService.lockClassification(
      req.user.schoolId,
      body.semesterId,
      body.lock,
    );
  }
}
