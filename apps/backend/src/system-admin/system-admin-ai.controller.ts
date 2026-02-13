import { Controller, Get, Put, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsSystemAdminGuard } from './guards/is-system-admin.guard';
import { SystemAdminAiService } from './system-admin-ai.service';

@Controller('api/system')
@UseGuards(JwtAuthGuard, IsSystemAdminGuard)
export class SystemAdminAiController {
    constructor(private readonly aiService: SystemAdminAiService) { }

    /**
     * PUT /api/system/settings/ai
     * Upserts the Gemini API key (encrypted at rest).
     */
    @Put('settings/ai')
    async updateAiSettings(@Body() body: { geminiApiKey: string }) {
        if (!body.geminiApiKey || typeof body.geminiApiKey !== 'string' || body.geminiApiKey.trim().length < 10) {
            throw new BadRequestException('A valid geminiApiKey is required (min 10 characters).');
        }
        return this.aiService.upsertAiSettings(body.geminiApiKey.trim());
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
