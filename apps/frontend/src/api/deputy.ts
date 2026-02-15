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
    curriculumVersionId?: string;
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

export const updateGradeLevel = async (id: string, data: {
    name?: string;
    levelNumber?: number;
}) => {
    const response = await api.put(`/api/deputy/grade-levels/${id}`, data);
    return response.data;
};

export const deleteGradeLevel = async (id: string) => {
    const response = await api.delete(`/api/deputy/grade-levels/${id}`);
    return response.data;
};

// ─── ROOMS ──────────────────────────────────────────────────────

export const getRooms = async () => {
    const response = await api.get('/api/deputy/rooms');
    return response.data;
};

export const createRoom = async (data: {
    name: string;
    capacity?: number;
    isComputerLab?: boolean;
    specialEquipment?: string[];
}) => {
    const response = await api.post('/api/deputy/rooms', data);
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

export const deleteRoom = async (id: string) => {
    const response = await api.delete(`/api/deputy/rooms/${id}`);
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

export const createSubject = async (data: {
    name: string;
    code: string;
    svpDescription?: string;
}) => {
    const response = await api.post('/api/deputy/subjects', data);
    return response.data;
};

export const updateSubject = async (id: string, data: {
    name?: string;
    code?: string;
    svpDescription?: string;
}) => {
    const response = await api.put(`/api/deputy/subjects/${id}`, data);
    return response.data;
};

export const deleteSubject = async (id: string) => {
    const response = await api.delete(`/api/deputy/subjects/${id}`);
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
    curriculumVersionId?: string;
}) => {
    const response = await api.post('/api/deputy/subjects/instances', data);
    return response.data;
};

// ─── CURRICULUM VERSIONING (ŠVP) ────────────────────────────────

export const getCurriculumVersions = async () => {
    const response = await api.get('/api/deputy/curriculum-versions');
    return response.data;
};

export const getCurriculumVersion = async (id: string) => {
    const response = await api.get(`/api/deputy/curriculum-versions/${id}`);
    return response.data;
};

export const createCurriculumVersion = async (data: {
    name: string;
    validFrom: string;
    validTo?: string;
}) => {
    const response = await api.post('/api/deputy/curriculum-versions', data);
    return response.data;
};

export const updateCurriculumVersion = async (id: string, data: {
    name?: string;
    validFrom?: string;
    validTo?: string | null;
}) => {
    const response = await api.put(`/api/deputy/curriculum-versions/${id}`, data);
    return response.data;
};

export const deleteCurriculumVersion = async (id: string) => {
    const response = await api.delete(`/api/deputy/curriculum-versions/${id}`);
    return response.data;
};

// ─── CURRICULUM ENTRIES (předmět × ročník) ──────────────────────

export const saveCurriculumEntry = async (data: {
    curriculumVersionId: string;
    subjectTemplateId: string;
    gradeLevelId: string;
    hoursPerWeek: number;
    rvpDescription?: string;
    svpApproach?: string;
    equipmentRequirements?: string[];
    needsComputerLab?: boolean;
}) => {
    const response = await api.post('/api/deputy/curriculum-entries', data);
    return response.data;
};

export const deleteCurriculumEntry = async (id: string) => {
    const response = await api.delete(`/api/deputy/curriculum-entries/${id}`);
    return response.data;
};

// ─── WHITE BOOK ─────────────────────────────────────────────────

export const getWhiteBookData = async () => {
    const response = await api.get('/api/deputy/white-book');
    return response.data;
};

// ─── SEMESTERS ──────────────────────────────────────────────────

export const createSemesters = async (data: {
    academicYearId: string;
    semesters: Array<{ number: number; name: string; startDate: string; endDate: string }>;
}) => {
    const response = await api.post('/api/deputy/semesters', data);
    return response.data;
};


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

export const resendInvitation = async (userId: string) => {
    const response = await api.post(`/api/deputy/users/${userId}/resend-invitation`);
    return response.data;
};

// ─── SCHOOL USER MANAGEMENT (remove, alumni, impersonate) ───────

export const removeSchoolUser = async (userId: string) => {
    const response = await api.delete(`/api/deputy/users/${userId}`);
    return response.data;
};

export const setUserAlumni = async (userId: string) => {
    const response = await api.patch(`/api/deputy/users/${userId}/alumni`);
    return response.data;
};

export const impersonateSchoolUser = async (userId: string) => {
    const response = await api.post(`/api/deputy/users/${userId}/impersonate`);
    return response.data;
};

// ─── RVP AI IMPORT ──────────────────────────────────────────────

export const analyzeRvpFromUrl = async (url: string) => {
    const formData = new FormData();
    formData.append('url', url);
    const response = await api.post('/api/deputy/rvp-import/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 min – AI can be slow
    });
    return response.data;
};

export const analyzeRvpFromPdf = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/deputy/rvp-import/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
    });
    return response.data;
};

export const confirmRvpImport = async (data: {
    versionName: string;
    validFrom: string;
    validTo?: string;
    subjectMappings: Array<{
        extractedName: string;
        extractedCode: string;
        existingId: string | null;
    }>;
    gradeMappings: Array<{
        gradeLevel: number;
        existingId: string | null;
        name: string;
    }>;
    allocations: Array<{
        subjectName: string;
        gradeLevel: number;
        hoursPerWeek: number;
        rvpDescription?: string;
    }>;
}) => {
    const response = await api.post('/api/deputy/rvp-import/confirm', data);
    return response.data;
};
