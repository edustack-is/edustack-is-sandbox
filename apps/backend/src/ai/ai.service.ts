import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as crypto from 'crypto';
import { UserRole, UserStatus, Classroom, User } from '../database/types';
import { SystemAdminAiService } from '../system-admin/system-admin-ai.service';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private db: DatabaseService,
    private systemAdminAiService: SystemAdminAiService,
  ) {}

  private cachedModel: any = null;

  private async getModel() {
    if (this.cachedModel) return this.cachedModel;

    const googleKey =
      await this.systemAdminAiService.getDecryptedApiKey('google');
    if (googleKey) {
      try {
        const available =
          await this.systemAdminAiService.getDiscoverableGoogleModels();
        if (available.length > 0) {
          const modelName =
            available.find((n) => n.toLowerCase().includes('flash')) ||
            available[0];
          const google = createGoogleGenerativeAI({ apiKey: googleKey });
          this.cachedModel = google(modelName);
          return this.cachedModel;
        }
      } catch (e: any) {
        this.logger.warn(`Google discovery failed: ${e.message}`);
      }
    }

    const openAiKey =
      await this.systemAdminAiService.getDecryptedApiKey('openai');
    if (openAiKey) {
      const openai = createOpenAI({ apiKey: openAiKey });
      this.cachedModel = openai('gpt-4o-mini');
      return this.cachedModel;
    }

    const anthropicKey =
      await this.systemAdminAiService.getDecryptedApiKey('anthropic');
    if (anthropicKey) {
      const anthropic = createAnthropic({ apiKey: anthropicKey });
      this.cachedModel = anthropic('claude-3-5-sonnet-latest');
      return this.cachedModel;
    }

    const opencodeKey =
      await this.systemAdminAiService.getDecryptedApiKey('opencode');
    if (opencodeKey) {
      const opencode = createOpenAI({
        apiKey: opencodeKey,
        baseURL: 'https://opencode.ai/zen/v1',
      });
      // Sensible default coding model from opencode
      this.cachedModel = opencode('opencode-go/kimi-k2.6');
      return this.cachedModel;
    }

    throw new BadRequestException('Žádný AI provider není dostupný.');
  }

  async seedClassroom(classroomId: string, count: number = 5) {
    const prompt = `Generate exactly ${count} realistic Czech student names (firstName, lastName). Return ONLY a valid JSON array of objects, no other text or markdown formatting. Example: [{"firstName": "Jan", "lastName": "Novák"}]`;
    const text = await this.safeGenerate(prompt);

    let studentsData = [];
    try {
      const jsonMatch = text.match(/\[([\s\S]*?)\]/);
      studentsData = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      return { success: false, message: 'Failed to parse AI response' };
    }

    const classroom = await this.db.queryOne<Classroom>(
      'SELECT schoolId FROM "Classroom" WHERE id = ?',
      [classroomId],
    );
    if (!classroom) throw new Error('Classroom not found');

    const createdStudents = [];
    for (const student of studentsData) {
      const email = `${student.firstName.toLowerCase()}.${student.lastName.toLowerCase()}.${crypto.randomBytes(2).toString('hex')}@skola.cz`;
      const userId = crypto.randomUUID();

      await this.db.transaction(async (db) => {
        await db.execute(
          'INSERT INTO "User" (id, email, firstName, lastName, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
          [
            userId,
            email,
            student.firstName,
            student.lastName,
            'seeded_password',
            new Date().toISOString(),
          ],
        );
        await db.execute(
          'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            userId,
            classroom.schoolId,
            UserRole.STUDENT,
            UserStatus.ACTIVE,
            new Date().toISOString(),
          ],
        );
        await db.execute(
          'INSERT INTO "StudentProfile" (id, userId, firstName, lastName, classroomId) VALUES (?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            userId,
            student.firstName,
            student.lastName,
            classroomId,
          ],
        );
      });
      createdStudents.push({ id: userId, email });
    }
    return {
      success: true,
      count: createdStudents.length,
      students: createdStudents,
    };
  }

  async refineText(data: {
    existingText?: string;
    context: string;
    instruction: string;
  }) {
    const prompt = `Jsi asistent. ${data.context}. ${data.instruction}. ${data.existingText || ''}`;
    const text = await this.safeGenerate(prompt);
    return { text: text.trim() };
  }

  async generateSchoolName(schoolType?: string) {
    const prompt = `Vygeneruj jeden stručný a realistický název pro českou školu typu: ${schoolType || 'ZŠ'}. Odpověz POUZE samotným názvem, bez uvozovek, bez vysvětlování a bez jakéhokoliv dalšího textu.`;
    const text = await this.safeGenerate(prompt);
    return {
      name: text
        .trim()
        .replace(/^["']|["']$/g, '')
        .split('\n')[0]
        .trim(),
    };
  }

  private async safeGenerate(prompt: string): Promise<string> {
    try {
      const model = await this.getModel();
      const { text } = await generateText({
        model,
        prompt,
        maxTokens: 500,
        temperature: 0.7,
      } as any);
      return text;
    } catch (e: any) {
      this.logger.warn(`AI generation failed: ${e.message}`);
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log('Using mock fallback for development');
        return this.getMockResponse(prompt);
      }
      throw e;
    }
  }

  private getMockResponse(prompt: string): string {
    const p = prompt.toLowerCase();
    if (p.includes('název pro školu') || p.includes('school name')) {
      if (p.includes('gymnázium')) return 'Gymnázium Jana Palacha';
      if (p.includes('střední') || p.includes('high_school'))
        return 'Střední průmyslová škola technická';
      if (p.includes('mateřská') || p.includes('kindergarten'))
        return 'MŠ Sluníčko';
      return 'Základní škola T. G. Masaryka';
    }
    if (p.includes('student names')) {
      return JSON.stringify([
        { firstName: 'Jan', lastName: 'Novák' },
        { firstName: 'Marie', lastName: 'Svobodová' },
        { firstName: 'Petr', lastName: 'Černý' },
        { firstName: 'Lucie', lastName: 'Kučerová' },
        { firstName: 'Martin', lastName: 'Marek' },
      ]);
    }
    return `Mock response for: ${prompt.substring(0, 30)}...`;
  }

  async generateThematicPlan(data: {
    subjectName: string;
    grade: string;
    topic: string;
    hoursPerWeek: number;
  }) {
    const prompt = `Vytvoř tematický plán pro předmět "${data.subjectName}", ${data.grade}. ročník. Dotace: ${data.hoursPerWeek}h/týden. Téma: ${data.topic}.`;
    const text = await this.safeGenerate(prompt);
    return { plan: text.trim() };
  }

  async generateStudentRecommendations(data: {
    studentName: string;
    grades: any[];
    attendance?: any;
    behavior?: string;
  }) {
    const prompt = `Navrhni doporučení pro studenta ${data.studentName} na základě jeho výsledků: ${JSON.stringify(data.grades)}.`;
    const text = await this.safeGenerate(prompt);
    return { recommendations: text.trim() };
  }

  async analyzeClassPerformance(data: { className: string; stats: any }) {
    const prompt = `Analyzuj prospěch třídy ${data.className}: ${JSON.stringify(data.stats)}`;
    const text = await this.safeGenerate(prompt);
    return { analysis: text.trim() };
  }

  async generateTest(data: {
    subjectName: string;
    grade: string;
    topic: string;
    questionCount?: number;
  }) {
    const prompt = `Vytvoř test pro předmět "${data.subjectName}", ${data.grade}. ročník. Téma: ${data.topic}.`;
    const text = await this.safeGenerate(prompt);
    return { test: text.trim() };
  }

  async generateWrittenTest(data: {
    subjectName: string;
    grade: string;
    topic: string;
  }) {
    const prompt = `Vytvoř písemku pro předmět "${data.subjectName}", ${data.grade}. ročník. Téma: ${data.topic}.`;
    const text = await this.safeGenerate(prompt);
    return { writtenTest: text.trim() };
  }
}
