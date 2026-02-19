import { Controller, Get, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth , ApiOperation , ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrincipalService } from './principal.service';

@ApiTags('principal')
@ApiBearerAuth('JWT-auth')
@Controller('api/principal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PRINCIPAL, UserRole.ADMIN)
export class PrincipalController {
    constructor(private readonly principalService: PrincipalService) { }

    /**
     * GET /api/principal/audit-logs?page=1&limit=20
     * Returns paginated audit log entries for the current school.
     * Accessible by Principal and System Admin (ADMIN role).
     */
    @Get('audit-logs')
    async getAuditLogs(
        @Req() req: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        this.ensureTenant(req);
        return this.principalService.getAuditLogs(
            req.user.schoolId,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
    }

    private ensureTenant(req: any) {
        if (req.user.type !== 'TENANT' || !req.user.schoolId) {
            throw new ForbiddenException('School context required.');
        }
    }
}
