import { useEffect, useState } from 'react';
import { Camera, GitCompare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getScheduleSnapshots, createScheduleSnapshot, diffScheduleSnapshot, deleteScheduleSnapshot } from '../api';
import { api } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const DAY_LABELS = ['', 'Po', 'Út', 'St', 'Čt', 'Pá'];

export default function ScheduleDiff() {
    const { t } = useTranslation();
    const [snapshots, setSnapshots] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [years, setYears] = useState<any[]>([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [snapshotName, setSnapshotName] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [diff, setDiff] = useState<any>(null);
    const [diffLoading, setDiffLoading] = useState(false);

    const load = async (yearId?: string) => {
        setLoading(true);
        try {
            setSnapshots(await getScheduleSnapshots(yearId));
        } catch { toast.error('Nepodařilo se načíst snapshoty'); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        api.get('/api/deputy/academic-years').then(r => {
            setYears(r.data);
            const current = r.data.find((y: any) => y.isCurrent);
            if (current) { setSelectedYear(current.id); load(current.id); }
            else { load(); }
        }).catch(() => load());
    }, []);

    const handleCreateSnapshot = async () => {
        if (!snapshotName || !selectedYear) { toast.error('Vyplňte název a vyberte rok'); return; }
        try {
            await createScheduleSnapshot(selectedYear, snapshotName);
            toast.success('Snapshot vytvořen');
            setCreateOpen(false);
            setSnapshotName('');
            load(selectedYear);
        } catch (e: any) { toast.error(e.response?.data?.message || 'Chyba'); }
    };

    const handleDiff = async (snapshotId: string) => {
        setDiffLoading(true);
        try {
            const result = await diffScheduleSnapshot(snapshotId);
            setDiff(result);
        } catch (e: any) { toast.error(e.response?.data?.message || 'Chyba'); }
        finally { setDiffLoading(false); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteScheduleSnapshot(deleteTarget.id);
            toast.success('Smazáno');
            setDeleteTarget(null);
            load(selectedYear);
        } catch (e: any) { toast.error(e.response?.data?.message || 'Chyba'); }
    };

    const eventLabel = (ev: any) => {
        const subName = ev.subject?.template?.name || ev.subjectInstanceId?.substring(0, 8) || '?';
        const className = ev.classroom?.name || '?';
        return `${subName} (${className}) – ${DAY_LABELS[ev.dayOfWeek] || '?'} ${ev.lessonNumber}. hod`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Porovnání rozvrhů (Diff)</h1>
                    <p className="text-muted-foreground">Vytvořte snapshoty rozvrhu a porovnávejte změny</p>
                </div>
                <div className="flex gap-2 items-center">
                    <Select value={selectedYear} onValueChange={v => { setSelectedYear(v); load(v); setDiff(null); }}>
                        <SelectTrigger className="w-44"><SelectValue placeholder="Školní rok" /></SelectTrigger>
                        <SelectContent>{years.map((y: any) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button onClick={() => setCreateOpen(true)}>
                        <Camera className="h-4 w-4 mr-2" />Nový snapshot
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">{t('common.loading')}</div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Snapshots list */}
                    <Card>
                        <CardHeader><CardTitle className="text-base">Snapshoty</CardTitle></CardHeader>
                        <CardContent>
                            {snapshots.length === 0 ? (
                                <p className="text-muted-foreground text-sm">Žádné snapshoty. Vytvořte první pro porovnávání.</p>
                            ) : (
                                <div className="space-y-2">
                                    {snapshots.map(s => (
                                        <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                                            <div>
                                                <p className="font-medium text-sm">{s.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(s.createdAt).toLocaleDateString('cs-CZ')} {new Date(s.createdAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="outline" size="sm" onClick={() => handleDiff(s.id)} disabled={diffLoading}>
                                                    <GitCompare className="h-3 w-3 mr-1" />Diff
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(s)}>
                                                    <Trash2 className="h-3 w-3 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Diff result */}
                    <Card>
                        <CardHeader><CardTitle className="text-base">Výsledek porovnání</CardTitle></CardHeader>
                        <CardContent>
                            {!diff ? (
                                <p className="text-muted-foreground text-sm">Vyberte snapshot a klikněte na "Diff" pro porovnání s aktuálním rozvrhem.</p>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-sm">
                                        Porovnání snapshotu <strong>{diff.snapshotName}</strong> ({new Date(diff.snapshotDate).toLocaleDateString('cs-CZ')}) s aktuálním rozvrhem:
                                    </p>

                                    {diff.added.length > 0 && (
                                        <div>
                                            <Badge className="bg-green-500/10 text-green-700 mb-2">+ Přidáno ({diff.added.length})</Badge>
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Událost</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {diff.added.map((ev: any, i: number) => (
                                                        <TableRow key={i}><TableCell className="text-green-700 text-xs">{eventLabel(ev)}</TableCell></TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}

                                    {diff.removed.length > 0 && (
                                        <div>
                                            <Badge className="bg-red-500/10 text-red-700 mb-2">− Odebráno ({diff.removed.length})</Badge>
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Událost</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {diff.removed.map((ev: any, i: number) => (
                                                        <TableRow key={i}><TableCell className="text-red-700 text-xs">{eventLabel(ev)}</TableCell></TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}

                                    {diff.changed.length > 0 && (
                                        <div>
                                            <Badge className="bg-yellow-500/10 text-yellow-700 mb-2">~ Změněno ({diff.changed.length})</Badge>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Původní</TableHead>
                                                        <TableHead>Aktuální</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {diff.changed.map((c: any, i: number) => (
                                                        <TableRow key={i}>
                                                            <TableCell className="text-xs text-red-600">{eventLabel(c.old)}</TableCell>
                                                            <TableCell className="text-xs text-green-600">{eventLabel(c.current)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}

                                    {diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0 && (
                                        <p className="text-sm text-muted-foreground">✅ Rozvrh se nezměnil od posledního snapshotu.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Create snapshot dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nový snapshot rozvrhu</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Název</Label>
                            <Input value={snapshotName} onChange={e => setSnapshotName(e.target.value)} placeholder="Rozvrh před změnami, Verze 1..." />
                        </div>
                        <p className="text-xs text-muted-foreground">Snapshot uloží aktuální stav rozvrhu pro školní rok {years.find(y => y.id === selectedYear)?.name || ''}.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Zrušit</Button>
                        <Button onClick={handleCreateSnapshot}>Vytvořit snapshot</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Smazat snapshot?</AlertDialogTitle>
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
