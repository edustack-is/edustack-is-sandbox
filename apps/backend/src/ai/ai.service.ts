import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';
import { UserRole, UserStatus } from '@prisma/client';
import { SystemAdminAiService } from '../system-admin/system-admin-ai.service';

@Injectable()
export class AiService {
  constructor(
    private prisma: PrismaService,
    private systemAdminAiService: SystemAdminAiService,
  ) {}

  private async getModel() {
    const apiKey = await this.systemAdminAiService.getDecryptedApiKey('google');
    if (!apiKey) {
      throw new BadRequestException(
        'Google AI API klíč není nastaven. Nastavte ho v administraci.',
      );
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  async seedClassroom(classroomId: string, count: number = 5) {
    const prompt = `Generate ${count} Czech student names (firstName, lastName) in JSON format. Example: [{"firstName": "Jan", "lastName": "Novak"}, ...]`;

    const model = await this.getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from potential markdown code blocks
    const jsonMatch =
      text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\[([\s\S]*?)\]/);
    let studentsData = [];

    try {
      if (jsonMatch) {
        studentsData = JSON.parse(jsonMatch[1] ? jsonMatch[1] : jsonMatch[0]);
      } else {
        studentsData = JSON.parse(text);
      }
    } catch (e) {
      console.error('Failed to parse AI response', text);
      return { success: false, message: 'Failed to parse AI response' };
    }

    const createdStudents = [];

    // Fetch classroom to get schoolId
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { schoolId: true },
    });

    if (!classroom) {
      throw new Error('Classroom not found');
    }

    for (const student of studentsData) {
      const email = `${student.firstName.toLowerCase()}.${student.lastName.toLowerCase()}.${crypto.randomBytes(2).toString('hex')}@skola.cz`;

      const user = await this.prisma.user.create({
        data: {
          email,
          firstName: student.firstName,
          lastName: student.lastName,
          passwordHash: 'seeded_password', // In real app, hash this
          schoolMemberships: {
            create: {
              schoolId: classroom.schoolId,
              role: UserRole.STUDENT,
              status: UserStatus.ACTIVE,
            },
          },
          studentProfile: {
            create: {
              firstName: student.firstName,
              lastName: student.lastName,
              classroomId,
            },
          },
        },
        include: {
          studentProfile: true,
          schoolMemberships: true,
        },
      });
      createdStudents.push(user);
    }

