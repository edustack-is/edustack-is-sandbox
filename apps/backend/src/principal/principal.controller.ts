import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/types';
import { PrincipalService } from './principal.service';

import { AuditLogEntryDto } from '../common/dto/response.dto';

@ApiTags('principal')
@ApiBearerAuth('JWT-auth')
@Controller('api/principal')
@UseGuards(JwtAuthGuard, RolesGuard)
// Audit log is the school leadership's view of who did what. Both the
// headmaster (PRINCIPAL) and their deputy (DEPUTY) need it. UserRole.ADMIN
// covers the school-admin role; system admins bypass RolesGuard via
// isSystemAdmin elsewhere.
@Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
export class PrincipalController {
  constructor(private readonly principalService: PrincipalService) {}

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
