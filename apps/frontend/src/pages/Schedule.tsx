import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '@/context/SchoolContext';
import { TimetableGrid, ScheduleEventData, TimeSlot } from '@/components/schedule/TimetableGrid';
import {
    getTimeSlots,
    getClassroomSchedule,
    getTeacherSchedule,
    getStudentSchedule,
    getRoomSchedule,
    api,
    getMe,
} from '@/api';
import { CalendarDays, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, GraduationCap, UserCheck, Users, DoorOpen } from 'lucide-react';

interface ClassroomOption {
    id: string;
    name: string;
}

interface RoomOption {
    id: string;
    name: string;
}

interface TeacherOption {
    id: string;
    user: { firstName: string; lastName: string };
}

interface AcademicYearOption {
    id: string;
    name: string;
    isCurrent: boolean;
}
interface SemesterOption {
    id: string;
    name: string;
    number: number;
    startDate: string;
    endDate: string;
}

type ViewMode = 'my' | 'classroom' | 'teacher' | 'room';

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
    const [rooms, setRooms] = useState<RoomOption[]>([]);

    const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
    const [selectedRoomId, setSelectedRoomId] = useState<string>('');

    // Student/teacher homeroom info
    const [myClassroomId, setMyClassroomId] = useState<string>('');
    const [myHomeroomTeacherId, setMyHomeroomTeacherId] = useState<string>('');
    // Resolved teacher-profile id of the current user (TEACHER role, plus
    // DEPUTY/PRINCIPAL who also teach). Empty when the user has no
    // teaching role.
    const [myTeacherProfileId, setMyTeacherProfileId] = useState<string>('');

    // Academic year & semester
    const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
    const [semesters, setSemesters] = useState<SemesterOption[]>([]);
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
    const [selectedSemesterId, setSelectedSemesterId] = useState('');

    // Print ref
    const printRef = useRef<HTMLDivElement>(null);

    // Today for highlighting substitutions
    const today = new Date().toISOString().slice(0, 10);

    // Roles allowed to call /api/deputy/*. The schedule page used to fire
    // those endpoints for every logged-in user, which produced a stream
    // of 403s in the backend log for TEACHER/STUDENT/PARENT visitors.
    // /api/registry/classrooms is open to TEACHER too, so we use it as a
    // fallback for teachers; STUDENT/PARENT just rely on the "My"
    // and (TEACHER-supplied) classroom views.
    const isSchoolAdmin = !!role && ['ADMIN', 'DEPUTY', 'PRINCIPAL', 'DIRECTOR'].includes(role);
    const isTeachingStaff = isSchoolAdmin || role === 'TEACHER';

    // ─── One-time init: classrooms, teachers, academic years, student info ────
    useEffect(() => {
        if (!schoolId) return;
        let cancelled = false;

        const init = async () => {
            // Classrooms — admins use /api/deputy/classrooms; teachers can
            // hit /api/registry/classrooms which is open to them; everyone
            // else gets no dropdown and relies on the "My" view.
            if (isSchoolAdmin) {
                const clsRes = await api.get('/api/deputy/classrooms').catch(() => ({ data: [] }));
                const clsList: ClassroomOption[] = Array.isArray(clsRes.data) ? clsRes.data : [];
                if (!cancelled) setClassrooms(clsList);
            } else if (role === 'TEACHER') {
                const clsRes = await api.get('/api/registry/classrooms').catch(() => ({ data: [] }));
                const clsList: ClassroomOption[] = Array.isArray(clsRes.data) ? clsRes.data : [];
                if (!cancelled) setClassrooms(clsList);
            }

            // Rooms — admin-only endpoint, skip otherwise.
            if (isSchoolAdmin) {
                const rRes = await api.get('/api/deputy/rooms').catch(() => ({ data: [] }));
                const rList: RoomOption[] = Array.isArray(rRes.data) ? rRes.data : [];
                if (!cancelled) setRooms(rList);
            }

            // Teachers — admin-only endpoint. /api/deputy/teachers returns
            // { id: userId, ..., teacherProfile: { id } } and
            // getTeacherSchedule filters by teacher-PROFILE id, so we
            // store teacherProfile.id, not the user id.
            if (isTeachingStaff) {
                try {
                    const tRes = await api.get('/api/deputy/teachers');
                    const tData = Array.isArray(tRes.data) ? tRes.data : [];
                    const teacherList = tData
                        .map((t: any) => ({
                            id: t.teacherProfile?.id || t.teacherProfileId || '',
                            user: {
                                firstName: t.user?.firstName || t.firstName || '',
                                lastName: t.user?.lastName || t.lastName || '',
                            },
                        }))
                        .filter((t: TeacherOption) => t.id);
                    if (!cancelled) setTeachers(teacherList);
                } catch {
                    /* ignore — non-admin TEACHER may legitimately get 403 here */
                }
            }

            // Academic years — admin-only endpoint. Without it we just
            // skip the year selector; the schedule view endpoints work
            // without it (they return the current year by default).
            if (isSchoolAdmin) {
                try {
                    const ayRes = await api.get('/api/deputy/academic-years');
                    const years = Array.isArray(ayRes.data) ? ayRes.data : [];
                    if (!cancelled) {
                        setAcademicYears(years);
                        const current = years.find((y: any) => y.isCurrent);
                        if (current) setSelectedAcademicYearId((prev) => prev || current.id);
                    }
                } catch {
                    /* ignore */
                }
            }

            // Resolve the current user's profiles once. /api/auth/me
            // returns both `teacherProfile` and `studentProfile` so we can
            // wire "My schedule" for anyone who actually teaches or is a
            // student — TEACHER, STUDENT, and DEPUTY/PRINCIPAL who hold a
            // teaching profile alongside their admin role.
            if (userId) {
                try {
                    const me: any = await getMe();
                    if (!cancelled && me?.teacherProfile?.id) {
                        setMyTeacherProfileId(me.teacherProfile.id);
                    }
                    if (!cancelled && me?.studentProfile?.classroomId) {
                        setMyClassroomId(me.studentProfile.classroomId);
                        setSelectedClassroomId((prev) => prev || me.studentProfile.classroomId);
                    }
                    if (!cancelled && me?.studentProfile?.classroom?.homeroomTeacher?.id) {
                        const htId = me.studentProfile.classroom.homeroomTeacher.id;
                        setMyHomeroomTeacherId(htId);
                        setSelectedTeacherId((prev) => prev || htId);
                    }
                } catch {
                    /* ignore */
                }
            }

            // Admin/Principal/Deputy: default to first classroom (after
            // setClassrooms has settled — we re-read state via the setter
            // closure to avoid referencing a no-longer-in-scope local).
            if (isSchoolAdmin && !cancelled) {
                setClassrooms((current) => {
                    if (current.length > 0) {
                        setSelectedClassroomId((prev) => prev || current[0].id);
                        setViewMode((prev) => (prev === 'my' ? 'classroom' : prev));
                    }
                    return current;
                });
            }
        };

        init();
        return () => {
            cancelled = true;
        };
    }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Load semesters when academic year changes (admin-only endpoint).
    useEffect(() => {
        if (!schoolId || !selectedAcademicYearId || !isSchoolAdmin) {
            setSemesters([]);
            return;
        }
        api.get('/api/deputy/semesters', { params: { academicYearId: selectedAcademicYearId } })
            .then((res) => {
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
    }, [schoolId, selectedAcademicYearId, isSchoolAdmin]);

    // Load time slots
    useEffect(() => {
        if (!schoolId) return;
        getTimeSlots()
            .then((data) => setSlots(Array.isArray(data) ? data : []))
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
                        // Whoever holds a teacher-profile (TEACHER, plus
                        // teaching DEPUTY/PRINCIPAL) sees the teacher
                        // schedule for themselves; pure students get the
                        // student classroom schedule. Anyone else falls
                        // through to the "no data" empty state.
                        if (myTeacherProfileId) {
                            data = await getTeacherSchedule(myTeacherProfileId, yearId);
                        } else if (role === 'STUDENT' && userId) {
                            data = await getStudentSchedule(userId, yearId);
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
                    case 'room': {
                        if (selectedRoomId) {
                            data = await getRoomSchedule(selectedRoomId, yearId);
                        }
                        break;
                    }
                }

                if (!cancelled) setEvents(Array.isArray(data) ? data : []);
            } catch (err: any) {
                if (!cancelled) {
                    console.error('Failed to load schedule:', err);
                    setError(err?.response?.data?.message || t('schedule.load_error'));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [
        viewMode,
        schoolId,
        role,
        userId,
        myTeacherProfileId,
        selectedClassroomId,
        selectedTeacherId,
        selectedRoomId,
        selectedAcademicYearId,
    ]);

    // Get current view title
    const getViewTitle = () => {
        switch (viewMode) {
            case 'my':
                return role === 'TEACHER' || role === 'STUDENT' ? t('schedule.my_schedule') : t('schedule.title');
            case 'classroom': {
                const cls = classrooms.find((c) => c.id === selectedClassroomId);
                return cls ? `${t('schedule.class_schedule')} ${cls.name}` : t('schedule.class_schedule');
            }
            case 'teacher': {
                const teacher = teachers.find((t) => t.id === selectedTeacherId);
                return teacher
                    ? `${t('schedule.teacher_schedule')} — ${teacher.user.firstName} ${teacher.user.lastName}`
                    : t('schedule.teacher_schedule');
            }
            case 'room': {
                const room = rooms.find((r) => r.id === selectedRoomId);
                return room ? `${t('schedule.room_schedule')} ${room.name}` : t('schedule.room_schedule');
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
        const yearName = academicYears.find((y) => y.id === selectedAcademicYearId)?.name || '';
        const semesterName = semesters.find((s) => s.id === selectedSemesterId)?.name || '';

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
            { num: 1, label: t('days.monday') },
            { num: 2, label: t('days.tuesday') },
            { num: 3, label: t('days.wednesday') },
            { num: 4, label: t('days.thursday') },
            { num: 5, label: t('days.friday') },
        ];

        const maxLesson = events.length > 0 ? Math.max(...events.map((e) => e.lessonNumber)) : 8;
        const usedSlots = slots.length > 0 ? slots : [];

        let html = `<table><thead><tr><th>${t('common.hour')}</th>`;
        days.forEach((d) => {
            html += `<th>${d.label}</th>`;
        });
        html += '</tr></thead><tbody>';

        for (let l = 1; l <= maxLesson; l++) {
            const slot = usedSlots.find((s) => s.lessonNumber === l);
            html += `<tr><td class="slot">${l}.<br/>${slot ? `${slot.startTime}` : ''}</td>`;
            days.forEach((d) => {
                const ev = events.find((e) => e.dayOfWeek === d.num && e.lessonNumber === l);
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
                <p>{t('schedule.no_school')}</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">{t('schedule.title')}</h1>
                </div>

                {/* Year & Semester selectors + Print */}
                <div className="flex items-center gap-2 flex-wrap">
                    {academicYears.length > 0 && (
                        <Select
                            value={selectedAcademicYearId}
                            onValueChange={(val) => {
                                setSelectedAcademicYearId(val);
                                setSelectedSemesterId('');
                            }}
                        >
                            <SelectTrigger className="w-40">
                                <CalendarDays className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                <SelectValue placeholder={`${t('sidebar.year_setup')}...`} />
                            </SelectTrigger>
                            <SelectContent>
                                {academicYears
                                    .filter((y) => y.id)
                                    .map((y) => (
                                        <SelectItem key={y.id} value={y.id}>
                                            {y.name} {y.isCurrent ? `(${t('common.active')})` : ''}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    )}
                    {semesters.length > 0 && (
                        <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
                            <SelectTrigger className="w-36">
                                <SelectValue placeholder={t('common.semester')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('common.all')}</SelectItem>
                                {semesters
                                    .filter((s) => s.id)
                                    .map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button variant="outline" size="icon" onClick={handlePrint} title={t('schedule.print')}>
                        <Printer className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* View mode tabs + the matching filter, on a single row.
                Tabs use a 4-column grid so the "Room" tab doesn't wrap;
                the filter shown to the right of the tabs is whichever
                applies to the active tab (none for "My"). */}
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
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
                    {role !== 'STUDENT' && (
                        <TabsList className="grid grid-cols-4 w-full sm:w-auto sm:inline-grid">
                            <TabsTrigger value="my" className="flex items-center gap-1.5">
                                <UserCheck className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t('schedule.my_schedule')}</span>
                                <span className="sm:hidden">{t('common.my')}</span>
                            </TabsTrigger>
                            <TabsTrigger value="classroom" className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" />
                                <span>{t('common.class')}</span>
                            </TabsTrigger>
                            <TabsTrigger value="teacher" className="flex items-center gap-1.5">
                                <GraduationCap className="h-3.5 w-3.5" />
                                <span>{t('common.teacher')}</span>
                            </TabsTrigger>
                            <TabsTrigger value="room" className="flex items-center gap-1.5">
                                <DoorOpen className="h-3.5 w-3.5" />
                                <span>{t('common.classroom')}</span>
                            </TabsTrigger>
                        </TabsList>
                    )}

                    {viewMode === 'classroom' && (
                        <Select value={selectedClassroomId} onValueChange={(v) => setSelectedClassroomId(v)}>
                            <SelectTrigger className="w-full sm:w-64">
                                <SelectValue placeholder={t('schedule.select_classroom')} />
                            </SelectTrigger>
                            <SelectContent>
                                {classrooms
                                    .filter((c) => c.id)
                                    .map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                            {c.id === myClassroomId ? ` (${t('common.my')} ${t('common.class')})` : ''}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    )}

                    {viewMode === 'teacher' && (
                        <Select value={selectedTeacherId} onValueChange={(v) => setSelectedTeacherId(v)}>
                            <SelectTrigger className="w-full sm:w-64">
                                <SelectValue placeholder={t('schedule.select_teacher')} />
                            </SelectTrigger>
                            <SelectContent>
                                {teachers
                                    .filter((tr) => tr.id)
                                    .map((tr) => (
                                        <SelectItem key={tr.id} value={tr.id}>
                                            {tr.user.lastName} {tr.user.firstName}
                                            {tr.id === myHomeroomTeacherId ? ` (${t('common.teacher')})` : ''}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    )}

                    {viewMode === 'room' && (
                        <Select value={selectedRoomId} onValueChange={(v) => setSelectedRoomId(v)}>
                            <SelectTrigger className="w-full sm:w-64">
                                <SelectValue placeholder={t('common.classroom')} />
                            </SelectTrigger>
                            <SelectContent>
                                {rooms
                                    .filter((r) => r.id)
                                    .map((r) => (
                                        <SelectItem key={r.id} value={r.id}>
                                            {r.name}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
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
                            <p className="text-lg font-medium">{t('schedule.empty')}</p>
                            <p className="text-sm mt-1">
                                {role === 'PRINCIPAL' || role === 'DEPUTY' || role === 'ADMIN'
                                    ? t('schedule.empty_admin')
                                    : t('schedule.empty_user')}
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
