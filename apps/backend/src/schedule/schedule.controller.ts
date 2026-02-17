import {
    Controller, Get, Post, Put, Delete,
    Body, Param, Query, Req, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, SubstitutionType } from '@prisma/client';
import { ScheduleService } from './schedule.service';

@Controller('api/schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleController {
    constructor(private readonly scheduleService: ScheduleService) { }

    // ─── LESSON TIME SLOTS ──────────────────────────────────────

    @Get('slots')
    @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
    async getTimeSlots(@Req() req: any) {
        this.ensureTenant(req);
        return this.scheduleService.getTimeSlots(req.user.schoolId);
    }

    @Put('slots')
    @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
    async upsertTimeSlots(
        @Req() req: any,
        @Body() body: { slots: { lessonNumber: number; startTime: string; endTime: string }[] },
    ) {
        this.ensureTenant(req);
        return this.scheduleService.upsertTimeSlots(req.user.schoolId, body.slots);
    }

    // ─── SCHEDULE EVENTS CRUD ───────────────────────────────────

    @Get('events')
    @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
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
    async createEvent(
        @Req() req: any,
        @Body() body: {
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
    async updateEvent(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: {
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
    async deleteEvent(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.scheduleService.deleteEvent(req.user.schoolId, id);
    }

    @Post('events/bulk')
    @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
    async bulkCreateEvents(
        @Req() req: any,
        @Body() body: {
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
        return this.scheduleService.bulkCreateEvents(req.user.schoolId, body.events);
    }

    @Post('validate')
    @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY)
    async validateCollision(
        @Req() req: any,
        @Body() body: {
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
    @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
    async getClassroomSchedule(
        @Req() req: any,
        @Param('id') classroomId: string,
        @Query('academicYearId') academicYearId?: string,
    ) {
        this.ensureTenant(req);
        return this.scheduleService.getClassroomSchedule(req.user.schoolId, classroomId, academicYearId);
    }

    @Get('view/teacher/:id')
    @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
    async getTeacherSchedule(
        @Req() req: any,
        @Param('id') teacherId: string,
        @Query('academicYearId') academicYearId?: string,
    ) {
        this.ensureTenant(req);
        return this.scheduleService.getTeacherSchedule(req.user.schoolId, teacherId, academicYearId);
    }

    @Get('view/student/:id')
    @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
    async getStudentSchedule(
        @Req() req: any,
        @Param('id') studentUserId: string,
        @Query('academicYearId') academicYearId?: string,
    ) {
        this.ensureTenant(req);
        return this.scheduleService.getStudentSchedule(req.user.schoolId, studentUserId, academicYearId);
    }

    // ─── SUBSTITUTIONS ──────────────────────────────────────────

    @Get('substitutions')
    @Roles(UserRole.ADMIN, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
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
    async createSubstitution(
        @Req() req: any,
        @Body() body: {
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
    async updateSubstitution(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: {
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
    async deleteSubstitution(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.scheduleService.deleteSubstitution(req.user.schoolId, id);
    }

    // ─── HELPERS ────────────────────────────────────────────────

    private ensureTenant(req: any) {
        if (req.user.type !== 'TENANT' || !req.user.schoolId) {
            throw new ForbiddenException('School context required.');
        }
    }
}
