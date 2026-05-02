import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Printer, Save, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { getClassBookEntries, upsertClassBookEntry, signClassBookEntry, getClassBookPrintUrl, api } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

export default function ClassBook() {
    const { t } = useTranslation();
    const [classrooms, setClassrooms] = useState<any[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ topic: '', notes: '', absentCount: '' });

    // Date range for print
    const [printFrom, setPrintFrom] = useState(new Date().toISOString().slice(0, 10));
    const [printTo, setPrintTo] = useState(new Date().toISOString().slice(0, 10));

    useEffect(() => {
        api.get('/api/deputy/classrooms')
            .then((r) => setClassrooms(r.data))
            .catch(() => {});
    }, []);

    const loadEntries = async () => {
        if (!selectedClassroom) return;
        setLoading(true);
        try {
            setEntries(await getClassBookEntries(selectedClassroom, date));
        } catch {
            toast.error('Chyba načítání');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEntries();
    }, [selectedClassroom, date]);

    const handleEdit = (index: number) => {
        const e = entries[index];
        setEditingId(index);
        setEditForm({
            topic: e.topic || '',
            notes: e.notes || '',
            absentCount: e.absentCount != null ? String(e.absentCount) : '',
        });
    };

    const handleSave = async (entry: any) => {
        try {
            await upsertClassBookEntry({
                classroomId: selectedClassroom,
                date,
                lessonNumber: entry.lessonNumber,
                topic: editForm.topic || undefined,
                notes: editForm.notes || undefined,
                absentCount: editForm.absentCount ? parseInt(editForm.absentCount) : undefined,
                scheduleEventId: entry.scheduleEventId,
                subjectName: entry.subjectName,
            });
            toast.success('Uloženo');
            setEditingId(null);
            loadEntries();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Chyba');
        }
    };

    const handleSign = async (entry: any) => {
        if (!entry.id) {
            toast.error('Nejdřív uložte záznam');
            return;
        }
        try {
            await signClassBookEntry(entry.id);
            toast.success('Podepsáno');
            loadEntries();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Chyba');
        }
    };

    const handlePrint = () => {
        if (!selectedClassroom) return;
        const url = getClassBookPrintUrl(selectedClassroom, printFrom, printTo);
        window.open(url, '_blank');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <BookOpen className="h-6 w-6" />
                        Třídní kniha
                    </h1>
                    <p className="text-muted-foreground">Elektronická třídní kniha s propojením na rozvrh</p>
                </div>
                <Select value={selectedClassroom} onValueChange={setSelectedClassroom}>
                    <SelectTrigger className="w-44">
                        <SelectValue placeholder={t('common.select_class')} />
                    </SelectTrigger>
                    <SelectContent>
                        {classrooms.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-4">
                <div className="space-y-1">
                    <Label>Datum</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
                </div>
                <div className="flex items-end gap-2 ml-auto">
                    <div className="space-y-1">
                        <Label>Tisk od</Label>
                        <Input
                            type="date"
                            value={printFrom}
                            onChange={(e) => setPrintFrom(e.target.value)}
                            className="w-36"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>do</Label>
                        <Input
                            type="date"
                            value={printTo}
                            onChange={(e) => setPrintTo(e.target.value)}
                            className="w-36"
                        />
                    </div>
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="h-4 w-4 mr-1" />
                        Tisk
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>
                        Záznamy –{' '}
                        {new Date(date).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-muted-foreground text-center py-8">Načítání…</p>
                    ) : !selectedClassroom ? (
                        <p className="text-muted-foreground text-center py-8">{t('common.select_class')}</p>
                    ) : entries.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">Žádné hodiny v rozvrhu pro tento den</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">Hod.</TableHead>
                                    <TableHead>Předmět</TableHead>
                                    <TableHead>{t('common.teacher')}</TableHead>
                                    <TableHead>Probírané učivo</TableHead>
                                    <TableHead>{t('common.notes')}</TableHead>
                                    <TableHead className="w-16">Nepřít.</TableHead>
                                    <TableHead className="w-24">Podpis</TableHead>
                                    <TableHead className="w-20"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.map((e: any, i: number) => (
                                    <TableRow key={e.lessonNumber}>
                                        <TableCell className="font-mono font-bold">{e.lessonNumber}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{e.subjectName || '-'}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {e.teacher ? `${e.teacher.lastName} ${e.teacher.firstName}` : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {editingId === i ? (
                                                <Textarea
                                                    value={editForm.topic}
                                                    onChange={(ev) =>
                                                        setEditForm((f) => ({ ...f, topic: ev.target.value }))
                                                    }
                                                    rows={2}
                                                    className="text-xs"
                                                />
                                            ) : (
                                                <span className="text-sm">
                                                    {e.topic || <span className="text-muted-foreground italic">–</span>}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {editingId === i ? (
                                                <Textarea
                                                    value={editForm.notes}
                                                    onChange={(ev) =>
                                                        setEditForm((f) => ({ ...f, notes: ev.target.value }))
                                                    }
                                                    rows={2}
                                                    className="text-xs"
                                                />
                                            ) : (
                                                <span className="text-sm">
                                                    {e.notes || <span className="text-muted-foreground italic">–</span>}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {editingId === i ? (
                                                <Input
                                                    type="number"
                                                    value={editForm.absentCount}
                                                    onChange={(ev) =>
                                                        setEditForm((f) => ({ ...f, absentCount: ev.target.value }))
                                                    }
                                                    className="w-14 text-xs"
                                                />
                                            ) : (
                                                <span className="text-sm">{e.absentCount ?? '-'}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {e.signature ? (
                                                <Badge className="text-xs gap-1">
                                                    <Check className="h-3 w-3" />
                                                    Podepsáno
                                                </Badge>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-6 text-xs"
                                                    onClick={() => handleSign(e)}
                                                >
                                                    Podepsat
                                                </Button>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {editingId === i ? (
                                                <Button size="sm" className="h-6 text-xs" onClick={() => handleSave(e)}>
                                                    <Save className="h-3 w-3" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 text-xs"
                                                    onClick={() => handleEdit(i)}
                                                >
                                                    Upravit
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
