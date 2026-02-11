import { Controller, Post, Body } from '@nestjs/common';
import { ScheduleService } from './schedule.service';

@Controller('api/schedule')
export class ScheduleController {
    constructor(private readonly scheduleService: ScheduleService) { }

    @Post('validate')
    async validate(@Body() body: {
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        teacherId: string;
        classroomId: string;
    }) {
        return this.scheduleService.validateCollision(
            body.dayOfWeek,
            body.startTime,
            body.endTime,
            body.teacherId,
            body.classroomId,
        );
    }
}
