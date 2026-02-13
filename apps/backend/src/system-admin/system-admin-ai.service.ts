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

    async upsertAiSettings(geminiApiKey: string) {
        const encryptedKey = encrypt(geminiApiKey);

        const settings = await this.prisma.systemSettings.upsert({
            where: { id: SETTINGS_ID },
            create: { id: SETTINGS_ID, geminiApiKey: encryptedKey },
            update: { geminiApiKey: encryptedKey },
        });

        return {
            isConfigured: true,
            keyHint: '****' + geminiApiKey.slice(-4),
            updatedAt: settings.updatedAt,
        };
    }

    // ─── GET SETTINGS (MASKED) ──────────────────────────────────

    async getAiSettings() {
        const settings = await this.prisma.systemSettings.findUnique({
            where: { id: SETTINGS_ID },
        });

        if (!settings || !settings.geminiApiKey) {
            return { isConfigured: false, keyHint: null, updatedAt: settings?.updatedAt ?? null };
        }

        try {
            const decryptedKey = decrypt(settings.geminiApiKey);
            return {
                isConfigured: true,
                keyHint: '****' + decryptedKey.slice(-4),
                updatedAt: settings.updatedAt,
            };
        } catch {
            return { isConfigured: true, keyHint: '****', updatedAt: settings.updatedAt };
        }
    }

    /**
     * Retrieve the decrypted API key for internal use (e.g., by AI services).
     */
    async getDecryptedApiKey(): Promise<string | null> {
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

        // Per-school aggregation for current month
        const bySchool = await this.prisma.aiTokenUsage.groupBy({
            by: ['schoolId'],
            where: { createdAt: { gte: startOfMonth } },
            _sum: {
                inputTokens: true,
                outputTokens: true,
                totalTokens: true,
            },
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

        // Daily breakdown for current month (for charting)
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

        // Grand totals
        const totals = await this.prisma.aiTokenUsage.aggregate({
            where: { createdAt: { gte: startOfMonth } },
            _sum: {
                inputTokens: true,
                outputTokens: true,
                totalTokens: true,
            },
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
            daily,
        };
    }
}
