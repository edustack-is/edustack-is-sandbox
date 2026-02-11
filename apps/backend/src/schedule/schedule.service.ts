import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ScheduleEvent } from '@prisma/client';

@Injectable()
export class ScheduleService {
    constructor(private prisma: PrismaService) { }

    async validateCollision(
        dayOfWeek: number,
        startTime: string,
        endTime: string,
        teacherId: string,
        classroomId: string,
    ): Promise<{ valid: boolean; message?: string }> {
        // Check for teacher collision
        const teacherCollision = await this.prisma.scheduleEvent.findFirst({
            where: {
                teacherId,
                dayOfWeek,
                OR: [
                    { startTime: { lte: startTime }, endTime: { gt: startTime } },
                    { startTime: { lt: endTime }, endTime: { gte: endTime } },
                    { startTime: { gte: startTime }, endTime: { lte: endTime } },
                ],
            },
        });

        if (teacherCollision) {
            return { valid: false, message: 'Teacher is already teaching at this time.' };
        }

        // Check for classroom collision
        const classroomCollision = await this.prisma.scheduleEvent.findFirst({
            where: {
                classroomId,
                dayOfWeek,
                OR: [
                    { startTime: { lte: startTime }, endTime: { gt: startTime } },
                    { startTime: { lt: endTime }, endTime: { gte: endTime } },
                    { startTime: { gte: startTime }, endTime: { lte: endTime } },
                ],
            },
        });

        if (classroomCollision) {
            return { valid: false, message: 'Classroom is occupied at this time.' };
        }

        return { valid: true };
    }
}
