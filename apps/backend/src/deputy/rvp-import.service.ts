import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../utils/crypto.service';
import { SecretType } from '@prisma/client';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

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
    .describe(
      'Educational area (vzdělávací oblast), e.g. "Jazyk a jazyková komunikace"',
    ),
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
  hoursPerWeek: z
    .number()
    .min(0)
    .describe('Weekly hours allocation (hodinová dotace za týden)'),
  rvpDescription: z
    .string()
    .optional()
    .describe(
      'Expected outcomes / key competencies from RVP for this subject × grade',
    ),
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
  totalGrades: z
    .number()
    .int()
    .describe('Number of grade levels (e.g. 9 for ZŠ, 4/6/8 for gymnázium)'),
  notes: z
    .string()
    .optional()
    .describe('Any important notes about the curriculum structure'),
});

export type RvpExtractionResult = z.infer<typeof RvpExtractionResultSchema>;

// ─── Types for preview/confirm flow ─────────────────────────────

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
    existingId: string | null; // null = create new
  }>;
  gradeMappings: Array<{
    gradeLevel: number;
    existingId: string | null; // null = create new
    name: string;
  }>;
  allocations: Array<{
    subjectName: string;
    gradeLevel: number;
    hoursPerWeek: number;
    rvpDescription?: string;
  }>;
}

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class RvpImportService {
  private readonly logger = new Logger(RvpImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  // ─── STEP 1: Extract text from source ──────────────────────────

  async extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer, verbosity: 0 });
      await parser.load();
      const result = await parser.getText();
      const text = result.text || '';

      if (text.trim().length < 100) {
        throw new BadRequestException(
          'PDF neobsahuje dostatek textu. Zkontrolujte, že nejde o skenovaný dokument.',
        );
      }
      this.logger.log(
        `PDF parsed: ${result.total} pages, ${text.length} chars`,
      );
      return text;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('PDF parse error:', err);
      throw new BadRequestException('Nepodařilo se zpracovat PDF soubor.');
    }
  }

  async extractTextFromUrl(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'EduStack-RVP-Import/1.0' },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new BadRequestException(
          `Nepodařilo se stáhnout dokument (HTTP ${response.status}).`,
        );
      }

      const contentType = response.headers.get('content-type') || '';

      // If PDF, parse it
      if (contentType.includes('application/pdf')) {
        const arrayBuffer = await response.arrayBuffer();
        return this.extractTextFromPdf(Buffer.from(arrayBuffer));
      }

      // Otherwise treat as HTML
      const html = await response.text();
      // Strip HTML tags to get plain text
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length < 100) {
        throw new BadRequestException('Stránka neobsahuje dostatek textu.');
      }

      this.logger.log(`URL fetched: ${text.length} chars`);
      return text;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('URL fetch error:', err);
      throw new BadRequestException('Nepodařilo se stáhnout obsah z URL.');
    }
  }

  // ─── STEP 2: AI extraction ─────────────────────────────────────

  async extractRvpData(
    documentText: string,
    userId: string,
    schoolId: string | null,
  ): Promise<RvpExtractionResult> {
    const model = await this.getAiModel();

    // Truncate if too long (Gemini can handle ~1M tokens but we want speed)
    const maxChars = 500_000;
    const truncated =
      documentText.length > maxChars
        ? documentText.substring(0, maxChars) + '\n\n[... dokument zkrácen ...]'
        : documentText;

    this.logger.log(`Starting RVP extraction: ${truncated.length} chars`);

    try {
      const result = await generateObject({
        model,
        schema: RvpExtractionResultSchema,
        prompt: `Jsi expert na český vzdělávací systém. Analyzuj následující text dokumentu RVP (Rámcový vzdělávací program) a extrahuj strukturovaná data.

INSTRUKCE:
1. Najdi VŠECHNY vyučovací předměty zmíněné v dokumentu.
2. Pro každý předmět vytvoř krátkou zkratku (kód): ČJ, M, AJ, INF, VV, HV, TV, PRV, PŘ, VL, Z, D, OV, F, CH, PČ apod.
3. Extrahuj hodinové dotace (počet hodin za týden) pro každý předmět v každém ročníku.
   - Pokud dokument uvádí celkový počet hodin za stupeň/období, rozděl je rovnoměrně mezi ročníky.
   - Pokud dokument uvádí rozsah (např. 2-3 hodiny), použij střední hodnotu.
   - Pokud konkrétní dotace není jasná, použij 0.
4. Pro každý předmět × ročník extrahuj stručný popis očekávaných výstupů z RVP.
5. Urči typ školy a celkový počet ročníků.

DŮLEŽITÉ:
- Názvy předmětů musí být přesně shodné v seznamu předmětů i v alokacích.
- Hodinové dotace jsou za TÝDEN, ne za rok.
- Pokud dokument neobsahuje detailní tabulku dotací, odhadni na základě kontextu a běžné praxe.

TEXT DOKUMENTU:
${truncated}`,
      });

      // Track usage
      await this.trackUsage(userId, schoolId, result.usage);

      this.logger.log(
        `RVP extraction complete: ${result.object.subjects.length} subjects, ${result.object.allocations.length} allocations`,
      );

      return result.object;
    } catch (err: any) {
      this.logger.error('AI extraction failed:', err);
      throw new ServiceUnavailableException(
        'AI analýza selhala. Zkuste to znovu nebo zkontrolujte konfiguraci AI klíčů.',
      );
    }
  }

  // ─── STEP 3: Build preview with matching ───────────────────────

  async buildPreview(
    extraction: RvpExtractionResult,
    schoolId: string,
  ): Promise<RvpPreviewData> {
    const existingSubjects = await this.prisma.subjectTemplate.findMany({
      where: { schoolId },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    const existingGradeLevels = await this.prisma.gradeLevel.findMany({
      where: { schoolId },
      select: { id: true, name: true, levelNumber: true },
      orderBy: { levelNumber: 'asc' },
    });

    // Match extracted subjects to existing ones (fuzzy by name/code)
    const matchedSubjects = extraction.subjects.map((es) => {
      const byCode = existingSubjects.find(
        (s) => s.code.toLowerCase() === es.code.toLowerCase(),
      );
      const byName = existingSubjects.find(
        (s) => s.name.toLowerCase() === es.name.toLowerCase(),
      );
      const match = byCode || byName;
      return {
        extractedName: es.name,
        extractedCode: es.code,
        existingId: match?.id || null,
        existingName: match?.name || null,
        action: (match ? 'match' : 'create') as 'match' | 'create',
      };
    });

    // Match grade levels
    const allGrades = [
      ...new Set(extraction.allocations.map((a) => a.gradeLevel)),
    ].sort((a, b) => a - b);
    const matchedGrades = allGrades.map((gl) => {
      const match = existingGradeLevels.find((g) => g.levelNumber === gl);
      return {
        gradeLevel: gl,
        existingId: match?.id || null,
        existingName: match?.name || null,
        action: (match ? 'match' : 'create') as 'match' | 'create',
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

  // ─── STEP 4: Confirm and import ────────────────────────────────

  async confirmImport(actorId: string, schoolId: string, data: RvpConfirmData) {
    // 1. Create missing grade levels
    const gradeLevelMap = new Map<number, string>(); // gradeNumber → id
    for (const gm of data.gradeMappings) {
      if (gm.existingId) {
        gradeLevelMap.set(gm.gradeLevel, gm.existingId);
      } else {
        const created = await this.prisma.gradeLevel.create({
          data: {
            name: gm.name,
            levelNumber: gm.gradeLevel,
            schoolId,
          },
        });
        gradeLevelMap.set(gm.gradeLevel, created.id);
      }
    }

    // 2. Create missing subjects
    const subjectMap = new Map<string, string>(); // extractedName → id
    for (const sm of data.subjectMappings) {
      if (sm.existingId) {
        subjectMap.set(sm.extractedName, sm.existingId);
      } else {
        const created = await this.prisma.subjectTemplate.create({
          data: {
            name: sm.extractedName,
            code: sm.extractedCode,
            schoolId,
          },
        });
        subjectMap.set(sm.extractedName, created.id);
      }
    }

    // 3. Create CurriculumVersion
    const version = await this.prisma.curriculumVersion.create({
      data: {
        name: data.versionName,
        validFrom: new Date(data.validFrom),
        validTo: data.validTo ? new Date(data.validTo) : null,
        schoolId,
      },
    });

    // 4. Create CurriculumEntries (bulk)
    let entriesCreated = 0;
    for (const alloc of data.allocations) {
      const subjectId = subjectMap.get(alloc.subjectName);
      const gradeLevelId = gradeLevelMap.get(alloc.gradeLevel);

      if (!subjectId || !gradeLevelId || alloc.hoursPerWeek <= 0) continue;

      try {
        await this.prisma.curriculumEntry.create({
          data: {
            curriculumVersionId: version.id,
            subjectTemplateId: subjectId,
            gradeLevelId,
            hoursPerWeek: alloc.hoursPerWeek,
            rvpDescription: alloc.rvpDescription || null,
          },
        });
        entriesCreated++;
      } catch (err: any) {
        // Skip duplicates silently
        this.logger.warn(
          `Skipped duplicate entry: ${alloc.subjectName} × grade ${alloc.gradeLevel}`,
        );
      }
    }

    // 5. Audit
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'RVP_IMPORT',
        entity: 'CurriculumVersion',
        entityId: version.id,
        newValues: {
          versionName: data.versionName,
          schoolId,
          subjectsCreated: data.subjectMappings.filter((s) => !s.existingId)
            .length,
          subjectsMapped: data.subjectMappings.filter((s) => s.existingId)
            .length,
          gradeLevelsCreated: data.gradeMappings.filter((g) => !g.existingId)
            .length,
          entriesCreated,
        },
      },
    });

    this.logger.log(
      `RVP import complete: version=${version.id}, entries=${entriesCreated}`,
    );

    return {
      versionId: version.id,
      versionName: version.name,
      subjectsCreated: data.subjectMappings.filter((s) => !s.existingId).length,
      gradeLevelsCreated: data.gradeMappings.filter((g) => !g.existingId)
        .length,
      entriesCreated,
    };
  }

  // ─── Private: AI model setup ───────────────────────────────────

  private async getAiModel() {
    const keys = await this.getApiKeys();

    // Prefer Gemini 2.5 Pro for large context
    if (keys.geminiApiKey) {
      const google = createGoogleGenerativeAI({ apiKey: keys.geminiApiKey });
      return google('gemini-2.5-pro');
    }

    // Fallback to OpenAI
    if (keys.openAiApiKey) {
      const openai = createOpenAI({ apiKey: keys.openAiApiKey });
      return openai('gpt-4o');
    }

    throw new ServiceUnavailableException(
      'Žádný AI poskytovatel není nakonfigurován. Nastavte Gemini nebo OpenAI klíč.',
    );
  }

  private async getApiKeys() {
    const secrets = await this.prisma.systemSecret.findMany({
      where: { type: SecretType.AI },
    });

    const findAndDecrypt = (service: string, key: string): string | null => {
      const secret = secrets.find(
        (s) => s.service === service && s.key === key,
      );
      if (!secret) return null;
      try {
        return this.cryptoService.decrypt(secret.value);
      } catch {
        return null;
      }
    };

    return {
      geminiApiKey:
        findAndDecrypt('google', 'API_KEY') ||
        process.env.GOOGLE_AI_API_KEY ||
        process.env.GEMINI_API_KEY,
      openAiApiKey:
        findAndDecrypt('openai', 'API_KEY') || process.env.OPENAI_API_KEY,
    };
  }

  private async trackUsage(
    userId: string,
    schoolId: string | null,
    usage: any,
  ) {
    if (!usage) return;
    try {
      await this.prisma.aiTokenUsage.create({
        data: {
          userId,
          schoolId: schoolId || null,
          provider: 'google',
          modelName: 'gemini-2.5-pro',
          inputTokens: usage.promptTokens ?? 0,
          outputTokens: usage.completionTokens ?? 0,
          totalTokens: usage.totalTokens ?? 0,
          promptType: 'RVP_IMPORT',
        },
      });
    } catch (err) {
      this.logger.error('Failed to track AI usage:', err);
    }
  }
}
