import axios from 'axios';
import i18n from '../i18n';

export const api = axios.create({
    baseURL: '/',
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // Inject current language
    config.headers['Accept-Language'] = i18n.language;
    // Let axios auto-set Content-Type for FormData (multipart/form-data with boundary)
    if (!(config.data instanceof FormData)) {
        config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json';
    }
    return config;
});

// Auto-logout on 401 (expired or invalid token)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const currentPath = window.location.pathname;
            // Don't redirect if already on login/setup to avoid loops
            if (currentPath !== '/login' && currentPath !== '/setup') {
                localStorage.removeItem('access_token');
                localStorage.removeItem('global_token');
                localStorage.removeItem('original_admin_token');
                localStorage.removeItem('impersonation_original_token');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export const getUsers = async (params?: { page?: number; limit?: number; role?: string; status?: string }) => {
    const response = await api.get('/api/users', { params });
    return response.data; // { data: User[], total: number }
};

export const importUsers = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/users/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const impersonateUser = async (targetId: string) => {
    const response = await api.post(`/api/auth/impersonate/${targetId}`);
    return response.data; // { access_token }
};

export const getClassrooms = async () => {
    const response = await api.get('/api/registry/classrooms');
    return response.data;
};

export const getAverageGrade = async (studentId: string, subjectId: string) => {
    const response = await api.get(`/api/grades/average/${studentId}/${subjectId}`);
    return response.data;
};

// ─── SCHEDULE API ───────────────────────────────────────────

export const getTimeSlots = async () => {
    const response = await api.get('/api/schedule/slots');
    return response.data;
};

export const upsertTimeSlots = async (slots: { lessonNumber: number; startTime: string; endTime: string }[]) => {
    const response = await api.put('/api/schedule/slots', { slots });
    return response.data;
};

export const getScheduleEvents = async (filters?: { academicYearId?: string; classroomId?: string; teacherId?: string }) => {
    const response = await api.get('/api/schedule/events', { params: filters });
    return response.data;
};

export const createScheduleEvent = async (data: {
    dayOfWeek: number; lessonNumber: number; subjectInstanceId: string;
    classroomId: string; teacherId: string; roomId?: string; academicYearId: string;
}) => {
    const response = await api.post('/api/schedule/events', data);
    return response.data;
};

export const updateScheduleEvent = async (id: string, data: any) => {
    const response = await api.put(`/api/schedule/events/${id}`, data);
    return response.data;
};

export const deleteScheduleEvent = async (id: string) => {
    const response = await api.delete(`/api/schedule/events/${id}`);
    return response.data;
};

export const bulkCreateScheduleEvents = async (events: any[]) => {
    const response = await api.post('/api/schedule/events/bulk', { events });
    return response.data;
};

export const validateSchedule = async (data: any) => {
    const response = await api.post('/api/schedule/validate', data);
    return response.data;
};

export const getClassroomSchedule = async (classroomId: string, academicYearId?: string) => {
    const response = await api.get(`/api/schedule/view/classroom/${classroomId}`, { params: { academicYearId } });
    return response.data;
};

export const getTeacherSchedule = async (teacherId: string, academicYearId?: string) => {
    const response = await api.get(`/api/schedule/view/teacher/${teacherId}`, { params: { academicYearId } });
    return response.data;
};

export const getStudentSchedule = async (studentUserId: string, academicYearId?: string) => {
    const response = await api.get(`/api/schedule/view/student/${studentUserId}`, { params: { academicYearId } });
    return response.data;
};

export const getSubstitutions = async (filters?: { date?: string; weekStart?: string; weekEnd?: string }) => {
    const response = await api.get('/api/schedule/substitutions', { params: filters });
    return response.data;
};

export const createSubstitution = async (data: any) => {
    const response = await api.post('/api/schedule/substitutions', data);
    return response.data;
};

export const updateSubstitution = async (id: string, data: any) => {
    const response = await api.put(`/api/schedule/substitutions/${id}`, data);
    return response.data;
};

export const deleteSubstitution = async (id: string) => {
    const response = await api.delete(`/api/schedule/substitutions/${id}`);
    return response.data;
};

// ─── SCHEDULE GENERATION & EXPORT ───────────────────────────

export const generateSchedule = async (academicYearId: string, clearExisting: boolean = false) => {
    const response = await api.post('/api/schedule/generate', { academicYearId, clearExisting });
    return response.data;
};

export const getScheduleExportHtml = async (classroomId: string, academicYearId: string) => {
    const response = await api.get('/api/schedule/export-html', { params: { classroomId, academicYearId } });
    return response.data;
};

// ─── SCHEDULE SNAPSHOTS & DIFF ──────────────────────────────

export const getScheduleSnapshots = async (academicYearId?: string) => {
    const response = await api.get('/api/schedule/snapshots', { params: { academicYearId } });
    return response.data;
};

export const createScheduleSnapshot = async (academicYearId: string, name: string) => {
    const response = await api.post('/api/schedule/snapshots', { academicYearId, name });
    return response.data;
};

export const diffScheduleSnapshot = async (snapshotId: string) => {
    const response = await api.get(`/api/schedule/snapshots/${snapshotId}/diff`);
    return response.data;
};

export const deleteScheduleSnapshot = async (snapshotId: string) => {
    const response = await api.delete(`/api/schedule/snapshots/${snapshotId}`);
    return response.data;
};

// ─── RECURRING EVENTS ───────────────────────────────────────

export const getRecurringEvents = async () => {
    const response = await api.get('/api/schedule/recurring-events');
    return response.data;
};

export const createRecurringEvent = async (data: { title: string; dayOfWeek: number; startTime: string; endTime: string; roomId?: string; teacherId?: string }) => {
    const response = await api.post('/api/schedule/recurring-events', data);
    return response.data;
};

export const updateRecurringEvent = async (id: string, data: any) => {
    const response = await api.put(`/api/schedule/recurring-events/${id}`, data);
    return response.data;
};

export const deleteRecurringEvent = async (id: string) => {
    const response = await api.delete(`/api/schedule/recurring-events/${id}`);
    return response.data;
};

/**
 * Exchange the httpOnly __edu_sso_token cookie for a JWT.
 * Must be called with credentials (withCredentials is already set on the api instance).
 */
export const exchangeSsoToken = async () => {
    const response = await api.post('/api/auth/sso/exchange-token');
    return response.data; // { access_token: string }
};

export const getInitStatus = async () => {
    const response = await api.get('/api/init/status');
    return response.data; // { initialized: boolean }
};

/** Build optional setup-token headers */
const setupHeaders = (token?: string) =>
    token ? { 'x-setup-token': token } : {};

export const setupApp = async (data: any, setupToken?: string) => {
    const { confirmPassword, ...payload } = data;
    const response = await api.post('/api/init/setup', payload, { headers: setupHeaders(setupToken) });
    return response.data; // { school: SchoolConfig, admin: User }
};

export const getSeedFiles = async (setupToken?: string) => {
    const response = await api.get('/api/init/seed-files', { headers: setupHeaders(setupToken) });
    return response.data; // Array<{ filename, name, description }>
};

export const setupWithSeed = async (data: any, setupToken?: string) => {
    const { confirmPassword, ...payload } = data;
    const response = await api.post('/api/init/setup-with-seed', payload, {
        timeout: 60000,
        headers: setupHeaders(setupToken),
    });
    return response.data; // { admin, seed: SeedResult }
};
export const acceptInvitation = async (payload: { token: string; password: string }) => {
    const response = await api.post('/api/auth/accept-invite', payload);
    return response.data; // { access_token: string }
};

export const requestPasswordReset = async (email: string) => {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data;
};

export const resetPassword = async (payload: { token: string; password: string }) => {
    const response = await api.post('/api/auth/reset-password', payload);
    return response.data;
};
export const login = async (credentials: { email: string; password: string }) => {
    const response = await api.post('/api/auth/login', credentials);
    return response.data; // { access_token: string }
};

export const getMe = async () => {
    const response = await api.get('/api/auth/me');
    return response.data; // User object
};

export const getSsoOptions = async (): Promise<string[]> => {
    const response = await api.get('/api/auth/sso-options');
    return response.data;
};

export const updateProfile = async (data: { avatarUrl?: string }) => {
    const response = await api.patch('/api/auth/profile', data);
    return response.data;
};

export const uploadAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const getUserIdentities = async () => {
    const response = await api.get('/api/auth/identities');
    return response.data;
};

export const getUserSchools = async () => {
    const response = await api.get('/api/auth/schools');
    return response.data; // Array of school memberships
};

export const linkIdentity = (provider: string) => {
    // This needs to redirect to the backend SSO route WITH the current token
    const token = localStorage.getItem('access_token');
    const backendUrl = window.location.origin === 'http://localhost:5173' ? 'http://localhost:3000' : '';
    window.location.href = `${backendUrl}/api/auth/sso/${provider}?token=${token}`;
};

// System Admin API
export const getSystemSchools = async () => {
    const response = await api.get('/api/system/schools');
    return response.data;
};

export const createSystemSchool = async (payload: {
    schoolName: string;
    address?: string;
    admin: { type: 'EXISTING'; userId: string } | { type: 'NEW'; firstName: string; lastName: string; email: string };
}) => {
    const response = await api.post('/api/system/schools', payload);
    return response.data;
};

export const searchUsers = async (query: string) => {
    const response = await api.get('/api/users', { params: { search: query, limit: 20 } });
    return response.data;
};
export const updateSystemSchool = async (id: string, payload: { name?: string; address?: string; requireSsoEmailMatch?: boolean }) => {
    const response = await api.patch(`/api/system/schools/${id}`, payload);
    return response.data;
};
export const deleteSystemSchool = async (id: string) => {
    const response = await api.delete(`/api/system/schools/${id}`);
    return response.data;
};

// System Admin Management
export const getSystemAdmins = async () => {
    const response = await api.get('/api/system/admins');
    return response.data;
};

export const promoteToSysAdmin = async (data: { email: string; firstName?: string; lastName?: string }) => {
    const response = await api.post('/api/system/admins', data);
    return response.data;
};

export const removeSystemAdmin = async (id: string) => {
    const response = await api.delete(`/api/system/admins/${id}`);
    return response.data;
};

// ─── GRADING ────────────────────────────────────────────────

export const createGrade = async (data: {
    studentId: string;
    subjectInstanceId: string;
    value: string;
    weight: number;
    description?: string;
    type?: string;
    verbalText?: string;
    category?: string;
    semesterId?: string;
}) => {
    const response = await api.post('/api/grading/grades', data);
    return response.data;
};

export const updateGrade = async (id: string, data: {
    value?: string;
    weight?: number;
    description?: string;
    verbalText?: string;
    category?: string;
}) => {
    const response = await api.put(`/api/grading/grades/${id}`, data);
    return response.data;
};

export const deleteGrade = async (id: string) => {
    const response = await api.delete(`/api/grading/grades/${id}`);
    return response.data;
};

export const getGradesForClassroom = async (classroomId: string, semesterId?: string) => {
    const response = await api.get(`/api/grading/classroom/${classroomId}`, { params: { semesterId } });
    return response.data;
};

export const getStudentGrades = async (studentId: string, semesterId?: string) => {
    const response = await api.get(`/api/grading/student/${studentId}`, { params: { semesterId } });
    return response.data;
};

export const getGradeAverage = async (studentId: string, subjectInstanceId: string) => {
    const response = await api.get(`/api/grading/average/${studentId}/${subjectInstanceId}`);
    return response.data;
};

export const getReportCards = async (classroomId: string, semesterId: string) => {
    const response = await api.get(`/api/grading/report-cards/${classroomId}/${semesterId}`);
    return response.data;
};

export const upsertReportCard = async (data: {
    studentId: string;
    subjectInstanceId: string;
    semesterId: string;
    finalGrade?: string;
    verbalEvaluation?: string;
    aiPolished?: boolean;
}) => {
    const response = await api.post('/api/grading/report-cards', data);
    return response.data;
};

export const polishVerbalEvaluation = async (data: {
    text: string;
    studentName: string;
    subjectName: string;
}) => {
    const response = await api.post('/api/grading/ai-polish', data);
    return response.data;
};

export const getGradingTypes = async (classroomId: string) => {
    const response = await api.get(`/api/grading/grading-types/${classroomId}`);
    return response.data;
};

// ─── BEHAVIOR GRADES ────────────────────────────────────────

export const upsertBehaviorGrade = async (data: { studentId: string; semesterId: string; grade: number; note?: string }) => {
    const response = await api.put('/api/grading/behavior', data);
    return response.data;
};

export const getBehaviorGrades = async (classroomId: string, semesterId: string) => {
    const response = await api.get(`/api/grading/behavior/${classroomId}/${semesterId}`);
    return response.data;
};

// ─── COMPETENCY GRADES ──────────────────────────────────────

export const upsertCompetencyGrade = async (data: {
    studentId: string; competencyId: string; subjectInstanceId: string;
    semesterId: string; level: number; note?: string;
}) => {
    const response = await api.put('/api/grading/competency', data);
    return response.data;
};

export const getCompetencyGrades = async (studentId: string, semesterId?: string) => {
    const response = await api.get(`/api/grading/competency/${studentId}`, { params: { semesterId } });
    return response.data;
};

// ─── EDUCATIONAL MEASURES ───────────────────────────────────

export const createMeasure = async (data: { studentId: string; type: string; reason: string; semesterId?: string }) => {
    const response = await api.post('/api/grading/measures', data);
    return response.data;
};

export const getMeasures = async (filters?: { classroomId?: string; studentId?: string; semesterId?: string }) => {
    const response = await api.get('/api/grading/measures', { params: filters });
    return response.data;
};

export const deleteMeasure = async (id: string) => {
    const response = await api.delete(`/api/grading/measures/${id}`);
    return response.data;
};

// ─── GRADE HISTORY ──────────────────────────────────────────

export const getGradeHistory = async (studentId: string, subjectInstanceId: string) => {
    const response = await api.get(`/api/grading/history/${studentId}/${subjectInstanceId}`);
    return response.data;
};

// ─── REPORT CARD HTML EXPORT ────────────────────────────────

export const getReportCardHtml = async (classroomId: string, semesterId: string) => {
    const response = await api.get(`/api/grading/report-cards-html/${classroomId}/${semesterId}`);
    return response.data;
};

// ─── COMMISSION EXAMS ───────────────────────────────────────

export const createCommissionExam = async (data: {
    date: string; originalGrade: string; studentId: string;
    subjectInstanceId: string; semesterId: string; note?: string;
}) => {
    const response = await api.post('/api/grading/commission-exams', data);
    return response.data;
};

export const getCommissionExams = async (filters?: { classroomId?: string; semesterId?: string }) => {
    const response = await api.get('/api/grading/commission-exams', { params: filters });
    return response.data;
};

export const updateCommissionExam = async (id: string, data: { newGrade?: string; note?: string; date?: string }) => {
    const response = await api.put(`/api/grading/commission-exams/${id}`, data);
    return response.data;
};

export const deleteCommissionExam = async (id: string) => {
    const response = await api.delete(`/api/grading/commission-exams/${id}`);
    return response.data;
};

// ─── CLASSIFICATION DEADLINE ────────────────────────────────

export const getClassificationDeadline = async (semesterId: string) => {
    const response = await api.get(`/api/grading/deadline/${semesterId}`);
    return response.data;
};

export const upsertClassificationDeadline = async (data: { semesterId: string; deadline: string; isLocked?: boolean }) => {
    const response = await api.put('/api/grading/deadline', data);
    return response.data;
};

export const lockClassification = async (semesterId: string, lock: boolean) => {
    const response = await api.post('/api/grading/deadline/lock', { semesterId, lock });
    return response.data;
};

// ─── ATTENDANCE ─────────────────────────────────────────────

export const recordAttendance = async (data: {
    date: string; lessonNumber: number; classroomId: string;
    records: Array<{ studentId: string; status: string; note?: string }>;
}) => {
    const response = await api.post('/api/attendance/record', data);
    return response.data;
};

export const getClassroomAttendance = async (classroomId: string, date: string) => {
    const response = await api.get(`/api/attendance/classroom/${classroomId}`, { params: { date } });
    return response.data;
};

export const createAbsenceExcuse = async (data: { studentId: string; reason: string; dateFrom: string; dateTo: string }) => {
    const response = await api.post('/api/attendance/excuses', data);
    return response.data;
};

export const getAbsenceExcuses = async (filters?: { classroomId?: string; status?: string }) => {
    const response = await api.get('/api/attendance/excuses', { params: filters });
    return response.data;
};

export const reviewAbsenceExcuse = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const response = await api.put(`/api/attendance/excuses/${id}/review`, { status });
    return response.data;
};

