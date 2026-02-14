import { api } from './index';

// ─── ACADEMIC YEAR ──────────────────────────────────────────────

export const getAcademicYears = async () => {
    const response = await api.get('/api/deputy/academic-years');
    return response.data;
};

export const createAcademicYear = async (data: {
    name: string;
    startDate: string;
    endDate: string;
    isCurrent?: boolean;
}) => {
    const response = await api.post('/api/deputy/academic-years', data);
    return response.data;
};

// ─── GRADE LEVELS ───────────────────────────────────────────────

export const getGradeLevels = async () => {
    const response = await api.get('/api/deputy/grade-levels');
    return response.data;
};

export const createGradeLevel = async (data: {
    name: string;
    levelNumber: number;
}) => {
    const response = await api.post('/api/deputy/grade-levels', data);
    return response.data;
};

// ─── ROOMS ──────────────────────────────────────────────────────

export const getRooms = async () => {
    const response = await api.get('/api/deputy/rooms');
    return response.data;
};

export const updateRoom = async (id: string, data: {
    name?: string;
    capacity?: number;
    isComputerLab?: boolean;
    specialEquipment?: string[];
}) => {
    const response = await api.put(`/api/deputy/rooms/${id}`, data);
    return response.data;
};

// ─── TEACHERS ───────────────────────────────────────────────────

export const getTeachers = async () => {
    const response = await api.get('/api/deputy/teachers');
    return response.data;
};

// ─── TEACHER WORKLOADS ──────────────────────────────────────────

export const getTeacherWorkloads = async (academicYearId: string) => {
    const response = await api.get('/api/deputy/teacher-workloads', {
        params: { academicYearId },
    });
    return response.data;
};

export const saveTeacherWorkload = async (data: {
    teacherId: string;
    academicYearId: string;
    workloadPercentage: number;
}) => {
    const response = await api.post('/api/deputy/teacher-workloads', data);
    return response.data;
};

// ─── SUBJECT TEMPLATES ──────────────────────────────────────────

export const getSubjectTemplates = async () => {
    const response = await api.get('/api/deputy/subjects');
    return response.data;
};

// ─── SUBJECT INSTANCES (CURRICULUM) ─────────────────────────────

export const getSubjectInstances = async (academicYearId: string) => {
    const response = await api.get('/api/deputy/subjects/instances', {
        params: { academicYearId },
    });
    return response.data;
};

export const createSubjectInstance = async (data: {
    templateId: string;
    academicYearId: string;
    gradeLevelId: string;
    hoursPerWeek: number;
}) => {
    const response = await api.post('/api/deputy/subjects/instances', data);
    return response.data;
};

// ─── BATCH ENROLLMENT ───────────────────────────────────────────

export const batchEnroll = async (data: {
    studentIds: string[];
    academicYearId: string;
    gradeLevelId: string;
    classroomId?: string;
}) => {
    const response = await api.post('/api/deputy/enrollments/batch', data);
    return response.data;
};

// ─── SCHOOL-SCOPED USER MANAGEMENT ──────────────────────────────

export const getDeputyUsers = async () => {
    const response = await api.get('/api/deputy/users');
    return response.data;
};

export const createStudentFamily = async (data: {
    student: { firstName: string; lastName: string; email?: string };
    parents: Array<{ firstName: string; lastName: string; email: string; phone?: string }>;
}) => {
    const response = await api.post('/api/deputy/users/student-family', data);
    return response.data;
};

export const createStaff = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    role: 'TEACHER' | 'DEPUTY';
    workloadPercentage: number;
}) => {
    const response = await api.post('/api/deputy/users/staff', data);
    return response.data;
};

