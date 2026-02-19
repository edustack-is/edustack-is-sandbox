import { Controller, Post, Get, Patch, Put, Delete, Body, Param, UseGuards, BadRequestException, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsSystemAdminGuard } from './guards/is-system-admin.guard';
import { SystemAdminService } from './system-admin.service';
import { validateCreateSchoolDto } from './dto/create-school.dto';
import { SsoStrategyFactoryService } from '../auth/sso-strategy-factory.service';
import { SystemAdminSsoService } from './system-admin-sso.service';
import { SystemSettingsService } from './system-settings.service';

import { SuccessResponseDto } from '../common/dto/api.dto';
import { AuditLogEntryDto, SchoolResponseDto, SchoolUserResponseDto, SsoConfigResponseDto, SystemDashboardResponseDto, SystemSettingsResponseDto } from '../common/dto/response.dto';

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
    ) { }

    @Get('sso')
    getSsoSettings() {
        return this.ssoService.getSsoSettings();
    }

    @Put('sso/:provider')
    async updateSsoProvider(
        @Param('provider') provider: string,
        @Body() body: any,
    ) {
        return this.ssoService.upsertSsoProvider(provider, body);
    }

    @Post('sso/reload')
    async reloadSso() {
        await this.ssoStrategyFactory.reloadStrategies();
        return { message: 'SSO strategies reloaded successfully' };
    }

    @Get('dashboard')
    getDashboard() {
        return this.systemAdminService.getDashboardStats();
    }

    @Post('schools')
    createSchool(@Body() body: any) {
        try {
            const dto = validateCreateSchoolDto(body);
            return this.systemAdminService.createSchool(dto);
        } catch (e: any) {
            throw new BadRequestException(e.message);
        }
    }

    @Get('schools')
    getSchools() {
        return this.systemAdminService.getSchools();
    }

    @Patch('schools/:id')
    updateSchool(
        @Param('id') id: string,
        @Body() body: { name?: string; address?: string; requireSsoEmailMatch?: boolean },
        @Req() req: any
    ) {
        return this.systemAdminService.updateSchool(id, body, req.user.userId);
    }

    @Patch('schools/:id/settings')
    updateSettings(
        @Param('id') id: string,
        @Body('aiConfig') aiConfig?: any,
        @Body('ssoConfig') ssoConfig?: any,
    ) {
        return this.systemAdminService.updateSchoolSettings(id, aiConfig, ssoConfig);
    }

    @Post('schools/:id/admins')
    assignAdmin(
        @Param('id') id: string,
        @Body('email') email: string,
        @Body('firstName') firstName: string,
        @Body('lastName') lastName: string,
    ) {
        return this.systemAdminService.assignSchoolAdmin(id, email, firstName, lastName);
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
        @Req() req: any,
        @Body('email') email: string,
        @Body('firstName') firstName?: string,
        @Body('lastName') lastName?: string,
    ) {
        return this.systemAdminService.promoteToSysAdmin(req.user.userId, email, firstName, lastName);
    }

    @Delete('admins/:id')
    removeSystemAdmin(@Req() req: any, @Param('id') id: string) {
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
