import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '@/context/SchoolContext';
import { getScheduleEvents, getSubstitutions, createSubstitution, deleteSubstitution, api } from '@/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CalendarDays, Plus, Trash2, UserCheck, Ban, ArrowLeftRight, MapPin, BookOpen } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface SubstitutionItem {
    id: string;
    date: string;
    type: 'SUBSTITUTION' | 'CANCELLED' | 'MERGED' | 'ROOM_CHANGE' | 'SUBJECT_CHANGE';
    note?: string;
    originalEvent: {
        id: string;
        lessonNumber: number;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        subject: { template: { name: string; code: string } };
        classroom: { name: string };
        teacherProfile: { id: string; user: { firstName: string; lastName: string } };
    };
    substituteTeacher?: { id: string; user: { firstName: string; lastName: string } } | null;
    substituteRoom?: { name: string } | null;
    substituteSubject?: { template: { name: string; code: string } } | null;
    createdBy: { firstName: string; lastName: string };
}

interface ScheduleEventBrief {
    id: string;
    lessonNumber: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    subject: { template: { name: string; code: string } };
    classroom: { id: string; name: string };
    teacherProfile: { id: string; user: { firstName: string; lastName: string } };
}

interface TeacherOption {
    id: string;
    user: { firstName: string; lastName: string };
}

