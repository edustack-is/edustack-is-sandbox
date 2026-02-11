import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

@Injectable()
export class AiService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(private prisma: PrismaService) {
        this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    }

    async seedClassroom(classroomId: string, count: number = 5) {
        const prompt = `Generate ${count} Czech student names (firstName, lastName) in JSON format. Example: [{"firstName": "Jan", "lastName": "Novak"}, ...]`;

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from potential markdown code blocks
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\[([\s\S]*?)\]/);
        let studentsData = [];

        try {
            if (jsonMatch) {
                studentsData = JSON.parse(jsonMatch[1] ? jsonMatch[1] : jsonMatch[0]);
            } else {
                studentsData = JSON.parse(text);
            }
        } catch (e) {
            console.error('Failed to parse AI response', text);
            return { success: false, message: 'Failed to parse AI response' };
        }

        const createdStudents = [];

        for (const student of studentsData) {
            const email = `${student.firstName.toLowerCase()}.${student.lastName.toLowerCase()}.${crypto.randomBytes(2).toString('hex')}@skola.cz`;

            const user = await this.prisma.user.create({
                data: {
                    email,
                    passwordHash: 'seeded_password', // In real app, hash this
                    role: 'STUDENT',
                    studentProfile: {
                        create: {
                            firstName: student.firstName,
                            lastName: student.lastName,
                            classroomId,
                        },
                    },
                },
                include: {
                    studentProfile: true,
                },
            });
            createdStudents.push(user);
        }

        return { success: true, count: createdStudents.length, students: createdStudents };
    }
}