export const getAttendanceStats = async (classroomId: string, dateFrom?: string, dateTo?: string) => {
    const response = await api.get(`/api/attendance/stats/${classroomId}`, { params: { dateFrom, dateTo } });
    return response.data;
};

export const exportAttendanceCsv = async (classroomId: string, dateFrom?: string, dateTo?: string) => {
    const response = await api.get(`/api/attendance/export/${classroomId}`, {
        params: { dateFrom, dateTo },
        responseType: 'blob',
    });
    return response.data;
};

export const getUnexcusedAlerts = async (threshold?: number) => {
    const response = await api.get('/api/attendance/unexcused-alerts', { params: { threshold } });
    return response.data;
};

export const getConversations = async () => {
    const response = await api.get('/api/messaging/conversations');
    return response.data;
};

export const getMessages = async (conversationId: string, limit = 50, offset = 0) => {
    const response = await api.get(`/api/messaging/conversations/${conversationId}/messages`, {
        params: { limit, offset },
    });
    return response.data;
};

export const sendMessage = async (conversationId: string, content: string) => {
    const response = await api.post(`/api/messaging/conversations/${conversationId}/messages`, { content });
    return response.data;
};

export const createConversation = async (data: {
    recipientIds: string[];
    subject?: string;
    type?: string;
    classroomId?: string;
    initialMessage?: string;
}) => {
    const response = await api.post('/api/messaging/conversations', data);
    return response.data;
};

