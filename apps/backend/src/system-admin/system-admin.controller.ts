import { Controller, Post, Get, Patch, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsSystemAdminGuard } from './guards/is-system-admin.guard';
import { SystemAdminService } from './system-admin.service';
import { validateCreateSchoolDto } from './dto/create-school.dto';

@Controller('api/system')
@UseGuards(JwtAuthGuard, IsSystemAdminGuard)
export class SystemAdminController {
    constructor(private readonly systemAdminService: SystemAdminService) { }

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
}
