import { Controller, Post, Get, Param, Body, UseGuards, Req, Res, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { AiChatService } from './ai-chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('ai')
@ApiBearerAuth('JWT-auth')
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
            provider?: string;
        },
    ) {
        if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
            throw new ForbiddenException('messages array is required.');
        }

        const userId = req.user.userId;
        let role = req.user.role || (req.user.isSystemAdmin ? 'SYSTEM_ADMIN' : 'STUDENT');
        if (role === 'ADMIN' || req.user.isSystemAdmin) role = 'SYSTEM_ADMIN';
        const schoolId = req.user.schoolId || null;
        const provider = body.provider || 'google-flash';
        const preferredLanguage = req.headers['accept-language']?.startsWith('en') ? 'English' : 'Czech';

        return this.aiChatService.chat(userId, role, schoolId, body.messages, provider, preferredLanguage);
    }

    /**
     * POST /api/ai/chat/stream
     * SSE streaming version — sends real-time progress events for tool calls.
     */
    @Post('chat/stream')
    async chatStream(
        @Req() req: any,
        @Res({ passthrough: false }) res: any,
        @Body() body: {
            messages: Array<{ role: 'user' | 'model'; text: string }>;
            provider?: string;
        },
    ) {
        if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
            res.status(400).json({ error: 'messages array is required.' });
            return;
        }

        const userId = req.user.userId;
        let role = req.user.role || (req.user.isSystemAdmin ? 'SYSTEM_ADMIN' : 'STUDENT');
        if (role === 'ADMIN' || req.user.isSystemAdmin) role = 'SYSTEM_ADMIN';
        const schoolId = req.user.schoolId || null;
        const provider = body.provider || 'google-flash';
        const preferredLanguage = req.headers['accept-language']?.startsWith('en') ? 'English' : 'Czech';

        // Setup SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
        res.flushHeaders();

        const sendEvent = (type: string, data: any) => {
            try {
                res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
            } catch (e) {
                // Client may have disconnected
            }
        };

        try {
            const result = await this.aiChatService.chatStream(
                userId, role, schoolId, body.messages, provider, preferredLanguage,
                (event) => sendEvent(event.type, event.data),
            );

            sendEvent('response', {
                text: result.response,
                usage: result.usage,
                dataChanged: result.dataChanged,
            });
        } catch (error: any) {
            sendEvent('error', {
                message: error.message || 'AI služba není dostupná.',
            });
        }

        sendEvent('done', {});
        res.end();
    }

    // ─── NEW AI FEATURES ────────────────────────────────────

    @Post('refine-text')
    async refineText(@Body() body: { existingText?: string; context: string; instruction: string }) {
        return this.aiService.refineText(body);
    }

    @Post('thematic-plan')
    async generateThematicPlan(@Body() body: {
        subjectName: string; grade: string; hoursPerWeek: number;
        semesterWeeks?: number; topics?: string;
    }) {
        return this.aiService.generateThematicPlan(body);
    }

    @Post('student-recommendations')
    async generateStudentRecommendations(@Body() body: {
        studentName: string;
        grades: Array<{ subject: string; grade: number }>;
        attendance?: { total: number; absent: number };
        behavior?: string;
    }) {
        return this.aiService.generateStudentRecommendations(body);
    }

    @Post('class-analysis')
    async analyzeClassPerformance(@Body() body: {
        className: string;
        grades: Array<{ student: string; subject: string; grade: number }>;
        subjectName?: string;
    }) {
        return this.aiService.analyzeClassPerformance(body);
    }

    @Post('generate-test')
    async generateTest(@Body() body: {
        subjectName: string; topic: string; grade: string;
        questionCount?: number; difficulty?: 'easy' | 'medium' | 'hard';
        questionTypes?: string;
    }) {
        return this.aiService.generateTest(body);
    }

    @Post('generate-written-test')
    async generateWrittenTest(@Body() body: {
        subjectName: string; topics: string[]; grade: string;
        duration?: number; variantCount?: number;
    }) {
        return this.aiService.generateWrittenTest(body);
    }
}
