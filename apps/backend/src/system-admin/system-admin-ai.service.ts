import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CryptoService } from '../utils/crypto.service';
import {
  SecretType,
  SystemSecret,
  AiTokenUsage,
  School,
} from '../database/types';
import * as crypto from 'crypto';

@Injectable()
export class SystemAdminAiService {
  constructor(
    private readonly db: DatabaseService,
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
        await this.db.execute(
          `INSERT INTO "SystemSecret" (id, type, service, "key", value, isActive, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(type, service, "key") DO UPDATE SET
             value = excluded.value,
             updatedAt = excluded.updatedAt`,
          [
            crypto.randomUUID(),
            SecretType.AI,
            s.id,
            s.key,
            this.cryptoService.encrypt(s.value),
            true,
            new Date().toISOString(),
          ],
        );
      }
    }

    return this.getAiSettings();
  }

  // ─── GET SETTINGS (MASKED) ──────────────────────────────────

  async getAiSettings() {
    const secrets = await this.db.query<SystemSecret>(
      'SELECT * FROM "SystemSecret" WHERE type = ?',
      [SecretType.AI],
    );

    const findSecret = (service: string, key: string) =>
      secrets.find((s: any) => s.service === service && s.key === key);

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
    const secret = await this.db.queryOne<SystemSecret>(
      'SELECT * FROM "SystemSecret" WHERE type = ? AND service = ? AND "key" = ?',
      [SecretType.AI, service, 'API_KEY'],
    );

    if (!secret) return null;
    try {
      return this.cryptoService.decrypt(secret.value);
    } catch {
      return null;
    }
  }

  // ─── MODEL DISCOVERY & CACHING ─────────────────────────────

  private googleModelsCache: { models: string[]; timestamp: number } | null =
    null;
  private readonly CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

  /**
   * Dynamically fetch available Google AI models with caching.
   * Returns a list of model IDs supporting generateContent.
   */
  async getDiscoverableGoogleModels(): Promise<string[]> {
    // 1. Check Cache
    const now = Date.now();
    if (
      this.googleModelsCache &&
      now - this.googleModelsCache.timestamp < this.CACHE_TTL
    ) {
      return this.googleModelsCache.models;
    }

    const apiKey = await this.getDecryptedApiKey('google');
    if (!apiKey) return [];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      );

      if (!response.ok) {
        throw new Error(`Google API returned ${response.status}`);
      }

      const data = (await response.json()) as any;
      if (!data.models || !Array.isArray(data.models)) {
        throw new Error('Invalid response format');
      }

      const models = data.models
        .filter((m: any) =>
          m.supportedGenerationMethods.includes('generateContent'),
        )
        .map((m: any) => m.name.replace('models/', ''))
        .sort()
        .reverse();

      // 2. Update Cache
      this.googleModelsCache = { models, timestamp: now };
      return models;
    } catch (err: any) {
      // If error, return empty but don't cache failure (or log it)
      return [];
    }
  }

  // ─── AGGREGATED USAGE ───────────────────────────────────────

  async getAiUsage() {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();

    // 1. Per-school aggregation
    const bySchool = await this.db.query(
      `SELECT schoolId, SUM(totalTokens) as totalTokens, SUM(inputTokens) as inputTokens, SUM(outputTokens) as outputTokens, COUNT(*) as requestCount
       FROM AiTokenUsage
       WHERE createdAt >= ?
       GROUP BY schoolId`,
      [startOfMonth],
    );

    // Enrich with school names
    const schoolIds = bySchool
      .map((s: any) => s.schoolId)
      .filter(Boolean) as string[];

    let schoolMap: Record<string, string> = {};
    if (schoolIds.length > 0) {
      const placeholders = schoolIds.map(() => '?').join(',');
      const schools = await this.db.query<School>(
        `SELECT id, name FROM School WHERE id IN (${placeholders})`,
        schoolIds,
      );
      schoolMap = Object.fromEntries(schools.map((s: any) => [s.id, s.name]));
    }

    const perSchool = bySchool.map((row: any) => ({
      schoolId: row.schoolId,
      schoolName: row.schoolId
        ? (schoolMap[row.schoolId] ?? 'Unknown')
        : 'Global',
      totalTokens: row.totalTokens ?? 0,
      inputTokens: row.inputTokens ?? 0,
      outputTokens: row.outputTokens ?? 0,
      requestCount: row.requestCount,
    }));

    // 2. Per-provider aggregation
    const byProvider = await this.db.query(
      `SELECT provider, SUM(totalTokens) as totalTokens, COUNT(*) as requestCount
       FROM AiTokenUsage
       WHERE createdAt >= ?
       GROUP BY provider`,
      [startOfMonth],
    );

    const perProvider = byProvider.map((p: any) => ({
      provider: p.provider || 'unknown',
      totalTokens: p.totalTokens ?? 0,
      requestCount: p.requestCount,
    }));

    // 3. Daily breakdown
    type DailyUsageRow = {
      day: string;
      total_tokens: number;
      request_count: number;
    };
    const dailyRaw = await this.db.query<DailyUsageRow>(
      `SELECT DATE(createdAt) as day, SUM(totalTokens) as total_tokens, COUNT(*) as request_count
       FROM AiTokenUsage
       WHERE createdAt >= ?
       GROUP BY DATE(createdAt)
       ORDER BY day ASC`,
      [startOfMonth],
    );

    const daily = dailyRaw.map((row: DailyUsageRow) => ({
      date: row.day,
      totalTokens: Number(row.total_tokens),
      requestCount: Number(row.request_count),
    }));

    // 4. Grand totals
    const totals = await this.db.queryOne(
      `SELECT SUM(totalTokens) as totalTokens, SUM(inputTokens) as inputTokens, SUM(outputTokens) as outputTokens, COUNT(*) as requestCount
       FROM AiTokenUsage
       WHERE createdAt >= ?`,
      [startOfMonth],
    );

    return {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      totals: {
        totalTokens: totals?.totalTokens ?? 0,
        inputTokens: totals?.inputTokens ?? 0,
        outputTokens: totals?.outputTokens ?? 0,
        requestCount: totals?.requestCount ?? 0,
      },
      perSchool,
      perProvider,
      daily,
    };
  }
}
