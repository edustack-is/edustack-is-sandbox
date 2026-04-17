import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { UserRole, UserStatus } from '@prisma/client';
import { SystemAdminAiService } from '../system-admin/system-admin-ai.service';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private systemAdminAiService: SystemAdminAiService,
  ) {}

  private cachedModel: any = null;

  /**
   * Dynamically gets the first available AI model provider.
   * Uses Vercel AI SDK providers for consistency with AiChatService.
   */
  private async getModel() {
    if (this.cachedModel) return this.cachedModel;

    const googleKey = await this.systemAdminAiService.getDecryptedApiKey('google');
    if (googleKey) {
      try {
        const available = await this.systemAdminAiService.getDiscoverableGoogleModels();
        if (available.length > 0) {
          const modelName = available.find(n => n.toLowerCase().includes('flash')) || available[0];
          this.logger.log(`Using discovered Google model: ${modelName}`);
          const google = createGoogleGenerativeAI({ apiKey: googleKey });
          this.cachedModel = google(modelName);
          return this.cachedModel;
        }
      } catch (e) {
        this.logger.warn(`Google discovery failed: ${e.message}`);
      }
    }

    const openAiKey = await this.systemAdminAiService.getDecryptedApiKey('openai');
    if (openAiKey) {
      this.logger.log('Using OpenAI (gpt-4o-mini)');
      const openai = createOpenAI({ apiKey: openAiKey });
      this.cachedModel = openai('gpt-4o-mini');
      return this.cachedModel;
    }

    const anthropicKey = await this.systemAdminAiService.getDecryptedApiKey('anthropic');
    if (anthropicKey) {
      this.logger.log('Using Anthropic (claude-3-haiku)');
      const anthropic = createAnthropic({ apiKey: anthropicKey });
      this.cachedModel = anthropic('claude-3-haiku-20240307');
      return this.cachedModel;
    }

    throw new BadRequestException('Žádný AI provider není dostupný. Zkontrolujte API klíče.');
  }

  async seedClassroom(classroomId: string, count: number = 5) {
    const prompt = `Generate ${count} Czech student names (firstName, lastName) in JSON format. Example: [{"firstName": "Jan", "lastName": "Novak"}, ...]`;
    const model = await this.getModel();
    const { text } = await generateText({ model, prompt });

    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\[([\s\S]*?)\]/);
    let studentsData = [];
    try {
      studentsData = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text);
    } catch (e) {
      this.logger.error('Failed to parse AI response', text);
      return { success: false, message: 'Failed to parse AI response' };
    }

    const classroom = await this.prisma.classroom.findUnique({ where: { id: classroomId }, select: { schoolId: true } });
    if (!classroom) throw new Error('Classroom not found');

    const createdStudents = [];
    for (const student of studentsData) {
      const email = `${student.firstName.toLowerCase()}.${student.lastName.toLowerCase()}.${crypto.randomBytes(2).toString('hex')}@skola.cz`;
      const user = await this.prisma.user.create({
        data: {
          email, firstName: student.firstName, lastName: student.lastName, passwordHash: 'seeded_password',
          schoolMemberships: { create: { schoolId: classroom.schoolId, role: UserRole.STUDENT, status: UserStatus.ACTIVE } },
          studentProfile: { create: { firstName: student.firstName, lastName: student.lastName, classroomId } },
        }
      });
      createdStudents.push(user);
    }
    return { success: true, count: createdStudents.length, students: createdStudents };
  }

  async refineText(data: { existingText?: string; context: string; instruction: string }): Promise<{ text: string }> {
    const prompt = data.existingText
      ? `Jsi asistent pro školní informační systém. Vylepši následující text na základě pokynů.\n\nKontext: ${data.context}\nPokyn: ${data.instruction}\n\nPůvodní text:\n${data.existingText}\n\nVylepšený text:`
      : `Jsi asistent pro školní informační systém. Vygeneruj text na základě pokynů.\n\nKontext: ${data.context}\nPokyn: ${data.instruction}\n\nVygenerovaný text:`;
    const model = await this.getModel();
    const { text } = await generateText({ model, prompt });
    return { text: text.trim() };
  }

  async generateSchoolName(schoolType?: string): Promise<{ name: string }> {
    let typeContext = 'základní škola';
    if (schoolType?.includes('gymnasium')) typeContext = 'gymnázium';
    else if (schoolType === 'elementary_1') typeContext = 'základní škola (pouze 1. stupeň)';

    const prompt = `Vygeneruj jeden náhodný realistický název pro českou školu typu: ${typeContext}. Vrať POUZE název bez uvozovek.`;
    const model = await this.getModel();
    const { text } = await generateText({ model, prompt });
    return { name: text.trim().replace(/^["']|["']$/g, '') };
  }

  async generateThematicPlan(data: any): Promise<{ plan: string }> {
    const weeks = data.semesterWeeks || 20;
    const prompt = `Vygeneruj tematický plán pro předmět "${data.subjectName}" pro ${data.grade}. ročník. Týdnů: ${weeks}. Tabulka markdown.`;
    const model = await this.getModel();
    const { text } = await generateText({ model, prompt });
    return { plan: text.trim() };
  }

  async generateStudentRecommendations(data: any): Promise<{ recommendations: string }> {
    const prompt = `Vytvoř doporučení pro studenta ${data.studentName} na základě známek.`;
    const model = await this.getModel();
    const { text } = await generateText({ model, prompt });
    return { recommendations: text.trim() };
  }

  async analyzeClassPerformance(data: any): Promise<{ analysis: string }> {
    const prompt = `Analyzuj prospěch třídy ${data.className}.`;
    const model = await this.getModel();
    const { text } = await generateText({ model, prompt });
    return { analysis: text.trim() };
  }

  async generateTest(data: any): Promise<{ test: string }> {
    const prompt = `Vytvoř test pro předmět "${data.subjectName}", téma "${data.topic}".`;
    const model = await this.getModel();
    const { text } = await generateText({ model, prompt });
    return { test: text.trim() };
  }

  async generateWrittenTest(data: any): Promise<{ writtenTest: string }> {
    const prompt = `Vytvoř písemku pro předmět "${data.subjectName}", ${data.grade}. ročník.`;
    const model = await this.getModel();
    const { text } = await generateText({ model, prompt });
    return { writtenTest: text.trim() };
  }
}
