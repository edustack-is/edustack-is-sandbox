import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getLessonPreparations, createLessonPreparation, updateLessonPreparation, deleteLessonPreparation, getSubjectTemplates } from '../api/deputy';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function LessonPreparations() {
    const { t, i18n } = useTranslation();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [editing, setEditing] = useState<any>(null);

    const emptyForm = { title: '', date: '', topic: '', duration: '45', objectives: '', activities: '', materials: '', homework: '', evaluation: '', subjectTemplateId: '' };
    const [form, setForm] = useState(emptyForm);

    const load = async () => {
        setLoading(true);
        try { setItems(await getLessonPreparations()); }
        catch { toast.error('Nepodařilo se načíst přípravy'); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        load();
        getSubjectTemplates().then(setSubjects).catch(() => { });
    }, []);

    const openEdit = (item: any) => {
        setEditing(item);
        setForm({
            title: item.title, date: item.date?.split('T')[0] || '', topic: item.topic,
            duration: String(item.duration), objectives: item.objectives || '', activities: item.activities || '',
            materials: item.materials || '', homework: item.homework || '', evaluation: item.evaluation || '',
            subjectTemplateId: item.subjectTemplateId,
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.title || !form.date || !form.topic || !form.subjectTemplateId) {
            toast.error('Vyplňte povinná pole'); return;
        }
        try {
            const data = { ...form, duration: parseInt(form.duration) || 45 };
            if (editing) {
                await updateLessonPreparation(editing.id, data);
                toast.success('Příprava aktualizována');
            } else {
                await createLessonPreparation(data as any);
                toast.success('Příprava vytvořena');
            }
            setDialogOpen(false); setEditing(null); setForm(emptyForm); load();
        } catch (e: any) { toast.error(e.response?.data?.message || 'Chyba'); }
    };

    const handleDelete = async (id: string) => {
        try { await deleteLessonPreparation(id); toast.success('Smazáno'); load(); }
        catch (e: any) { toast.error(e.response?.data?.message || 'Chyba'); }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Přípravy na hodiny</h1>
                    <p className="text-muted-foreground">Plánování a reflexe vyučovacích hodin</p>
                </div>
                <Button onClick={() => { setEditing(null); setForm(emptyForm); setDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />Nová příprava
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">{t('common.loading')}</div>
            ) : items.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Zatím nejsou žádné přípravy
                </CardContent></Card>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Datum</TableHead>
                            <TableHead>Název</TableHead>
                            <TableHead>Téma</TableHead>
                            <TableHead>Předmět</TableHead>
                            <TableHead>Min</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map(item => (
                            <TableRow key={item.id}>
                                <TableCell className="whitespace-nowrap">{new Date(item.date).toLocaleDateString(i18n.language)}</TableCell>
                                <TableCell className="font-medium">{item.title}</TableCell>
                                <TableCell>{item.topic}</TableCell>
                                <TableCell><Badge variant="outline">{item.subjectTemplate?.name}</Badge></TableCell>
                                <TableCell>{item.duration}</TableCell>
                                <TableCell>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditing(null); }}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{editing ? 'Upravit přípravu' : 'Nová příprava na hodinu'}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Název *</Label>
                                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Úvod do algoritmů" />
                            </div>
                            <div className="space-y-1">
                                <Label>Datum *</Label>
                                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Předmět *</Label>
                                <Select value={form.subjectTemplateId} onValueChange={v => setForm(f => ({ ...f, subjectTemplateId: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Vyberte" /></SelectTrigger>
                                    <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Délka (min)</Label>
                                <Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
                            </div>
                        </div>
                        <div className="space-y-1"><Label>Téma *</Label>
                            <Input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="Téma hodiny" />
                        </div>
                        <div className="space-y-1"><Label>Cíle / výstupy</Label>
                            <Textarea value={form.objectives} onChange={e => setForm(f => ({ ...f, objectives: e.target.value }))} rows={2} />
                        </div>
                        <div className="space-y-1"><Label>Průběh hodiny</Label>
                            <Textarea value={form.activities} onChange={e => setForm(f => ({ ...f, activities: e.target.value }))} rows={3} />
                        </div>
                        <div className="space-y-1"><Label>Pomůcky</Label>
                            <Input value={form.materials} onChange={e => setForm(f => ({ ...f, materials: e.target.value }))} />
                        </div>
                        <div className="space-y-1"><Label>Domácí úkol</Label>
                            <Input value={form.homework} onChange={e => setForm(f => ({ ...f, homework: e.target.value }))} />
                        </div>
                        <div className="space-y-1"><Label>Reflexe / hodnocení</Label>
                            <Textarea value={form.evaluation} onChange={e => setForm(f => ({ ...f, evaluation: e.target.value }))} rows={2} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušit</Button>
                        <Button onClick={handleSave}>{editing ? 'Uložit' : 'Vytvořit'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