export const getAvailableRecipients = async () => {
    const response = await api.get('/api/messaging/recipients');
    return response.data;
};

export const getMessagingClassrooms = async () => {
    const response = await api.get('/api/messaging/classrooms');
    return response.data;
};

export const createClassBroadcast = async (data: { classroomId: string; subject: string; message: string }) => {
    const response = await api.post('/api/messaging/broadcast/class', data);
    return response.data;
};

export const createSchoolBroadcast = async (data: { subject: string; message: string }) => {
    const response = await api.post('/api/messaging/broadcast/school', data);
    return response.data;
};

// ─── NOTIFICATIONS ──────────────────────────────────────────

export const getNotifications = async (limit = 20, offset = 0) => {
    const response = await api.get('/api/messaging/notifications', { params: { limit, offset } });
    return response.data;
};

export const getUnreadNotificationCount = async () => {
    const response = await api.get('/api/messaging/notifications/unread-count');
    return response.data;
};

export const markNotificationRead = async (id: string) => {
    const response = await api.put(`/api/messaging/notifications/${id}/read`);
    return response.data;
};

export const markAllNotificationsRead = async () => {
    const response = await api.put('/api/messaging/notifications/read-all');
    return response.data;
};

export const toggleEmailNotifications = async (enabled: boolean) => {
    const response = await api.put('/api/messaging/email-notifications', { enabled });
    return response.data;
};

