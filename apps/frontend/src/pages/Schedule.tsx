import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '@/context/SchoolContext';
import { TimetableGrid, ScheduleEventData, TimeSlot } from '@/components/schedule/TimetableGrid';
import {
    getTimeSlots,
    getClassroomSchedule,
    getTeacherSchedule,
    getStudentSchedule,
    api,
    getMe,
} from '@/api';
import { CalendarDays, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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

    // Student/teacher homeroom info
    const [myClassroomId, setMyClassroomId] = useState<string>('');
    const [myHomeroomTeacherId, setMyHomeroomTeacherId] = useState<string>('');

    // Academic year & semester
    const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
    const [semesters, setSemesters] = useState<SemesterOption[]>([]);
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
    const [selectedSemesterId, setSelectedSemesterId] = useState('');

    // Print ref
    const printRef = useRef<HTMLDivElement>(null);

    // Today for highlighting substitutions
    const today = new Date().toISOString().slice(0, 10);

    // ─── One-time init: classrooms, teachers, academic years, student info ────
    useEffect(() => {
        if (!schoolId) return;
        let cancelled = false;

        const init = async () => {
            // Load classrooms
            const clsRes = await api.get('/api/deputy/classrooms').catch(() => ({ data: [] }));
            const clsList: ClassroomOption[] = Array.isArray(clsRes.data) ? clsRes.data : [];
            if (!cancelled) setClassrooms(clsList);

            // Load teachers (fallback to users list)
            let teacherList: TeacherOption[] = [];
            try {
                const tRes = await api.get('/api/deputy/teachers');
                const tData = Array.isArray(tRes.data) ? tRes.data : [];
                teacherList = tData.map((t: any) => ({
                    id: t.id,
                    user: { firstName: t.user?.firstName || t.firstName || '', lastName: t.user?.lastName || t.lastName || '' },
                }));
            } catch {
                try {
                    const uRes = await api.get('/api/deputy/users');
                    const uData = Array.isArray(uRes.data) ? uRes.data : [];
                    teacherList = uData
                        .filter((u: any) => u.role === 'TEACHER')
                        .map((t: any) => ({
                            id: t.teacherProfileId || t.id,
                            user: { firstName: t.firstName, lastName: t.lastName },
                        }));
                } catch { /* ignore */ }
            }
            if (!cancelled) setTeachers(teacherList);

            // Load academic years
            try {
                const ayRes = await api.get('/api/deputy/academic-years');
                const years = Array.isArray(ayRes.data) ? ayRes.data : [];
                if (!cancelled) {
                    setAcademicYears(years);
                    const current = years.find((y: any) => y.isCurrent);
                    if (current) setSelectedAcademicYearId(prev => prev || current.id);
                }
            } catch { /* ignore */ }

            // Student homeroom defaults
            if (role === 'STUDENT' && userId) {
                try {
                    const me: any = await getMe();
                    if (!cancelled && me?.studentProfile?.classroomId) {
                        setMyClassroomId(me.studentProfile.classroomId);
                        setSelectedClassroomId(prev => prev || me.studentProfile.classroomId);
                    }
                    if (!cancelled && me?.studentProfile?.classroom?.homeroomTeacher?.id) {
                        const htId = me.studentProfile.classroom.homeroomTeacher.id;
                        setMyHomeroomTeacherId(htId);
                        setSelectedTeacherId(prev => prev || htId);
                    }
                } catch { /* ignore */ }
            }

            // Admin/Principal/Deputy: default to first classroom
            if (role !== 'TEACHER' && role !== 'STUDENT' && role !== 'PARENT' && clsList.length > 0) {
                if (!cancelled) {
                    setSelectedClassroomId(prev => prev || clsList[0].id);
                    setViewMode(prev => prev === 'my' ? 'classroom' : prev);
                }
            }
        };

        init();
        return () => { cancelled = true; };
    }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // ─── Load schedule when view/filter changes ──────────────────────
    useEffect(() => {
        if (!schoolId) return;
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);
            const yearId = selectedAcademicYearId || undefined;

            try {
                let data: ScheduleEventData[] = [];

                switch (viewMode) {
                    case 'my': {
                        if (role === 'TEACHER') {
                            const profileRes = await api.get('/api/teacher/profile');
                            if (profileRes.data?.id) {
                                data = await getTeacherSchedule(profileRes.data.id, yearId);
                            }
                        } else if (role === 'STUDENT') {
                            if (userId) {
                                data = await getStudentSchedule(userId, yearId);
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

                if (!cancelled) setEvents(Array.isArray(data) ? data : []);
            } catch (err: any) {
                if (!cancelled) {
                    console.error('Failed to load schedule:', err);
                    setError(err?.response?.data?.message || 'Nepodařilo se načíst rozvrh');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [viewMode, schoolId, role, userId, selectedClassroomId, selectedTeacherId, selectedAcademicYearId]);

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

    // Print handler
    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const title = getViewTitle();
        const yearName = academicYears.find(y => y.id === selectedAcademicYearId)?.name || '';
        const semesterName = semesters.find(s => s.id === selectedSemesterId)?.name || '';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title} – ${yearName}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; }
                    h1 { font-size: 18px; margin-bottom: 4px; }
                    .subtitle { font-size: 13px; color: #666; margin-bottom: 16px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: center; vertical-align: top; }
                    th { background: #f5f5f5; font-weight: 600; }
                    td.slot { background: #fafafa; font-weight: 600; width: 60px; }
                    .subject-code { font-weight: 700; font-size: 12px; }
                    .teacher-name { font-size: 10px; color: #555; }
                    .room-name { font-size: 10px; color: #888; }
                    .empty { min-height: 40px; }
                    @media print { body { padding: 10px; } }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <div class="subtitle">${[yearName, semesterName].filter(Boolean).join(' · ')}</div>
                ${buildPrintTable()}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
    };

    const buildPrintTable = () => {
        const days = [
            { num: 1, label: 'Pondělí' },
            { num: 2, label: 'Úterý' },
            { num: 3, label: 'Středa' },
            { num: 4, label: 'Čtvrtek' },
            { num: 5, label: 'Pátek' },
        ];

        const maxLesson = events.length > 0 ? Math.max(...events.map(e => e.lessonNumber)) : 8;
        const usedSlots = slots.length > 0 ? slots : [];

        let html = '<table><thead><tr><th>Hodina</th>';
        days.forEach(d => { html += `<th>${d.label}</th>`; });
        html += '</tr></thead><tbody>';

        for (let l = 1; l <= maxLesson; l++) {
            const slot = usedSlots.find(s => s.lessonNumber === l);
            html += `<tr><td class="slot">${l}.<br/>${slot ? `${slot.startTime}` : ''}</td>`;
            days.forEach(d => {
                const ev = events.find(e => e.dayOfWeek === d.num && e.lessonNumber === l);
                if (ev) {
                    html += `<td>
                        <div class="subject-code">${ev.subject.template.code}</div>
                        <div class="teacher-name">${ev.teacherProfile.user.lastName}</div>
                        ${ev.room ? `<div class="room-name">📍 ${ev.room.name}</div>` : ''}
                    </td>`;
                } else {
                    html += '<td class="empty"></td>';
                }
            });
            html += '</tr>';
        }

        html += '</tbody></table>';
        return html;
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

                {/* Year & Semester selectors + Print */}
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
                    <Button variant="outline" size="icon" onClick={handlePrint} title="Vytisknout rozvrh">
                        <Printer className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* View mode tabs */}
            <Tabs
                value={viewMode}
                onValueChange={(v) => {
                    const mode = v as ViewMode;
                    setViewMode(mode);
                    // Set smart defaults when switching tabs
                    if (mode === 'classroom' && !selectedClassroomId && myClassroomId) {
                        setSelectedClassroomId(myClassroomId);
                    }
                    if (mode === 'teacher' && !selectedTeacherId && myHomeroomTeacherId) {
                        setSelectedTeacherId(myHomeroomTeacherId);
                    }
                }}
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
                                    {c.name} {c.id === myClassroomId ? '(moje třída)' : ''}
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
                                    {t.id === myHomeroomTeacherId ? ' (třídní učitel)' : ''}
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
                <CardContent className="p-2 sm:p-4" ref={printRef}>
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
                            highlightDate={today}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
