import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenAI, Type } from '@google/genai';
import { decrypt } from './ai-crypto.util';

// ─── Role-based system instructions ─────────────────────────────

const BASE_INSTRUCTION =
    'Jsi AI asistent v rámci školního systému EduStack. Tvým úkolem je pomáhat uživatelům s používáním aplikace, vysvětlováním funkcí, popisem dat v systému nebo (pro technické role) s architekturou a API. Odmítni odpovídat na obecné dotazy netýkající se EduStacku, školní agendy nebo uložených dat. Komunikuj vždy česky.';

const SYSTEM_INSTRUCTIONS: Record<string, string> = {
    SYSTEM_ADMIN:
        `${BASE_INSTRUCTION} Jsi expertní asistent pro správce. Můžeš detailně popisovat architekturu (NestJS, Prisma, React, Tailwind), vysvětlovat API endpointy a pomáhat s SQL dotazy či debugováním.`,
    PRINCIPAL:
        `${BASE_INSTRUCTION} Pomáhej řediteli s orientací v datech školy, vysvětlováním statistik a reportů.`,
    DEPUTY:
        `${BASE_INSTRUCTION} Pomáhej zástupci s tvorbou úvazků a správou rozvrhu v aplikaci.`,
    TEACHER:
        `${BASE_INSTRUCTION} Pomáhej učitelům s ovládáním klasifikace a prací s jejich žáky. Pokud se zeptají na známky konkrétního žáka, použij funkci fetchStudentGrades.`,
    STUDENT:
        `${BASE_INSTRUCTION} Pomáhej studentům pochopit jejich hodnocení a orientovat se v rozvrhu. Pokud chtějí vysvětlit látku, odkaž je na studijní materiály v systému, ale negeneruj za ně úkoly.`,
    PARENT:
        `${BASE_INSTRUCTION} Pomáhej rodičům najít informace o docházce a známkách jejich dětí.`,
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
        let response;
        try {
            response = await genAI.models.generateContent({
                model: 'gemini-2.0-flash',
                contents,
                config: {
                    systemInstruction,
                    tools,
                },
            });
        } catch (error: any) {
            console.error('Gemini API Error:', error);
            if (error.status === 429 || error.code === 429 || error.message?.includes('429')) {
                throw new ServiceUnavailableException('AI je momentálně přetížená (Rate Limit). Zkuste to prosím za chvíli.');
            }
            throw new ServiceUnavailableException('Chyba při komunikaci s AI službou.');
        }

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