// ─── TEST DATA ──────────────────────────────────────────────

export const generateTestData = async (config: {
    schoolName: string;
    schoolType: string;
    teacherCount?: number;
    teacherActiveCount?: number;
    teacherInvitedCount?: number;
    studentCount?: number;
    studentActiveCount?: number;
    studentInvitedCount?: number;
    parentCount?: number;
    generateSubjects?: boolean;
    generateSchedule?: boolean;
    generateGrades?: boolean;
    generateCommunication?: boolean;
    generateAttendance?: boolean;
    generateReportCards?: boolean;
    generateCommunity?: boolean;
}) => {
    const response = await api.post('/api/system/test-data/generate', config);
    return response.data;
};

export const wipeSchoolData = async (schoolId: string) => {
    const response = await api.delete(`/api/system/test-data/wipe/${schoolId}`);
    return response.data;
};

export const wipeAllData = async () => {
    const response = await api.delete('/api/system/test-data/wipe-all');
    return response.data;
};

// ─── COMMUNITY ──────────────────────────────────────────────

export const getBulletinPosts = async () => {
    const response = await api.get('/api/community/bulletin');
    return response.data;
};

export const createBulletinPost = async (data: { title: string; content: string; pinned?: boolean }) => {
    const response = await api.post('/api/community/bulletin', data);
    return response.data;
};

