import { Controller, Post, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DeputyCurriculumService } from './deputy-curriculum.service';

@Controller('api/deputy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DEPUTY, UserRole.PRINCIPAL)
export class DeputyCurriculumController {
    constructor(private readonly curriculumService: DeputyCurriculumService) { }

    /**
     * POST /api/deputy/academic-years
     * Creates a new academic year for the school.
     */
    @Post('academic-years')
    async createAcademicYear(
        @Req() req: any,
        @Body() body: { name: string; startDate: string; endDate: string; isCurrent?: boolean },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.createAcademicYear(
            req.user.userId, req.user.schoolId, body,
        );
    }

    /**
     * POST /api/deputy/subjects/instances
     * Assigns a SubjectTemplate to a GradeLevel + AcademicYear with hoursPerWeek.
     */
    @Post('subjects/instances')
    async createSubjectInstance(
        @Req() req: any,
        @Body() body: { templateId: string; academicYearId: string; gradeLevelId: string; hoursPerWeek: number },
    ) {
        this.ensureTenant(req);
        return this.curriculumService.createSubjectInstance(
            req.user.userId, req.user.schoolId, body,
        );
    }

    /**
     * POST /api/deputy/enrollments/batch
     * Batch-enrolls students into a specific academic year + grade level.
     */
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

    private ensureTenant(req: any) {
        if (req.user.type !== 'TENANT' || !req.user.schoolId) {
            throw new ForbiddenException('School context required.');
        }
    }
}
