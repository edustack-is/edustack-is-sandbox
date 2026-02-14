import { Injectable, ServiceUnavailableException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../utils/crypto.service';
import { SecretType } from '@prisma/client';
import { generateText, tool, ToolSet, jsonSchema } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { EventSource } from 'eventsource';

// ─── Role-based system instructions ─────────────────────────────

const BASE_INSTRUCTION =
    'Jsi AI asistent v rámci školního systému EduStack. Tvým úkolem je pomáhat uživatelům s používáním aplikace, vysvětlováním funkcí, popisem dat v systému nebo (pro technické role) s architekturou a API. Odmítni odpovídat na obecné dotazy netýkající se EduStacku, školní agendy nebo uložených dat. Komunikuj vždy česky.';

const SYSTEM_INSTRUCTIONS: Record<string, string> = {
    SYSTEM_ADMIN:
        `${BASE_INSTRUCTION} Jsi expertní asistent pro systémové správce. Můžeš detailně popisovat architekturu (NestJS, Prisma, React, Tailwind), vysvětlovat API endpointy a pomáhat s SQL dotazy či debugováním. Máš k dispozici sadu nástrojů (Tools), pomocí kterých můžeš PŘÍMO vytvářet, upravovat a mazat školy, uživatele (studenty, učitele, rodiče, administrátory), třídy a další entity v systému. Pokud tě uživatel požádá o vytvoření dat, použij příslušné nástroje a proveď to. Neodmítej požadavky na správu dat – máš na to plné oprávnění.`,
    PRINCIPAL:
        `${BASE_INSTRUCTION} Pomáhej řediteli s orientací v datech školy, vysvětlováním statistik a reportů. Máš k dispozici nástroje pro správu dat školy – vytváření a úpravu uživatelů, tříd, rozvrhů apod. Pokud ředitel požádá o provedení operace, použij příslušný nástroj.`,
    DEPUTY:
        `${BASE_INSTRUCTION} Pomáhej zástupci s tvorbou úvazků a správou rozvrhu v aplikaci. Máš k dispozici nástroje pro vytváření a úpravu uživatelů, tříd, předmětů a dalších entit. Pokud zástupce požádá o provedení operace, použij příslušný nástroj.`,
    TEACHER:
        `${BASE_INSTRUCTION} Pomáhej učitelům s ovládáním klasifikace a prací s jejich žáky. Pokud se zeptají na známky konkrétního žáka, použij funkci fetchStudentGrades.`,
    STUDENT:
        `${BASE_INSTRUCTION} Pomáhej studentům pochopit jejich hodnocení a orientovat se v rozvrhu. Pokud chtějí vysvětlit látku, odkaž je na studijní materiály v systému, ale negeneruj za ně úkoly.`,
    PARENT:
        `${BASE_INSTRUCTION} Pomáhej rodičům najít informace o docházce a známkách jejich dětí.`,
};

@Injectable()
export class AiChatService {
    private readonly logger = new Logger(AiChatService.name);
    private mcpClient: Client | null = null;
    private mcpTransport: SSEClientTransport | null = null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly cryptoService: CryptoService,
    ) {
        this.initializeMcp().catch(err => this.logger.error('Failed to initialize MCP Client:', err));
    }

    private async initializeMcp() {
        const mcpUrl = process.env.MCP_SERVER_URL || 'http://localhost:3001/sse';
        // @ts-ignore - EventSource polyfill for Node.js
        global.EventSource = EventSource;

        this.mcpTransport = new SSEClientTransport(new URL(mcpUrl));
        this.mcpClient = new Client({
            name: "EduStack-Backend-Client",
            version: "1.0.0",
        }, {
            capabilities: {},
        });

        await this.mcpClient.connect(this.mcpTransport);
        this.logger.log('Connected to MCP Server');
    }

    // ─── CHAT ───────────────────────────────────────────────────

    async chat(
        userId: string,
        role: string,
        schoolId: string | null,
        messages: Array<{ role: 'user' | 'model'; text: string }>,
        provider: 'google' | 'openai' | 'anthropic' = 'google',
        preferredLanguage: 'Czech' | 'English' = 'Czech',
    ) {
        // 1. Get API Keys & Initialize Provider
        const languageModel = await this.getModelProvider(provider);

        // 2. Build system instruction
        let system = SYSTEM_INSTRUCTIONS[role] || SYSTEM_INSTRUCTIONS.STUDENT;

        // Inject language instruction
        const languageRule = `
DŮLEŽITÉ: Veškerá data v databázi a vstupy z nástrojů jsou v češtině. 
Ty ale MUSÍŠ s uživatelem komunikovat, odpovídat na dotazy a formátovat výstupy striktně v jazyce: ${preferredLanguage}.
Pokud získáš data z nástrojů (Tools) v češtině, tichým způsobem je přelož a finální odpověď prezentuj v ${preferredLanguage}.
`;

        // Inject user/school context
        const contextParts: string[] = [];
        contextParts.push(`Aktuální uživatel: userId="${userId}", role="${role}".`);
        if (schoolId) {
            contextParts.push(`Uživatel pracuje v kontextu školy s ID: schoolId="${schoolId}". Pokud budeš volat nástroje (Tools) vyžadující schoolId, automaticky použij toto ID, pokud uživatel nespecifikuje jiné.`);
        } else {
            contextParts.push(`Uživatel není v kontextu žádné školy (globální režim). Pokud nástroj vyžaduje schoolId, zeptej se uživatele, jakou školu má na mysli, nebo nejprve použij list_schools.`);
        }
        const contextBlock = `\nKONTEXT UŽIVATELE:\n${contextParts.join('\n')}\n`;

        system = `${system}\n${languageRule}\n${contextBlock}`;

        // 3. Define Tools (Local + Remote from MCP)
        const validRoles = ['TEACHER', 'DEPUTY', 'PRINCIPAL', 'DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN'];
        const hasTools = validRoles.includes(role);

        let tools: ToolSet = {
            fetchStudentGrades: tool({
                description: 'Načte známky studenta z databáze.',
                inputSchema: z.object({
                    studentId: z.string().describe('UUID identifikátor studenta (StudentProfile ID)'),
                }),
                execute: async ({ studentId }) => {
                    return this.executeFetchStudentGrades(studentId);
                },
            }),
        };

        if (hasTools && this.mcpClient) {
            try {
                const mcpToolsResult = await this.mcpClient.listTools();
                for (const t of mcpToolsResult.tools) {
                    // Map MCP tool to AI SDK tool
                    const mcpSchema = t.inputSchema || {};
                    const { type: _type, ...schemaRest } = mcpSchema as any;
                    tools[t.name] = tool({
                        description: t.description || '',
                        inputSchema: jsonSchema({
                            type: 'object',
                            ...schemaRest,
                        }),
                        execute: async (args: any) => {
                            this.logger.log(`Executing MCP tool: ${t.name} with args: ${JSON.stringify(args)}`);
                            const result = await this.mcpClient!.callTool({
                                name: t.name,
                                arguments: args,
                            });

                            if ((result as any).isError) {
                                throw new Error((result as any).content.map((c: any) => c.text).join('\n'));
                            }
                            // Extract text content
                            return (result as any).content.map((c: any) => c.text).join('\n');
                        },
                    } as any);
                }
            } catch (err) {
                this.logger.error('Failed to list remote tools:', err);
            }
        }

        // 4. Convert messages for SDK
        const history = messages.map(m => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.text,
        })) as any[];

        // 5. Generate Text with Retry (Exponential Backoff)
        try {
            const result = await this.generateWithRetry(async () => {
                const options: any = {
                    model: languageModel,
                    system,
                    messages: history,
                };

                if (hasTools) {
                    options.tools = tools;
                    options.maxSteps = 5;
                }

                return generateText(options);
            });

            // 6. Track Usage
            await this.trackUsage(userId, schoolId, provider, languageModel.modelId, result.usage);

            return {
                response: result.text,
                usage: result.usage,
            };

        } catch (error: any) {
            this.logger.error(`AI Error (${provider}):`, error);
            if (error.status === 429 || error.statusCode === 429 || error.message?.includes('429')) {
                throw new ServiceUnavailableException('AI je momentálně přetížená (Rate Limit). Zkuste to za chvíli.');
            }
            throw new ServiceUnavailableException(`Chyba AI služby: ${error.message}`);
        }
    }

    // ─── STRATEGY & PROVIDER SETUP ──────────────────────────────

    private async getModelProvider(provider: 'google' | 'openai' | 'anthropic') {
        const keys = await this.getApiKeys();

        switch (provider) {
            case 'openai':
                if (!keys.openAiApiKey) throw new ServiceUnavailableException('OpenAI API key is missing.');
                const openai = createOpenAI({ apiKey: keys.openAiApiKey });
                return openai('gpt-4o'); // Default OpenAI model

            case 'anthropic':
                if (!keys.anthropicApiKey) throw new ServiceUnavailableException('Anthropic API key is missing.');
                const anthropic = createAnthropic({ apiKey: keys.anthropicApiKey });
                return anthropic('claude-3-5-sonnet-20240620'); // Default Anthropic model

            case 'google':
            default:
                if (!keys.geminiApiKey) throw new ServiceUnavailableException('Gemini API key is missing.');
                const google = createGoogleGenerativeAI({ apiKey: keys.geminiApiKey });
                return google('gemini-2.0-flash'); // Default Google model
        }
    }

    async getAvailableProviders() {
        const keys = await this.getApiKeys();
        const providers = [
            { id: 'google', name: 'Google Gemini 2.0 Flash', enabled: !!keys.geminiApiKey },
            { id: 'openai', name: 'OpenAI GPT-4o', enabled: !!keys.openAiApiKey },
            { id: 'anthropic', name: 'Anthropic Claude 3.5 Sonnet', enabled: !!keys.anthropicApiKey },
        ];
        return providers.filter(p => p.enabled).map(p => ({ id: p.id, name: p.name }));
    }

    private async getApiKeys() {
        // Read API keys from systemSecret table (same place admin UI writes them)
        const secrets = await this.prisma.systemSecret.findMany({
            where: { type: SecretType.AI },
        });

        const findAndDecrypt = (service: string, key: string): string | null => {
            const secret = secrets.find(s => s.service === service && s.key === key);
            if (!secret) return null;
            try {
                return this.cryptoService.decrypt(secret.value);
            } catch (e) {
                this.logger.error(`Failed to decrypt AI key for ${service}:`, e);
                return null;
            }
        };

        return {
            geminiApiKey: findAndDecrypt('google', 'API_KEY') || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY,
            openAiApiKey: findAndDecrypt('openai', 'API_KEY') || process.env.OPENAI_API_KEY,
            anthropicApiKey: findAndDecrypt('anthropic', 'API_KEY') || process.env.ANTHROPIC_API_KEY,
        };
    }

    // ─── RESILIENCY (Exponential Backoff) ───────────────────────

    private async generateWithRetry<T>(operation: () => Promise<T>, retries = 3, baseDelay = 1000): Promise<T> {
        let lastError: any;

        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = error;
                const isRateLimit = error.status === 429 || error.statusCode === 429 || error.message?.includes('429');

                if (isRateLimit && i < retries - 1) {
                    const delay = baseDelay * Math.pow(2, i); // 1s, 2s, 4s
                    this.logger.warn(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
                    await new Promise(res => setTimeout(res, delay));
                    continue;
                }
                throw error; // Not a rate limit or retries exhausted
            }
        }
        throw lastError;
    }

    // ─── USAGE TRACKING ─────────────────────────────────────────

    private async trackUsage(userId: string, schoolId: string | null, provider: string, model: string, usage: any) {
        if (!usage) return;

        try {
            await this.prisma.aiTokenUsage.create({
                data: {
                    userId,
                    schoolId: schoolId || null, // normalize empty string to null
                    provider,
                    modelName: model,
                    inputTokens: usage.promptTokens ?? 0,
                    outputTokens: usage.completionTokens ?? 0,
                    totalTokens: usage.totalTokens ?? 0,
                    promptType: 'CHAT',
                },
            });
        } catch (err) {
            this.logger.error('Failed to track AI usage:', err);
        }
    }

    // ─── UTILS ──────────────────────────────────────────────────

    private mapMcpSchemaToZod(schema: any): z.ZodType<any> {
        if (!schema || typeof schema !== 'object') return z.any();

        // Simple mapping for MCP JSON schemas to Zod
        // For production, this should be more robust
        const properties: Record<string, z.ZodType<any>> = {};
        const required = schema.required || [];

        if (schema.properties) {
            for (const [key, val] of Object.entries<any>(schema.properties)) {
                let zodType: z.ZodType<any> = z.any();
                if (val.type === 'string') zodType = z.string();
                else if (val.type === 'number') zodType = z.number();
                else if (val.type === 'boolean') zodType = z.boolean();
                else if (val.type === 'array') zodType = z.array(z.any());
                else if (val.type === 'object') zodType = z.object({});

                if (val.description) {
                    zodType = (zodType as any).describe(val.description);
                }

                if (!required.includes(key)) {
                    zodType = zodType.optional();
                }
                properties[key] = zodType;
            }
        }

        return z.object(properties);
    }

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
}