export const ScheduleSubstitutions: React.FC = () => {
    const { t } = useTranslation();

    const TYPE_CONFIG = {
        SUBSTITUTION: {
            label: t('sidebar.substitutions'),
            icon: UserCheck,
            color: 'bg-amber-100 text-amber-800 border-amber-300',
        },
        CANCELLED: { label: t('schedule.cancelled'), icon: Ban, color: 'bg-red-100 text-red-800 border-red-300' },
        MERGED: {
            label: t('schedule.merged', 'Spojeno'),
            icon: ArrowLeftRight,
            color: 'bg-violet-100 text-violet-800 border-violet-300',
        },
        ROOM_CHANGE: {
            label: t('schedule.room_change'),
            icon: MapPin,
            color: 'bg-sky-100 text-sky-800 border-sky-300',
        },
        SUBJECT_CHANGE: {
            label: t('schedule.subject_change'),
            icon: BookOpen,
            color: 'bg-orange-100 text-orange-800 border-orange-300',
        },
    };

    const { role, schoolId } = useSchool();

    const [substitutions, setSubstitutions] = useState<SubstitutionItem[]>([]);
    const [events, setEvents] = useState<ScheduleEventBrief[]>([]);
    const [teachers, setTeachers] = useState<TeacherOption[]>([]);
    const [loading, setLoading] = useState(true);

    // Date filter
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return today.toISOString().slice(0, 10);
    });

    // Create dialog
    const [createDialog, setCreateDialog] = useState(false);
    const [formDate, setFormDate] = useState(selectedDate);
    const [formEventId, setFormEventId] = useState('');
    const [formType, setFormType] = useState<string>('SUBSTITUTION');
    const [formTeacherId, setFormTeacherId] = useState('');
    const [formNote, setFormNote] = useState('');
    const [saving, setSaving] = useState(false);

    const canManage = role === 'PRINCIPAL' || role === 'DEPUTY' || role === 'ADMIN';

    // ─── Load data ──────────────────────────────────────────

    const loadSubstitutions = useCallback(async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            // Load substitutions for the week around selected date
            const d = new Date(selectedDate);
            const dayOfWeek = d.getDay(); // 0=Sun
            const monday = new Date(d);
            monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
            const friday = new Date(monday);
            friday.setDate(monday.getDate() + 4);

            const data = await getSubstitutions({
                weekStart: monday.toISOString().slice(0, 10),
                weekEnd: friday.toISOString().slice(0, 10),
            });
            setSubstitutions(Array.isArray(data) ? data : []);
        } catch {
            setSubstitutions([]);
        } finally {
            setLoading(false);
        }
    }, [schoolId, selectedDate]);

    useEffect(() => {
        loadSubstitutions();
    }, [loadSubstitutions]);

    useEffect(() => {
        if (!schoolId) return;
        // Load all events for the dropdown
        getScheduleEvents()
            .then((data) => setEvents(Array.isArray(data) ? data : []))
            .catch(() => setEvents([]));

        // Load teachers
        api.get('/api/deputy/dashboard')
            .then((res) => {
                if (res.data?.teachers) {
                    setTeachers(
                        res.data.teachers
                            .filter((u: any) => u.teacherProfile)
                            .map((u: any) => ({
                                id: u.teacherProfile.id,
                                user: { firstName: u.firstName, lastName: u.lastName },
                            })),
                    );
                }
            })
            .catch(() => setTeachers([]));
    }, [schoolId]);

    // ─── Handlers ───────────────────────────────────────────

    const handleCreate = async () => {
        if (!formEventId || !formType || !formDate) {
            toast.error('Vyplňte všechna povinná pole.');
            return;
        }

        setSaving(true);
        try {
            await createSubstitution({
                date: formDate,
                originalEventId: formEventId,
                type: formType,
                substituteTeacherId: formTeacherId || undefined,
                note: formNote || undefined,
            });
            toast.success('Suplování vytvořeno.');
            setCreateDialog(false);
            loadSubstitutions();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Nepodařilo se vytvořit suplování.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteSubstitution(id);
            toast.success('Suplování odstraněno.');
            loadSubstitutions();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Nepodařilo se odstranit suplování.');
        }
    };

    // Group substitutions by date
    const groupedByDate = substitutions.reduce(
        (acc, sub) => {
            const date = new Date(sub.date).toISOString().slice(0, 10);
            if (!acc[date]) acc[date] = [];
            acc[date].push(sub);
            return acc;
        },
        {} as Record<string, SubstitutionItem[]>,
    );

    // Filter events for the selected date's day of week
    const getEventsForDate = (date: string) => {
        const d = new Date(date);
        const dow = d.getDay(); // 0=Sun... convert to 1=Mon...
        const adjustedDow = dow === 0 ? 7 : dow;
        return events.filter((e) => e.dayOfWeek === adjustedDow);
    };

    if (!canManage) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Nemáte oprávnění pro správu suplování.</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <CalendarDays className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">{t('schedule.substitutions_title', 'Suplování')}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-40"
                    />
                    <Button
                        onClick={() => {
                            setFormDate(selectedDate);
                            setFormEventId('');
                            setFormType('SUBSTITUTION');
                            setFormTeacherId('');
                            setFormNote('');
                            setCreateDialog(true);
                        }}
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        {t('schedule.new_substitution', 'Nové suplování')}
                    </Button>
                </div>
            </div>

            {/* Substitutions list */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : Object.keys(groupedByDate).length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-40" />
                        <p className="text-lg font-medium">
                            {t('schedule.no_substitutions_week', 'Žádné suplování v tomto týdnu')}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                Object.entries(groupedByDate)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, subs]) => (
                        <Card key={date}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4" />
                                    {new Date(date).toLocaleDateString('cs-CZ', {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                    })}
                                    <Badge variant="secondary" className="ml-2">
                                        {subs.length}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y">
                                    {subs
                                        .sort((a, b) => a.originalEvent.lessonNumber - b.originalEvent.lessonNumber)
                                        .map((sub) => {
                                            const cfg = TYPE_CONFIG[sub.type];
                                            const Icon = cfg.icon;
                                            return (
                                                <div
                                                    key={sub.id}
                                                    className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
                                                >
                                                    <div
                                                        className={`w-8 h-8 rounded-full flex items-center justify-center border ${cfg.color}`}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-medium text-sm">
                                                                {sub.originalEvent.lessonNumber}. hodina
                                                            </span>
                                                            <Badge variant="outline" className="text-xs">
                                                                {sub.originalEvent.subject.template.code}
                                                            </Badge>
                                                            <span className="text-xs text-muted-foreground">
                                                                {sub.originalEvent.classroom.name}
                                                            </span>
                                                            <Badge className={`text-xs border ${cfg.color}`}>
                                                                {cfg.label}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            {t('schedule.originally', 'Původně')}:{' '}
                                                            {sub.originalEvent.teacherProfile.user.lastName}{' '}
                                                            {sub.originalEvent.teacherProfile.user.firstName}
                                                            {sub.substituteTeacher && (
                                                                <span className="text-foreground font-medium">
                                                                    {' → '}
                                                                    {sub.substituteTeacher.user.lastName}{' '}
                                                                    {sub.substituteTeacher.user.firstName}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {sub.note && (
                                                            <div className="text-xs italic text-muted-foreground mt-0.5">
                                                                {sub.note}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => handleDelete(sub.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                </div>
                            </CardContent>
                        </Card>
                    ))
            )}

            {/* ─── Create dialog ─────────────────────────────── */}
            <Dialog open={createDialog} onOpenChange={setCreateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('schedule.new_substitution', 'Nové suplování')}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>Datum *</Label>
                            <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                        </div>

                        <div>
                            <Label>Hodina *</Label>
                            <Select value={formEventId} onValueChange={setFormEventId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Vyberte hodinu..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {getEventsForDate(formDate)
                                        .sort((a, b) => a.lessonNumber - b.lessonNumber)
                                        .map((e) => (
                                            <SelectItem key={e.id} value={e.id}>
                                                {e.lessonNumber}. hod — {e.subject.template.code} ({e.classroom.name},{' '}
                                                {e.teacherProfile.user.lastName})
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Typ *</Label>
                            <Select value={formType} onValueChange={setFormType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                                        <SelectItem key={key} value={key}>
                                            {cfg.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {formType === 'SUBSTITUTION' && (
                            <div>
                                <Label>{t('schedule.substituting_teacher', 'Suplující učitel')}</Label>
                                <Select value={formTeacherId} onValueChange={setFormTeacherId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Vyberte učitele..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {teachers.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.user.lastName} {t.user.firstName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div>
                            <Label>{t('common.note')}</Label>
                            <Textarea
                                value={formNote}
                                onChange={(e) => setFormNote(e.target.value)}
                                placeholder="Důvod suplování..."
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialog(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleCreate} disabled={saving}>
                            {saving ? t('common.saving') : t('schedule.create_substitution', 'Vytvořit suplování')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
