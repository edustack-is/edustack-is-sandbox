/**
 * Adds @ApiResponse({ status: 200/201, description: '...', type: XxxDto })
 * to EVERY async controller method that doesn't yet have a success response type.
 *
 * Run with: node scripts/add-success-responses.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

// ─── RESPONSE MAPPINGS ─────────────────────────────────
// Maps: 'file' → 'method' → { status, desc, type?, isArray? }
const RESPONSES = {
  'auth/auth.controller.ts': {
    getSsoOptions: {
      s: 200,
      d: 'Seznam SSO poskytovatelů.',
      t: 'SsoOptionDto',
      arr: true,
    },
    ssoAuth: { s: 302, d: 'Přesměrování na SSO poskytovatele.' },
    ssoCallback: { s: 302, d: 'Přesměrování s SSO tokenem.' },
    exchangeSsoToken: {
      s: 200,
      d: 'JWT token po SSO přihlášení.',
      t: 'LoginResponseDto',
    },
    inviteUser: { s: 201, d: 'Pozvánka odeslána.', t: 'SuccessResponseDto' },
    acceptInvite: { s: 200, d: 'Účet aktivován.', t: 'SuccessResponseDto' },
    forgotPassword: {
      s: 200,
      d: 'E-mail s odkazem odeslán.',
      t: 'SuccessResponseDto',
    },
    resetPassword: { s: 200, d: 'Heslo změněno.', t: 'SuccessResponseDto' },
    getIdentities: { s: 200, d: 'Seznam propojených SSO identit.' },
    impersonate: {
      s: 200,
      d: 'JWT token impersonovaného uživatele.',
      t: 'LoginResponseDto',
    },
    login: { s: 200, d: 'Přihlášení úspěšné.', t: 'LoginResponseDto' },
    getSchools: {
      s: 200,
      d: 'Školy uživatele.',
      t: 'SchoolListItemDto',
      arr: true,
    },
    selectSchool: {
      s: 200,
      d: 'Tenant token pro vybranou školu.',
      t: 'SelectSchoolResponseDto',
    },
    refreshGlobal: {
      s: 200,
      d: 'Nový globální JWT token.',
      t: 'LoginResponseDto',
    },
    getMe: { s: 200, d: 'Profil přihlášeného uživatele.', t: 'UserProfileDto' },
    updateProfile: { s: 200, d: 'Aktualizovaný profil.', t: 'UserProfileDto' },
    uploadAvatar: { s: 200, d: 'URL nahraného avataru.' },
    parseCookies: null, // private, not endpoint
  },
  'grading/grading.controller.ts': {
    createGrade: { s: 201, d: 'Vytvořená známka.', t: 'GradeResponseDto' },
    updateGrade: { s: 200, d: 'Aktualizovaná známka.', t: 'GradeResponseDto' },
    deleteGrade: { s: 200, d: 'Známka smazána.', t: 'SuccessResponseDto' },
    getGradesForClassroom: { s: 200, d: 'Známky třídy – pole objektů.' },
    getStudentGrades: { s: 200, d: 'Známky studenta – pole objektů.' },
    getAverage: { s: 200, d: 'Vážený průměr studenta.' },
    getReportCards: { s: 200, d: 'Vysvědčení třídy – pole.' },
    upsertReportCard: { s: 200, d: 'Uložené vysvědčení.' },
    polishVerbalEvaluation: { s: 200, d: 'AI vylepšený text.' },
    getGradingTypes: { s: 200, d: 'Typy hodnocení pro třídu.' },
    upsertBehaviorGrade: { s: 200, d: 'Uložené hodnocení chování.' },
    getBehaviorGrades: { s: 200, d: 'Hodnocení chování – pole.' },
    upsertCompetencyGrade: { s: 200, d: 'Uložené hodnocení kompetence.' },
    getCompetencyGrades: { s: 200, d: 'Kompetence studenta – pole.' },
    createMeasure: { s: 201, d: 'Vytvořené výchovné opatření.' },
    getMeasures: { s: 200, d: 'Seznam opatření – pole.' },
    deleteMeasure: { s: 200, d: 'Opatření smazáno.', t: 'SuccessResponseDto' },
    getGradeHistory: { s: 200, d: 'Historie změn známek – pole.' },
    getReportCardHtml: { s: 200, d: 'HTML pro tisk vysvědčení.' },
    getCommissionExams: { s: 200, d: 'Komisionální přezkoušení – pole.' },
    createCommissionExam: { s: 201, d: 'Vytvořené komisionální přezkoušení.' },
    updateCommissionExam: { s: 200, d: 'Aktualizované přezkoušení.' },
    deleteCommissionExam: {
      s: 200,
      d: 'Přezkoušení smazáno.',
      t: 'SuccessResponseDto',
    },
    getGradingDeadline: { s: 200, d: 'Deadline klasifikace.' },
    upsertGradingDeadline: { s: 200, d: 'Uložený deadline.' },
    ensureTenant: null,
    isAdmin: null,
  },
  'schedule/schedule.controller.ts': {
    getTimeSlots: { s: 200, d: 'Časové sloty (zvonění) – pole.' },
    upsertTimeSlots: { s: 200, d: 'Uložené časové sloty.' },
    getEvents: { s: 200, d: 'Rozvrhové události – pole.' },
    createEvent: { s: 201, d: 'Vytvořená rozvrhová událost.' },
    updateEvent: { s: 200, d: 'Aktualizovaná rozvrhová událost.' },
    deleteEvent: { s: 200, d: 'Událost smazána.', t: 'SuccessResponseDto' },
    bulkCreateEvents: { s: 201, d: 'Hromadně vytvořené události – pole.' },
    validateCollision: { s: 200, d: 'Výsledek kontroly kolizí.' },
    getClassroomSchedule: { s: 200, d: 'Rozvrh třídy – matice.' },
    getTeacherSchedule: { s: 200, d: 'Rozvrh učitele – matice.' },
    getStudentSchedule: { s: 200, d: 'Rozvrh studenta – matice.' },
    getSubstitutions: { s: 200, d: 'Suplování – pole.' },
    createSubstitution: { s: 201, d: 'Vytvořené suplování.' },
    updateSubstitution: { s: 200, d: 'Aktualizované suplování.' },
    deleteSubstitution: {
      s: 200,
      d: 'Suplování smazáno.',
      t: 'SuccessResponseDto',
    },
    generateSchedule: { s: 200, d: 'Výsledek generování rozvrhu.' },
    exportHtml: { s: 200, d: 'HTML rozvrhu pro tisk.' },
    getSnapshots: { s: 200, d: 'Snapshoty rozvrhu – pole.' },
    createSnapshot: { s: 201, d: 'Vytvořený snapshot.' },
    diffSnapshots: { s: 200, d: 'Rozdíly mezi snapshoty.' },
    getRecurringEvents: { s: 200, d: 'Kroužky – pole.' },
    createRecurringEvent: { s: 201, d: 'Vytvořený kroužek.' },
    updateRecurringEvent: { s: 200, d: 'Aktualizovaný kroužek.' },
    deleteRecurringEvent: {
      s: 200,
      d: 'Kroužek smazán.',
      t: 'SuccessResponseDto',
    },
  },
  'attendance/attendance.controller.ts': {
    recordAttendance: {
      s: 201,
      d: 'Docházka zaznamenána.',
      t: 'SuccessResponseDto',
    },
    getClassroomAttendance: { s: 200, d: 'Docházka třídy – pole záznamů.' },
    createExcuse: { s: 201, d: 'Omluvenka vytvořena.' },
    getExcuses: { s: 200, d: 'Seznam omluvenek – pole.' },
    reviewExcuse: { s: 200, d: 'Omluvenka schválena/zamítnuta.' },
    getClassStatistics: { s: 200, d: 'Statistiky docházky třídy.' },
    exportCsv: { s: 200, d: 'CSV soubor s docházkou.' },
    getUnexcusedAlerts: {
      s: 200,
      d: 'Upozornění na neomluvené hodiny – pole.',
    },
  },
  'messaging/messaging.controller.ts': {
    getConversations: { s: 200, d: 'Konverzace uživatele – pole.' },
    getMessages: { s: 200, d: 'Zprávy v konverzaci s paginací.' },
    sendMessage: { s: 201, d: 'Odeslaná zpráva.' },
    createConversation: { s: 201, d: 'Vytvořená konverzace.' },
    getAvailableRecipients: { s: 200, d: 'Dostupní příjemci – pole.' },
    getAvailableClassrooms: { s: 200, d: 'Třídy pro broadcast – pole.' },
    createClassBroadcast: { s: 201, d: 'Hromadná zpráva odeslána.' },
    createSchoolBroadcast: { s: 201, d: 'Školní broadcast odeslán.' },
    getNotifications: { s: 200, d: 'Notifikace s paginací.' },
    getUnreadCount: { s: 200, d: 'Počet nepřečtených.', t: 'CountResponseDto' },
    markAsRead: { s: 200, d: 'Notifikace označena.', t: 'SuccessResponseDto' },
    markAllRead: { s: 200, d: 'Vše přečteno.', t: 'SuccessResponseDto' },
    toggleEmailNotifications: {
      s: 200,
      d: 'Stav e-mail notifikací.',
      t: 'ToggleResponseDto',
    },
  },
  'community/community.controller.ts': {
    createBulletinPost: { s: 201, d: 'Vytvořený příspěvek.' },
    getBulletinPosts: { s: 200, d: 'Příspěvky na nástěnce – pole.' },
    updateBulletinPost: { s: 200, d: 'Aktualizovaný příspěvek.' },
    deleteBulletinPost: {
      s: 200,
      d: 'Příspěvek smazán.',
      t: 'SuccessResponseDto',
    },
    createPoll: { s: 201, d: 'Vytvořená anketa.' },
    getPolls: { s: 200, d: 'Ankety – pole.' },
    vote: { s: 200, d: 'Hlas zaznamenán.', t: 'SuccessResponseDto' },
    deletePoll: { s: 200, d: 'Anketa smazána.', t: 'SuccessResponseDto' },
    createCalendarEvent: { s: 201, d: 'Vytvořená událost.' },
    getCalendarEvents: { s: 200, d: 'Události – pole.' },
    rsvpEvent: { s: 200, d: 'RSVP zaznamenáno.', t: 'SuccessResponseDto' },
    deleteCalendarEvent: {
      s: 200,
      d: 'Událost smazána.',
      t: 'SuccessResponseDto',
    },
  },
  'classbook/classbook.controller.ts': {
    getEntries: { s: 200, d: 'Záznamy třídní knihy za den – pole.' },
    upsertEntry: { s: 200, d: 'Uložený záznam třídní knihy.' },
    signEntry: { s: 200, d: 'Záznam podepsán.', t: 'SuccessResponseDto' },
    getEntriesRange: { s: 200, d: 'Záznamy za období – pole.' },
    printClassBook: { s: 200, d: 'HTML pro tisk třídní knihy.' },
    getAttendance: { s: 200, d: 'Docházka pro hodinu – pole.' },
  },
  'deputy/deputy.controller.ts': {
    getSchoolDashboard: { s: 200, d: 'Dashboard školy – statistiky.' },
    getClassrooms: { s: 200, d: 'Třídy školy – pole.' },
    createClassroom: { s: 201, d: 'Vytvořená třída.' },
    updateClassroom: { s: 200, d: 'Aktualizovaná třída.' },
    deleteClassroom: { s: 200, d: 'Třída smazána.', t: 'SuccessResponseDto' },
    getSubjects: { s: 200, d: 'Šablony předmětů – pole.' },
    createSubject: { s: 201, d: 'Vytvořený předmět.' },
    updateSubject: { s: 200, d: 'Aktualizovaný předmět.' },
    deleteSubject: { s: 200, d: 'Předmět smazán.', t: 'SuccessResponseDto' },
    getRooms: { s: 200, d: 'Místnosti – pole.' },
    createRoom: { s: 201, d: 'Vytvořená místnost.' },
    updateRoom: { s: 200, d: 'Aktualizovaná místnost.' },
    deleteRoom: { s: 200, d: 'Místnost smazána.', t: 'SuccessResponseDto' },
    getBuildings: { s: 200, d: 'Budovy – pole.' },
    createBuilding: { s: 201, d: 'Vytvořená budova.' },
    updateBuilding: { s: 200, d: 'Aktualizovaná budova.' },
    deleteBuilding: { s: 200, d: 'Budova smazána.', t: 'SuccessResponseDto' },
    shareRoom: { s: 200, d: 'Místnost sdílena.', t: 'SuccessResponseDto' },
    unshareRoom: { s: 200, d: 'Sdílení zrušeno.', t: 'SuccessResponseDto' },
    getSharedRooms: { s: 200, d: 'Sdílené místnosti – pole.' },
    getEvents: { s: 200, d: 'Události – pole.' },
    getUpcomingEvents: { s: 200, d: 'Nadcházející události – pole.' },
    createEvent: { s: 201, d: 'Vytvořená událost.' },
    updateEvent: { s: 200, d: 'Aktualizovaná událost.' },
    deleteEvent: { s: 200, d: 'Událost smazána.', t: 'SuccessResponseDto' },
    inviteUser: { s: 201, d: 'Uživatel pozván.', t: 'SuccessResponseDto' },
    getUsers: { s: 200, d: 'Uživatelé školy – pole.' },
    updateUser: { s: 200, d: 'Uživatel aktualizován.' },
    reinviteUser: {
      s: 200,
      d: 'Pozvánka znovu odeslána.',
      t: 'SuccessResponseDto',
    },
    removeUser: { s: 200, d: 'Uživatel odebrán.', t: 'SuccessResponseDto' },
    createStudentWithFamily: { s: 201, d: 'Student a rodina vytvořeni.' },
    setAlumni: { s: 200, d: 'Status absolventa nastaven.' },
    getAuditLog: { s: 200, d: 'Audit log – pole záznamů.' },
    getSchoolSettings: { s: 200, d: 'Nastavení školy.' },
    updateSchoolSettings: { s: 200, d: 'Nastavení uloženo.' },
    exportUsersCsv: { s: 200, d: 'CSV s uživateli.' },
    suspendUser: {
      s: 200,
      d: 'Uživatel suspendován.',
      t: 'SuccessResponseDto',
    },
    reactivateUser: {
      s: 200,
      d: 'Uživatel reaktivován.',
      t: 'SuccessResponseDto',
    },
  },
  'deputy/deputy-curriculum.controller.ts': {
    getAcademicYears: { s: 200, d: 'Školní roky – pole.' },
    createAcademicYear: { s: 201, d: 'Vytvořený školní rok.' },
    getGradeLevels: { s: 200, d: 'Ročníky – pole.' },
    createGradeLevel: { s: 201, d: 'Vytvořený ročník.' },
    updateGradeLevel: { s: 200, d: 'Aktualizovaný ročník.' },
    deleteGradeLevel: { s: 200, d: 'Ročník smazán.', t: 'SuccessResponseDto' },
    getTeachers: { s: 200, d: 'Učitelé – pole.' },
    getTeacherWorkloads: { s: 200, d: 'Úvazky učitelů – pole.' },
    saveTeacherWorkload: { s: 200, d: 'Úvazek uložen.' },
    getSubjectInstances: { s: 200, d: 'Instance předmětů – pole.' },
    createSubjectInstance: { s: 201, d: 'Vytvořená instance předmětu.' },
    getCurriculumVersions: { s: 200, d: 'Verze ŠVP – pole.' },
    compareCurriculumVersions: { s: 200, d: 'Porovnání verzí ŠVP.' },
    getCurriculumVersion: { s: 200, d: 'Detail verze ŠVP.' },
    createCurriculumVersion: { s: 201, d: 'Vytvořená verze ŠVP.' },
    updateCurriculumVersion: { s: 200, d: 'Aktualizovaná verze ŠVP.' },
    deleteCurriculumVersion: {
      s: 200,
      d: 'Verze smazána.',
      t: 'SuccessResponseDto',
    },
    duplicateCurriculumVersion: { s: 201, d: 'Duplikovaná verze ŠVP.' },
    saveCurriculumEntry: { s: 200, d: 'Záznam ŠVP uložen.' },
    deleteCurriculumEntry: {
      s: 200,
      d: 'Záznam smazán.',
      t: 'SuccessResponseDto',
    },
    getCompetencies: { s: 200, d: 'Kompetence – pole.' },
    getCompetencyMatrix: { s: 200, d: 'Matice kompetencí.' },
    toggleCompetencyMapping: {
      s: 200,
      d: 'Mapování přepnuto.',
      t: 'SuccessResponseDto',
    },
    uploadRvp: { s: 200, d: 'RVP soubor nahrán – náhled dat.' },
    getLastRvpUpload: { s: 200, d: 'Poslední nahraný RVP.' },
    confirmRvp: { s: 200, d: 'Import RVP potvrzen.', t: 'SuccessResponseDto' },
    getThematicPlans: { s: 200, d: 'Tematické plány – pole.' },
    upsertThematicPlan: { s: 200, d: 'Tematický plán uložen.' },
    getTeachingMaterials: { s: 200, d: 'Výukové materiály – pole.' },
    createTeachingMaterial: { s: 201, d: 'Vytvořený materiál.' },
    updateTeachingMaterial: { s: 200, d: 'Aktualizovaný materiál.' },
    deleteTeachingMaterial: {
      s: 200,
      d: 'Materiál smazán.',
      t: 'SuccessResponseDto',
    },
    getLessonPlans: { s: 200, d: 'Přípravy na hodiny – pole.' },
    createLessonPlan: { s: 201, d: 'Vytvořená příprava.' },
    updateLessonPlan: { s: 200, d: 'Aktualizovaná příprava.' },
    deleteLessonPlan: {
      s: 200,
      d: 'Příprava smazána.',
      t: 'SuccessResponseDto',
    },
    getSemesters: { s: 200, d: 'Semestry – pole.' },
    upsertSemesters: { s: 200, d: 'Semestry uloženy.' },
    batchEnroll: { s: 200, d: 'Studenti zapsáni.', t: 'SuccessResponseDto' },
    getStudentEnrollments: { s: 200, d: 'Zápisy studentů – pole.' },
  },
  'users/users.controller.ts': {
    importUsers: { s: 201, d: 'Výsledek importu – počet vytvořených.' },
    findAll: { s: 200, d: 'Seznam uživatelů s paginací.' },
    findOne: { s: 200, d: 'Detail uživatele.' },
  },
  'student/student.controller.ts': {
    getMyData: {
      s: 200,
      d: 'Data studenta – profil, známky, rozvrh, docházka.',
    },
    getSchedule: { s: 200, d: 'Rozvrh studenta – matice.' },
  },
  'parent/parent.controller.ts': {
    getChildren: { s: 200, d: 'Děti rodiče – pole.' },
    getChildDashboard: {
      s: 200,
      d: 'Dashboard dítěte – profil, známky, rozvrh.',
    },
  },
  'teacher/teacher.controller.ts': {
    getMySchedule: { s: 200, d: 'Rozvrh učitele napříč školami – matice.' },
    getClasses: { s: 200, d: 'Třídy a studenti učitele – pole.' },
    createGrade: { s: 201, d: 'Vytvořená známka.', t: 'GradeResponseDto' },
    createAttendance: { s: 201, d: 'Docházka zaznamenána.' },
  },
  'principal/principal.controller.ts': {
    getAuditLog: { s: 200, d: 'Audit log školy – pole záznamů.' },
  },
  'system-admin/system-admin.controller.ts': {
    getDashboard: {
      s: 200,
      d: 'Dashboard – počty škol, uživatelů, prostředků.',
    },
    getSchools: { s: 200, d: 'Všechny školy – pole.' },
    createSchool: { s: 201, d: 'Vytvořená škola.' },
    updateSchool: { s: 200, d: 'Aktualizovaná škola.' },
    softDeleteSchool: {
      s: 200,
      d: 'Škola deaktivována.',
      t: 'SuccessResponseDto',
    },
    getSchool: { s: 200, d: 'Detail školy.' },
    getAdmins: { s: 200, d: 'Systémoví administrátoři – pole.' },
    promoteAdmin: { s: 200, d: 'Uživatel povýšen.', t: 'SuccessResponseDto' },
    demoteAdmin: { s: 200, d: 'Oprávnění odebráno.', t: 'SuccessResponseDto' },
    getSsoConfig: { s: 200, d: 'Aktuální SSO konfigurace.' },
    saveSsoConfig: { s: 200, d: 'SSO konfigurace uložena.' },
    getSettings: { s: 200, d: 'Globální systémová nastavení.' },
    saveSettings: { s: 200, d: 'Nastavení uložena.' },
    getGlobalAuditLog: { s: 200, d: 'Globální audit log – pole.' },
  },
  'system-admin/system-admin-ai.controller.ts': {
    getAiConfig: { s: 200, d: 'AI konfigurace (provider, model, klíč).' },
    saveAiConfig: { s: 200, d: 'AI konfigurace uložena.' },
    testAi: { s: 200, d: 'Výsledek testu AI připojení.' },
    getAiUsage: { s: 200, d: 'Statistiky spotřeby AI.' },
  },
  'system-admin/backup.controller.ts': {
    listBackups: { s: 200, d: 'Dostupné zálohy – pole.' },
    createBackup: { s: 201, d: 'Záloha vytvořena.' },
    downloadBackup: { s: 200, d: 'Soubor zálohy (stream).' },
    restoreBackup: { s: 200, d: 'Záloha obnovena.', t: 'SuccessResponseDto' },
    deleteBackup: { s: 200, d: 'Záloha smazána.', t: 'SuccessResponseDto' },
  },
  'system-admin/monitoring.controller.ts': {
    healthCheck: { s: 200, d: 'Status služeb (DB, mail, MCP).' },
    getMetrics: { s: 200, d: 'Systémové metriky – CPU, paměť, uptime.' },
  },
  'system-admin/test-data.controller.ts': {
    generateTestData: {
      s: 201,
      d: 'Testovací data vygenerována.',
      t: 'SuccessResponseDto',
    },
    generateAll: {
      s: 201,
      d: 'Kompletní testovací sada vytvořena.',
      t: 'SuccessResponseDto',
    },
  },
  'ai/ai.controller.ts': {
    chat: { s: 200, d: 'Streaming AI odpověď (text/event-stream).' },
    generateStudents: { s: 200, d: 'AI vygenerovaní studenti – pole.' },
    refineText: { s: 200, d: 'Vylepšený text.' },
    generateThematicPlan: { s: 200, d: 'Vygenerovaný tematický plán.' },
    generateStudentRecommendation: { s: 200, d: 'Doporučení pro studenta.' },
    generateVerbalEvaluation: { s: 200, d: 'Vygenerované slovní hodnocení.' },
    analyzeClassPerformance: { s: 200, d: 'Analýza prospěchu třídy.' },
    generateTest: { s: 200, d: 'Vygenerovaný test.' },
    generateExam: { s: 200, d: 'Vygenerovaná písemka.' },
  },
  'registry/registry.controller.ts': {
    getClassrooms: { s: 200, d: 'Třídy v matrice – pole.' },
    createClassroom: { s: 201, d: 'Třída vytvořena v matrice.' },
  },
  'export/export.controller.ts': {
    exportStudents: { s: 200, d: 'Export studentů ve zvoleném formátu.' },
    exportTeachers: { s: 200, d: 'Export učitelů.' },
    exportGrades: { s: 200, d: 'Export známek.' },
    exportAttendance: { s: 200, d: 'Export docházky.' },
    exportAll: { s: 200, d: 'Kompletní export dat.' },
  },
  'reports/reports.controller.ts': {
    gradeStatsByClassroom: { s: 200, d: 'Statistiky prospěchu třídy.' },
    gradeStatsByStudent: { s: 200, d: 'Statistiky prospěchu studenta.' },
    attendanceStats: { s: 200, d: 'Statistiky docházky.' },
    printableReportCard: { s: 200, d: 'HTML vysvědčení pro tisk.' },
    dashboardStats: { s: 200, d: 'Statistiky pro dashboard.' },
    subjectComparison: { s: 200, d: 'Porovnání předmětů.' },
    yearOverYear: { s: 200, d: 'Meziroční srovnání.' },
  },
  'gdpr/gdpr.controller.ts': {
    getMyData: { s: 200, d: 'Kompletní osobní data uživatele (čl. 15 GDPR).' },
    downloadMyData: { s: 200, d: 'JSON soubor s osobními daty.' },
    deleteMyData: {
      s: 200,
      d: 'Osobní data anonymizována.',
      t: 'SuccessResponseDto',
    },
  },
  'init/init.controller.ts': {
    getStatus: { s: 200, d: 'Stav inicializace systému.' },
    setup: { s: 201, d: 'Administrátor vytvořen.' },
  },
};

// All valid DTO type names
const VALID_TYPES = new Set([
  'LoginResponseDto',
  'SsoOptionDto',
  'SchoolListItemDto',
  'SelectSchoolResponseDto',
  'UserProfileDto',
  'GradeResponseDto',
  'SuccessResponseDto',
  'CountResponseDto',
  'ToggleResponseDto',
  'ErrorResponseDto',
]);

let totalAdded = 0;

for (const [relPath, methods] of Object.entries(RESPONSES)) {
  const filePath = path.join(SRC, relPath);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Skip: ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let fileModified = false;

  // Ensure ApiResponse is imported
  if (!content.includes('ApiResponse')) {
    content = content.replace(
      /import \{([^}]+)\} from '@nestjs\/swagger'/,
      (m, imp) => `import {${imp}, ApiResponse } from '@nestjs/swagger'`,
    );
    fileModified = true;
  }

  // Check if SuccessResponseDto is needed and imported
  const needsSuccess = Object.values(methods).some(
    (r) => r && r.t === 'SuccessResponseDto',
  );
  if (needsSuccess && !content.includes('SuccessResponseDto')) {
    if (content.includes("from '../common/dto/api.dto'")) {
      content = content.replace(
        /import \{([^}]+)\} from '\.\.\/common\/dto\/api\.dto'/,
        (m, imp) =>
          `import {${imp}, SuccessResponseDto } from '../common/dto/api.dto'`,
      );
    } else {
      // Add a new import
      const idx = content.lastIndexOf('import ');
      const nl = content.indexOf('\n', idx);
      const end = content.indexOf('\n', nl + 1);
      content =
        content.slice(0, end + 1) +
        "import { SuccessResponseDto } from '../common/dto/api.dto';\n" +
        content.slice(end + 1);
    }
    fileModified = true;
  }

  for (const [methodName, resp] of Object.entries(methods)) {
    if (!resp) continue; // skip null (private methods)

    // Check if this method already has a success (2xx) @ApiResponse with description
    const successCheck = new RegExp(
      `@ApiResponse\\(\\{\\s*status:\\s*${resp.s}[^}]*description:`,
    );
    // Find @ApiOperation for this method
    const opRegex = new RegExp(
      `(@ApiOperation\\([^)]+\\))[\\s\\S]{0,500}?async\\s+${methodName}\\b`,
    );
    const opMatch = opRegex.exec(content);
    if (!opMatch) continue;

    // Check in the area between @ApiOperation and async for existing success response
    const area = content.slice(
      opMatch.index,
      opMatch.index + opMatch[0].length,
    );
    if (area.includes(`status: ${resp.s},`) && area.includes('description:'))
      continue;

    // Build the new @ApiResponse
    let respDecorator = `@ApiResponse({ status: ${resp.s}, description: '${resp.d}'`;
    if (resp.t && VALID_TYPES.has(resp.t)) {
      respDecorator += `, type: ${resp.t}`;
    }
    if (resp.arr) {
      respDecorator += `, isArray: true`;
    }
    respDecorator += ' })';

    // Insert after @ApiOperation line
    const opEnd = opMatch.index + opMatch[1].length;
    // Find the indent
    const lineStart = content.lastIndexOf('\n', opMatch.index) + 1;
    const indent = content.slice(lineStart, opMatch.index);

    content =
      content.slice(0, opEnd) +
      `\n${indent}${respDecorator}` +
      content.slice(opEnd);
    totalAdded++;
    fileModified = true;
  }

  if (fileModified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(
      `✅ ${relPath}: ${Object.keys(methods).filter((m) => methods[m]).length}`,
    );
  }
}

console.log(`\n🎯 Success responses added: ${totalAdded}`);
