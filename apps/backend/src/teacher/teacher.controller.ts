import { Controller, Get, Post, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, AttendanceStatus } from '@prisma/client';
import { TeacherService } from './teacher.service';
import { GradeResponseDto , SuccessResponseDto } from '../common/dto/api.dto';

import { ScheduleMatrixResponseDto, TeacherClassResponseDto } from '../common/dto/response.dto';
@ApiTags('teacher')
@ApiBearerAuth('JWT-auth')
@Controller('api/teacher')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class TeacherController {
    constructor(private readonly teacherService: TeacherService) { }

    /**
     * GET /api/teacher/my-schedule
     * Returns a unified schedule across ALL schools. Ignores current school context.
     */
    @Get('my-schedule')
    @ApiOperation({ summary: 'Rozvrh učitele (všechny školy)' })
    @ApiResponse({ status: 200, description: 'Rozvrh učitele napříč školami – matice.', type: ScheduleMatrixResponseDto })
    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })
    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    async getMySchedule(@Req() req: any) {
        return this.teacherService.getMySchedule(req.user.userId);
    }

    /**
     * GET /api/teacher/classes
     * Returns classes and students the teacher teaches within the current school.
     */
    @Get('classes')
    @ApiOperation({ summary: 'Třídy a studenti učitele' })
    @ApiResponse({ status: 200, description: 'Třídy a studenti učitele – pole.', type: TeacherClassResponseDto, isArray: true })
    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })
    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    async getClasses(@Req() req: any) {
        this.ensureTenantContext(req);
        return this.teacherService.getClasses(req.user.userId, req.user.schoolId);
    }

    /**
     * POST /api/teacher/grades
     * Creates a grade for a student. Validates teacher authority.
     */
    @Post('grades')
    @ApiOperation({ summary: 'Zadání známky studentovi' })
    @ApiResponse({ status: 201, description: 'Vytvořená známka.', type: GradeResponseDto })
    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })
    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })
    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    async createGrade(
        @Req() req: any,
        @Body() body: { studentId: string; subjectInstanceId: string; value: string; weight: number; description?: string },
    ) {
        this.ensureTenantContext(req);
        return this.teacherService.createGrade(req.user.userId, req.user.schoolId, body);
    }

    /**
     * POST /api/teacher/attendance
     * Records attendance for a student. Validates teacher authority.
     */
    @Post('attendance')
    @ApiOperation({ summary: 'Záznam docházky studenta' })
    @ApiResponse({ status: 201, description: 'Docházka zaznamenána.', type: SuccessResponseDto })
    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })
    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })
    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    async createAttendance(
        @Req() req: any,
        @Body() body: { studentId: string; status: AttendanceStatus; date?: string; note?: string },
    ) {
        this.ensureTenantContext(req);
        return this.teacherService.createAttendance(req.user.userId, req.user.schoolId, body);
    }

    private ensureTenantContext(req: any) {
        if (req.user.type !== 'TENANT' || !req.user.schoolId) {
            throw new ForbiddenException('School context required. Please select a school first.');
        }
    }
}
