import axios from 'axios';

export const api = axios.create({
    baseURL: '/',
    headers: {
        'Content-Type': 'application/json',
    },
});

export const getUsers = async () => {
    const response = await api.get('/users');
    return response.data;
};

export const getClassrooms = async () => {
    const response = await api.get('/registry/classrooms');
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
