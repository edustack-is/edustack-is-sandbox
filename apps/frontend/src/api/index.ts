import axios from 'axios';
import i18n from '../i18n';

export const api = axios.create({
    baseURL: '/',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // Inject current language
    config.headers['Accept-Language'] = i18n.language;
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

export const impersonateUser = async (targetId: string, adminId: string) => {
    const response = await api.post(`/api/auth/impersonate/${targetId}`, { adminId });
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

export const validateSchedule = async (data: any) => {
    const response = await api.post('/api/schedule/validate', data);
    return response.data;
};

export const getInitStatus = async () => {
    const response = await api.get('/api/init/status');
    return response.data; // { initialized: boolean }
};

export const setupApp = async (data: any) => {
    const response = await api.post('/api/init/setup', data);
    return response.data; // { school: SchoolConfig, admin: User }
};

export const getSeedFiles = async () => {
    const response = await api.get('/api/init/seed-files');
    return response.data; // Array<{ filename, name, description }>
};

export const setupWithSeed = async (data: any) => {
    const response = await api.post('/api/init/setup-with-seed', data, { timeout: 60000 });
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
export const updateSystemSchool = async (id: string, payload: { name?: string; address?: string }) => {
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
