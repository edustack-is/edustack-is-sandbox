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

// ─── MESSAGING ──────────────────────────────────────────────

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
