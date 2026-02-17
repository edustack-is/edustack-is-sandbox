import {
    Controller, Get, Post, Put, Delete, Body, Param, Query,
    UseGuards, Req, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { GradingService } from './grading.service';

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
    async getGradingTypes(
        @Req() req: any,
        @Param('classroomId') classroomId: string,
    ) {
        this.ensureTenant(req);
        return this.gradingService.getGradingTypesForClassroom(req.user.schoolId, classroomId);
    }
}
