/**
 * Script to add @ApiOperation and @ApiResponse decorators to all NestJS controller methods.
 * Run with: npx ts-node scripts/add-swagger-ops.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..', 'src');

// Map of controller file → method name → summary (Czech)
const OPS: Record<string, Record<string, string>> = {
    // ─── AUTH ────────────────────────────────────────────────
    'auth/auth.controller.ts': {
        getSsoOptions: 'Dostupní SSO poskytovatelé',
        ssoAuth: 'Přesměrování na SSO poskytovatele',
        ssoCallback: 'Callback z SSO poskytovatele',
        exchangeSsoToken: 'Výměna SSO cookie za JWT',
        inviteUser: 'Odeslání pozvánky uživateli',
        acceptInvite: 'Přijetí pozvánky a nastavení hesla',
        forgotPassword: 'Žádost o reset hesla',
        resetPassword: 'Reset hesla pomocí tokenu',
        getIdentities: 'Propojené SSO identity uživatele',
        impersonate: 'Impersonace jiného uživatele (admin)',
        login: 'Přihlášení e-mailem a heslem',
        getSchools: 'Seznam škol uživatele',
        selectSchool: 'Výběr školy a role',
        refreshGlobal: 'Obnovení globálního JWT tokenu',
        getMe: 'Profil přihlášeného uživatele',
        updateProfile: 'Aktualizace profilu',
        uploadAvatar: 'Nahrání avataru',
    },
    // ─── GRADING ─────────────────────────────────────────────
    'grading/grading.controller.ts': {
        createGrade: 'Vytvoření známky',
        updateGrade: 'Úprava známky',
        deleteGrade: 'Smazání známky',
        getGradesForClassroom: 'Známky třídy',
        getStudentGrades: 'Známky studenta',
        getAverage: 'Vážený průměr studenta za předmět',
        getReportCards: 'Vysvědčení třídy za semestr',
        upsertReportCard: 'Uložení/aktualizace vysvědčení',
        polishVerbalEvaluation: 'AI vylepšení slovního hodnocení',
        getGradingTypes: 'Typy hodnocení třídy',
        upsertBehaviorGrade: 'Hodnocení chování',
        getBehaviorGrades: 'Hodnocení chování třídy',
        upsertCompetencyGrade: 'Hodnocení kompetence',
        getCompetencyGrades: 'Kompetence studenta',
        createMeasure: 'Výchovné opatření (pochvala/důtka)',
        getMeasures: 'Seznam výchovných opatření',
        deleteMeasure: 'Smazání výchovného opatření',
        getGradeHistory: 'Historie známek studenta',
        getReportCardHtml: 'Vysvědčení třídy (tisk HTML)',
        getCommissionExams: 'Komisionální přezkoušení',
        updateCommissionExam: 'Aktualizace komisionálního přezkoušení',
        createCommissionExam: 'Vytvoření komisionálního přezkoušení',
        deleteCommissionExam: 'Smazání komisionálního přezkoušení',
        getGradingDeadline: 'Deadline klasifikace',
        upsertGradingDeadline: 'Nastavení deadline klasifikace',
    },
    // ─── SCHEDULE ────────────────────────────────────────────
    'schedule/schedule.controller.ts': {
        getTimeSlots: 'Časové sloty (zvonění)',
        upsertTimeSlots: 'Nastavení časových slotů',
        getEvents: 'Rozvrhové události',
        createEvent: 'Vytvoření rozvrhové události',
        updateEvent: 'Úprava rozvrhové události',
        deleteEvent: 'Smazání rozvrhové události',
        bulkCreateEvents: 'Hromadné vytvoření událostí',
        validateCollision: 'Kontrola kolizí rozvrhu',
        getClassroomSchedule: 'Rozvrh třídy',
        getTeacherSchedule: 'Rozvrh učitele',
        getStudentSchedule: 'Rozvrh studenta',
        getSubstitutions: 'Suplování',
        createSubstitution: 'Vytvoření suplování',
        updateSubstitution: 'Úprava suplování',
        deleteSubstitution: 'Smazání suplování',
        generateSchedule: 'Automatické generování rozvrhu',
        exportHtml: 'Export rozvrhu (HTML tisk)',
        getSnapshots: 'Snapshoty rozvrhu',
        createSnapshot: 'Vytvoření snapshotu',
        diffSnapshots: 'Porovnání dvou snapshotů',
        getRecurringEvents: 'Opakující se události (kroužky)',
        createRecurringEvent: 'Vytvoření kroužku',
        updateRecurringEvent: 'Úprava kroužku',
        deleteRecurringEvent: 'Smazání kroužku',
    },
    // ─── ATTENDANCE ──────────────────────────────────────────
    'attendance/attendance.controller.ts': {
        recordAttendance: 'Záznam docházky třídy',
        getClassroomAttendance: 'Docházka třídy za den',
        createExcuse: 'Omluvenka absence (rodič)',
        getExcuses: 'Seznam omluvenek',
        reviewExcuse: 'Schválení/zamítnutí omluvenky',
        getClassStatistics: 'Statistiky docházky třídy',
        exportCsv: 'Export docházky (CSV)',
        getUnexcusedAlerts: 'Upozornění na neomluvené hodiny',
    },
    // ─── MESSAGING ───────────────────────────────────────────
    'messaging/messaging.controller.ts': {
        getConversations: 'Seznam konverzací',
        getMessages: 'Zprávy v konverzaci',
        sendMessage: 'Odeslání zprávy',
        createConversation: 'Vytvoření konverzace',
        getAvailableRecipients: 'Dostupní příjemci',
        getAvailableClassrooms: 'Dostupné třídy pro broadcast',
        createClassBroadcast: 'Hromadná zpráva třídě',
        createSchoolBroadcast: 'Hromadná zpráva škole',
        getNotifications: 'Seznam notifikací',
        getUnreadCount: 'Počet nepřečtených notifikací',
        markAsRead: 'Označení notifikace jako přečtené',
        markAllRead: 'Označení všech notifikací jako přečtených',
        toggleEmailNotifications: 'Zapnutí/vypnutí e-mailových notifikací',
    },
    // ─── COMMUNITY ───────────────────────────────────────────
    'community/community.controller.ts': {
        createBulletinPost: 'Vytvoření příspěvku na nástěnku',
        getBulletinPosts: 'Seznam příspěvků na nástěnce',
        updateBulletinPost: 'Úprava příspěvku na nástěnce',
        deleteBulletinPost: 'Smazání příspěvku z nástěnky',
        createPoll: 'Vytvoření ankety',
        getPolls: 'Seznam anket',
        vote: 'Hlasování v anketě',
        deletePoll: 'Smazání ankety',
        createCalendarEvent: 'Vytvoření události v kalendáři',
        getCalendarEvents: 'Události v kalendáři',
        rsvpEvent: 'RSVP na událost',
        deleteCalendarEvent: 'Smazání události',
    },
    // ─── CLASSBOOK ───────────────────────────────────────────
    'classbook/classbook.controller.ts': {
        getEntries: 'Záznamy třídní knihy za den',
        upsertEntry: 'Uložení záznamu do třídní knihy',
        signEntry: 'Elektronický podpis záznamu',
        getEntriesRange: 'Záznamy třídní knihy za období',
        printClassBook: 'Tisk třídní knihy (HTML)',
        getAttendance: 'Docházka pro hodinu v třídní knize',
    },
    // ─── DEPUTY ──────────────────────────────────────────────
    'deputy/deputy.controller.ts': {
        getSchoolDashboard: 'Dashboard školy',
        getClassrooms: 'Seznam tříd',
        createClassroom: 'Vytvoření třídy',
        updateClassroom: 'Úprava třídy',
        deleteClassroom: 'Smazání třídy',
        getSubjects: 'Šablony předmětů',
        createSubject: 'Vytvoření šablony předmětu',
        updateSubject: 'Úprava šablony předmětu',
        deleteSubject: 'Smazání šablony předmětu',
        getRooms: 'Seznam místností',
        createRoom: 'Vytvoření místnosti',
        updateRoom: 'Úprava místnosti',
        deleteRoom: 'Smazání místnosti',
        getBuildings: 'Seznam budov',
        createBuilding: 'Vytvoření budovy',
        updateBuilding: 'Úprava budovy',
        deleteBuilding: 'Smazání budovy',
        shareRoom: 'Sdílení místnosti s jinou školou',
        unshareRoom: 'Zrušení sdílení místnosti',
        getSharedRooms: 'Sdílené místnosti',
        getEvents: 'Události školního roku',
        getUpcomingEvents: 'Nadcházející události',
        createEvent: 'Vytvoření události',
        updateEvent: 'Úprava události',
        deleteEvent: 'Smazání události',
        inviteUser: 'Pozvání uživatele do školy',
        getUsers: 'Seznam uživatelů školy',
        updateUser: 'Úprava uživatele',
        reinviteUser: 'Opakované odeslání pozvánky',
        removeUser: 'Odebrání uživatele ze školy',
        createStudentWithFamily: 'Vytvoření studenta s rodinou',
        setAlumni: 'Nastavení absolventa',
        getAuditLog: 'Audit log školy',
        getSchoolSettings: 'Nastavení školy',
        updateSchoolSettings: 'Uložení nastavení školy',
        exportUsersCsv: 'Export uživatelů (CSV)',
        suspendUser: 'Suspendování uživatele',
        reactivateUser: 'Reaktivace uživatele',
    },
    // ─── DEPUTY CURRICULUM ───────────────────────────────────
    'deputy/deputy-curriculum.controller.ts': {
        getAcademicYears: 'Školní roky',
        createAcademicYear: 'Vytvoření školního roku',
        getGradeLevels: 'Ročníky',
        createGradeLevel: 'Vytvoření ročníku',
        updateGradeLevel: 'Úprava ročníku',
        deleteGradeLevel: 'Smazání ročníku',
        getTeachers: 'Seznam učitelů',
        getTeacherWorkloads: 'Úvazky učitelů',
        saveTeacherWorkload: 'Uložení úvazku učitele',
        getSubjectInstances: 'Instance předmětů',
        createSubjectInstance: 'Vytvoření instance předmětu',
        getCurriculumVersions: 'Verze ŠVP',
        compareCurriculumVersions: 'Porovnání verzí ŠVP',
        getCurriculumVersion: 'Detail verze ŠVP',
        createCurriculumVersion: 'Vytvoření verze ŠVP',
        updateCurriculumVersion: 'Úprava verze ŠVP',
        deleteCurriculumVersion: 'Smazání verze ŠVP',
        duplicateCurriculumVersion: 'Duplikace verze ŠVP',
        saveCurriculumEntry: 'Uložení záznamu ŠVP',
        deleteCurriculumEntry: 'Smazání záznamu ŠVP',
        getCompetencies: 'Kompetence',
        getCompetencyMatrix: 'Matice kompetencí',
        toggleCompetencyMapping: 'Přepnutí mapování kompetence',
        uploadRvp: 'Upload RVP souboru',
        getLastRvpUpload: 'Poslední nahraný RVP',
        confirmRvp: 'Potvrzení importu RVP',
        getThematicPlans: 'Tematické plány',
        upsertThematicPlan: 'Uložení tematického plánu',
        getTeachingMaterials: 'Výukové materiály',
        createTeachingMaterial: 'Vytvoření výukového materiálu',
        updateTeachingMaterial: 'Úprava výukového materiálu',
        deleteTeachingMaterial: 'Smazání výukového materiálu',
        getLessonPlans: 'Přípravy na hodiny',
        createLessonPlan: 'Vytvoření přípravy na hodinu',
        updateLessonPlan: 'Úprava přípravy na hodinu',
        deleteLessonPlan: 'Smazání přípravy na hodinu',
        getSemesters: 'Semestry školního roku',
        upsertSemesters: 'Uložení semestrů',
        batchEnroll: 'Hromadný zápis studentů',
        getStudentEnrollments: 'Zápisy studentů v ročníku',
    },
    // ─── USERS ───────────────────────────────────────────────
    'users/users.controller.ts': {
        importUsers: 'Import uživatelů z CSV',
        findAll: 'Seznam všech uživatelů',
        findOne: 'Detail uživatele',
    },
    // ─── STUDENT ─────────────────────────────────────────────
    'student/student.controller.ts': {
        getMyData: 'Data přihlášeného studenta',
        getSchedule: 'Rozvrh studenta',
    },
    // ─── PARENT ──────────────────────────────────────────────
    'parent/parent.controller.ts': {
        getChildren: 'Seznam dětí rodiče',
        getChildDashboard: 'Dashboard dítěte',
    },
    // ─── TEACHER ─────────────────────────────────────────────
    'teacher/teacher.controller.ts': {
        getMySchedule: 'Rozvrh učitele (všechny školy)',
        getClasses: 'Třídy a studenti učitele',
        createGrade: 'Zadání známky studentovi',
        createAttendance: 'Záznam docházky studenta',
    },
    // ─── PRINCIPAL ───────────────────────────────────────────
    'principal/principal.controller.ts': {
        getAuditLog: 'Audit log školy',
    },
    // ─── SYSTEM ADMIN ────────────────────────────────────────
    'system-admin/system-admin.controller.ts': {
        getDashboard: 'Dashboard systému',
        getSchools: 'Seznam škol',
        createSchool: 'Vytvoření školy',
        updateSchool: 'Úprava školy',
        softDeleteSchool: 'Soft delete školy',
        getSchool: 'Detail školy',
        getAdmins: 'Seznam administrátorů',
        promoteAdmin: 'Povýšení na administrátora',
        demoteAdmin: 'Odebrání administrátorských práv',
        getSsoConfig: 'Konfigurace SSO',
        saveSsoConfig: 'Uložení konfigurace SSO',
        getSettings: 'Systémová nastavení',
        saveSettings: 'Uložení systémových nastavení',
        getGlobalAuditLog: 'Globální audit log',
    },
    // ─── SYSTEM ADMIN AI ─────────────────────────────────────
    'system-admin/system-admin-ai.controller.ts': {
        getAiConfig: 'Konfigurace AI',
        saveAiConfig: 'Uložení konfigurace AI',
        testAi: 'Test AI připojení',
        getAiUsage: 'Spotřeba AI',
    },
    // ─── BACKUP ──────────────────────────────────────────────
    'system-admin/backup.controller.ts': {
        listBackups: 'Seznam záloh',
        createBackup: 'Vytvoření zálohy',
        downloadBackup: 'Stažení zálohy',
        restoreBackup: 'Obnovení ze zálohy',
        deleteBackup: 'Smazání zálohy',
    },
    // ─── MONITORING ──────────────────────────────────────────
    'system-admin/monitoring.controller.ts': {
        healthCheck: 'Health check (liveness probe)',
        getMetrics: 'Metriky systému',
    },
    // ─── TEST DATA ───────────────────────────────────────────
    'system-admin/test-data.controller.ts': {
        generateTestData: 'Generování testovacích dat',
        generateAll: 'Generování kompletních testovacích dat',
    },
    // ─── AI ──────────────────────────────────────────────────
    'ai/ai.controller.ts': {
        chat: 'AI chat (streaming)',
        generateStudents: 'AI generování studentů',
        refineText: 'AI vylepšení textu',
        generateThematicPlan: 'AI generování tematického plánu',
        generateStudentRecommendation: 'AI doporučení pro studenta',
        generateVerbalEvaluation: 'AI generování slovního hodnocení',
        analyzeClassPerformance: 'AI analýza prospěchu třídy',
        generateTest: 'AI generování testu',
        generateExam: 'AI generování písemky',
    },
    // ─── REGISTRY ────────────────────────────────────────────
    'registry/registry.controller.ts': {
        getClassrooms: 'Třídy v matrice',
        createClassroom: 'Vytvoření třídy v matrice',
    },
};

// Controllers that DON'T require auth (no 401/403 errors)
const PUBLIC_CONTROLLERS = new Set([
    'system-admin/monitoring.controller.ts',
]);

// Controllers that use @Public() on some methods
const PARTIAL_PUBLIC_METHODS = new Set([
    'getSsoOptions', 'ssoAuth', 'ssoCallback', 'exchangeSsoToken',
    'acceptInvite', 'forgotPassword', 'resetPassword', 'login',
    'healthCheck',
]);

let totalAdded = 0;

for (const [relPath, methods] of Object.entries(OPS)) {
    const filePath = path.join(SRC, relPath);
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  File not found: ${relPath}`);
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    let fileModified = false;

    // Ensure ApiOperation + ApiResponse are imported
    const swaggerImports = ['ApiOperation', 'ApiResponse'];
    for (const imp of swaggerImports) {
        if (!content.includes(imp)) {
            if (content.includes("from '@nestjs/swagger'")) {
                content = content.replace(
                    /import \{([^}]+)\} from '@nestjs\/swagger'/,
                    (match, imports) => `import {${imports}, ${imp} } from '@nestjs/swagger'`
                );
                fileModified = true;
            }
        }
    }

    for (const [methodName, summary] of Object.entries(methods)) {
        // Check if @ApiOperation already exists for this method
        const methodRegex = new RegExp(`@ApiOperation\\([^)]*\\)\\s*\\n[\\s\\S]{0,300}?async\\s+${methodName}\\b`);
        if (methodRegex.test(content)) continue; // Already has @ApiOperation

        // Find the method and add @ApiOperation + error @ApiResponses before it
        const asyncRegex = new RegExp(`(\\s+)(async\\s+${methodName}\\b)`, 'g');
        const match = asyncRegex.exec(content);
        if (match) {
            const indent = match[1];
            const isPublic = PARTIAL_PUBLIC_METHODS.has(methodName) || PUBLIC_CONTROLLERS.has(relPath);

            let decorators = `${indent}@ApiOperation({ summary: '${summary}' })`;

            // Add common error responses
            if (!isPublic) {
                decorators += `\n${indent}@ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })`;
                decorators += `\n${indent}@ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })`;
            }

            // POST/PUT/PATCH methods get 400 (validation)
            if (/create|upsert|update|save|record|invite|import|upload|setup|vote|review|send|toggle|bulk|batch|promote|demote|share|generate|confirm|sign|rsvp/i.test(methodName)) {
                decorators += `\n${indent}@ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })`;
            }

            // Methods with :id params get 404
            // Check if the method signature has @Param
            const methodBlock = content.slice(match.index, match.index + 500);
            if (methodBlock.includes('@Param(')) {
                decorators += `\n${indent}@ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })`;
            }

            const replacement = `${decorators}\n${indent}${match[2]}`;
            content = content.slice(0, match.index) + replacement + content.slice(match.index + match[0].length);
            totalAdded++;
            fileModified = true;
        }
    }

    if (fileModified) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ ${relPath}: ${Object.keys(methods).length} operations`);
    }
}

console.log(`\n🎯 Total @ApiOperation decorators added: ${totalAdded}`);
