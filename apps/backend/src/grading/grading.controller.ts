import {
    Controller, Get, Post, Put, Delete, Body, Param, Query,
    UseGuards, Req, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth , ApiOperation , ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { GradingService } from './grading.service';

@ApiTags('grading')
@ApiBearerAuth('JWT-auth')
@Controller('api/grading')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradingController {
    constructor(private readonly gradingService: GradingService) { }

    private ensureTenant(req: any) {
        if (req.user.type !== 'TENANT' || !req.user.schoolId) {
            throw new ForbiddenException('School context required.');
        }
    }

    private isAdmin(req: any): boolean {
        const role = req.user.role;
        return role === UserRole.PRINCIPAL || role === UserRole.DEPUTY || role === UserRole.ADMIN;
    }

    // ─── GRADE CRUD ─────────────────────────────────────────────

    /**
     * POST /api/grading/grades
     * Create a grade (teacher for subjects they teach; admin for any).
     */
    @Post('grades')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Vytvoření známky' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    async createGrade(
        @Req() req: any,
        @Body() body: {
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
        return this.gradingService.createGrade(req.user.userId, req.user.schoolId, body);
    }

    /**
     * PUT /api/grading/grades/:id
     * Update a grade (only the teacher who created it, or admin).
     */
    @Put('grades/:id')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Úprava známky' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async updateGrade(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: {
            value?: string;
            weight?: number;
            description?: string;
            verbalText?: string;
            category?: string;
        },
    ) {
        this.ensureTenant(req);
        return this.gradingService.updateGrade(req.user.userId, req.user.schoolId, id, body);
    }

    /**
     * DELETE /api/grading/grades/:id
     */
    @Delete('grades/:id')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Smazání známky' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async deleteGrade(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.gradingService.deleteGrade(req.user.userId, req.user.schoolId, id);
    }

    // ─── GRADE QUERIES ──────────────────────────────────────────

    /**
     * GET /api/grading/classroom/:id
     * Get grades grid for a classroom (teacher sees own subjects; admin sees all).
     */
    @Get('classroom/:id')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Známky třídy' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

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
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT)
    @ApiOperation({ summary: 'Známky studenta' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async getStudentGrades(
        @Req() req: any,
        @Param('id') studentId: string,
        @Query('semesterId') semesterId?: string,
    ) {
        this.ensureTenant(req);
        return this.gradingService.getStudentGrades(req.user.schoolId, studentId, semesterId);
    }

    /**
     * GET /api/grading/average/:studentId/:subjectInstanceId
     */
    @Get('average/:studentId/:subjectInstanceId')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT)
    @ApiOperation({ summary: 'Vážený průměr studenta za předmět' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async getAverage(
        @Req() req: any,
        @Param('studentId') studentId: string,
        @Param('subjectInstanceId') subjectInstanceId: string,
    ) {
        this.ensureTenant(req);
        const average = await this.gradingService.calculateWeightedAverage(studentId, subjectInstanceId);
        return { average };
    }

    // ─── REPORT CARDS ───────────────────────────────────────────

    /**
     * GET /api/grading/report-cards/:classroomId/:semesterId
     */
    @Get('report-cards/:classroomId/:semesterId')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Vysvědčení třídy za semestr' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async getReportCards(
        @Req() req: any,
        @Param('classroomId') classroomId: string,
        @Param('semesterId') semesterId: string,
    ) {
        this.ensureTenant(req);
        return this.gradingService.getReportCardsForClass(req.user.schoolId, classroomId, semesterId);
    }

    /**
     * POST /api/grading/report-cards
     * Create or update a report card entry.
     */
    @Post('report-cards')
    @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Uložení/aktualizace vysvědčení' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    async upsertReportCard(
        @Req() req: any,
        @Body() body: {
            studentId: string;
            subjectInstanceId: string;
            semesterId: string;
            finalGrade?: string;
            verbalEvaluation?: string;
            aiPolished?: boolean;
        },
    ) {
        this.ensureTenant(req);
        return this.gradingService.upsertReportCard(req.user.userId, req.user.schoolId, body);
    }

    // ─── AI POLISH ──────────────────────────────────────────────

    /**
     * POST /api/grading/ai-polish
     * AI polish verbal evaluation text.
     */
    @Post('ai-polish')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'AI vylepšení slovního hodnocení' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    async polishVerbalEvaluation(
        @Req() req: any,
        @Body() body: { text: string; studentName: string; subjectName: string },
    ) {
        this.ensureTenant(req);
        return this.gradingService.polishVerbalEvaluation(req.user.userId, req.user.schoolId, body);
    }

    // ─── GRADING TYPES ──────────────────────────────────────────

    /**
     * GET /api/grading/grading-types/:classroomId
     * Get grading type settings for subjects in a classroom.
     */
    @Get('grading-types/:classroomId')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Typy hodnocení třídy' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async getGradingTypes(
        @Req() req: any,
        @Param('classroomId') classroomId: string,
    ) {
        this.ensureTenant(req);
        return this.gradingService.getGradingTypesForClassroom(req.user.schoolId, classroomId);
    }

    // ─── BEHAVIOR GRADES ────────────────────────────────────────

    @Put('behavior')
    @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.TEACHER)
    @ApiOperation({ summary: 'Hodnocení chování' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async upsertBehaviorGrade(
        @Req() req: any,
        @Body() body: { studentId: string; semesterId: string; grade: number; note?: string },
    ) {
        this.ensureTenant(req);
        return this.gradingService.upsertBehaviorGrade(req.user.schoolId, body);
    }

    @Get('behavior/:classroomId/:semesterId')
    @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.TEACHER)
    @ApiOperation({ summary: 'Hodnocení chování třídy' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async getBehaviorGrades(
        @Req() req: any,
        @Param('classroomId') classroomId: string,
        @Param('semesterId') semesterId: string,
    ) {
        this.ensureTenant(req);
        return this.gradingService.getBehaviorGrades(req.user.schoolId, classroomId, semesterId);
    }

    // ─── COMPETENCY GRADES ──────────────────────────────────────

    @Put('competency')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Hodnocení kompetence' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    async upsertCompetencyGrade(
        @Req() req: any,
        @Body() body: {
            studentId: string; competencyId: string; subjectInstanceId: string;
            semesterId: string; level: number; note?: string;
        },
    ) {
        this.ensureTenant(req);
        return this.gradingService.upsertCompetencyGrade(req.user.userId, req.user.schoolId, body);
    }

    @Get('competency/:studentId')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT)
    @ApiOperation({ summary: 'Kompetence studenta' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async getCompetencyGrades(
        @Req() req: any,
        @Param('studentId') studentId: string,
        @Query('semesterId') semesterId?: string,
    ) {
        this.ensureTenant(req);
        return this.gradingService.getCompetencyGrades(req.user.schoolId, studentId, semesterId);
    }

    // ─── EDUCATIONAL MEASURES ───────────────────────────────────

    @Post('measures')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Výchovné opatření (pochvala/důtka)' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    async createMeasure(
        @Req() req: any,
        @Body() body: { studentId: string; type: string; reason: string; semesterId?: string },
    ) {
        this.ensureTenant(req);
        return this.gradingService.createMeasure(req.user.userId, req.user.schoolId, body);
    }

    @Get('measures')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Seznam výchovných opatření' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async getMeasures(
        @Req() req: any,
        @Query('classroomId') classroomId?: string,
        @Query('studentId') studentId?: string,
        @Query('semesterId') semesterId?: string,
    ) {
        this.ensureTenant(req);
        return this.gradingService.getMeasures(req.user.schoolId, { classroomId, studentId, semesterId });
    }

    @Delete('measures/:id')
    @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Smazání výchovného opatření' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async deleteMeasure(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.gradingService.deleteMeasure(req.user.schoolId, id);
    }

    // ─── GRADE HISTORY ──────────────────────────────────────────

    @Get('history/:studentId/:subjectInstanceId')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT)
    @ApiOperation({ summary: 'Historie známek studenta' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async getGradeHistory(
        @Req() req: any,
        @Param('studentId') studentId: string,
        @Param('subjectInstanceId') subjectInstanceId: string,
    ) {
        this.ensureTenant(req);
        return this.gradingService.getGradeHistory(req.user.schoolId, studentId, subjectInstanceId);
    }

    // ─── REPORT CARD HTML EXPORT ────────────────────────────────

    @Get('report-cards-html/:classroomId/:semesterId')
    @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Vysvědčení třídy (tisk HTML)' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async getReportCardHtml(
        @Req() req: any,
        @Param('classroomId') classroomId: string,
        @Param('semesterId') semesterId: string,
    ) {
        this.ensureTenant(req);
        const html = await this.gradingService.getReportCardHtml(req.user.schoolId, classroomId, semesterId);
        return { html };
    }

    // ─── COMMISSION EXAMS ───────────────────────────────────────

    @Post('commission-exams')
    @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Vytvoření komisionálního přezkoušení' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    async createCommissionExam(
        @Req() req: any,
        @Body() body: {
            date: string; originalGrade: string; studentId: string;
            subjectInstanceId: string; semesterId: string; note?: string;
        },
    ) {
        this.ensureTenant(req);
        return this.gradingService.createCommissionExam(req.user.schoolId, body);
    }

    @Get('commission-exams')
    @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Komisionální přezkoušení' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async getCommissionExams(
        @Req() req: any,
        @Query('classroomId') classroomId?: string,
        @Query('semesterId') semesterId?: string,
    ) {
        this.ensureTenant(req);
        return this.gradingService.getCommissionExams(req.user.schoolId, { classroomId, semesterId });
    }

    @Put('commission-exams/:id')
    @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Aktualizace komisionálního přezkoušení' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async updateCommissionExam(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: { newGrade?: string; note?: string; date?: string },
    ) {
        this.ensureTenant(req);
        return this.gradingService.updateCommissionExam(req.user.schoolId, id, body);
    }

    @Delete('commission-exams/:id')
    @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
    @ApiOperation({ summary: 'Smazání komisionálního přezkoušení' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

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
        return this.gradingService.lockClassification(req.user.schoolId, body.semesterId, body.lock);
    }
}
