import { useEffect, useState } from 'react';
import { Plus, Trash2, Calendar, Edit2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getRecurringEvents, createRecurringEvent, updateRecurringEvent, deleteRecurringEvent } from '../api';
import { api } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const DAY_LABELS = ['', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];

export default function RecurringEvents() {
    const { t } = useTranslation();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [rooms, setRooms] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);

    const emptyForm = { title: '', dayOfWeek: '1', startTime: '15:00', endTime: '16:30', roomId: 'none', teacherId: 'none' };
    const [form, setForm] = useState(emptyForm);

    const load = async () => {
        setLoading(true);
        try {
            setEvents(await getRecurringEvents());
        } catch { toast.error('Nepodařilo se načíst kroužky'); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        load();
        api.get('/api/deputy/rooms').then(r => setRooms(r.data)).catch(() => { });
        api.get('/api/deputy/teachers').then(r => setTeachers(r.data)).catch(() => { });
    }, []);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    const openEdit = (ev: any) => {
        setEditing(ev);
        setForm({
            title: ev.title,
            dayOfWeek: String(ev.dayOfWeek),
            startTime: ev.startTime,
            endTime: ev.endTime,
            roomId: ev.roomId || 'none',
            teacherId: ev.teacherId || 'none',
        });
        setDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!form.title || !form.startTime || !form.endTime) {
            toast.error('Vyplňte název a časy'); return;
        }
        const payload = {
            title: form.title,
            dayOfWeek: parseInt(form.dayOfWeek),
            startTime: form.startTime,
            endTime: form.endTime,
            roomId: (form.roomId && form.roomId !== 'none') ? form.roomId : undefined,
            teacherId: (form.teacherId && form.teacherId !== 'none') ? form.teacherId : undefined,
        };
        try {
            if (editing) {
                await updateRecurringEvent(editing.id, payload);
                toast.success('Kroužek aktualizován');
            } else {
                await createRecurringEvent(payload);
                toast.success('Kroužek vytvořen');
            }
            setDialogOpen(false);
            load();
        } catch (e: any) { toast.error(e.response?.data?.message || 'Chyba'); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteRecurringEvent(deleteTarget.id);
            toast.success('Smazáno');
            setDeleteTarget(null);
            load();
        } catch (e: any) { toast.error(e.response?.data?.message || 'Chyba'); }
    };

    // Group by day
    const byDay = DAY_LABELS.slice(1).map((label, i) => ({
        day: i + 1,
        label,
        events: events.filter(e => e.dayOfWeek === i + 1),
    }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Kroužky a opakující se akce</h1>
                    <p className="text-muted-foreground">Pravidelné mimoškolní aktivity a kroužky</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />Nový kroužek
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">{t('common.loading')}</div>
            ) : events.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Zatím nejsou žádné kroužky
                </CardContent></Card>
            ) : (
                <div className="grid gap-6 lg:grid-cols-5">
                    {byDay.map(({ day, label, events: dayEvents }) => (
                        <div key={day} className="space-y-2">
                            <h3 className="font-semibold text-sm text-muted-foreground">{label}</h3>
                            {dayEvents.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">—</p>
                            ) : dayEvents.map(ev => (
                                <Card key={ev.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-3 space-y-1">
                                        <div className="flex items-start justify-between">
                                            <span className="font-medium text-sm">{ev.title}</span>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(ev)}>
                                                    <Edit2 className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteTarget(ev)}>
                                                    <Trash2 className="h-3 w-3 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            {ev.startTime}–{ev.endTime}
                                        </div>
                                        {ev.room && <Badge variant="outline" className="text-xs">{ev.room.name}</Badge>}
                                        {ev.teacher && <p className="text-xs text-muted-foreground">{ev.teacher.firstName} {ev.teacher.lastName}</p>}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editing ? 'Upravit kroužek' : 'Nový kroužek'}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Název</Label>
                            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Robotika, Šachy, Keramika..." />
                        </div>
                        <div className="space-y-1">
                            <Label>Den</Label>
                            <Select value={form.dayOfWeek} onValueChange={v => setForm(f => ({ ...f, dayOfWeek: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {DAY_LABELS.slice(1).map((label, i) => (
                                        <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Od</Label>
                                <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>Do</Label>
                                <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Místnost (volitelné)</Label>
                            <Select value={form.roomId} onValueChange={v => setForm(f => ({ ...f, roomId: v }))}>
                                <SelectTrigger><SelectValue placeholder="Vyberte místnost" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
                                    {rooms.filter((r: any) => r.id).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Vedoucí (volitelné)</Label>
                            <Select value={form.teacherId} onValueChange={v => setForm(f => ({ ...f, teacherId: v }))}>
                                <SelectTrigger><SelectValue placeholder="Vyberte učitele" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
                                    {teachers.filter((t: any) => (t.userId || t.id)).map((t: any) => <SelectItem key={t.userId || t.id} value={t.userId || t.id}>{t.user?.firstName || t.firstName} {t.user?.lastName || t.lastName}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušit</Button>
                        <Button onClick={handleSubmit}>{editing ? 'Uložit' : 'Vytvořit'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Smazat kroužek?</AlertDialogTitle>
                        <AlertDialogDescription>Tato akce je nevratná.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Zrušit</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Smazat</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
