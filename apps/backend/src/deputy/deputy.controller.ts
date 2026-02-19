import {
    Controller, Get, Post, Put, Patch, Delete,
    Body, Param, Query, Res, UseGuards, Req, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DeputyService } from './deputy.service';

@ApiTags('deputy')
@ApiBearerAuth('JWT-auth')
@Controller('api/deputy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.DEPUTY, UserRole.PRINCIPAL)
export class DeputyController {
    constructor(
        private readonly deputyService: DeputyService,
        private readonly jwtService: JwtService,
    ) { }

    // ─── SCHOOL DASHBOARD (all roles) ────────────────────────────────

    @Get('dashboard')
    @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
    async getSchoolDashboard(@Req() req: any) {
        this.ensureTenant(req);
        return this.deputyService.getSchoolDashboard(req.user.schoolId);
    }

    // ─── CLASSROOM ───────────────────────────────────────────────────

    @Get('classrooms')
    async getClassrooms(@Req() req: any) {
        this.ensureTenant(req);
        return this.deputyService.getClassrooms(req.user.schoolId);
    }

    @Post('classrooms')
    async createClassroom(@Req() req: any, @Body() body: { name: string; grade: number }) {
        this.ensureTenant(req);
        return this.deputyService.createClassroom(req.user.userId, req.user.schoolId, body);
    }

    @Put('classrooms/:id')
    async updateClassroom(@Req() req: any, @Param('id') id: string, @Body() body: { name?: string; grade?: number }) {
        this.ensureTenant(req);
        return this.deputyService.updateClassroom(req.user.userId, req.user.schoolId, id, body);
    }

    @Delete('classrooms/:id')
    async deleteClassroom(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.deleteClassroom(req.user.userId, req.user.schoolId, id);
    }

    // ─── SUBJECT ─────────────────────────────────────────────────────

    @Get('subjects')
    async getSubjects(@Req() req: any) {
        this.ensureTenant(req);
        return this.deputyService.getSubjects(req.user.schoolId);
    }

    @Post('subjects')
    async createSubject(@Req() req: any, @Body() body: { name: string; code: string; svpDescription?: string }) {
        this.ensureTenant(req);
        return this.deputyService.createSubject(req.user.userId, req.user.schoolId, body);
    }

    @Put('subjects/:id')
    async updateSubject(@Req() req: any, @Param('id') id: string, @Body() body: { name?: string; code?: string; svpDescription?: string }) {
        this.ensureTenant(req);
        return this.deputyService.updateSubject(req.user.userId, req.user.schoolId, id, body);
    }

    @Delete('subjects/:id')
    async deleteSubject(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.deleteSubject(req.user.userId, req.user.schoolId, id);
    }

    // ─── ROOM ────────────────────────────────────────────────────────

    @Get('rooms')
    async getRooms(@Req() req: any) {
        this.ensureTenant(req);
        return this.deputyService.getRooms(req.user.schoolId);
    }

    @Post('rooms')
    async createRoom(@Req() req: any, @Body() body: { name: string; capacity?: number; isComputerLab?: boolean; specialEquipment?: string[]; buildingId?: string; floor?: number }) {
        this.ensureTenant(req);
        return this.deputyService.createRoom(req.user.userId, req.user.schoolId, body);
    }

    @Put('rooms/:id')
    async updateRoom(@Req() req: any, @Param('id') id: string, @Body() body: { name?: string; capacity?: number; isComputerLab?: boolean; specialEquipment?: string[]; buildingId?: string | null; floor?: number | null }) {
        this.ensureTenant(req);
        return this.deputyService.updateRoom(req.user.userId, req.user.schoolId, id, body);
    }

    @Delete('rooms/:id')
    async deleteRoom(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.deleteRoom(req.user.userId, req.user.schoolId, id);
    }

    // ─── BUILDING ────────────────────────────────────────────────────

    @Get('buildings')
    async getBuildings(@Req() req: any) {
        this.ensureTenant(req);
        return this.deputyService.getBuildings(req.user.schoolId);
    }

    @Post('buildings')
    async createBuilding(@Req() req: any, @Body() body: { name: string; address?: string; floors?: number }) {
        this.ensureTenant(req);
        return this.deputyService.createBuilding(req.user.userId, req.user.schoolId, body);
    }

    @Put('buildings/:id')
    async updateBuilding(@Req() req: any, @Param('id') id: string, @Body() body: { name?: string; address?: string; floors?: number }) {
        this.ensureTenant(req);
        return this.deputyService.updateBuilding(req.user.userId, req.user.schoolId, id, body);
    }

    @Delete('buildings/:id')
    async deleteBuilding(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.deleteBuilding(req.user.userId, req.user.schoolId, id);
    }

    // ─── ROOM SHARING ────────────────────────────────────────────────

    @Post('rooms/:id/share')
    async shareRoom(@Req() req: any, @Param('id') roomId: string, @Body() body: { targetSchoolId: string }) {
        this.ensureTenant(req);
        return this.deputyService.shareRoom(req.user.userId, req.user.schoolId, roomId, body.targetSchoolId);
    }

    @Delete('rooms/:id/share/:schoolId')
    async unshareRoom(@Req() req: any, @Param('id') roomId: string, @Param('schoolId') targetSchoolId: string) {
        this.ensureTenant(req);
        return this.deputyService.unshareRoom(req.user.userId, req.user.schoolId, roomId, targetSchoolId);
    }

    @Get('shared-rooms')
    async getSharedRooms(@Req() req: any) {
        this.ensureTenant(req);
        return this.deputyService.getSharedRooms(req.user.schoolId);
    }

    // ─── SCHOOL EVENTS ───────────────────────────────────────────────

    @Get('events')
    @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
    async getEvents(@Req() req: any) {
        this.ensureTenant(req);
        return this.deputyService.getEvents(req.user.schoolId);
    }

    @Get('events/upcoming')
    @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
    async getUpcomingEvents(@Req() req: any, @Query('limit') limit?: string) {
        this.ensureTenant(req);
        return this.deputyService.getUpcomingEvents(req.user.schoolId, limit ? Number(limit) : 10);
    }

    @Post('events')
    async createEvent(@Req() req: any, @Body() body: { title: string; description?: string; date: string; endDate?: string; type?: string; allDay?: boolean }) {
        this.ensureTenant(req);
        return this.deputyService.createEvent(req.user.userId, req.user.schoolId, body);
    }

    @Put('events/:id')
    async updateEvent(@Req() req: any, @Param('id') id: string, @Body() body: { title?: string; description?: string; date?: string; endDate?: string; type?: string; allDay?: boolean }) {
        this.ensureTenant(req);
        return this.deputyService.updateEvent(req.user.userId, req.user.schoolId, id, body);
    }

    @Delete('events/:id')
    async deleteEvent(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.deleteEvent(req.user.userId, req.user.schoolId, id);
    }

    // ─── USER INVITATION ─────────────────────────────────────────────

    @Post('users/invite')
    async inviteUser(
        @Req() req: any,
        @Body() body: {
            email: string;
            firstName: string;
            lastName: string;
            role: UserRole;
            workloadPercentage?: number;
        },
    ) {
        this.ensureTenant(req);
        return this.deputyService.inviteUser(req.user.userId, req.user.schoolId, body);
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
        @Body() body: {
            student: { firstName: string; lastName: string; email?: string };
            parents: Array<{ firstName: string; lastName: string; email: string; phone?: string }>;
        },
    ) {
        this.ensureTenant(req);
        return this.deputyService.createStudentFamily(req.user.userId, req.user.schoolId, body);
    }

    // ─── STAFF CREATION ─────────────────────────────────────────────

    @Post('users/staff')
    async createStaff(
        @Req() req: any,
        @Body() body: {
            firstName: string;
            lastName: string;
            email: string;
            role: 'TEACHER' | 'DEPUTY';
            workloadPercentage: number;
        },
    ) {
        this.ensureTenant(req);
        return this.deputyService.createStaff(req.user.userId, req.user.schoolId, body);
    }

    @Post('users/:id/resend-invitation')
    async resendInvitation(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.resendInvitation(req.user.userId, req.user.schoolId, id);
    }

    // ─── REMOVE USER FROM SCHOOL ────────────────────────────────────

    @Delete('users/:id')
    async removeUser(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.removeSchoolUser(req.user.userId, req.user.schoolId, id);
    }

    // ─── SET STUDENT AS ALUMNI ────────────────────────────────────────

    @Patch('users/:id/alumni')
    async setAlumni(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.setAlumniStatus(req.user.userId, req.user.schoolId, id);
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
        @Body() body: { firstName?: string; lastName?: string; email?: string; workloadPercentage?: number },
    ) {
        this.ensureTenant(req);
        return this.deputyService.updateSchoolUser(req.user.userId, req.user.schoolId, id, body);
    }

    // ─── SUSPEND / REACTIVATE ───────────────────────────────────────

    @Patch('users/:id/suspend')
    async suspendUser(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.suspendUser(req.user.userId, req.user.schoolId, id);
    }

    @Patch('users/:id/reactivate')
    async reactivateUser(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.reactivateUser(req.user.userId, req.user.schoolId, id);
    }

    // ─── CHANGE ROLE ────────────────────────────────────────────────

    @Patch('users/:id/role')
    async changeUserRole(@Req() req: any, @Param('id') id: string, @Body() body: { role: string }) {
        this.ensureTenant(req);
        return this.deputyService.changeUserRole(req.user.userId, req.user.schoolId, id, body.role);
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
    async createThematicPlan(@Req() req: any, @Body() body: {
        title: string; subjectTemplateId: string; academicYearId: string; gradeLevelId: string;
    }) {
        this.ensureTenant(req);
        return this.deputyService.createThematicPlan(req.user.userId, req.user.schoolId, body);
    }

    @Put('thematic-plans/:id')
    async updateThematicPlan(@Req() req: any, @Param('id') id: string, @Body() body: { title?: string }) {
        this.ensureTenant(req);
        return this.deputyService.updateThematicPlan(req.user.userId, req.user.schoolId, id, body);
    }

    @Delete('thematic-plans/:id')
    async deleteThematicPlan(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.deleteThematicPlan(req.user.userId, req.user.schoolId, id);
    }

    @Put('thematic-plans/:id/weeks')
    async saveThematicPlanWeeks(@Req() req: any, @Param('id') id: string, @Body() body: {
        weeks: Array<{ weekNumber: number; topic: string; objectives?: string; methods?: string; resources?: string; crossCurricular?: string; notes?: string }>;
    }) {
        this.ensureTenant(req);
        return this.deputyService.saveThematicPlanWeeks(req.user.userId, req.user.schoolId, id, body.weeks);
    }

    // ─── LESSON PREPARATIONS ─────────────────────────────────────────

    @Get('lesson-preparations')
    async getLessonPreparations(@Req() req: any, @Query('subjectTemplateId') subjectTemplateId?: string) {
        this.ensureTenant(req);
        return this.deputyService.getLessonPreparations(req.user.schoolId, {
            subjectTemplateId, teacherId: req.user.userId,
        });
    }

    @Post('lesson-preparations')
    async createLessonPreparation(@Req() req: any, @Body() body: {
        title: string; date: string; duration?: number; topic: string; objectives?: string;
        activities?: string; materials?: string; homework?: string; evaluation?: string;
        subjectTemplateId: string;
    }) {
        this.ensureTenant(req);
        return this.deputyService.createLessonPreparation(req.user.userId, req.user.schoolId, body);
    }

    @Put('lesson-preparations/:id')
    async updateLessonPreparation(@Req() req: any, @Param('id') id: string, @Body() body: {
        title?: string; date?: string; duration?: number; topic?: string; objectives?: string;
        activities?: string; materials?: string; homework?: string; evaluation?: string;
    }) {
        this.ensureTenant(req);
        return this.deputyService.updateLessonPreparation(req.user.userId, req.user.schoolId, id, body);
    }

    @Delete('lesson-preparations/:id')
    async deleteLessonPreparation(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.deleteLessonPreparation(req.user.userId, req.user.schoolId, id);
    }

    // ─── TEACHING MATERIALS ──────────────────────────────────────────

    @Get('teaching-materials')
    async getTeachingMaterials(@Req() req: any, @Query('subjectTemplateId') sub?: string, @Query('type') type?: string) {
        this.ensureTenant(req);
        return this.deputyService.getTeachingMaterials(req.user.schoolId, { subjectTemplateId: sub, type });
    }

    @Post('teaching-materials')
    async createTeachingMaterial(@Req() req: any, @Body() body: {
        title: string; description?: string; url: string; type?: string;
        subjectTemplateId?: string; gradeLevelId?: string;
    }) {
        this.ensureTenant(req);
        return this.deputyService.createTeachingMaterial(req.user.userId, req.user.schoolId, body);
    }

    @Put('teaching-materials/:id')
    async updateTeachingMaterial(@Req() req: any, @Param('id') id: string, @Body() body: {
        title?: string; description?: string; url?: string; type?: string;
        subjectTemplateId?: string | null; gradeLevelId?: string | null;
    }) {
        this.ensureTenant(req);
        return this.deputyService.updateTeachingMaterial(req.user.userId, req.user.schoolId, id, body);
    }

    @Delete('teaching-materials/:id')
    async deleteTeachingMaterial(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.deleteTeachingMaterial(req.user.userId, req.user.schoolId, id);
    }

    // ─── RVP COMPETENCIES & MAPPINGS ─────────────────────────────────

    @Get('competencies')
    async getRvpCompetencies(@Req() req: any) {
        this.ensureTenant(req);
        return this.deputyService.getRvpCompetencies(req.user.schoolId);
    }

    @Post('competencies')
    async createRvpCompetency(@Req() req: any, @Body() body: {
        code: string; name: string; area: string; description?: string;
    }) {
        this.ensureTenant(req);
        return this.deputyService.createRvpCompetency(req.user.userId, req.user.schoolId, body);
    }

    @Put('competencies/:id')
    async updateRvpCompetency(@Req() req: any, @Param('id') id: string, @Body() body: {
        code?: string; name?: string; area?: string; description?: string;
    }) {
        this.ensureTenant(req);
        return this.deputyService.updateRvpCompetency(req.user.userId, req.user.schoolId, id, body);
    }

    @Delete('competencies/:id')
    async deleteRvpCompetency(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.deleteRvpCompetency(req.user.userId, req.user.schoolId, id);
    }

    @Get('competency-mappings')
    async getCompetencyMappings(@Req() req: any, @Query('subjectTemplateId') sub?: string, @Query('gradeLevelId') gl?: string) {
        this.ensureTenant(req);
        return this.deputyService.getCompetencyMappings(req.user.schoolId, { subjectTemplateId: sub, gradeLevelId: gl });
    }

    @Post('competency-mappings')
    async upsertCompetencyMapping(@Req() req: any, @Body() body: {
        competencyId: string; subjectTemplateId: string; gradeLevelId: string;
        fulfilled: boolean; note?: string;
    }) {
        this.ensureTenant(req);
        return this.deputyService.upsertCompetencyMapping(req.user.userId, req.user.schoolId, body);
    }

    @Delete('competency-mappings/:id')
    async deleteCompetencyMapping(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.deleteCompetencyMapping(req.user.userId, req.user.schoolId, id);
    }

    // ─── HELPER ──────────────────────────────────────────────────────

    private ensureTenant(req: any) {
        if (req.user.type !== 'TENANT' || !req.user.schoolId) {
            throw new ForbiddenException('School context required.');
        }
    }
}
