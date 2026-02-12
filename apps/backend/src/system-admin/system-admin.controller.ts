import { Controller, Post, Get, Patch, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsSystemAdminGuard } from './guards/is-system-admin.guard';
import { SystemAdminService } from './system-admin.service';
import { validateCreateSchoolDto } from './dto/create-school.dto';

@Controller('api/system/schools')
@UseGuards(JwtAuthGuard, IsSystemAdminGuard)
export class SystemAdminController {
    constructor(private readonly systemAdminService: SystemAdminService) { }

    @Post()
    createSchool(@Body() body: any) {
        try {
            const dto = validateCreateSchoolDto(body);
            return this.systemAdminService.createSchool(dto);
        } catch (e: any) {
            throw new BadRequestException(e.message);
        }
    }

    @Get()
    getSchools() {
        return this.systemAdminService.getSchools();
    }

    @Patch(':id/settings')
    updateSettings(
        @Param('id') id: string,
        @Body('aiConfig') aiConfig?: any,
        @Body('ssoConfig') ssoConfig?: any,
    ) {
        return this.systemAdminService.updateSchoolSettings(id, aiConfig, ssoConfig);
    }

    @Post(':id/admins')
    assignAdmin(
        @Param('id') id: string,
        @Body('email') email: string,
        @Body('firstName') firstName: string,
        @Body('lastName') lastName: string,
    ) {
        return this.systemAdminService.assignSchoolAdmin(id, email, firstName, lastName);
    }
}
