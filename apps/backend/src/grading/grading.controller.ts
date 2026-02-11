import { Controller, Get, Param } from '@nestjs/common';
import { GradingService } from './grading.service';

@Controller('api/grades')
export class GradingController {
    constructor(private readonly gradingService: GradingService) { }

    @Get('average/:studentId/:subjectId')
    async getAverage(
        @Param('studentId') studentId: string,
        @Param('subjectId') subjectId: string,
    ): Promise<{ average: number }> {
        const average = await this.gradingService.calculateWeightedAverage(studentId, subjectId);
        return { average };
    }
}
