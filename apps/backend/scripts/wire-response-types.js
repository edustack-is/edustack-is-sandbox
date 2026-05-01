/**
 * Wires response DTO types into @ApiResponse success decorators.
 * Uses string-based matching (no regex).
 * Run: node scripts/wire-response-types.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

// file → method → { t: 'DtoName', arr?: true }
const MAP = {
  'auth/auth.controller.ts': {
    getSsoOptions: { t: 'SsoOptionDto', arr: true },
    exchangeSsoToken: { t: 'LoginResponseDto' },
    inviteUser: { t: 'SuccessResponseDto' },
    acceptInvite: { t: 'SuccessResponseDto' },
    forgotPassword: { t: 'SuccessResponseDto' },
    resetPassword: { t: 'SuccessResponseDto' },
    getIdentities: { t: 'SsoIdentityResponseDto', arr: true },
    impersonate: { t: 'LoginResponseDto' },
    login: { t: 'LoginResponseDto' },
    getSchools: { t: 'SchoolListItemDto', arr: true },
    selectSchool: { t: 'SelectSchoolResponseDto' },
    refreshGlobal: { t: 'LoginResponseDto' },
    getMe: { t: 'UserProfileDto' },
    updateProfile: { t: 'UserProfileDto' },
    uploadAvatar: { t: 'UploadResultDto' },
  },
  'grading/grading.controller.ts': {
    createGrade: { t: 'GradeResponseDto' },
    updateGrade: { t: 'GradeResponseDto' },
    deleteGrade: { t: 'SuccessResponseDto' },
    getGradesForClassroom: { t: 'GradeResponseDto', arr: true },
    getStudentGrades: { t: 'GradeResponseDto', arr: true },
    getAverage: { t: 'GradeResponseDto' },
    getReportCards: { t: 'ReportCardResponseDto', arr: true },
    upsertReportCard: { t: 'ReportCardResponseDto' },
    polishVerbalEvaluation: { t: 'AiTextResponseDto' },
    getGradingTypes: { t: 'GradingTypeResponseDto', arr: true },
    upsertBehaviorGrade: { t: 'BehaviorGradeResponseDto' },
    getBehaviorGrades: { t: 'BehaviorGradeResponseDto', arr: true },
    upsertCompetencyGrade: { t: 'CompetencyGradeResponseDto' },
    getCompetencyGrades: { t: 'CompetencyGradeResponseDto', arr: true },
    createMeasure: { t: 'MeasureResponseDto' },
    getMeasures: { t: 'MeasureResponseDto', arr: true },
    deleteMeasure: { t: 'SuccessResponseDto' },
    getGradeHistory: { t: 'GradeHistoryEntryDto', arr: true },
    getCommissionExams: { t: 'CommissionExamResponseDto', arr: true },
    createCommissionExam: { t: 'CommissionExamResponseDto' },
    updateCommissionExam: { t: 'CommissionExamResponseDto' },
    deleteCommissionExam: { t: 'SuccessResponseDto' },
    getGradingDeadline: { t: 'GradingDeadlineResponseDto' },
    upsertGradingDeadline: { t: 'GradingDeadlineResponseDto' },
  },
  'schedule/schedule.controller.ts': {
    getTimeSlots: { t: 'TimeSlotDto', arr: true },
    upsertTimeSlots: { t: 'TimeSlotDto', arr: true },
    getEvents: { t: 'ScheduleEventResponseDto', arr: true },
    createEvent: { t: 'ScheduleEventResponseDto' },
    updateEvent: { t: 'ScheduleEventResponseDto' },
    deleteEvent: { t: 'SuccessResponseDto' },
    bulkCreateEvents: { t: 'ScheduleEventResponseDto', arr: true },
    validateCollision: { t: 'CollisionResultDto' },
    getClassroomSchedule: { t: 'ScheduleMatrixResponseDto' },
    getTeacherSchedule: { t: 'ScheduleMatrixResponseDto' },
    getStudentSchedule: { t: 'ScheduleMatrixResponseDto' },
    getSubstitutions: { t: 'SubstitutionResponseDto', arr: true },
    createSubstitution: { t: 'SubstitutionResponseDto' },
    updateSubstitution: { t: 'SubstitutionResponseDto' },
    deleteSubstitution: { t: 'SuccessResponseDto' },
    generateSchedule: { t: 'GenerateScheduleResultDto' },
    getSnapshots: { t: 'SnapshotResponseDto', arr: true },
    createSnapshot: { t: 'SnapshotResponseDto' },
    diffSnapshots: { t: 'ScheduleDiffResponseDto' },
    getRecurringEvents: { t: 'RecurringEventResponseDto', arr: true },
    createRecurringEvent: { t: 'RecurringEventResponseDto' },
    updateRecurringEvent: { t: 'RecurringEventResponseDto' },
    deleteRecurringEvent: { t: 'SuccessResponseDto' },
  },
  'attendance/attendance.controller.ts': {
    recordAttendance: { t: 'SuccessResponseDto' },
    getClassroomAttendance: { t: 'AttendanceRecordResponseDto', arr: true },
    createExcuse: { t: 'ExcuseResponseDto' },
    getExcuses: { t: 'ExcuseResponseDto', arr: true },
    reviewExcuse: { t: 'ExcuseResponseDto' },
    getClassStatistics: { t: 'AttendanceStatsResponseDto' },
    getUnexcusedAlerts: { t: 'UnexcusedAlertDto', arr: true },
  },
  'messaging/messaging.controller.ts': {
    getConversations: { t: 'ConversationResponseDto', arr: true },
    getMessages: { t: 'MessageResponseDto', arr: true },
    sendMessage: { t: 'MessageResponseDto' },
    createConversation: { t: 'ConversationResponseDto' },
    getAvailableRecipients: { t: 'RecipientResponseDto', arr: true },
    getAvailableClassrooms: { t: 'ClassroomResponseDto', arr: true },
    createClassBroadcast: { t: 'SuccessResponseDto' },
    createSchoolBroadcast: { t: 'SuccessResponseDto' },
    getNotifications: { t: 'NotificationResponseDto', arr: true },
    getUnreadCount: { t: 'CountResponseDto' },
    markAsRead: { t: 'SuccessResponseDto' },
    markAllRead: { t: 'SuccessResponseDto' },
    toggleEmailNotifications: { t: 'ToggleResponseDto' },
  },
  'community/community.controller.ts': {
    createBulletinPost: { t: 'BulletinPostResponseDto' },
    getBulletinPosts: { t: 'BulletinPostResponseDto', arr: true },
    updateBulletinPost: { t: 'BulletinPostResponseDto' },
    deleteBulletinPost: { t: 'SuccessResponseDto' },
    createPoll: { t: 'PollResponseDto' },
    getPolls: { t: 'PollResponseDto', arr: true },
    vote: { t: 'SuccessResponseDto' },
    deletePoll: { t: 'SuccessResponseDto' },
    createCalendarEvent: { t: 'CommunityEventResponseDto' },
    getCalendarEvents: { t: 'CommunityEventResponseDto', arr: true },
    rsvpEvent: { t: 'SuccessResponseDto' },
    deleteCalendarEvent: { t: 'SuccessResponseDto' },
  },
  'classbook/classbook.controller.ts': {
    getEntries: { t: 'ClassbookEntryResponseDto', arr: true },
    upsertEntry: { t: 'ClassbookEntryResponseDto' },
    signEntry: { t: 'SuccessResponseDto' },
    getEntriesRange: { t: 'ClassbookEntryResponseDto', arr: true },
    getAttendance: { t: 'AttendanceRecordResponseDto', arr: true },
  },
  'deputy/deputy.controller.ts': {
    getSchoolDashboard: { t: 'SchoolDashboardResponseDto' },
    getClassrooms: { t: 'ClassroomResponseDto', arr: true },
    createClassroom: { t: 'ClassroomResponseDto' },
    updateClassroom: { t: 'ClassroomResponseDto' },
    deleteClassroom: { t: 'SuccessResponseDto' },
    getSubjects: { t: 'SubjectResponseDto', arr: true },
    createSubject: { t: 'SubjectResponseDto' },
    updateSubject: { t: 'SubjectResponseDto' },
    deleteSubject: { t: 'SuccessResponseDto' },
    getRooms: { t: 'RoomResponseDto', arr: true },
    createRoom: { t: 'RoomResponseDto' },
    updateRoom: { t: 'RoomResponseDto' },
    deleteRoom: { t: 'SuccessResponseDto' },
    getBuildings: { t: 'BuildingResponseDto', arr: true },
    createBuilding: { t: 'BuildingResponseDto' },
    updateBuilding: { t: 'BuildingResponseDto' },
    deleteBuilding: { t: 'SuccessResponseDto' },
    shareRoom: { t: 'SuccessResponseDto' },
    unshareRoom: { t: 'SuccessResponseDto' },
    getSharedRooms: { t: 'SharedRoomResponseDto', arr: true },
    getEvents: { t: 'SchoolEventResponseDto', arr: true },
    getUpcomingEvents: { t: 'SchoolEventResponseDto', arr: true },
    createEvent: { t: 'SchoolEventResponseDto' },
    updateEvent: { t: 'SchoolEventResponseDto' },
    deleteEvent: { t: 'SuccessResponseDto' },
    inviteUser: { t: 'SuccessResponseDto' },
    getUsers: { t: 'SchoolUserResponseDto', arr: true },
    updateUser: { t: 'SchoolUserResponseDto' },
    reinviteUser: { t: 'SuccessResponseDto' },
    removeUser: { t: 'SuccessResponseDto' },
    createStudentWithFamily: { t: 'StudentFamilyResponseDto' },
    setAlumni: { t: 'SuccessResponseDto' },
    getAuditLog: { t: 'AuditLogEntryDto', arr: true },
    getSchoolSettings: { t: 'SchoolSettingsResponseDto' },
    updateSchoolSettings: { t: 'SchoolSettingsResponseDto' },
    suspendUser: { t: 'SuccessResponseDto' },
    reactivateUser: { t: 'SuccessResponseDto' },
  },
  'deputy/deputy-curriculum.controller.ts': {
    getAcademicYears: { t: 'AcademicYearResponseDto', arr: true },
    createAcademicYear: { t: 'AcademicYearResponseDto' },
    getGradeLevels: { t: 'GradeLevelResponseDto', arr: true },
    createGradeLevel: { t: 'GradeLevelResponseDto' },
    updateGradeLevel: { t: 'GradeLevelResponseDto' },
    deleteGradeLevel: { t: 'SuccessResponseDto' },
    getTeachers: { t: 'SchoolUserResponseDto', arr: true },
    getTeacherWorkloads: { t: 'TeacherWorkloadResponseDto', arr: true },
    saveTeacherWorkload: { t: 'TeacherWorkloadResponseDto' },
    getSubjectInstances: { t: 'SubjectInstanceResponseDto', arr: true },
    createSubjectInstance: { t: 'SubjectInstanceResponseDto' },
    getCurriculumVersions: { t: 'CurriculumVersionResponseDto', arr: true },
    compareCurriculumVersions: { t: 'CurriculumDiffResponseDto' },
    getCurriculumVersion: { t: 'CurriculumVersionResponseDto' },
    createCurriculumVersion: { t: 'CurriculumVersionResponseDto' },
    updateCurriculumVersion: { t: 'CurriculumVersionResponseDto' },
    deleteCurriculumVersion: { t: 'SuccessResponseDto' },
    duplicateCurriculumVersion: { t: 'CurriculumVersionResponseDto' },
    saveCurriculumEntry: { t: 'CurriculumEntryResponseDto' },
    deleteCurriculumEntry: { t: 'SuccessResponseDto' },
    getCompetencies: { t: 'CompetencyResponseDto', arr: true },
    getCompetencyMatrix: { t: 'CompetencyMatrixResponseDto' },
    toggleCompetencyMapping: { t: 'SuccessResponseDto' },
    uploadRvp: { t: 'RvpUploadResponseDto' },
    getLastRvpUpload: { t: 'RvpUploadResponseDto' },
    confirmRvp: { t: 'SuccessResponseDto' },
    getThematicPlans: { t: 'ThematicPlanResponseDto', arr: true },
    upsertThematicPlan: { t: 'ThematicPlanResponseDto' },
    getTeachingMaterials: { t: 'TeachingMaterialResponseDto', arr: true },
    createTeachingMaterial: { t: 'TeachingMaterialResponseDto' },
    updateTeachingMaterial: { t: 'TeachingMaterialResponseDto' },
    deleteTeachingMaterial: { t: 'SuccessResponseDto' },
    getLessonPlans: { t: 'LessonPlanResponseDto', arr: true },
    createLessonPlan: { t: 'LessonPlanResponseDto' },
    updateLessonPlan: { t: 'LessonPlanResponseDto' },
    deleteLessonPlan: { t: 'SuccessResponseDto' },
    getSemesters: { t: 'SemesterResponseDto', arr: true },
    upsertSemesters: { t: 'SemesterResponseDto', arr: true },
    batchEnroll: { t: 'SuccessResponseDto' },
    getStudentEnrollments: { t: 'EnrollmentResponseDto', arr: true },
  },
  'users/users.controller.ts': {
    importUsers: { t: 'ImportResultDto' },
    findAll: { t: 'PaginatedUsersResponseDto' },
    findOne: { t: 'SchoolUserResponseDto' },
  },
  'student/student.controller.ts': {
    getMyData: { t: 'StudentDataResponseDto' },
    getSchedule: { t: 'ScheduleMatrixResponseDto' },
  },
  'parent/parent.controller.ts': {
    getChildren: { t: 'ParentChildResponseDto', arr: true },
    getChildDashboard: { t: 'ChildDashboardResponseDto' },
  },
  'teacher/teacher.controller.ts': {
    getMySchedule: { t: 'ScheduleMatrixResponseDto' },
    getClasses: { t: 'TeacherClassResponseDto', arr: true },
    createGrade: { t: 'GradeResponseDto' },
    createAttendance: { t: 'SuccessResponseDto' },
  },
  'principal/principal.controller.ts': {
    getAuditLog: { t: 'AuditLogEntryDto', arr: true },
  },
  'system-admin/system-admin.controller.ts': {
    getDashboard: { t: 'SystemDashboardResponseDto' },
    getSchools: { t: 'SchoolResponseDto', arr: true },
    createSchool: { t: 'SchoolResponseDto' },
    updateSchool: { t: 'SchoolResponseDto' },
    softDeleteSchool: { t: 'SuccessResponseDto' },
    getSchool: { t: 'SchoolResponseDto' },
    getAdmins: { t: 'SchoolUserResponseDto', arr: true },
    promoteAdmin: { t: 'SuccessResponseDto' },
    demoteAdmin: { t: 'SuccessResponseDto' },
    getSsoConfig: { t: 'SsoConfigResponseDto' },
    saveSsoConfig: { t: 'SsoConfigResponseDto' },
    getSettings: { t: 'SystemSettingsResponseDto' },
    saveSettings: { t: 'SystemSettingsResponseDto' },
    getGlobalAuditLog: { t: 'AuditLogEntryDto', arr: true },
  },
  'system-admin/system-admin-ai.controller.ts': {
    getAiConfig: { t: 'AiConfigResponseDto' },
    saveAiConfig: { t: 'AiConfigResponseDto' },
    testAi: { t: 'SuccessResponseDto' },
    getAiUsage: { t: 'AiUsageResponseDto' },
  },
  'system-admin/backup.controller.ts': {
    listBackups: { t: 'BackupResponseDto', arr: true },
    createBackup: { t: 'BackupResponseDto' },
    restoreBackup: { t: 'SuccessResponseDto' },
    deleteBackup: { t: 'SuccessResponseDto' },
  },
  'system-admin/monitoring.controller.ts': {
    healthCheck: { t: 'HealthCheckResponseDto' },
    getMetrics: { t: 'MetricsResponseDto' },
  },
  'system-admin/test-data.controller.ts': {
    generateTestData: { t: 'SuccessResponseDto' },
    generateAll: { t: 'SuccessResponseDto' },
  },
  'ai/ai.controller.ts': {
    generateStudents: { t: 'SchoolUserResponseDto', arr: true },
    refineText: { t: 'AiTextResponseDto' },
    generateThematicPlan: { t: 'AiTextResponseDto' },
    analyzeClassPerformance: { t: 'AiTextResponseDto' },
    generateTest: { t: 'AiTextResponseDto' },
  },
  'registry/registry.controller.ts': {
    getClassrooms: { t: 'RegistryClassroomResponseDto', arr: true },
    createClassroom: { t: 'RegistryClassroomResponseDto' },
  },
  'reports/reports.controller.ts': {
    gradeStatsByClassroom: { t: 'ReportStatsResponseDto' },
    gradeStatsByStudent: { t: 'ReportStatsResponseDto' },
    attendanceStats: { t: 'ReportStatsResponseDto' },
    dashboardStats: { t: 'ReportStatsResponseDto' },
    subjectComparison: { t: 'ReportStatsResponseDto' },
    yearOverYear: { t: 'ReportStatsResponseDto' },
  },
  'gdpr/gdpr.controller.ts': {
    getMyData: { t: 'GdprDataResponseDto' },
    deleteMyData: { t: 'SuccessResponseDto' },
  },
  'init/init.controller.ts': {
    getStatus: { t: 'InitStatusResponseDto' },
    setup: { t: 'LoginResponseDto' },
  },
};

// Which file each DTO lives in
const RESPONSE_FILE = '../common/dto/response.dto';
const API_FILE = '../common/dto/api.dto';

const RESPONSE_DTOS = new Set([
  'ClassroomResponseDto',
  'SubjectResponseDto',
  'RoomResponseDto',
  'BuildingResponseDto',
  'SchoolEventResponseDto',
  'SchoolUserResponseDto',
  'StudentFamilyResponseDto',
  'AuditLogEntryDto',
  'SchoolSettingsResponseDto',
  'AcademicYearResponseDto',
  'GradeLevelResponseDto',
  'SubjectInstanceResponseDto',
  'TeacherWorkloadResponseDto',
  'CurriculumVersionResponseDto',
  'CurriculumEntryResponseDto',
  'CompetencyResponseDto',
  'SemesterResponseDto',
  'ThematicPlanResponseDto',
  'TeachingMaterialResponseDto',
  'LessonPlanResponseDto',
  'EnrollmentResponseDto',
  'ScheduleEventResponseDto',
  'ScheduleMatrixResponseDto',
  'SubstitutionResponseDto',
  'CollisionResultDto',
  'SnapshotResponseDto',
  'RecurringEventResponseDto',
  'AttendanceRecordResponseDto',
  'ExcuseResponseDto',
  'AttendanceStatsResponseDto',
  'UnexcusedAlertDto',
  'ConversationResponseDto',
  'MessageResponseDto',
  'NotificationResponseDto',
  'RecipientResponseDto',
  'BulletinPostResponseDto',
  'PollResponseDto',
  'CommunityEventResponseDto',
  'ClassbookEntryResponseDto',
  'ReportCardResponseDto',
  'GradingTypeResponseDto',
  'BehaviorGradeResponseDto',
  'CompetencyGradeResponseDto',
  'MeasureResponseDto',
  'GradeHistoryEntryDto',
  'CommissionExamResponseDto',
  'GradingDeadlineResponseDto',
  'SchoolDashboardResponseDto',
  'SharedRoomResponseDto',
  'SsoIdentityResponseDto',
  'UploadResultDto',
  'ImportResultDto',
  'StudentDataResponseDto',
  'ChildDashboardResponseDto',
  'ParentChildResponseDto',
  'TeacherClassResponseDto',
  'SystemDashboardResponseDto',
  'SchoolResponseDto',
  'SsoConfigResponseDto',
  'AiConfigResponseDto',
  'AiUsageResponseDto',
  'AiTextResponseDto',
  'BackupResponseDto',
  'HealthCheckResponseDto',
  'MetricsResponseDto',
  'RvpUploadResponseDto',
  'CompetencyMatrixResponseDto',
  'CurriculumDiffResponseDto',
  'ScheduleDiffResponseDto',
  'GenerateScheduleResultDto',
  'GdprDataResponseDto',
  'InitStatusResponseDto',
  'ReportStatsResponseDto',
  'RegistryClassroomResponseDto',
  'SystemSettingsResponseDto',
  'PaginatedUsersResponseDto',
]);

let totalWired = 0;

for (const [relPath, methods] of Object.entries(MAP)) {
  const filePath = path.join(SRC, relPath);
  if (!fs.existsSync(filePath)) {
    console.warn('Skip: ' + relPath);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let mod = false;

  // Collect needed imports
  const fromResp = new Set();
  const fromApi = new Set();
  for (const r of Object.values(methods)) {
    if (!r) continue;
    if (RESPONSE_DTOS.has(r.t)) fromResp.add(r.t);
    else fromApi.add(r.t);
  }

  // Add response.dto import
  if (fromResp.size > 0) {
    const items = [...fromResp].sort().join(', ');
    if (!content.includes("from '" + RESPONSE_FILE + "'")) {
      const lastImp = content.lastIndexOf('import ');
      const nl = content.indexOf('\n', lastImp);
      const nl2 = content.indexOf('\n', nl + 1);
      content =
        content.slice(0, nl2 + 1) +
        'import { ' +
        items +
        " } from '" +
        RESPONSE_FILE +
        "';\n" +
        content.slice(nl2 + 1);
      mod = true;
    }
  }

  // Add api.dto items
  if (fromApi.size > 0 && content.includes("from '" + API_FILE + "'")) {
    for (const item of fromApi) {
      if (!content.includes(item)) {
        content = content.replace(
          "} from '" + API_FILE + "'",
          ', ' + item + " } from '" + API_FILE + "'",
        );
        mod = true;
      }
    }
  }

  // Wire types into @ApiResponse success entries
  for (const [methodName, resp] of Object.entries(methods)) {
    if (!resp) continue;

    const methodMarker = 'async ' + methodName + '(';
    const methodIdx = content.indexOf(methodMarker);
    if (methodIdx === -1) continue;

    const areaStart = Math.max(0, methodIdx - 800);
    const area = content.slice(areaStart, methodIdx);

    // Find success @ApiResponse (200 or 201) without type:
    for (const code of ['200', '201']) {
      const statusStr = 'status: ' + code + ',';
      const idx = area.lastIndexOf(statusStr);
      if (idx === -1) continue;

      // Find the @ApiResponse that contains this status
      const respStart = area.lastIndexOf('@ApiResponse(', idx);
      if (respStart === -1) continue;
      const respEnd = area.indexOf('})', respStart);
      if (respEnd === -1) continue;
      const snippet = area.slice(respStart, respEnd + 2);

      if (snippet.includes('type:')) continue; // already typed

      const arrPart = resp.arr ? ', isArray: true' : '';
      const newSnippet = snippet.replace(
        ' })',
        ', type: ' + resp.t + arrPart + ' })',
      );

      const absStart = areaStart + respStart;
      content =
        content.slice(0, absStart) +
        newSnippet +
        content.slice(absStart + snippet.length);
      totalWired++;
      mod = true;
      break;
    }
  }

  if (mod) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('OK  ' + relPath);
  }
}

console.log('\nTotal wired: ' + totalWired);
