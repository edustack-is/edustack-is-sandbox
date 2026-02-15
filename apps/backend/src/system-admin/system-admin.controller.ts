import { Controller, Post, Get, Patch, Put, Delete, Body, Param, UseGuards, BadRequestException, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsSystemAdminGuard } from './guards/is-system-admin.guard';
import { SystemAdminService } from './system-admin.service';
import { validateCreateSchoolDto } from './dto/create-school.dto';
import { SsoStrategyFactoryService } from '../auth/sso-strategy-factory.service';
import { SystemAdminSsoService } from './system-admin-sso.service';

@Controller('api/system')
@UseGuards(JwtAuthGuard, IsSystemAdminGuard)
export class SystemAdminController {
    constructor(
        private readonly systemAdminService: SystemAdminService,
        private readonly ssoStrategyFactory: SsoStrategyFactoryService,
        private readonly ssoService: SystemAdminSsoService,
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
        @Body() body: { name?: string; address?: string },
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
    demoteFromSysAdmin(@Req() req: any, @Param('id') id: string) {
        return this.systemAdminService.demoteFromSysAdmin(req.user.userId, id);
    }
}
