import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '@/context/SchoolContext';
import { TimetableGrid, ScheduleEventData, TimeSlot } from '@/components/schedule/TimetableGrid';
import {
    getTimeSlots,
    getClassroomSchedule,
    getTeacherSchedule,
    getStudentSchedule,
    api,
} from '@/api';
import { CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar, GraduationCap, UserCheck, Users } from 'lucide-react';

interface ClassroomOption {
    id: string;
    name: string;
}

interface TeacherOption {
    id: string;
    user: { firstName: string; lastName: string };
}

interface AcademicYearOption { id: string; name: string; isCurrent: boolean; }
interface SemesterOption { id: string; name: string; number: number; startDate: string; endDate: string; }

type ViewMode = 'my' | 'classroom' | 'teacher';

export const Schedule: React.FC = () => {
    const { t } = useTranslation();
    const { role, userId, schoolId } = useSchool();

    const [viewMode, setViewMode] = useState<ViewMode>('my');
    const [events, setEvents] = useState<ScheduleEventData[]>([]);
    const [slots, setSlots] = useState<TimeSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter options
    const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
    const [teachers, setTeachers] = useState<TeacherOption[]>([]);
    const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

    // Academic year & semester
    const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
    const [semesters, setSemesters] = useState<SemesterOption[]>([]);
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
    const [selectedSemesterId, setSelectedSemesterId] = useState('');

    // Today for highlighting substitutions
    const today = new Date().toISOString().slice(0, 10);

    // Load classrooms, teachers, and academic years
    useEffect(() => {
        if (!schoolId) return;

        api.get('/api/deputy/classrooms').then(res => {
            setClassrooms(Array.isArray(res.data) ? res.data : []);
        }).catch(() => setClassrooms([]));

        api.get('/api/deputy/dashboard').then(res => {
            const data = res.data;
            if (data?.teachers) {
                setTeachers(data.teachers.map((t: any) => ({
                    id: t.teacherProfile?.id || t.id,
                    user: { firstName: t.firstName, lastName: t.lastName },
                })));
            }
        }).catch(() => setTeachers([]));

        // Load academic years
        api.get('/api/deputy/academic-years').then(res => {
            const years = Array.isArray(res.data) ? res.data : [];
            setAcademicYears(years);
            const current = years.find((y: any) => y.isCurrent);
            if (current && !selectedAcademicYearId) {
                setSelectedAcademicYearId(current.id);
            }
        }).catch(() => setAcademicYears([]));
    }, [schoolId]);

    // Load semesters when academic year changes
    useEffect(() => {
        if (!schoolId || !selectedAcademicYearId) {
            setSemesters([]);
            return;
        }
        api.get('/api/deputy/semesters', { params: { academicYearId: selectedAcademicYearId } })
            .then(res => {
                const sems = Array.isArray(res.data) ? res.data : [];
                setSemesters(sems);
                // Auto-select current semester based on today's date
                const now = new Date();
                const currentSem = sems.find((s: any) => {
                    const start = new Date(s.startDate);
                    const end = new Date(s.endDate);
                    return now >= start && now <= end;
                });
                setSelectedSemesterId(currentSem?.id || '');
            })
            .catch(() => setSemesters([]));
    }, [schoolId, selectedAcademicYearId]);

    // Load time slots
    useEffect(() => {
        if (!schoolId) return;
        getTimeSlots()
            .then(data => setSlots(Array.isArray(data) ? data : []))
            .catch(() => setSlots([]));
    }, [schoolId]);

    // Load schedule based on view mode
    const loadSchedule = useCallback(async () => {
        if (!schoolId) return;

        setLoading(true);
        setError(null);

        const yearId = selectedAcademicYearId || undefined;

        try {
            let data: ScheduleEventData[] = [];

            switch (viewMode) {
                case 'my': {
                    if (role === 'TEACHER') {
                        // Get teacher profile id
                        const profileRes = await api.get('/api/teacher/profile');
                        if (profileRes.data?.id) {
                            data = await getTeacherSchedule(profileRes.data.id, yearId);
                        }
                    } else if (role === 'STUDENT') {
                        if (userId) {
                            data = await getStudentSchedule(userId, yearId);
                        }
                    } else {
                        // For PRINCIPAL/DEPUTY/ADMIN — show all events or first classroom
                        if (classrooms.length > 0) {
                            const firstClassroom = classrooms[0];
                            setSelectedClassroomId(firstClassroom.id);
                            data = await getClassroomSchedule(firstClassroom.id, yearId);
                            setViewMode('classroom');
                        }
                    }
                    break;
                }
                case 'classroom': {
                    if (selectedClassroomId) {
                        data = await getClassroomSchedule(selectedClassroomId, yearId);
                    }
                    break;
                }
                case 'teacher': {
                    if (selectedTeacherId) {
                        data = await getTeacherSchedule(selectedTeacherId, yearId);
                    }
                    break;
                }
            }

            setEvents(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('Failed to load schedule:', err);
            setError(err?.response?.data?.message || 'Nepodařilo se načíst rozvrh');
        } finally {
            setLoading(false);
        }
    }, [viewMode, schoolId, role, userId, selectedClassroomId, selectedTeacherId, classrooms, selectedAcademicYearId]);

    useEffect(() => {
        loadSchedule();
    }, [loadSchedule]);

    // Get current view title
    const getViewTitle = () => {
        switch (viewMode) {
            case 'my':
                return role === 'TEACHER' ? 'Můj rozvrh' : role === 'STUDENT' ? 'Můj rozvrh' : 'Rozvrh';
            case 'classroom': {
                const cls = classrooms.find(c => c.id === selectedClassroomId);
                return cls ? `Rozvrh třídy ${cls.name}` : 'Rozvrh třídy';
            }
            case 'teacher': {
                const teacher = teachers.find(t => t.id === selectedTeacherId);
                return teacher
                    ? `Rozvrh — ${teacher.user.firstName} ${teacher.user.lastName}`
                    : 'Rozvrh učitele';
            }
        }
    };

    if (!schoolId) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>{t('schedule.no_school', 'Nejdříve vyberte školu.')}</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">{t('schedule.title', 'Rozvrh')}</h1>
                </div>

                {/* Year & Semester selectors */}
                <div className="flex items-center gap-2 flex-wrap">
                    {academicYears.length > 0 && (
                        <Select value={selectedAcademicYearId} onValueChange={(val) => {
                            setSelectedAcademicYearId(val);
                            setSelectedSemesterId('');
                        }}>
                            <SelectTrigger className="w-40">
                                <CalendarDays className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                <SelectValue placeholder="Rok..." />
                            </SelectTrigger>
                            <SelectContent>
                                {academicYears.map(y => (
                                    <SelectItem key={y.id} value={y.id}>
                                        {y.name} {y.isCurrent ? '(aktuální)' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {semesters.length > 0 && (
                        <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
                            <SelectTrigger className="w-36">
                                <SelectValue placeholder="Pololetí..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Vše</SelectItem>
                                {semesters.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            {/* View mode tabs */}
            <Tabs
                value={viewMode}
                onValueChange={(v) => setViewMode(v as ViewMode)}
                className="w-full"
            >
                <TabsList className="grid w-full grid-cols-3 max-w-md">
                    <TabsTrigger value="my" className="flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Můj rozvrh</span>
                        <span className="sm:hidden">Můj</span>
                    </TabsTrigger>
                    <TabsTrigger value="classroom" className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Třída</span>
                        <span className="sm:hidden">Třída</span>
                    </TabsTrigger>
                    <TabsTrigger value="teacher" className="flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Učitel</span>
                        <span className="sm:hidden">Učitel</span>
                    </TabsTrigger>
                </TabsList>

                {/* Classroom filter */}
                <TabsContent value="classroom" className="mt-3">
                    <Select
                        value={selectedClassroomId}
                        onValueChange={(v) => setSelectedClassroomId(v)}
                    >
                        <SelectTrigger className="w-full max-w-xs">
                            <SelectValue placeholder="Vyberte třídu..." />
                        </SelectTrigger>
                        <SelectContent>
                            {classrooms.map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </TabsContent>

                {/* Teacher filter */}
                <TabsContent value="teacher" className="mt-3">
                    <Select
                        value={selectedTeacherId}
                        onValueChange={(v) => setSelectedTeacherId(v)}
                    >
                        <SelectTrigger className="w-full max-w-xs">
                            <SelectValue placeholder="Vyberte učitele..." />
                        </SelectTrigger>
                        <SelectContent>
                            {teachers.map(t => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.user.lastName} {t.user.firstName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </TabsContent>
            </Tabs>

            {/* Timetable */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{getViewTitle()}</CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-12 text-destructive">
                            <p>{error}</p>
                        </div>
                    ) : events.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
                            <p className="text-lg font-medium">
                                {t('schedule.empty', 'Žádné hodiny v rozvrhu')}
                            </p>
                            <p className="text-sm mt-1">
                                {(role === 'PRINCIPAL' || role === 'DEPUTY' || role === 'ADMIN')
                                    ? t('schedule.empty_admin', 'Rozvrh můžete naplánovat v sekci Plánování rozvrhu.')
                                    : t('schedule.empty_user', 'Rozvrh zatím nebyl vytvořen.')
                                }
                            </p>
                        </div>
                    ) : (
                        <TimetableGrid
                            events={events}
                            timeSlots={slots}
                            showTeacher={viewMode !== 'teacher'}
                            showClassroom={viewMode === 'teacher'}
                            showRoom
                            highlightDate={today}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
