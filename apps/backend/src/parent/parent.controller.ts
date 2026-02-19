import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ParentService } from './parent.service';

@ApiTags('parent')
@ApiBearerAuth('JWT-auth')
@Controller('api/parent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT)
export class ParentController {
    constructor(private readonly parentService: ParentService) { }

    /**
     * GET /api/parent/children
     * Returns all children linked to the authenticated parent.
     * Works across all schools (uses global identity).
     */
    @Get('children')
    async getChildren(@Req() req: any) {
        return this.parentService.getChildren(req.user.userId);
    }

    /**
     * GET /api/parent/child/:studentId/dashboard
     * Returns a child's dashboard data (grades, schedule, profile).
     * Verifies ownership — returns 403 if student doesn't belong to this parent.
     */
    @Get('child/:studentId/dashboard')
    async getChildDashboard(
        @Param('studentId') studentId: string,
        @Req() req: any,
    ) {
        return this.parentService.getChildDashboard(req.user.userId, studentId);
    }
}
