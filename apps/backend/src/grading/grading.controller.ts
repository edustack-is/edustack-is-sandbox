import { Controller, Get, Param, UseInterceptors } from '@nestjs/common';
import { GradingService } from './grading.service';
import { LogSensitiveRead } from '../auth/log-sensitive-read.decorator';
import { LogSensitiveReadInterceptor } from '../auth/log-sensitive-read.interceptor';

@Controller('api/grades')
export class GradingController {
    constructor(private readonly gradingService: GradingService) { }

    @Get('average/:studentId/:subjectInstanceId')
    @UseInterceptors(LogSensitiveReadInterceptor)
    @LogSensitiveRead()
    async getAverage(
        @Param('studentId') studentId: string,
        @Param('subjectInstanceId') subjectInstanceId: string,
    ): Promise<{ average: number }> {
        const average = await this.gradingService.calculateWeightedAverage(studentId, subjectInstanceId);
        return { average };
    }
}
