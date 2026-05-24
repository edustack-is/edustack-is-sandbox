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

export const createGradeLevel = async (data: { name: string; levelNumber: number }) => {
    const response = await api.post('/api/deputy/grade-levels', data);
    return response.data;
};

export const updateGradeLevel = async (
    id: string,
    data: {
        name?: string;
        levelNumber?: number;
    },
) => {
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
    buildingId?: string;
    floor?: number;
}) => {
    const response = await api.post('/api/deputy/rooms', data);
    return response.data;
};

export const updateRoom = async (
    id: string,
    data: {
        name?: string;
        capacity?: number;
        isComputerLab?: boolean;
        specialEquipment?: string[];
        buildingId?: string | null;
        floor?: number | null;
    },
) => {
    const response = await api.put(`/api/deputy/rooms/${id}`, data);
    return response.data;
};

export const deleteRoom = async (id: string) => {
    const response = await api.delete(`/api/deputy/rooms/${id}`);
    return response.data;
};

// ─── BUILDINGS ──────────────────────────────────────────────────

export const getBuildings = async () => {
    const response = await api.get('/api/deputy/buildings');
    return response.data;
};

export const createBuilding = async (data: { name: string; address?: string; floors?: number }) => {
    const response = await api.post('/api/deputy/buildings', data);
    return response.data;
};

export const updateBuilding = async (id: string, data: { name?: string; address?: string; floors?: number }) => {
    const response = await api.put(`/api/deputy/buildings/${id}`, data);
    return response.data;
};

export const deleteBuilding = async (id: string) => {
    const response = await api.delete(`/api/deputy/buildings/${id}`);
    return response.data;
};

// ─── ROOM SHARING ───────────────────────────────────────────────

export const shareRoom = async (roomId: string, targetSchoolId: string) => {
    const response = await api.post(`/api/deputy/rooms/${roomId}/share`, { targetSchoolId });
    return response.data;
};

export const unshareRoom = async (roomId: string, targetSchoolId: string) => {
    const response = await api.delete(`/api/deputy/rooms/${roomId}/share/${targetSchoolId}`);
    return response.data;
};

export const getSharedRooms = async () => {
    const response = await api.get('/api/deputy/shared-rooms');
    return response.data;
};

// ─── SCHOOL EVENTS ──────────────────────────────────────────────

export const getSchoolEvents = async () => {
    const response = await api.get('/api/deputy/events');
    return response.data;
};

export const getUpcomingEvents = async (limit = 10) => {
    const response = await api.get('/api/deputy/events/upcoming', { params: { limit } });
    return response.data;
};

export const createSchoolEvent = async (data: {
    title: string;
    description?: string;
    date: string;
    endDate?: string;
    type?: string;
    allDay?: boolean;
}) => {
    const response = await api.post('/api/deputy/events', data);
    return response.data;
};

export const updateSchoolEvent = async (
    id: string,
    data: {
        title?: string;
        description?: string;
        date?: string;
        endDate?: string;
        type?: string;
        allDay?: boolean;
    },
) => {
    const response = await api.put(`/api/deputy/events/${id}`, data);
    return response.data;
};

