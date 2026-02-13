import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenAI, Type } from '@google/genai';
import { decrypt } from './ai-crypto.util';

// ─── Role-based system instructions ─────────────────────────────

const SYSTEM_INSTRUCTIONS: Record<string, string> = {
    SYSTEM_ADMIN:
        'Jsi AI asistent pro správce systému EduStack. Můžeš odpovídat na dotazy ohledně architektury systému (Node.js, Prisma, NestJS) a správy škol. Komunikuj česky, stručně a profesionálně.',
    PRINCIPAL:
        'Jsi AI asistent pro ředitele školy. Můžeš pomoci s organizací školy, analýzou dat a přípravou dokumentů. Komunikuj česky.',
    DEPUTY:
        'Jsi AI asistent zástupce ředitele. Můžeš pomoci s kurikulem, rozvrhem a organizací výuky. Komunikuj česky.',
    TEACHER:
        'Jsi AI asistent učitele. Můžeš pomoci generovat testy, analyzovat prospěch žáků a připravovat výukové materiály. Když tě někdo požádá o prospěch žáka, použij funkci fetchStudentGrades. Komunikuj česky.',
    STUDENT:
        'Jsi AI tutor pro studenty. Pomáháš s učením, vysvětluješ látku a odpovídáš na otázky. Neposkytuj odpovědi na testy, ale navádej studenta ke správnému řešení. Komunikuj česky.',
    PARENT:
        'Jsi AI asistent pro rodiče. Můžeš odpovídat na dotazy ohledně prospěchu a docházky dítěte. Komunikuj česky.',
};

// ─── Function declarations for Gemini ───────────────────────────

const FETCH_STUDENT_GRADES_DECLARATION = {
    name: 'fetchStudentGrades',
    description: 'Načte známky studenta z databáze. Vrací předmět, známku, váhu a datum.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            studentId: {
                type: Type.STRING,
                description: 'UUID identifikátor studenta (StudentProfile ID)',
            },
        },
        required: ['studentId'],
    },
};

@Injectable()
export class AiChatService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── CHAT ───────────────────────────────────────────────────

    async chat(
        userId: string,
        role: string,
        schoolId: string | null,
        messages: Array<{ role: 'user' | 'model'; text: string }>,
    ) {
        // 1. Fetch API key from SystemSettings
        const apiKey = await this.getApiKey();

        // 2. Build system instruction
        const systemInstruction = SYSTEM_INSTRUCTIONS[role] || SYSTEM_INSTRUCTIONS.STUDENT;

        // 3. Build tools list — teachers and above get function calling
        const tools = ['TEACHER', 'DEPUTY', 'PRINCIPAL', 'SYSTEM_ADMIN'].includes(role)
            ? [{ functionDeclarations: [FETCH_STUDENT_GRADES_DECLARATION] }]
            : [];

        // 4. Initialize Gemini client
        const genAI = new GoogleGenAI({ apiKey });

        // 5. Convert message history to Gemini format
        const contents = messages.map((m) => ({
            role: m.role === 'model' ? ('model' as const) : ('user' as const),
            parts: [{ text: m.text }],
        }));

        // 6. Call Gemini
        let response = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents,
            config: {
                systemInstruction,
                tools,
            },
        });

        // 7. Handle function calling loop
        let loopCount = 0;
        while (response.functionCalls && response.functionCalls.length > 0 && loopCount < 3) {
            loopCount++;
            const functionCall = response.functionCalls[0];

            if (functionCall.name === 'fetchStudentGrades') {
                const args = functionCall.args as { studentId: string };
                const gradesData = await this.executeFetchStudentGrades(args.studentId);

                // Add the model's function call and the function response to contents
                contents.push({
                    role: 'model' as const,
                    parts: [{ functionCall: { name: functionCall.name, args: functionCall.args } }] as any,
                });
                contents.push({
                    role: 'user' as const,
                    parts: [{
                        functionResponse: {
                            name: functionCall.name,
                            response: { result: gradesData },
                        },
                    }] as any,
                });

                // Call Gemini again with the function response
                response = await genAI.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents,
                    config: {
                        systemInstruction,
                        tools,
                    },
                });
            } else {
                break; // Unknown function, stop loop
            }
        }

        // 8. Extract response text
        const responseText = response.text ?? '';

        // 9. Track token usage
        const usage = response.usageMetadata;
        if (usage) {
            await this.prisma.aiTokenUsage.create({
                data: {
                    userId,
                    schoolId,
                    inputTokens: usage.promptTokenCount ?? 0,
                    outputTokens: usage.candidatesTokenCount ?? 0,
                    totalTokens: usage.totalTokenCount ?? 0,
                    promptType: 'CHAT',
                },
            });
        }

        return {
            response: responseText,
            usage: usage
                ? {
                    inputTokens: usage.promptTokenCount ?? 0,
                    outputTokens: usage.candidatesTokenCount ?? 0,
                    totalTokens: usage.totalTokenCount ?? 0,
                }
                : null,
        };
    }

    // ─── FUNCTION IMPLEMENTATIONS ───────────────────────────────

    private async executeFetchStudentGrades(studentId: string) {
        const grades = await this.prisma.grade.findMany({
            where: { studentId },
            include: {
                subjectInstance: {
                    include: { template: true },
                },
            },
            orderBy: { date: 'desc' },
            take: 50,
        });

        return grades.map((g: any) => ({
            subject: g.subjectInstance?.template?.name ?? 'Neznámý předmět',
            value: g.value,
            weight: g.weight,
            description: g.description,
            gradedAt: g.date.toISOString(),
        }));
    }

    // ─── HELPERS ────────────────────────────────────────────────

    private async getApiKey(): Promise<string> {
        // Decrypt from SystemSettings
        const settings = await this.prisma.systemSettings.findUnique({
            where: { id: 'global' },
        });

        if (settings?.geminiApiKey) {
            try {
                return decrypt(settings.geminiApiKey);
            } catch {
                // If decryption fails, try as plain text
                return settings.geminiApiKey;
            }
        }

        // Fallback to env variable
        const envKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
        if (envKey) return envKey;

        throw new ServiceUnavailableException(
            'AI is not configured. Ask your System Admin to set the Gemini API key.',
        );
    }
}
