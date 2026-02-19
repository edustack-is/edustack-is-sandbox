import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
    CalendarDays, Plus, Pencil, Trash2, Loader2,
} from 'lucide-react';
import {
    getSchoolEvents, createSchoolEvent, updateSchoolEvent, deleteSchoolEvent,
} from '@/api/deputy';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const EVENT_TYPES = ['HOLIDAY', 'EXAM_PERIOD', 'PARENT_MEETING', 'SCHOOL_TRIP', 'SPORTS_DAY', 'OTHER'] as const;

const EVENT_TYPE_COLORS: Record<string, string> = {
    HOLIDAY: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    EXAM_PERIOD: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    PARENT_MEETING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    SCHOOL_TRIP: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    SPORTS_DAY: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
    HOLIDAY: 'Prázdniny / Svátek',
    EXAM_PERIOD: 'Zkouškové období',
    PARENT_MEETING: 'Třídní schůzky',
    SCHOOL_TRIP: 'Školní výlet',
    SPORTS_DAY: 'Sportovní den',
    OTHER: 'Jiné',
};

interface SchoolEvent {
    id: string;
    title: string;
    description?: string;
    date: string;
    endDate?: string;
    type: string;
    allDay: boolean;
}

interface EventForm {
    title: string;
    description: string;
    date: string;
    endDate: string;
    type: string;
    allDay: boolean;
}

const EMPTY_FORM: EventForm = {
    title: '', description: '', date: '', endDate: '', type: 'OTHER', allDay: true,
};

export default function SchoolEvents() {
    const { t, i18n } = useTranslation();
    const [events, setEvents] = useState<SchoolEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<SchoolEvent | null>(null);
    const [form, setForm] = useState<EventForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const fetchEvents = useCallback(() => {
        getSchoolEvents()
            .then(setEvents)
            .catch(() => toast.error(t('events.load_error', 'Nepodařilo se načíst události')))
            .finally(() => setLoading(false));
    }, [t]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setDialogOpen(true);
    };

    const openEdit = (evt: SchoolEvent) => {
        setEditing(evt);
        setForm({
            title: evt.title,
            description: evt.description || '',
            date: evt.date.slice(0, 10),
            endDate: evt.endDate ? evt.endDate.slice(0, 10) : '',
            type: evt.type,
            allDay: evt.allDay,
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.title || !form.date) return;
        try {
            setSaving(true);
            const payload = {
                title: form.title,
                description: form.description || undefined,
                date: form.date,
                endDate: form.endDate || undefined,
                type: form.type,
                allDay: form.allDay,
            };
            if (editing) {
                await updateSchoolEvent(editing.id, payload);
                toast.success(t('events.updated', 'Událost aktualizována'));
            } else {
                await createSchoolEvent(payload);
                toast.success(t('events.created', 'Událost vytvořena'));
            }
            setDialogOpen(false);
            fetchEvents();
        } catch {
            toast.error(t('events.save_error', 'Chyba při ukládání'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('events.delete_confirm', 'Smazat tuto událost?'))) return;
        try {
            await deleteSchoolEvent(id);
            toast.success(t('events.deleted', 'Událost smazána'));
            fetchEvents();
        } catch {
            toast.error(t('events.delete_error', 'Chyba při mazání'));
        }
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <CalendarDays className="h-6 w-6" />
                        {t('events.title', 'Události školního roku')}
                    </h1>
                    <p className="text-sm text-muted-foreground">{t('events.subtitle', 'Správa událostí, prázdnin a schůzek')}</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" /> {t('events.add', 'Přidat událost')}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{t('events.all_events', 'Všechny události')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : events.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p>{t('events.no_events', 'Žádné události')}</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('events.col_date', 'Datum')}</TableHead>
                                    <TableHead>{t('events.col_title', 'Název')}</TableHead>
                                    <TableHead>{t('events.col_type', 'Typ')}</TableHead>
                                    <TableHead>{t('events.col_description', 'Popis')}</TableHead>
                                    <TableHead className="text-right">{t('events.col_actions', 'Akce')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {events.map(evt => (
                                    <TableRow key={evt.id}>
                                        <TableCell className="text-sm whitespace-nowrap">
                                            {new Date(evt.date).toLocaleDateString(i18n.language)}
                                            {evt.endDate && <> – {new Date(evt.endDate).toLocaleDateString(i18n.language)}</>}
                                        </TableCell>
                                        <TableCell className="font-medium">{evt.title}</TableCell>
                                        <TableCell>
                                            <Badge className={EVENT_TYPE_COLORS[evt.type] || EVENT_TYPE_COLORS.OTHER} variant="outline">
                                                {EVENT_TYPE_LABELS[evt.type] || evt.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{evt.description}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => openEdit(evt)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(evt.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? t('events.edit', 'Upravit událost') : t('events.add', 'Přidat událost')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>{t('events.field_title', 'Název')}</Label>
                            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>{t('events.field_date', 'Datum od')}</Label>
                                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>{t('events.field_end_date', 'Datum do')}</Label>
                                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>{t('events.field_type', 'Typ')}</Label>
                            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {EVENT_TYPES.map(t => (
                                        <SelectItem key={t} value={t}>{EVENT_TYPE_LABELS[t]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch checked={form.allDay} onCheckedChange={v => setForm(f => ({ ...f, allDay: v }))} />
                            <Label>{t('events.field_all_day', 'Celodenní')}</Label>
                        </div>
                        <div className="space-y-1">
                            <Label>{t('events.field_description', 'Popis')}</Label>
                            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel', 'Zrušit')}</Button>
                        <Button onClick={handleSave} disabled={saving || !form.title || !form.date}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {editing ? t('common.save', 'Uložit') : t('events.add', 'Přidat událost')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