export const deleteSchoolEvent = async (id: string) => {
    const response = await api.delete(`/api/deputy/events/${id}`);
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

export const createSubject = async (data: { name: string; code: string; svpDescription?: string }) => {
    const response = await api.post('/api/deputy/subjects', data);
    return response.data;
};

export const updateSubject = async (
    id: string,
    data: {
        name?: string;
        code?: string;
        svpDescription?: string;
    },
) => {
    const response = await api.put(`/api/deputy/subjects/${id}`, data);
    return response.data;
};

export const deleteSubject = async (id: string) => {
    const response = await api.delete(`/api/deputy/subjects/${id}`);
    return response.data;
};

// ─── SUBJECT INSTANCES (CURRICULUM) ─────────────────────────────

export const getSubjectInstances = async (academicYearId: string) => {
    const response = await api.get('/api/deputy/subject-instances', {
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

export const createCurriculumVersion = async (data: { name: string; validFrom: string; validTo?: string }) => {
    const response = await api.post('/api/deputy/curriculum-versions', data);
    return response.data;
};

export const updateCurriculumVersion = async (
    id: string,
    data: {
        name?: string;
        validFrom?: string;
        validTo?: string | null;
    },
) => {
    const response = await api.put(`/api/deputy/curriculum-versions/${id}`, data);
    return response.data;
};

export const deleteCurriculumVersion = async (id: string) => {
    const response = await api.delete(`/api/deputy/curriculum-versions/${id}`);
    return response.data;
};

export const duplicateCurriculumVersion = async (
    id: string,
    data: {
        name: string;
        validFrom: string;
        validTo?: string;
    },
) => {
    const response = await api.post(`/api/deputy/curriculum-versions/${id}/duplicate`, data);
    return response.data;
};

export const compareCurriculumVersions = async (versionAId: string, versionBId: string) => {
    const response = await api.get('/api/deputy/curriculum-versions/compare', {
        params: { versionA: versionAId, versionB: versionBId },
    });
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
    gradingType?: string;
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

// ─── STAFF WORKLOADS ────────────────────────────────────────────

export const getSchoolStaff = async () => {
    const response = await api.get('/api/deputy/staff');
    return response.data;
};

export const getStaffWorkloads = async (academicYearId: string) => {
    const response = await api.get('/api/deputy/staff-workloads', {
        params: { academicYearId },
    });
    return response.data;
};

export const createStaffWorkload = async (data: {
    userId: string;
    academicYearId: string;
    versionLabel: string;
    validFrom: string;
    teachingLoad: number;
    adminLoad: number;
    note?: string;
}) => {
    const response = await api.post('/api/deputy/staff-workloads', data);
    return response.data;
};

export const updateStaffWorkload = async (
    id: string,
    data: {
        versionLabel?: string;
        validFrom?: string;
        teachingLoad?: number;
        adminLoad?: number;
        note?: string | null;
    },
) => {
    const response = await api.put(`/api/deputy/staff-workloads/${id}`, data);
    return response.data;
};

export const deleteStaffWorkload = async (id: string) => {
    const response = await api.delete(`/api/deputy/staff-workloads/${id}`);
    return response.data;
};

export const saveStaffSubjectAssignments = async (
    workloadId: string,
    assignments: Array<{
        subjectTemplateId: string;
        gradeLevelIds: string[];
        canSubstitute: boolean;
    }>,
) => {
    const response = await api.put(`/api/deputy/staff-workloads/${workloadId}/subjects`, { assignments });
    return response.data;
};

export const getSubjectTemplatesForWorkloads = async () => {
    const response = await api.get('/api/deputy/subject-templates');
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

// ─── USER EDIT, SUSPEND, ROLE, EXPORT ───────────────────────────

export const updateSchoolUser = async (
    userId: string,
    data: {
        firstName?: string;
        lastName?: string;
        email?: string;
        workloadPercentage?: number;
        // null = unassign from classroom; undefined = leave as-is.
        classroomId?: string | null;
    },
) => {
    const response = await api.put(`/api/deputy/users/${userId}`, data);
    return response.data;
};

export const assignStudentToClassroom = async (userId: string, classroomId: string | null) => {
    const response = await api.put(`/api/deputy/users/${userId}`, { classroomId });
    return response.data;
};

export const suspendUser = async (userId: string) => {
    const response = await api.patch(`/api/deputy/users/${userId}/suspend`);
    return response.data;
};

export const reactivateUser = async (userId: string) => {
    const response = await api.patch(`/api/deputy/users/${userId}/reactivate`);
    return response.data;
};

export const changeUserRole = async (userId: string, role: string) => {
    const response = await api.patch(`/api/deputy/users/${userId}/role`, { role });
    return response.data;
};

export const exportUsersCSV = async () => {
    const response = await api.get('/api/deputy/users/export', { responseType: 'blob' });
    return response.data;
};

// ─── THEMATIC PLANS ─────────────────────────────────────────────

export const getThematicPlans = async () => {
    const response = await api.get('/api/deputy/thematic-plans');
    return response.data;
};

export const getThematicPlan = async (id: string) => {
    const response = await api.get(`/api/deputy/thematic-plans/${id}`);
    return response.data;
};

export const createThematicPlan = async (data: {
    title: string;
    subjectTemplateId: string;
    academicYearId: string;
    gradeLevelId: string;
}) => {
    const response = await api.post('/api/deputy/thematic-plans', data);
    return response.data;
};

export const updateThematicPlan = async (id: string, data: { title?: string }) => {
    const response = await api.put(`/api/deputy/thematic-plans/${id}`, data);
    return response.data;
};

export const deleteThematicPlan = async (id: string) => {
    const response = await api.delete(`/api/deputy/thematic-plans/${id}`);
    return response.data;
};

export const saveThematicPlanWeeks = async (
    planId: string,
    weeks: Array<{
        weekNumber: number;
        topic: string;
        objectives?: string;
        methods?: string;
        resources?: string;
        crossCurricular?: string;
        notes?: string;
    }>,
) => {
    const response = await api.put(`/api/deputy/thematic-plans/${planId}/weeks`, { weeks });
    return response.data;
};

// ─── LESSON PREPARATIONS ────────────────────────────────────────

export const getLessonPreparations = async (subjectTemplateId?: string) => {
    const response = await api.get('/api/deputy/lesson-preparations', { params: { subjectTemplateId } });
    return response.data;
};

export const createLessonPreparation = async (data: {
    title: string;
    date: string;
    duration?: number;
    topic: string;
    objectives?: string;
    activities?: string;
    materials?: string;
    homework?: string;
    evaluation?: string;
    subjectTemplateId: string;
}) => {
    const response = await api.post('/api/deputy/lesson-preparations', data);
    return response.data;
};

export const updateLessonPreparation = async (id: string, data: any) => {
    const response = await api.put(`/api/deputy/lesson-preparations/${id}`, data);
    return response.data;
};

export const deleteLessonPreparation = async (id: string) => {
    const response = await api.delete(`/api/deputy/lesson-preparations/${id}`);
    return response.data;
};

// ─── TEACHING MATERIALS ─────────────────────────────────────────

export const getTeachingMaterials = async (subjectTemplateId?: string, type?: string) => {
    const response = await api.get('/api/deputy/teaching-materials', { params: { subjectTemplateId, type } });
    return response.data;
};

export const createTeachingMaterial = async (data: {
    title: string;
    description?: string;
    url: string;
    type?: string;
    subjectTemplateId?: string;
    gradeLevelId?: string;
}) => {
    const response = await api.post('/api/deputy/teaching-materials', data);
    return response.data;
};

export const updateTeachingMaterial = async (id: string, data: any) => {
    const response = await api.put(`/api/deputy/teaching-materials/${id}`, data);
    return response.data;
};

export const deleteTeachingMaterial = async (id: string) => {
    const response = await api.delete(`/api/deputy/teaching-materials/${id}`);
    return response.data;
};

// ─── RVP COMPETENCIES ───────────────────────────────────────────

export const getRvpCompetencies = async () => {
    const response = await api.get('/api/deputy/competencies');
    return response.data;
};

export const createRvpCompetency = async (data: { code: string; name: string; area: string; description?: string }) => {
    const response = await api.post('/api/deputy/competencies', data);
    return response.data;
};

export const updateRvpCompetency = async (id: string, data: any) => {
    const response = await api.put(`/api/deputy/competencies/${id}`, data);
    return response.data;
};

export const deleteRvpCompetency = async (id: string) => {
    const response = await api.delete(`/api/deputy/competencies/${id}`);
    return response.data;
};

export const getCompetencyMappings = async (subjectTemplateId?: string, gradeLevelId?: string) => {
    const response = await api.get('/api/deputy/competency-mappings', { params: { subjectTemplateId, gradeLevelId } });
    return response.data;
};

export const upsertCompetencyMapping = async (data: {
    competencyId: string;
    subjectTemplateId: string;
    gradeLevelId: string;
    fulfilled: boolean;
    note?: string;
}) => {
    const response = await api.post('/api/deputy/competency-mappings', data);
    return response.data;
};

export const deleteCompetencyMapping = async (id: string) => {
    const response = await api.delete(`/api/deputy/competency-mappings/${id}`);
    return response.data;
};

// ─── RVP AI IMPORT ──────────────────────────────────────────────

export const analyzeRvpFromUrl = async (url: string) => {
    const formData = new FormData();
    formData.append('url', url);
    const response = await api.post('/api/deputy/rvp-import/analyze', formData, {
        timeout: 120000, // 2 min – AI can be slow
    });
    return response.data;
};

export const analyzeRvpFromPdf = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/deputy/rvp-import/analyze', formData, {
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
