import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ApiException } from '../common/exceptions/api.exception';
import { CryptoService } from '../utils/crypto.service';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import * as crypto from 'crypto';

const { PDFParse } = require('pdf-parse');

// ─── Zod schema for structured AI extraction ────────────────────

const RvpSubjectSchema = z.object({
  name: z
    .string()
    .describe('Full Czech subject name, e.g. "Český jazyk a literatura"'),
  code: z.string().describe('Short abbreviation, e.g. "ČJ", "M", "AJ", "PRV"'),
  educationalArea: z
    .string()
    .optional()
    .describe('Educational area (vzdělávací oblast)'),
});

const RvpAllocationSchema = z.object({
  subjectName: z
    .string()
    .describe('Subject name – must exactly match one from the subjects list'),
  gradeLevel: z
    .number()
    .int()
    .min(1)
    .max(9)
    .describe('Grade level (ročník) 1–9'),
  hoursPerWeek: z.number().min(0).describe('Weekly hours allocation'),
  rvpDescription: z
    .string()
    .optional()
    .describe('Expected outcomes / key competencies'),
});

const RvpExtractionResultSchema = z.object({
  documentTitle: z.string().describe('Title of the RVP / curriculum document'),
  schoolType: z.string().describe('Type of school: ZŠ, gymnázium, SOŠ etc.'),
  subjects: z
    .array(RvpSubjectSchema)
    .describe('All subjects found in the document'),
  allocations: z
    .array(RvpAllocationSchema)
    .describe('Hourly allocations per subject × grade'),
  totalGrades: z.number().int().describe('Number of grade levels'),
  notes: z.string().optional().describe('Any important notes'),
});

export type RvpSubject = z.infer<typeof RvpSubjectSchema>;
export type RvpAllocation = z.infer<typeof RvpAllocationSchema>;
export type RvpExtractionResult = z.infer<typeof RvpExtractionResultSchema>;

export interface RvpPreviewData {
  extraction: RvpExtractionResult;
  existingSubjects: Array<{ id: string; name: string; code: string }>;
  existingGradeLevels: Array<{ id: string; name: string; levelNumber: number }>;
  matchedSubjects: Array<{
    extractedName: string;
    extractedCode: string;
    existingId: string | null;
    existingName: string | null;
    action: 'match' | 'create';
  }>;
  matchedGrades: Array<{
    gradeLevel: number;
    existingId: string | null;
    existingName: string | null;
    action: 'match' | 'create';
  }>;
}

export interface RvpConfirmData {
  versionName: string;
  validFrom: string;
  validTo?: string;
  subjectMappings: Array<{
    extractedName: string;
    extractedCode: string;
    existingId: string | null;
  }>;
  gradeMappings: Array<{
    gradeLevel: number;
    existingId: string | null;
    name: string;
  }>;
  allocations: Array<{
    subjectName: string;
    gradeLevel: number;
    hoursPerWeek: number;
    rvpDescription?: string;
  }>;
}

@Injectable()
export class RvpImportService {
  private readonly logger = new Logger(RvpImportService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cryptoService: CryptoService,
  ) {}

