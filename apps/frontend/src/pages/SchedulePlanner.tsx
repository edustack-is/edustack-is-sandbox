import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '@/context/SchoolContext';
import { TimetableGrid, ScheduleEventData, TimeSlot } from '@/components/schedule/TimetableGrid';
import { getTimeSlots, upsertTimeSlots, getScheduleEvents, createScheduleEvent, deleteScheduleEvent, api } from '@/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar, Save, Trash2, Plus, Clock, Settings2 } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface ClassroomOption {
    id: string;
    name: string;
}
interface TeacherOption {
    id: string;
    userId: string;
    user: { firstName: string; lastName: string };
}
interface SubjectInstanceOption {
    id: string;
    hoursPerWeek: number;
    template: { id: string; name: string; code: string };
    gradeLevelId: string;
}
interface RoomOption {
    id: string;
    name: string;
    capacity: number;
    isComputerLab: boolean;
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

export const SchedulePlanner: React.FC = () => {
    const { t } = useTranslation();
    const { schoolId, role } = useSchool();

    // Data
    const [events, setEvents] = useState<ScheduleEventData[]>([]);
    const [slots, setSlots] = useState<TimeSlot[]>([]);
    const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
    const [teachers, setTeachers] = useState<TeacherOption[]>([]);
    const [subjects, setSubjects] = useState<SubjectInstanceOption[]>([]);
    const [rooms, setRooms] = useState<RoomOption[]>([]);
    const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
    const [semesters, setSemesters] = useState<SemesterOption[]>([]);

    // Selection
    const [selectedClassroomId, setSelectedClassroomId] = useState('');
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
    const [selectedSemesterId, setSelectedSemesterId] = useState('');

    // Dialogs
    const [addDialog, setAddDialog] = useState<{ dayOfWeek: number; lessonNumber: number } | null>(null);
    const [detailDialog, setDetailDialog] = useState<ScheduleEventData | null>(null);
    const [slotsDialog, setSlotsDialog] = useState(false);
    const [editSlots, setEditSlots] = useState<TimeSlot[]>([]);

    // Form state for add dialog
    const [addSubjectId, setAddSubjectId] = useState('');
    const [addTeacherId, setAddTeacherId] = useState('');
    const [addRoomId, setAddRoomId] = useState('');
    const [saving, setSaving] = useState(false);

    const [loading, setLoading] = useState(true);

    // Check permission
    const canPlan = role === 'PRINCIPAL' || role === 'DEPUTY' || role === 'ADMIN';

    // ─── Load reference data ────────────────────────────────

    useEffect(() => {
        if (!schoolId) return;

        // Load time slots
        getTimeSlots()
            .then((data) => setSlots(Array.isArray(data) ? data : []))
            .catch(() => setSlots([]));

        // Load classrooms
        api.get('/api/deputy/classrooms')
            .then((res) => {
                const data = Array.isArray(res.data) ? res.data : [];
                setClassrooms(data);
                if (data.length > 0 && !selectedClassroomId) {
                    setSelectedClassroomId(data[0].id);
                }
            })
            .catch(() => setClassrooms([]));

        // Load teachers
        api.get('/api/deputy/dashboard')
            .then((res) => {
                if (res.data?.teachers) {
                    setTeachers(
                        res.data.teachers
                            .filter((u: any) => u.teacherProfile)
                            .map((u: any) => ({
                                id: u.teacherProfile.id,
                                userId: u.id,
                                user: { firstName: u.firstName, lastName: u.lastName },
                            })),
                    );
                }
            })
            .catch(() => setTeachers([]));

        // Load rooms
        api.get('/api/deputy/rooms')
            .then((res) => setRooms(Array.isArray(res.data) ? res.data : []))
            .catch(() => setRooms([]));

        // Load academic years
        api.get('/api/deputy/academic-years')
            .then((res) => {
                const years = Array.isArray(res.data) ? res.data : [];
                setAcademicYears(years);
                const current = years.find((y: any) => y.isCurrent);
                if (current && !selectedAcademicYearId) {
                    setSelectedAcademicYearId(current.id);
                }
            })
            .catch(() => setAcademicYears([]));
    }, [schoolId]);

    // Load semesters when academic year changes
    useEffect(() => {
        if (!schoolId || !selectedAcademicYearId) {
            setSemesters([]);
            return;
        }
        api.get('/api/deputy/semesters', { params: { academicYearId: selectedAcademicYearId } })
            .then((res) => {
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

    // Load subject instances for the selected academic year
    useEffect(() => {
        if (!schoolId || !selectedAcademicYearId) return;
        api.get('/api/deputy/subject-instances', { params: { academicYearId: selectedAcademicYearId } })
            .then((res) => setSubjects(Array.isArray(res.data) ? res.data : []))
            .catch(() => {
                // Fallback: try loading all subject instances
                api.get('/api/schedule/events', { params: { academicYearId: selectedAcademicYearId } })
                    .then(() => setSubjects([]))
                    .catch(() => setSubjects([]));
            });
    }, [schoolId, selectedAcademicYearId]);

    // ─── Load schedule events ───────────────────────────────

    const loadEvents = useCallback(async () => {
        if (!schoolId || !selectedClassroomId) return;
        setLoading(true);
        try {
            const data = await getScheduleEvents({
                classroomId: selectedClassroomId,
                academicYearId: selectedAcademicYearId || undefined,
            });
            setEvents(Array.isArray(data) ? data : []);
        } catch {
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }, [schoolId, selectedClassroomId, selectedAcademicYearId]);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    // ─── Handlers ───────────────────────────────────────────

    const handleCellClick = (dayOfWeek: number, lessonNumber: number, event?: ScheduleEventData) => {
        if (!canPlan) return;
        if (event) {
            setDetailDialog(event);
        } else {
            setAddSubjectId('');
            setAddTeacherId('');
            setAddRoomId('');
            setAddDialog({ dayOfWeek, lessonNumber });
        }
    };

    const handleAddEvent = async () => {
        if (!addDialog || !addSubjectId || !addTeacherId || !selectedClassroomId || !selectedAcademicYearId) {
            toast.error('Vyplňte všechna povinná pole.');
            return;
        }

        setSaving(true);
        try {
            await createScheduleEvent({
                dayOfWeek: addDialog.dayOfWeek,
                lessonNumber: addDialog.lessonNumber,
                subjectInstanceId: addSubjectId,
                classroomId: selectedClassroomId,
                teacherId: addTeacherId,
                roomId: addRoomId && addRoomId !== 'none' ? addRoomId : undefined,
                academicYearId: selectedAcademicYearId,
            });
            toast.success('Hodina přidána do rozvrhu.');
            setAddDialog(null);
            loadEvents();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Nepodařilo se přidat hodinu.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        try {
            await deleteScheduleEvent(eventId);
            toast.success('Hodina odstraněna z rozvrhu.');
            setDetailDialog(null);
            loadEvents();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Nepodařilo se odstranit hodinu.');
        }
    };

    const handleSaveSlots = async () => {
        try {
            await upsertTimeSlots(editSlots);
            toast.success('Zvonění uloženo.');
            setSlotsDialog(false);
            setSlots(editSlots);
        } catch {
            toast.error('Nepodařilo se uložit zvonění.');
        }
    };

    // ─── Remaining hours calculation ────────────────────────

    const getUsedHours = (subjectId: string) => {
        return events.filter((e) => e.subject.id === subjectId).length;
    };

    // ─── Render ─────────────────────────────────────────────

    if (!canPlan) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Nemáte oprávnění pro plánování rozvrhu.</p>
            </div>
        );
    }

    const DAYS_MAP: Record<number, string> = { 1: 'Pondělí', 2: 'Úterý', 3: 'Středa', 4: 'Čtvrtek', 5: 'Pátek' };

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">{t('schedule.plan_title', 'Plánování rozvrhu')}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setEditSlots(
                                slots.length > 0
                                    ? [...slots]
                                    : Array.from({ length: 8 }, (_, i) => ({
                                          lessonNumber: i + 1,
                                          startTime: `${String(7 + i).padStart(2, '0')}:55`,
                                          endTime: `${String(8 + i).padStart(2, '0')}:40`,
                                      })),
                            );
                            setSlotsDialog(true);
                        }}
                    >
                        <Clock className="h-4 w-4 mr-1" />
                        Zvonění
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Třída:</Label>
                    <Select value={selectedClassroomId} onValueChange={setSelectedClassroomId}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Třída..." />
                        </SelectTrigger>
                        <SelectContent>
                            {classrooms
                                .filter((c) => c.id)
                                .map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Rok:</Label>
                    <Select
                        value={selectedAcademicYearId}
                        onValueChange={(val) => {
                            setSelectedAcademicYearId(val);
                            setSelectedSemesterId('');
                        }}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Rok..." />
                        </SelectTrigger>
                        <SelectContent>
                            {academicYears
                                .filter((y) => y.id)
                                .map((y) => (
                                    <SelectItem key={y.id} value={y.id}>
                                        {y.name} {y.isCurrent ? '(aktuální)' : ''}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>

                {semesters.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium whitespace-nowrap">Pololetí:</Label>
                        <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
                            <SelectTrigger className="w-36">
                                <SelectValue placeholder="Pololetí..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Vše</SelectItem>
                                {semesters
                                    .filter((s) => s.id)
                                    .map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Timetable grid */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                            {classrooms.find((c) => c.id === selectedClassroomId)?.name || 'Vyberte třídu'}
                        </CardTitle>
                        <div className="text-sm text-muted-foreground">Kliknutím na prázdné pole přidáte hodinu</div>
                    </div>
                </CardHeader>
                <CardContent className="p-2 sm:p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : (
                        <TimetableGrid
                            events={events}
                            timeSlots={slots}
                            showTeacher
                            showRoom
                            editable={canPlan}
                            onCellClick={handleCellClick}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Remaining hours panel */}
            {subjects.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Zbývající hodiny dle ŠVP</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {subjects.map((sub) => {
                                const used = getUsedHours(sub.id);
                                const remaining = sub.hoursPerWeek - used;
                                return (
                                    <Badge
                                        key={sub.id}
                                        variant={remaining <= 0 ? 'secondary' : 'default'}
                                        className={`text-xs ${remaining < 0 ? 'bg-destructive text-destructive-foreground' : remaining === 0 ? 'opacity-50' : ''}`}
                                    >
                                        {sub.template.code}:{' '}
                                        {remaining > 0
                                            ? `${remaining}h zbývá`
                                            : remaining === 0
                                              ? '✓ hotovo'
                                              : `${Math.abs(remaining)}h navíc`}
                                    </Badge>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Add event dialog ─────────────────────────────── */}
            <Dialog open={!!addDialog} onOpenChange={(open) => !open && setAddDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Přidat hodinu — {addDialog && DAYS_MAP[addDialog.dayOfWeek]}, {addDialog?.lessonNumber}.
                            hodina
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>Předmět *</Label>
                            <Select value={addSubjectId} onValueChange={setAddSubjectId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Vyberte předmět..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {subjects
                                        .filter((s) => s.id)
                                        .map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.template.code} — {s.template.name} (
                                                {s.hoursPerWeek - getUsedHours(s.id)}h zbývá)
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Učitel *</Label>
                            <Select value={addTeacherId} onValueChange={setAddTeacherId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Vyberte učitele..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {teachers
                                        .filter((t) => t.id)
                                        .map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.user.lastName} {t.user.firstName}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Učebna (volitelné)</Label>
                            <Select value={addRoomId} onValueChange={setAddRoomId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Vyberte učebnu..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">— Žádná —</SelectItem>
                                    {rooms
                                        .filter((r) => r.id)
                                        .map((r) => (
                                            <SelectItem key={r.id} value={r.id}>
                                                {r.name} ({r.capacity} míst) {r.isComputerLab ? '💻' : ''}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialog(null)}>
                            Zrušit
                        </Button>
                        <Button onClick={handleAddEvent} disabled={saving}>
                            <Plus className="h-4 w-4 mr-1" />
                            {saving ? 'Ukládám...' : 'Přidat'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Event detail dialog ──────────────────────────── */}
            <Dialog open={!!detailDialog} onOpenChange={(open) => !open && setDetailDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{detailDialog?.subject.template.name}</DialogTitle>
                    </DialogHeader>

                    {detailDialog && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Den:</span>{' '}
                                    {DAYS_MAP[detailDialog.dayOfWeek]}
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Hodina:</span> {detailDialog.lessonNumber}.
                                    ({detailDialog.startTime}–{detailDialog.endTime})
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Učitel:</span>{' '}
                                    {detailDialog.teacherProfile.user.firstName}{' '}
                                    {detailDialog.teacherProfile.user.lastName}
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Třída:</span> {detailDialog.classroom.name}
                                </div>
                                {detailDialog.room && (
                                    <div>
                                        <span className="text-muted-foreground">Učebna:</span> {detailDialog.room.name}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => detailDialog && handleDeleteEvent(detailDialog.id)}
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Odstranit z rozvrhu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Time slots (zvonění) dialog ──────────────────── */}
            <Dialog open={slotsDialog} onOpenChange={setSlotsDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings2 className="h-5 w-5" />
                            Nastavení zvonění
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {editSlots.map((slot, i) => (
                            <div key={slot.lessonNumber} className="flex items-center gap-2">
                                <span className="w-8 text-sm font-medium text-center">{slot.lessonNumber}.</span>
                                <Input
                                    type="time"
                                    value={slot.startTime}
                                    onChange={(e) => {
                                        const updated = [...editSlots];
                                        updated[i] = { ...updated[i], startTime: e.target.value };
                                        setEditSlots(updated);
                                    }}
                                    className="w-28"
                                />
                                <span className="text-muted-foreground">–</span>
                                <Input
                                    type="time"
                                    value={slot.endTime}
                                    onChange={(e) => {
                                        const updated = [...editSlots];
                                        updated[i] = { ...updated[i], endTime: e.target.value };
                                        setEditSlots(updated);
                                    }}
                                    className="w-28"
                                />
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSlotsDialog(false)}>
                            Zrušit
                        </Button>
                        <Button onClick={handleSaveSlots}>
                            <Save className="h-4 w-4 mr-1" />
                            Uložit zvonění
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