export const updateBulletinPost = async (id: string, data: { title?: string; content?: string; pinned?: boolean }) => {
    const response = await api.put(`/api/community/bulletin/${id}`, data);
    return response.data;
};

export const deleteBulletinPost = async (id: string) => {
    const response = await api.delete(`/api/community/bulletin/${id}`);
    return response.data;
};

export const getPolls = async () => {
    const response = await api.get('/api/community/polls');
    return response.data;
};

export const createPoll = async (data: { question: string; options: string[]; multiSelect?: boolean; endsAt?: string }) => {
    const response = await api.post('/api/community/polls', data);
    return response.data;
};

export const votePoll = async (optionId: string) => {
    const response = await api.post(`/api/community/polls/${optionId}/vote`);
    return response.data;
};

export const deletePoll = async (id: string) => {
    const response = await api.delete(`/api/community/polls/${id}`);
    return response.data;
};

export const getCalendarEvents = async () => {
    const response = await api.get('/api/community/events');
    return response.data;
};

export const createCalendarEvent = async (data: { title: string; description?: string; startDate: string; endDate?: string; location?: string }) => {
    const response = await api.post('/api/community/events', data);
    return response.data;
};

export const rsvpEvent = async (eventId: string, status: 'YES' | 'NO' | 'MAYBE') => {
    const response = await api.post(`/api/community/events/${eventId}/rsvp`, { status });
    return response.data;
};

