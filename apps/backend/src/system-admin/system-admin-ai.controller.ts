import { Controller, Get, Put, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsSystemAdminGuard } from './guards/is-system-admin.guard';
import { SystemAdminAiService } from './system-admin-ai.service';

@ApiTags('system')
@ApiBearerAuth('JWT-auth')
@Controller('api/system')
@UseGuards(JwtAuthGuard, IsSystemAdminGuard)
export class SystemAdminAiController {
    constructor(private readonly aiService: SystemAdminAiService) { }

    /**
     * PUT /api/system/settings/ai
     * Upserts the Gemini API key (encrypted at rest).
     */
    @Put('settings/ai')
    async updateAiSettings(@Body() body: {
        geminiApiKey?: string;
        openAiApiKey?: string;
        anthropicApiKey?: string;
    }) {
        if (
            (!body.geminiApiKey && !body.openAiApiKey && !body.anthropicApiKey) ||
            (body.geminiApiKey && body.geminiApiKey.length < 10) ||
            (body.openAiApiKey && body.openAiApiKey.length < 10) ||
            (body.anthropicApiKey && body.anthropicApiKey.length < 10)
        ) {
            throw new BadRequestException('At least one valid API key (min 10 chars) is required.');
        }

        return this.aiService.upsertAiSettings({
            geminiApiKey: body.geminiApiKey?.trim(),
            openAiApiKey: body.openAiApiKey?.trim(),
            anthropicApiKey: body.anthropicApiKey?.trim(),
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
    async getAiUsage() {
        return this.aiService.getAiUsage();
    }
}
