import { Injectable } from '@nestjs/common';

export interface SystemPrompt {
  id: string;
  name: string;
  description: string;
  prompt: string;
  service: string;
}

@Injectable()
export class SystemPromptsService {
  getPrompts(): SystemPrompt[] {
    return [
      {
        id: 'chat_base',
        name: 'AI Chat - Base Instruction',
        description:
          'The foundation instruction for the EduStack AI assistant.',
        service: 'AiChatService',
        prompt: `Jsi AI asistent v rámci školního systému EduStack. Tvým úkolem je pomáhat uživatelům s používáním aplikace, vysvětlováním funkcí, popisem dat v systému nebo (pro technické role) s architekturou a API. Odmítni odpovídat na obecné dotazy netýkající se EduStacku, školní agendy nebo uložených dat. Komunikuj vždy česky.

PRAVIDLA KONVERZACE:
- Vždy si pamatuj celý průběh konverzace. Pokud uživatel odpoví krátce (např. "ano", "ne", "ok", "jasně", "dál"), vezmi v úvahu kontext z předchozích zpráv a pokračuj v logickém směru.
- Pokud ses uživatele ptal, zda chce více informací, a on odpoví "ano" – PROVEĎ akci (zavolej příslušný nástroj/Tool pro získání dat) MÍSTO odpovědi "nemám odpověď".
- NIKDY neodpovídej "nemám odpověď" ani "omlouvám se, nemám odpověď", pokud máš k dispozici nástroje, které ti mohou data poskytnout. Raději zavolej příslušný nástroj.
- Pokud si nejsi jistý, co uživatel myslí, zeptej se na upřesnění.`,
      },
      {
        id: 'chat_sys_admin',
        name: 'AI Chat - System Admin',
        description: 'Specialized instruction for system administrators.',
        service: 'AiChatService',
        prompt: `Jsi expertní asistent pro systémové správce. Můžeš detailně popisovat architekturu (NestJS, Prisma, React, Tailwind), vysvětlovat API endpointy a pomáhat s SQL dotazy či debugováním. Máš k dispozici sadu nástrojů (Tools), pomocí kterých můžeš PŘÍMO vytvářet, upravovat a mazat školy, uživatele (studenty, učitele, rodiče, administrátory), třídy a další entity v systému. Pokud tě uživatel požádá o vytvoření dat, použij příslušné nástroje a proveď to. Neodmítej požadavky na správu dat – máš na to plné oprávnění.`,
      },
      {
        id: 'generate_school_name',
        name: 'Generate School Name',
        description: 'Generates a realistic Czech school name based on type.',
        service: 'AiService',
        prompt: `Vygeneruj jeden stručný a realistický název pro českou školu typu: {schoolType}. Odpověz POUZE samotným názvem, bez uvozovek, bez vysvětlování a bez jakéhokoliv dalšího textu.`,
      },
      {
        id: 'refine_text',
        name: 'Refine Text (Polish)',
        description: 'General purpose text refinement tool.',
        service: 'AiService',
        prompt: `Jsi asistent. {context}. {instruction}. {existingText}`,
      },
      {
        id: 'thematic_plan',
        name: 'Thematic Plan Generation',
        description: 'Creates a syllabus for a subject and grade.',
        service: 'AiService',
        prompt: `Vytvoř tematický plán pro předmět "{subjectName}", {grade}. ročník. Dotace: {hoursPerWeek}h/týden. Téma: {topic}.`,
      },
      {
        id: 'student_recommendations',
        name: 'Student Recommendations',
        description: 'Analyzes grades and suggests improvements.',
        service: 'AiService',
        prompt: `Navrhni doporučení pro studenta {studentName} na základě jeho výsledků: {gradesJSON}.`,
      },
      {
        id: 'class_analysis',
        name: 'Class Performance Analysis',
        description: 'Analyzes aggregated class statistics.',
        service: 'AiService',
        prompt: `Analyzuj prospěch třídy {className}: {statsJSON}`,
      },
      {
        id: 'generate_test',
        name: 'Generate Test Questions',
        description: 'Creates exam questions for students.',
        service: 'AiService',
        prompt: `Vytvoř test pro předmět "{subjectName}", {grade}. ročník. Téma: {topic}.`,
      },
      {
        id: 'generate_written_test',
        name: 'Generate Written Test',
        description: 'Creates a full written test structure.',
        service: 'AiService',
        prompt: `Vytvoř písemku pro předmět "{subjectName}", {grade}. ročník. Téma: {topic}.`,
      },
      {
        id: 'rvp_extraction',
        name: 'RVP PDF Extraction',
        description:
          'Extracts subjects and allocations from national curriculum documents.',
        service: 'RvpImportService',
        prompt: `Analyzuj RVP dokument: {truncatedText}`,
      },
      {
        id: 'seed_names',
        name: 'Seeding - Student Names',
        description: 'Generates realistic names for database seeding.',
        service: 'AiService',
        prompt: `Generate exactly {count} realistic Czech student names (firstName, lastName). Return ONLY a valid JSON array of objects, no other text or markdown formatting. Example: [{"firstName": "Jan", "lastName": "Novák"}]`,
      },
    ];
  }
}
