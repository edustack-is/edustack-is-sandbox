import {
    Controller, Get, Post, Put, Delete,
    Body, Param, UseGuards, Req, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DeputyService } from './deputy.service';

@Controller('api/deputy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DEPUTY, UserRole.PRINCIPAL)
export class DeputyController {
    constructor(private readonly deputyService: DeputyService) { }

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
    async createSubject(@Req() req: any, @Body() body: { name: string }) {
        this.ensureTenant(req);
        return this.deputyService.createSubject(req.user.userId, req.user.schoolId, body);
    }

    @Put('subjects/:id')
    async updateSubject(@Req() req: any, @Param('id') id: string, @Body() body: { name?: string }) {
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
    async createRoom(@Req() req: any, @Body() body: { name: string; capacity?: number; equipment?: string[] }) {
        this.ensureTenant(req);
        return this.deputyService.createRoom(req.user.userId, req.user.schoolId, body);
    }

    @Put('rooms/:id')
    async updateRoom(@Req() req: any, @Param('id') id: string, @Body() body: { name?: string; capacity?: number; equipment?: string[] }) {
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

    // ─── HELPER ──────────────────────────────────────────────────────

    private ensureTenant(req: any) {
        if (req.user.type !== 'TENANT' || !req.user.schoolId) {
            throw new ForbiddenException('School context required.');
        }
    }
}
