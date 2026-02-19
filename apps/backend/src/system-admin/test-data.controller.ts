import { Controller, Post, Delete, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth , ApiOperation , ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsSystemAdminGuard } from './guards/is-system-admin.guard';
import { TestDataService } from './test-data.service';
import type { GenerateConfig } from './test-data.service';

@ApiTags('system')
@ApiBearerAuth('JWT-auth')
@Controller('api/system/test-data')
@UseGuards(JwtAuthGuard, IsSystemAdminGuard)
export class TestDataController {
    constructor(private readonly testDataService: TestDataService) { }

    @Post('generate')
    @ApiOperation({ summary: 'Generování kompletních testovacích dat' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    async generateAll(@Body() body: GenerateConfig) {
        if (!body.schoolName || !body.schoolType) {
            throw new BadRequestException('schoolName and schoolType are required');
        }
        // Apply defaults
        const config: GenerateConfig = {
            schoolName: body.schoolName,
            schoolType: body.schoolType,
            teacherCount: body.teacherCount ?? 10,
            teacherActiveCount: body.teacherActiveCount ?? 8,
            teacherInvitedCount: body.teacherInvitedCount ?? 2,
            studentCount: body.studentCount ?? 50,
            studentActiveCount: body.studentActiveCount ?? 40,
            studentInvitedCount: body.studentInvitedCount ?? 10,
            parentCount: body.parentCount ?? 0,
            generateSubjects: body.generateSubjects !== false,
            generateSchedule: body.generateSchedule !== false,
            generateGrades: body.generateGrades !== false,
            generateCommunication: body.generateCommunication !== false,
        };
        return this.testDataService.generateAll(config);
    }

    @Delete('wipe/:schoolId')
    async wipeSchool(@Param('schoolId') schoolId: string) {
        if (!schoolId) throw new BadRequestException('schoolId is required');
        return this.testDataService.wipeSchoolData(schoolId);
    }

    @Delete('wipe-all')
    async wipeAll() {
        return this.testDataService.wipeAllData();
    }
}
