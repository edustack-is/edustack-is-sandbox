import axios from 'axios';

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
    return config;
});

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

export const login = async (credentials: { email: string; password: string }) => {
    const response = await api.post('/api/auth/login', credentials);
    return response.data; // { access_token: string }
};

export const getMe = async () => {
    const response = await api.get('/api/auth/me');
    return response.data; // User object
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
