import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
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
import { ParentService } from './parent.service';

import {
  ChildDashboardResponseDto,
  ParentChildResponseDto,
} from '../common/dto/response.dto';
@ApiTags('parent')
@ApiBearerAuth('JWT-auth')
@Controller('api/parent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT)
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  /**
   * GET /api/parent/children
   * Returns all children linked to the authenticated parent.
   * Works across all schools (uses global identity).
   */
  @Get('children')
  @ApiOperation({ summary: 'Seznam dětí rodiče' })
  @ApiResponse({
    status: 200,
    description: 'Děti rodiče – pole.',
    type: ParentChildResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
  })
  @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })
  async getChildren(@Req() req: any) {
    return this.parentService.getChildren(req.user.userId);
  }

  /**
   * GET /api/parent/child/:studentId/dashboard
   * Returns a child's dashboard data (grades, schedule, profile).
   * Verifies ownership — returns 403 if student doesn't belong to this parent.
   */
  @Get('child/:studentId/dashboard')
  @ApiOperation({ summary: 'Dashboard dítěte' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard dítěte – profil, známky, rozvrh.',
    type: ChildDashboardResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
  })
  @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })
  async getChildDashboard(
    @Param('studentId') studentId: string,
    @Req() req: any,
  ) {
    return this.parentService.getChildDashboard(req.user.userId, studentId);
  }
}
