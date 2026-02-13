import { Controller, Post, Get, Param, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiChatService } from './ai-chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
    constructor(
        private readonly aiService: AiService,
        private readonly aiChatService: AiChatService,
    ) { }

    @Post('seed/:classroomId')
    async seedClassroom(
        @Param('classroomId') classroomId: string,
        @Body('count') count?: number,
    ) {
        return this.aiService.seedClassroom(classroomId, count);
    }

    @Get('providers')
    async getProviders() {
        return this.aiChatService.getAvailableProviders();
    }

    /**
     * POST /api/ai/chat
     * Handles conversational AI with role-based context and function calling.
     */
    @Post('chat')
    async chat(
        @Req() req: any,
        @Body() body: {
            messages: Array<{ role: 'user' | 'model'; text: string }>;
            provider?: 'google' | 'openai' | 'anthropic';
        },
    ) {
        if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
            throw new ForbiddenException('messages array is required.');
        }

        const userId = req.user.userId;
        const role = req.user.role || (req.user.isSystemAdmin ? 'SYSTEM_ADMIN' : 'STUDENT');
        const schoolId = req.user.schoolId || null;
        const provider = body.provider || 'google';

        return this.aiChatService.chat(userId, role, schoolId, body.messages, provider);
    }
}
