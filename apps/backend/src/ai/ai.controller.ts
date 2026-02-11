import { Controller, Post, Param, Body } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('api/ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('seed/:classroomId')
    async seedClassroom(
        @Param('classroomId') classroomId: string,
        @Body('count') count?: number,
    ) {
        return this.aiService.seedClassroom(classroomId, count);
    }
}
