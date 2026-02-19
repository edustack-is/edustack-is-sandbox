import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Req, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DeputyCurriculumService } from './deputy-curriculum.service';
import { RvpImportService } from './rvp-import.service';
import type { RvpConfirmData } from './rvp-import.service';

@ApiTags('deputy')
@ApiBearerAuth('JWT-auth')
@Controller('api/deputy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.DEPUTY, UserRole.PRINCIPAL)
export class DeputyCurriculumController {
    constructor(
        private readonly curriculumService: DeputyCurriculumService,
        private readonly rvpImportService: RvpImportService,
    ) { }

    // ─── ACADEMIC YEARS ─────────────────────────────────────────────

    @Get('academic-years')
    async getAcademicYears(@Req() req: any) {
        this.ensureTenant(req);
        return this.curriculumService.getAcademicYears(req.user.schoolId);
    }

    @Post('academic-years')
    async createAcademicYear(
        @Req() req: any,
        @Body() body: { name: string; startDate: string; endDate: string; isCurrent?: boolean; curriculumVersionId?: string },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.createAcademicYear(
            req.user.userId, req.user.schoolId, body,
        );
    }

    // ─── GRADE LEVELS ───────────────────────────────────────────────

    @Get('grade-levels')
    async getGradeLevels(@Req() req: any) {
        this.ensureTenant(req);
        return this.curriculumService.getGradeLevels(req.user.schoolId);
    }

    @Post('grade-levels')
    async createGradeLevel(
        @Req() req: any,
        @Body() body: { name: string; levelNumber: number },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.createGradeLevel(
            req.user.userId, req.user.schoolId, body,
        );
    }

    @Put('grade-levels/:id')
    async updateGradeLevel(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: { name?: string; levelNumber?: number },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.updateGradeLevel(
            req.user.userId, req.user.schoolId, id, body,
        );
    }

    @Delete('grade-levels/:id')
    async deleteGradeLevel(
        @Req() req: any,
        @Param('id') id: string,
    ) {
        this.ensureTenant(req);
        return this.curriculumService.deleteGradeLevel(
            req.user.userId, req.user.schoolId, id,
        );
    }

    // ─── TEACHERS ───────────────────────────────────────────────────

    @Get('teachers')
    async getTeachers(@Req() req: any) {
        this.ensureTenant(req);
        return this.curriculumService.getTeachers(req.user.schoolId);
    }

    // ─── TEACHER WORKLOADS ──────────────────────────────────────────

    @Get('teacher-workloads')
    async getTeacherWorkloads(
        @Req() req: any,
        @Query('academicYearId') academicYearId: string,
    ) {
        this.ensureTenant(req);
        return this.curriculumService.getTeacherWorkloads(req.user.schoolId, academicYearId);
    }

    @Post('teacher-workloads')
    async saveTeacherWorkload(
        @Req() req: any,
        @Body() body: { teacherId: string; academicYearId: string; workloadPercentage: number },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.saveTeacherWorkload(
            req.user.userId, req.user.schoolId, body,
        );
    }

    // ─── SUBJECT INSTANCES ──────────────────────────────────────────

    @Get('subjects/instances')
    async getSubjectInstances(
        @Req() req: any,
        @Query('academicYearId') academicYearId: string,
    ) {
        this.ensureTenant(req);
        return this.curriculumService.getSubjectInstances(req.user.schoolId, academicYearId);
    }

    @Post('subjects/instances')
    async createSubjectInstance(
        @Req() req: any,
        @Body() body: {
            templateId: string;
            academicYearId: string;
            gradeLevelId: string;
            hoursPerWeek: number;
            curriculumVersionId?: string;
        },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.createSubjectInstance(
            req.user.userId, req.user.schoolId, body,
        );
    }

    // ─── CURRICULUM VERSIONING ──────────────────────────────────────

    @Get('curriculum-versions')
    async getCurriculumVersions(@Req() req: any) {
        this.ensureTenant(req);
        return this.curriculumService.getCurriculumVersions(req.user.schoolId);
    }

    @Get('curriculum-versions/compare')
    async compareCurriculumVersions(
        @Req() req: any,
        @Query('versionA') versionA: string,
        @Query('versionB') versionB: string,
    ) {
        this.ensureTenant(req);
        return this.curriculumService.compareCurriculumVersions(
            req.user.schoolId, versionA, versionB,
        );
    }

    @Get('curriculum-versions/:id')
    async getCurriculumVersion(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.curriculumService.getCurriculumVersion(req.user.schoolId, id);
    }

    @Post('curriculum-versions')
    async createCurriculumVersion(
        @Req() req: any,
        @Body() body: {
            name: string;
            validFrom: string;
            validTo?: string;
        },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.createCurriculumVersion(
            req.user.userId, req.user.schoolId, body,
        );
    }

    @Put('curriculum-versions/:id')
    async updateCurriculumVersion(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: {
            name?: string;
            validFrom?: string;
            validTo?: string | null;
        },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.updateCurriculumVersion(
            req.user.userId, req.user.schoolId, id, body,
        );
    }

    @Delete('curriculum-versions/:id')
    async deleteCurriculumVersion(
        @Req() req: any,
        @Param('id') id: string,
    ) {
        this.ensureTenant(req);
        return this.curriculumService.deleteCurriculumVersion(
            req.user.userId, req.user.schoolId, id,
        );
    }

    @Post('curriculum-versions/:id/duplicate')
    async duplicateCurriculumVersion(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: { name: string; validFrom: string; validTo?: string },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.duplicateCurriculumVersion(
            req.user.userId, req.user.schoolId, id, body,
        );
    }



    // ─── CURRICULUM ENTRIES (předmět × ročník) ──────────────────────

    @Post('curriculum-entries')
    async saveCurriculumEntry(
        @Req() req: any,
        @Body() body: {
            curriculumVersionId: string;
            subjectTemplateId: string;
            gradeLevelId: string;
            hoursPerWeek: number;
            rvpDescription?: string;
            svpApproach?: string;
            equipmentRequirements?: string[];
            needsComputerLab?: boolean;
            gradingType?: string;
        },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.saveCurriculumEntry(
            req.user.userId, req.user.schoolId, body,
        );
    }

    @Delete('curriculum-entries/:id')
    async deleteCurriculumEntry(
        @Req() req: any,
        @Param('id') id: string,
    ) {
        this.ensureTenant(req);
        return this.curriculumService.deleteCurriculumEntry(
            req.user.userId, req.user.schoolId, id,
        );
    }

    // ─── WHITE BOOK (read-only, all school users) ───────────────────

    @Get('white-book')
    async getWhiteBook(@Req() req: any) {
        this.ensureTenant(req);
        return this.curriculumService.getWhiteBookData(req.user.schoolId);
    }

    // ─── SEMESTERS ──────────────────────────────────────────────────

    @Get('semesters')
    async getSemesters(
        @Req() req: any,
        @Query('academicYearId') academicYearId: string,
    ) {
        this.ensureTenant(req);
        return this.curriculumService.getSemesters(req.user.schoolId, academicYearId);
    }

    @Post('semesters')
    async createSemesters(
        @Req() req: any,
        @Body() body: {
            academicYearId: string;
            semesters: Array<{ number: number; name: string; startDate: string; endDate: string }>;
        },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.createSemesters(
            req.user.userId, req.user.schoolId, body,
        );
    }

    @Post('enrollments/batch')
    async batchEnroll(
        @Req() req: any,
        @Body() body: {
            studentIds: string[];
            academicYearId: string;
            gradeLevelId: string;
            classroomId?: string;
        },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.batchEnroll(
            req.user.userId, req.user.schoolId, body,
        );
    }

    // ─── STAFF WORKLOADS ────────────────────────────────────────────

    @Get('staff')
    async getSchoolStaff(@Req() req: any) {
        this.ensureTenant(req);
        return this.curriculumService.getSchoolStaff(req.user.schoolId);
    }

    @Get('staff-workloads')
    async getStaffWorkloads(
        @Req() req: any,
        @Query('academicYearId') academicYearId: string,
    ) {
        this.ensureTenant(req);
        return this.curriculumService.getStaffWorkloads(req.user.schoolId, academicYearId);
    }

    @Post('staff-workloads')
    async createStaffWorkload(
        @Req() req: any,
        @Body() body: {
            userId: string;
            academicYearId: string;
            versionLabel: string;
            validFrom: string;
            teachingLoad: number;
            adminLoad: number;
            note?: string;
        },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.createStaffWorkload(
            req.user.userId, req.user.schoolId, body,
        );
    }

    @Put('staff-workloads/:id')
    async updateStaffWorkload(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: {
            versionLabel?: string;
            validFrom?: string;
            teachingLoad?: number;
            adminLoad?: number;
            note?: string | null;
        },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.updateStaffWorkload(
            req.user.userId, req.user.schoolId, id, body,
        );
    }

    @Delete('staff-workloads/:id')
    async deleteStaffWorkload(
        @Req() req: any,
        @Param('id') id: string,
    ) {
        this.ensureTenant(req);
        return this.curriculumService.deleteStaffWorkload(
            req.user.userId, req.user.schoolId, id,
        );
    }

    @Put('staff-workloads/:id/subjects')
    async saveStaffSubjectAssignments(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: {
            assignments: Array<{
                subjectTemplateId: string;
                gradeLevelIds: string[];
                canSubstitute: boolean;
            }>;
        },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.saveStaffSubjectAssignments(
            req.user.userId, req.user.schoolId, id, body.assignments,
        );
    }

    @Get('subject-templates')
    async getSubjectTemplates(@Req() req: any) {
        this.ensureTenant(req);
        return this.curriculumService.getSubjectTemplates(req.user.schoolId);
    }

    // ─── RVP IMPORT (AI-powered) ────────────────────────────────────

    @Post('rvp-import/analyze')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
    async analyzeRvp(
        @Req() req: any,
        @UploadedFile() file: any,
        @Body() body: { url?: string },
    ) {
        this.ensureTenant(req);
        const { schoolId, userId } = req.user;

        let documentText: string;

        if (file) {
            // PDF upload
            documentText = await this.rvpImportService.extractTextFromPdf(file.buffer);
        } else if (body.url) {
            // URL fetch
            documentText = await this.rvpImportService.extractTextFromUrl(body.url);
        } else {
            throw new BadRequestException('Zadejte URL nebo nahrajte PDF soubor.');
        }

        // AI extraction
        const extraction = await this.rvpImportService.extractRvpData(
            documentText,
            userId,
            schoolId,
        );

        // Build preview with matching
        return this.rvpImportService.buildPreview(extraction, schoolId);
    }

    @Post('rvp-import/confirm')
    async confirmRvpImport(
        @Req() req: any,
        @Body() body: RvpConfirmData,
    ) {
        this.ensureTenant(req);
        const { schoolId, userId } = req.user;
        return this.rvpImportService.confirmImport(userId, schoolId, body);
    }

    private ensureTenant(req: any) {
        if (req.user.type !== 'TENANT' || !req.user.schoolId) {
            throw new ForbiddenException('School context required.');
        }
    }
}
