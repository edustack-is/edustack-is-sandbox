import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

const SETTINGS_ID = 'global';

// Simple AES-256 encryption for API key storage
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY || 'edu-stack-default-key-change-me!!'; // 32 chars

function encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

@Injectable()
export class SystemAdminAiService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── PUT SETTINGS ───────────────────────────────────────────

    async upsertAiSettings(keys: { geminiApiKey?: string; openAiApiKey?: string; anthropicApiKey?: string }) {
        const updateData: any = {};
        const response: any = { isConfigured: {}, updatedAt: new Date() };

        if (keys.geminiApiKey) {
            updateData.geminiApiKey = encrypt(keys.geminiApiKey);
            response.isConfigured.gemini = true;
        }
        if (keys.openAiApiKey) {
            updateData.openAiApiKey = encrypt(keys.openAiApiKey);
            response.isConfigured.openai = true;
        }
        if (keys.anthropicApiKey) {
            updateData.anthropicApiKey = encrypt(keys.anthropicApiKey);
            response.isConfigured.anthropic = true;
        }

        const settings = await this.prisma.systemSettings.upsert({
            where: { id: SETTINGS_ID },
            create: { id: SETTINGS_ID, ...updateData },
            update: updateData,
        });

        return {
            ...await this.getAiSettings(),
            updatedAt: settings.updatedAt,
        };
    }

    // ─── GET SETTINGS (MASKED) ──────────────────────────────────

    async getAiSettings() {
        const settings = await this.prisma.systemSettings.findUnique({
            where: { id: SETTINGS_ID },
        });

        const maskKey = (key: string | null) => {
            if (!key) return null;
            try {
                const decrypted = decrypt(key);
                return '****' + decrypted.slice(-4);
            } catch {
                return '****';
            }
        };

        return {
            gemini: {
                isConfigured: !!settings?.geminiApiKey,
                keyHint: maskKey(settings?.geminiApiKey),
            },
            openai: {
                isConfigured: !!settings?.openAiApiKey,
                keyHint: maskKey(settings?.openAiApiKey),
            },
            anthropic: {
                isConfigured: !!settings?.anthropicApiKey,
                keyHint: maskKey(settings?.anthropicApiKey),
            },
            updatedAt: settings?.updatedAt ?? null,
        };
    }

    /**
     * Retrieve the decrypted API key for internal use (e.g., by AI services).
     */
    async getDecryptedApiKey(): Promise<string | null> {
        // This method might be deprecated in favor of AiChatService's own key retrieval, 
        // but keeping it for backward compatibility if needed.
        const settings = await this.prisma.systemSettings.findUnique({
            where: { id: SETTINGS_ID },
        });
        if (!settings?.geminiApiKey) return null;
        try {
            return decrypt(settings.geminiApiKey);
        } catch {
            return null;
        }
    }

    // ─── AGGREGATED USAGE ───────────────────────────────────────

    async getAiUsage() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // 1. Per-school aggregation
        const bySchool = await this.prisma.aiTokenUsage.groupBy({
            by: ['schoolId'],
            where: { createdAt: { gte: startOfMonth } },
            _sum: { totalTokens: true, inputTokens: true, outputTokens: true },
            _count: true,
        });

        // Enrich with school names
        const schoolIds = bySchool.map((s) => s.schoolId).filter(Boolean) as string[];
        const schools = schoolIds.length > 0
            ? await this.prisma.school.findMany({
                where: { id: { in: schoolIds } },
                select: { id: true, name: true },
            })
            : [];
        const schoolMap = Object.fromEntries(schools.map((s) => [s.id, s.name]));

        const perSchool = bySchool.map((row) => ({
            schoolId: row.schoolId,
            schoolName: row.schoolId ? schoolMap[row.schoolId] ?? 'Unknown' : 'Global',
            totalTokens: row._sum.totalTokens ?? 0,
            inputTokens: row._sum.inputTokens ?? 0,
            outputTokens: row._sum.outputTokens ?? 0,
            requestCount: row._count,
        }));

        // 2. Per-provider aggregation
        const byProvider = await this.prisma.aiTokenUsage.groupBy({
            by: ['provider'],
            where: { createdAt: { gte: startOfMonth } },
            _sum: { totalTokens: true },
            _count: true,
        });

        const perProvider = byProvider.map(p => ({
            provider: p.provider || 'unknown',
            totalTokens: p._sum.totalTokens ?? 0,
            requestCount: p._count,
        }));

        // 3. Daily breakdown
        const dailyRaw = await this.prisma.$queryRawUnsafe<
            { day: string; total_tokens: bigint; request_count: bigint }[]
        >(
            `SELECT DATE("createdAt") as day, SUM("totalTokens") as total_tokens, COUNT(*) as request_count
             FROM "AiTokenUsage"
             WHERE "createdAt" >= $1
             GROUP BY DATE("createdAt")
             ORDER BY day ASC`,
            startOfMonth,
        );

        const daily = dailyRaw.map((row) => ({
            date: row.day,
            totalTokens: Number(row.total_tokens),
            requestCount: Number(row.request_count),
        }));

        // 4. Grand totals
        const totals = await this.prisma.aiTokenUsage.aggregate({
            where: { createdAt: { gte: startOfMonth } },
            _sum: { totalTokens: true, inputTokens: true, outputTokens: true },
            _count: true,
        });

        return {
            month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
            totals: {
                totalTokens: totals._sum.totalTokens ?? 0,
                inputTokens: totals._sum.inputTokens ?? 0,
                outputTokens: totals._sum.outputTokens ?? 0,
                requestCount: totals._count,
            },
            perSchool,
            perProvider,
            daily,
        };
    }
}
