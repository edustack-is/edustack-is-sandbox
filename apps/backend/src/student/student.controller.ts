import { Controller, Get, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { StudentService } from './student.service';

@Controller('api/student')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class StudentController {
    constructor(private readonly studentService: StudentService) { }

    @Get('my-data')
    async getMyData(@Req() req: any) {
        this.ensureTenantContext(req);
        return this.studentService.getMyData(req.user.userId, req.user.schoolId);
    }

    @Get('schedule')
    async getSchedule(@Req() req: any) {
        this.ensureTenantContext(req);
        return this.studentService.getSchedule(req.user.userId, req.user.schoolId);
    }

    /**
     * Ensures the request has a TENANT token (school context selected).
     */
    private ensureTenantContext(req: any) {
        if (req.user.type !== 'TENANT' || !req.user.schoolId) {
            throw new ForbiddenException('School context required. Please select a school first.');
        }
    }
}
