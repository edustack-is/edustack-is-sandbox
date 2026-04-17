import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../utils/crypto.service';
import { SecretType } from '@prisma/client';

@Injectable()
export class SystemAdminAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  // ─── PUT SETTINGS ───────────────────────────────────────────

  async upsertAiSettings(keys: {
    geminiApiKey?: string;
    openAiApiKey?: string;
    anthropicApiKey?: string;
  }) {
    const services = [
      { id: 'google', key: 'API_KEY', value: keys.geminiApiKey },
      { id: 'openai', key: 'API_KEY', value: keys.openAiApiKey },
      { id: 'anthropic', key: 'API_KEY', value: keys.anthropicApiKey },
    ];

    for (const s of services) {
      if (s.value) {
        await this.prisma.systemSecret.upsert({
          where: {
            type_service_key: {
              type: SecretType.AI,
              service: s.id,
              key: s.key,
            },
          },
          create: {
            type: SecretType.AI,
            service: s.id,
            key: s.key,
            value: this.cryptoService.encrypt(s.value),
          },
          update: {
            value: this.cryptoService.encrypt(s.value),
          },
        });
      }
    }

    return this.getAiSettings();
  }

  // ─── GET SETTINGS (MASKED) ──────────────────────────────────

  async getAiSettings() {
    const secrets = await this.prisma.systemSecret.findMany({
      where: { type: SecretType.AI },
    });

    const findSecret = (service: string, key: string) =>
      secrets.find((s) => s.service === service && s.key === key);

    const maskKey = (encryptedValue: string | undefined) => {
      if (!encryptedValue) return null;
      try {
        const decrypted = this.cryptoService.decrypt(encryptedValue);
        return '****' + decrypted.slice(-4);
      } catch {
        return '****';
      }
    };

    const gemini = findSecret('google', 'API_KEY');
    const openai = findSecret('openai', 'API_KEY');
    const anthropic = findSecret('anthropic', 'API_KEY');

    return {
      gemini: {
        isConfigured: !!gemini,
        keyHint: maskKey(gemini?.value),
      },
      openai: {
        isConfigured: !!openai,
        keyHint: maskKey(openai?.value),
      },
      anthropic: {
        isConfigured: !!anthropic,
        keyHint: maskKey(anthropic?.value),
      },
      updatedAt: secrets.length > 0 ? secrets[0].updatedAt : null,
    };
  }

  /**
   * Retrieve the decrypted API key for internal use.
   */
  async getDecryptedApiKey(service: string = 'google'): Promise<string | null> {
    const secret = await this.prisma.systemSecret.findUnique({
      where: {
        type_service_key: {
          type: SecretType.AI,
          service,
          key: 'API_KEY',
        },
      },
    });

    if (!secret) return null;
    try {
      return this.cryptoService.decrypt(secret.value);
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
    const schoolIds = bySchool
      .map((s) => s.schoolId)
      .filter(Boolean) as string[];
    const schools =
      schoolIds.length > 0
        ? await this.prisma.school.findMany({
            where: { id: { in: schoolIds } },
            select: { id: true, name: true },
          })
        : [];
    const schoolMap = Object.fromEntries(schools.map((s) => [s.id, s.name]));

    const perSchool = bySchool.map((row) => ({
      schoolId: row.schoolId,
      schoolName: row.schoolId
        ? (schoolMap[row.schoolId] ?? 'Unknown')
        : 'Global',
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

    const perProvider = byProvider.map((p) => ({
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
