import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GradingService {
    constructor(private prisma: PrismaService) { }

    async calculateWeightedAverage(studentId: string, subjectInstanceId: string): Promise<number> {
        const grades = await this.prisma.grade.findMany({
            where: {
                studentId,
                subjectInstanceId,
            },
        });

        if (grades.length === 0) {
            return 0;
        }

        let totalWeightedScore = 0;
        let totalWeight = 0;

        for (const grade of grades) {
            const value = parseFloat(grade.value);
            if (!isNaN(value)) {
                totalWeightedScore += value * grade.weight;
                totalWeight += grade.weight;
            }
        }

        return totalWeight === 0 ? 0 : totalWeightedScore / totalWeight;
    }
}
