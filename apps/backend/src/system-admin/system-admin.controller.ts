import {
  Controller,
  Post,
  Get,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole, User } from '../database/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsSystemAdminGuard } from './guards/is-system-admin.guard';
import { SystemAdminService } from './system-admin.service';
import { validateCreateSchoolDto } from './dto/create-school.dto';
import { SsoStrategyFactoryService } from '../auth/sso-strategy-factory.service';
import {
  SystemAdminSsoService,
  UpsertSsoDto,
} from './system-admin-sso.service';
import { SystemSettingsService } from './system-settings.service';
import { SystemAdminAiService } from './system-admin-ai.service';
import { AiUsageResponseDto } from '../common/dto/response.dto';

interface UserRequest extends Request {
  user: { userId: string; email: string; isSystemAdmin: boolean };
}

@ApiTags('system')
@ApiBearerAuth('JWT-auth')
@Controller('api/system')
@UseGuards(JwtAuthGuard, IsSystemAdminGuard)
export class SystemAdminController {
  constructor(
    private readonly systemAdminService: SystemAdminService,
    private readonly ssoStrategyFactory: SsoStrategyFactoryService,
    private readonly ssoService: SystemAdminSsoService,
    private readonly settingsService: SystemSettingsService,
    private readonly aiService: SystemAdminAiService,
  ) {}

  // ─── SSO SETTINGS ───────────────────────────────────────────────

  @Get('sso')
  getSsoSettings() {
    return this.ssoService.getSsoSettings();
  }

  @Put('sso/:provider')
  async updateSsoProvider(
    @Param('provider') provider: string,
    @Body() body: UpsertSsoDto,
  ) {
    return this.ssoService.upsertSsoProvider(provider, body);
  }

  @Delete('sso/:provider')
  async deleteSsoProvider(@Param('provider') provider: string) {
    return this.ssoService.removeSsoProvider(provider);
  }

  @Post('sso/reload')
  async reloadSso() {
    await this.ssoStrategyFactory.reloadStrategies();
    return { message: 'SSO strategies reloaded successfully' };
  }

  // ─── AI SETTINGS ────────────────────────────────────────────────

  /**
   * PUT /api/system/settings/ai
   * Upserts the Gemini API key (encrypted at rest).
   */
  @Put('settings/ai')
  async updateAiSettings(
    @Body()
    body: {
      geminiApiKey?: string;
      openAiApiKey?: string;
      anthropicApiKey?: string;
      opencodeApiKey?: string;
    },
  ) {
    const providedKeys = [
      body.geminiApiKey,
      body.openAiApiKey,
      body.anthropicApiKey,
      body.opencodeApiKey,
    ];

    if (providedKeys.every((k) => k === undefined)) {
      throw new BadRequestException('At least one API key must be provided.');
    }

    for (const key of providedKeys) {
      if (key !== undefined && key !== '' && key.length < 10) {
        throw new BadRequestException(
          'API keys must be at least 10 characters long.',
        );
      }
    }

    return this.aiService.upsertAiSettings({
      geminiApiKey: body.geminiApiKey?.trim(),
      openAiApiKey: body.openAiApiKey?.trim(),
      anthropicApiKey: body.anthropicApiKey?.trim(),
      opencodeApiKey: body.opencodeApiKey?.trim(),
    });
  }

  /**
   * GET /api/system/settings/ai
   * Returns configuration status with masked key.
   */
  @Get('settings/ai')
  async getAiSettings() {
    return this.aiService.getAiSettings();
  }

  /**
   * GET /api/system/ai-usage
   * Returns aggregated token usage for the current month.
   */
  @Get('ai-usage')
  @ApiOperation({ summary: 'Spotřeba AI' })
  @ApiResponse({
    status: 200,
    description: 'Statistiky spotřeby AI.',
    type: AiUsageResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
  })
  async getAiUsage() {
    return this.aiService.getAiUsage();
  }

  // ─── SYSTEM DASHBOARD ───────────────────────────────────────────

  @Get('dashboard')
  getDashboard() {
    return this.systemAdminService.getDashboardStats();
  }

  @Post('schools')
  createSchool(@Body() body: Record<string, unknown>) {
    try {
      const dto = validateCreateSchoolDto(body);
      return this.systemAdminService.createSchool(dto);
    } catch (e: unknown) {
      const error = e as Error;
      throw new BadRequestException(error.message);
    }
  }

  @Get('schools')
  getSchools() {
    return this.systemAdminService.getSchools();
  }

  @Patch('schools/:id')
  updateSchool(
    @Param('id') id: string,
    @Body()
    body: { name?: string; address?: string; requireSsoEmailMatch?: boolean },
    @Req() req: UserRequest,
  ) {
    return this.systemAdminService.updateSchool(id, body, req.user.userId);
  }

  @Patch('schools/:id/settings')
  updateSettings(
    @Param('id') id: string,
    @Body('aiConfig') aiConfig?: Record<string, unknown>,
    @Body('ssoConfig') ssoConfig?: Record<string, unknown>,
  ) {
    return this.systemAdminService.updateSchoolSettings(
      id,
      aiConfig,
      ssoConfig,
    );
  }

  @Post('schools/:id/admins')
  assignAdmin(
    @Req() req: any,
    @Param('id') id: string,
    @Body('userId') userId: string,
  ) {
    return this.systemAdminService.assignSchoolAdmin(
      id,
      userId,
      req.user.userId,
    );
  }

  @Delete('schools/:id')
  deleteSchool(@Param('id') id: string) {
    return this.systemAdminService.deleteSchool(id);
  }

  // ─── SYSTEM ADMIN MANAGEMENT ─────────────────────────────────────

  @Get('admins')
  getSystemAdmins() {
    return this.systemAdminService.getSystemAdmins();
  }

  @Post('admins')
  promoteToSysAdmin(
    @Req() req: UserRequest,
    @Body('email') email: string,
    @Body('firstName') firstName?: string,
    @Body('lastName') lastName?: string,
  ) {
    return this.systemAdminService.promoteToSysAdmin(
      req.user.userId,
      email,
      firstName,
      lastName,
    );
  }

  @Delete('admins/:id')
  removeSystemAdmin(@Req() req: UserRequest, @Param('id') id: string) {
    return this.systemAdminService.removeSystemAdmin(req.user.userId, id);
  }

  // ─── SYSTEM SETTINGS ─────────────────────────────────────────────

  @Get('settings')
  getSystemSettings() {
    return this.settingsService.getAll();
  }

  @Put('settings')
  updateSystemSettings(@Body() body: Record<string, string>) {
    return this.settingsService.setMany(body);
  }
}