    return {
      success: true,
      count: createdStudents.length,
      students: createdStudents,
    };
  }

  // ─── AI TEXT REFINEMENT (generic field helper) ───────────

  /**
   * Generic AI text generation / refinement for any text field.
   * Can generate from scratch with context, or refine existing text.
   */
  async refineText(data: {
    existingText?: string;
    context: string;
    instruction: string;
  }): Promise<{ text: string }> {
    const prompt = data.existingText
      ? `Jsi asistent pro školní informační systém. Vylepši následující text na základě pokynů.\n\nKontext: ${data.context}\nPokyn: ${data.instruction}\n\nPůvodní text:\n${data.existingText}\n\nVylepšený text:`
      : `Jsi asistent pro školní informační systém. Vygeneruj text na základě pokynů.\n\nKontext: ${data.context}\nPokyn: ${data.instruction}\n\nVygenerovaný text:`;

    const model = await this.getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { text: response.text().trim() };
  }

  async generateSchoolName(schoolType?: string): Promise<{ name: string }> {
    let typeContext = 'základní škola';
    if (schoolType?.includes('gymnasium')) {
      typeContext = 'gymnázium';
    } else if (schoolType === 'elementary_1') {
      typeContext = 'základní škola (pouze 1. stupeň)';
    }

    const prompt = `
Vygeneruj jeden náhodný, ale vysoce realistický a uvěřitelný název pro českou školu typu: ${typeContext}.
Název by měl znít jako skutečná existující instituce v ČR (např. může obsahovat jméno ulice, čtvrti, města, osobnosti, zaměření atd.).
Může to být například:
- Základní škola a Mateřská škola, Praha 3, Náměstí Jiřího z Poděbrad 7
- Gymnázium J. K. Tyla, Hradec Králové
- Základní škola T. G. Masaryka, Poděbrady
- Sportovní základní škola, Liberec
- První české gymnázium v Karlových Varech

Vrať POUZE název školy, nic jiného. Nepřidávej žádné uvozovky ani vysvětlující text.
        `;

    const model = await this.getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const name = response
      .text()
      .trim()
      .replace(/^["']|["']$/g, '');
    return { name };
  }

  // ─── THEMATIC PLAN GENERATION ───────────────────────────

  async generateThematicPlan(data: {
    subjectName: string;
    grade: string;
    hoursPerWeek: number;
    semesterWeeks?: number;
    topics?: string;
  }): Promise<{ plan: string }> {
    const weeks = data.semesterWeeks || 20;
    const prompt = `Jsi zkušený český učitel. Vygeneruj tematický plán pro předmět "${data.subjectName}" pro ${data.grade}. ročník.
Hodin týdně: ${data.hoursPerWeek}
Počet týdnů: ${weeks}
${data.topics ? `Zohledni témata: ${data.topics}` : ''}

Formát: tabulka s číslem týdne, tématem, počtem hodin, a poznámkami k aktivitám.
Odpověz v markdown tabulce.`;

    const model = await this.getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { plan: response.text().trim() };
  }

  // ─── STUDENT RECOMMENDATIONS ────────────────────────────

  async generateStudentRecommendations(data: {
    studentName: string;
    grades: Array<{ subject: string; grade: number }>;
    attendance?: { total: number; absent: number };
    behavior?: string;
  }): Promise<{ recommendations: string }> {
    const gradesStr = data.grades
      .map((g) => `${g.subject}: ${g.grade}`)
      .join(', ');
    const attendanceStr = data.attendance
      ? `Docházka: ${data.attendance.total - data.attendance.absent}/${data.attendance.total} (${Math.round((1 - data.attendance.absent / data.attendance.total) * 100)}%)`
      : '';

    const prompt = `Jsi školní poradce v českém školství. Na základě následujících dat vytvoř individuální doporučení pro studenta.

Student: ${data.studentName}
Známky: ${gradesStr}
${attendanceStr}
${data.behavior ? `Chování: ${data.behavior}` : ''}

Vytvoř:
1. Silné stránky studenta
2. Oblasti pro zlepšení
3. Konkrétní doporučení (studijní techniky, doplňková výuka, apod.)
4. Doporučení pro rodiče

Piš česky, stručně a konstruktivně.`;

    const model = await this.getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { recommendations: response.text().trim() };
  }

  // ─── CLASS PERFORMANCE ANALYSIS ─────────────────────────

  async analyzeClassPerformance(data: {
    className: string;
    grades: Array<{ student: string; subject: string; grade: number }>;
    subjectName?: string;
  }): Promise<{ analysis: string }> {
    const gradesStr = data.grades
      .map((g) => `${g.student} – ${g.subject}: ${g.grade}`)
      .join('\n');

    const prompt = `Jsi analytik školních dat. Analyzuj prospěch třídy ${data.className}${data.subjectName ? ` v předmětu ${data.subjectName}` : ''}.

Data známek:
${gradesStr}

Poskytni:
1. Souhrnnou statistiku (průměr, medián, rozložení známek)
2. Identifikaci studentů s vynikajícími výsledky
3. Identifikaci studentů, kteří potřebují podporu
4. Trendy a vzory ve výkonnosti
5. Doporučení pro učitele

Použij českou terminologii. Formátuj přehledně v markdown.`;

    const model = await this.getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { analysis: response.text().trim() };
  }

  // ─── TEST GENERATION ────────────────────────────────────

  async generateTest(data: {
    subjectName: string;
    topic: string;
    grade: string;
    questionCount?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    questionTypes?: string;
  }): Promise<{ test: string }> {
    const count = data.questionCount || 10;
    const diff =
      data.difficulty === 'easy'
        ? 'snadná'
        : data.difficulty === 'hard'
          ? 'těžká'
          : 'střední';
    const types =
      data.questionTypes || 'výběr z možností, doplňování, otevřené otázky';

    const prompt = `Jsi zkušený český učitel. Vytvoř test pro předmět "${data.subjectName}", téma "${data.topic}", ${data.grade}. ročník.

Počet otázek: ${count}
Obtížnost: ${diff}
Typy otázek: ${types}

Pro každou otázku uveď:
- Číslo a text otázky
- Možné odpovědi (u výběru)
- Správnou odpověď
- Bodové ohodnocení

Na konci uveď celkový počet bodů a klíč odpovědí.
Formátuj v markdown.`;

    const model = await this.getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { test: response.text().trim() };
  }

  // ─── WRITTEN TEST (PÍSEMKA) GENERATION ──────────────────

  async generateWrittenTest(data: {
    subjectName: string;
    topics: string[];
    grade: string;
    duration?: number;
    variantCount?: number;
  }): Promise<{ writtenTest: string }> {
    const dur = data.duration || 45;
    const variants = data.variantCount || 2;
    const topicsStr = data.topics.join(', ');

    const prompt = `Jsi zkušený český učitel. Vytvoř písemnou práci (písemku) pro předmět "${data.subjectName}", ${data.grade}. ročník.

Témata: ${topicsStr}
Doba trvání: ${dur} minut
Počet variant: ${variants}

Pro každou variantu vytvoř:
- Hlavičku s názvem předmětu, třídou, datem, jménem studenta
- Úlohy odstupňované podle obtížnosti
- Bodové ohodnocení za každou úlohu
- Celkový počet bodů
- Klasifikační tabulku (body → známka)

Formátuj přehledně v markdown, varianty odděl.`;

    const model = await this.getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { writtenTest: response.text().trim() };
  }
}
