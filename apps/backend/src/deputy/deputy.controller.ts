import {
    Controller, Get, Post, Put, Patch, Delete,
    Body, Param, UseGuards, Req, ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DeputyService } from './deputy.service';

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
    async createRoom(@Req() req: any, @Body() body: { name: string; capacity?: number; isComputerLab?: boolean; specialEquipment?: string[] }) {
        this.ensureTenant(req);
        return this.deputyService.createRoom(req.user.userId, req.user.schoolId, body);
    }

    @Put('rooms/:id')
    async updateRoom(@Req() req: any, @Param('id') id: string, @Body() body: { name?: string; capacity?: number; isComputerLab?: boolean; specialEquipment?: string[] }) {
        this.ensureTenant(req);
        return this.deputyService.updateRoom(req.user.userId, req.user.schoolId, id, body);
    }

    @Delete('rooms/:id')
    async deleteRoom(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.deputyService.deleteRoom(req.user.userId, req.user.schoolId, id);
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

    // ─── HELPER ──────────────────────────────────────────────────────

    private ensureTenant(req: any) {
        if (req.user.type !== 'TENANT' || !req.user.schoolId) {
            throw new ForbiddenException('School context required.');
        }
    }
}