export const deleteCalendarEvent = async (id: string) => {
    const response = await api.delete(`/api/community/events/${id}`);
    return response.data;
};

// ─── CLASS BOOK ─────────────────────────────────────────────

export const getClassBookEntries = async (classroomId: string, date: string) => {
    const response = await api.get(`/api/classbook/entries/${classroomId}`, { params: { date } });
    return response.data;
};

export const upsertClassBookEntry = async (data: {
    classroomId: string; date: string; lessonNumber: number;
    topic?: string; notes?: string; absentCount?: number;
    scheduleEventId?: string; subjectName?: string;
}) => {
    const response = await api.post('/api/classbook/entries', data);
    return response.data;
};

export const signClassBookEntry = async (entryId: string) => {
    const response = await api.post(`/api/classbook/sign/${entryId}`);
    return response.data;
};

export const getClassBookRange = async (classroomId: string, dateFrom: string, dateTo: string) => {
    const response = await api.get(`/api/classbook/range/${classroomId}`, { params: { dateFrom, dateTo } });
    return response.data;
};

export const getClassBookPrintUrl = (classroomId: string, dateFrom: string, dateTo: string) => {
    return `/api/classbook/print/${classroomId}?dateFrom=${dateFrom}&dateTo=${dateTo}`;
};

export const getClassBookAttendance = async (classroomId: string, date: string, lessonNumber: number) => {
    const response = await api.get(`/api/classbook/attendance/${classroomId}`, { params: { date, lessonNumber } });
    return response.data;
};

// ─── AI FEATURES ────────────────────────────────────────────

export const aiRefineText = async (data: { existingText?: string; context: string; instruction: string }) => {
    const response = await api.post('/api/ai/refine-text', data);
    return response.data;
};

export const aiGenerateThematicPlan = async (data: { subjectName: string; grade: string; hoursPerWeek: number; semesterWeeks?: number; topics?: string }) => {
    const response = await api.post('/api/ai/thematic-plan', data);
    return response.data;
};

export const aiStudentRecommendations = async (data: { studentName: string; grades: Array<{ subject: string; grade: number }>; attendance?: { total: number; absent: number }; behavior?: string }) => {
    const response = await api.post('/api/ai/student-recommendations', data);
    return response.data;
};

export const aiClassAnalysis = async (data: { className: string; grades: Array<{ student: string; subject: string; grade: number }>; subjectName?: string }) => {
    const response = await api.post('/api/ai/class-analysis', data);
    return response.data;
};

export const aiGenerateTest = async (data: { subjectName: string; topic: string; grade: string; questionCount?: number; difficulty?: 'easy' | 'medium' | 'hard'; questionTypes?: string }) => {
    const response = await api.post('/api/ai/generate-test', data);
    return response.data;
};

export const aiGenerateWrittenTest = async (data: { subjectName: string; topics: string[]; grade: string; duration?: number; variantCount?: number }) => {
    const response = await api.post('/api/ai/generate-written-test', data);
    return response.data;
};

export const aiGenerateSchoolName = async (schoolType?: string) => {
    const response = await api.post('/api/ai/generate-school-name', { schoolType });
    return response.data;
};