  async extractTextFromPdf(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer, verbosity: 0 });
    await parser.load();
    const text = (await parser.getText()).text || '';
    if (text.trim().length < 100)
      throw ApiException.badRequest(
        'apiErrors.badRequest.pdfNotEnoughText',
        'PDF does not contain enough text.',
      );
    return text;
  }

  async extractRvpData(
    documentText: string,
    userId: string,
    schoolId: string | null,
  ): Promise<RvpExtractionResult> {
    const model = await this.getAiModel();
    const truncated = documentText.substring(0, 500_000);

    try {
      const result = await generateObject({
        model,
        schema: RvpExtractionResultSchema,
        prompt: `Analyzuj RVP dokument: ${truncated}`,
      });

      await this.trackUsage(userId, schoolId, result.usage);
      return result.object;
    } catch (err: any) {
      throw new ServiceUnavailableException('AI analýza selhala.');
    }
  }

  async buildPreview(
    extraction: RvpExtractionResult,
    schoolId: string,
  ): Promise<RvpPreviewData> {
    const [existingSubjects, existingGradeLevels] = await Promise.all([
      this.db.query<{ id: string; name: string; code: string }>(
        'SELECT id, name, code FROM "SubjectTemplate" WHERE schoolId = ? ORDER BY name ASC',
        [schoolId],
      ),
      this.db.query<{ id: string; name: string; levelNumber: number }>(
        'SELECT id, name, levelNumber FROM "GradeLevel" WHERE schoolId = ? ORDER BY levelNumber ASC',
        [schoolId],
      ),
    ]);

    const matchedSubjects = extraction.subjects.map((es: RvpSubject) => {
      const match = existingSubjects.find(
        (s) =>
          s.code.toLowerCase() === es.code.toLowerCase() ||
          s.name.toLowerCase() === es.name.toLowerCase(),
      );
      return {
        extractedName: es.name,
        extractedCode: es.code,
        existingId: match?.id || null,
        existingName: match?.name || null,
        action: match ? ('match' as const) : ('create' as const),
      };
    });

    const allGrades = [
      ...new Set(
        extraction.allocations.map((a: RvpAllocation) => a.gradeLevel),
      ),
    ].sort((a, b) => a - b);
    const matchedGrades = allGrades.map((gl) => {
      const match = existingGradeLevels.find((g) => g.levelNumber === gl);
      return {
        gradeLevel: gl,
        existingId: match?.id || null,
        existingName: match?.name || null,
        action: match ? ('match' as const) : ('create' as const),
      };
    });

    return {
      extraction,
      existingSubjects,
      existingGradeLevels,
      matchedSubjects,
      matchedGrades,
    };
  }

  async confirmImport(actorId: string, schoolId: string, data: RvpConfirmData) {
    return this.db.transaction(async (db) => {
      const gradeLevelMap = new Map<number, string>();
      for (const gm of data.gradeMappings) {
        if (gm.existingId) gradeLevelMap.set(gm.gradeLevel, gm.existingId);
        else {
          const id = crypto.randomUUID();
          await db.execute(
            'INSERT INTO "GradeLevel" (id, name, levelNumber, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
            [
              id,
              gm.name,
              gm.gradeLevel,
              schoolId,
              new Date().toISOString(),
              new Date().toISOString(),
            ],
          );
          gradeLevelMap.set(gm.gradeLevel, id);
        }
      }

      const subjectMap = new Map<string, string>();
      for (const sm of data.subjectMappings) {
        if (sm.existingId) subjectMap.set(sm.extractedName, sm.existingId);
        else {
          const id = crypto.randomUUID();
          await db.execute(
            'INSERT INTO "SubjectTemplate" (id, name, code, schoolId) VALUES (?, ?, ?, ?)',
            [id, sm.extractedName, sm.extractedCode, schoolId],
          );
          subjectMap.set(sm.extractedName, id);
        }
      }

      const versionId = crypto.randomUUID();
      await db.execute(
        'INSERT INTO "CurriculumVersion" (id, name, validFrom, validTo, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          versionId,
          data.versionName,
          new Date(data.validFrom).toISOString(),
          data.validTo ? new Date(data.validTo).toISOString() : null,
          schoolId,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );

      let entriesCreated = 0;
      for (const alloc of data.allocations) {
        const subjectId = subjectMap.get(alloc.subjectName);
        const gradeLevelId = gradeLevelMap.get(alloc.gradeLevel);
        if (subjectId && gradeLevelId && alloc.hoursPerWeek > 0) {
          await db.execute(
            'INSERT INTO "CurriculumEntry" (id, curriculumVersionId, subjectTemplateId, gradeLevelId, hoursPerWeek, rvpDescription, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              crypto.randomUUID(),
              versionId,
              subjectId,
              gradeLevelId,
              alloc.hoursPerWeek,
              alloc.rvpDescription || null,
              new Date().toISOString(),
              new Date().toISOString(),
            ],
          );
          entriesCreated++;
        }
      }

      await db.execute(
        'INSERT INTO "AuditLog" (id, actorId, action, entity, entityId, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          actorId,
          'RVP_IMPORT',
          'CurriculumVersion',
          versionId,
          JSON.stringify({ versionName: data.versionName, entriesCreated }),
          new Date().toISOString(),
        ],
      );
      return { versionId, entriesCreated };
    });
  }

  private async getAiModel() {
    const keys = await this.getApiKeys();
    if (keys.geminiApiKey)
      return createGoogleGenerativeAI({ apiKey: keys.geminiApiKey })(
        'gemini-2.5-pro',
      );
    if (keys.openAiApiKey)
      return createOpenAI({ apiKey: keys.openAiApiKey })('gpt-4o');
    throw new ServiceUnavailableException(
      'Žádný AI poskytovatel není nakonfigurován.',
    );
  }

  private async getApiKeys() {
    const secrets = await this.db.query(
      'SELECT * FROM "SystemSecret" WHERE type = ?',
      ['AI'],
    );
    const find = (service: string, key: string) => {
      const s = secrets.find(
        (s: any) => s.service === service && s.key === key,
      );
      try {
        return s ? this.cryptoService.decrypt((s as any).value) : null;
      } catch {
        return null;
      }
    };
    return {
      geminiApiKey: find('google', 'API_KEY') || process.env.GEMINI_API_KEY,
      openAiApiKey: find('openai', 'API_KEY') || process.env.OPENAI_API_KEY,
    };
  }

  private async trackUsage(
    userId: string,
    schoolId: string | null,
    usage: any,
  ) {
    if (!usage) return;
    await this.db.execute(
      'INSERT INTO "AiTokenUsage" (id, userId, schoolId, provider, modelName, inputTokens, outputTokens, totalTokens, promptType, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        userId,
        schoolId,
        'google',
        'gemini-2.5-pro',
        usage.promptTokens || 0,
        usage.completionTokens || 0,
        usage.totalTokens || 0,
        'RVP_IMPORT',
        new Date().toISOString(),
      ],
    );
  }
}
