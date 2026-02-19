import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, Download, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
    getClassroomAttendance, recordAttendance, getAttendanceStats,
    exportAttendanceCsv, getAbsenceExcuses, reviewAbsenceExcuse, getUnexcusedAlerts,
} from '../api';
import { api } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type StatusKey = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
const STATUS_ICONS: Record<StatusKey, typeof CheckCircle> = { PRESENT: CheckCircle, ABSENT: XCircle, LATE: Clock, EXCUSED: AlertTriangle };
const STATUS_COLORS: Record<StatusKey, string> = { PRESENT: 'text-green-600', ABSENT: 'text-red-600', LATE: 'text-yellow-600', EXCUSED: 'text-blue-600' };
const STATUS_LABELS: Record<StatusKey, string> = { PRESENT: 'Přítomen', ABSENT: 'Nepřítomen', LATE: 'Pozdě', EXCUSED: 'Omluven' };

export default function AttendancePage() {
    const { t } = useTranslation();
    const [classrooms, setClassrooms] = useState<any[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [lessonNumber, setLessonNumber] = useState(1);
    const [attendance, setAttendance] = useState<any>(null);
    const [localRecords, setLocalRecords] = useState<Record<string, StatusKey>>({});
    const [stats, setStats] = useState<any>(null);
    const [excuses, setExcuses] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/api/deputy/classrooms').then(r => setClassrooms(r.data)).catch(() => { });
    }, []);

    const loadAttendance = async () => {
        if (!selectedClassroom) return;
        setLoading(true);
        try {
            const data = await getClassroomAttendance(selectedClassroom, date);
            setAttendance(data);
            // Init local records from server
            const recs: Record<string, StatusKey> = {};
            for (const r of data.records) {
                if (r.lessonNumber === lessonNumber) recs[r.studentId] = r.status;
            }
            for (const s of data.students) {
                if (!recs[s.id]) recs[s.id] = 'PRESENT';
            }
            setLocalRecords(recs);
        } catch { toast.error('Nepodařilo se načíst docházku'); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadAttendance(); }, [selectedClassroom, date, lessonNumber]);

    const handleSave = async () => {
        if (!selectedClassroom) return;
        const records = Object.entries(localRecords).map(([studentId, status]) => ({ studentId, status }));
        try {
            await recordAttendance({ date, lessonNumber, classroomId: selectedClassroom, records });
            toast.success('Docházka uložena');
        } catch (e: any) { toast.error(e.response?.data?.message || 'Chyba'); }
    };

    const toggleStatus = (studentId: string) => {
        const order: StatusKey[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
        const current = localRecords[studentId] || 'PRESENT';
        const next = order[(order.indexOf(current) + 1) % order.length];
        setLocalRecords(prev => ({ ...prev, [studentId]: next }));
    };

    const loadStats = async () => {
        if (!selectedClassroom) return;
        try { setStats(await getAttendanceStats(selectedClassroom)); } catch { toast.error('Chyba'); }
    };

    const loadExcuses = async () => {
        try { setExcuses(await getAbsenceExcuses(selectedClassroom ? { classroomId: selectedClassroom } : undefined)); } catch { toast.error('Chyba'); }
    };

    const loadAlerts = async () => {
        try { setAlerts(await getUnexcusedAlerts()); } catch { toast.error('Chyba'); }
    };

    const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        try {
            await reviewAbsenceExcuse(id, status);
            toast.success(status === 'APPROVED' ? 'Omluvenka schválena' : 'Omluvenka zamítnuta');
            loadExcuses();
        } catch (e: any) { toast.error(e.response?.data?.message || 'Chyba'); }
    };

    const handleExport = async () => {
        if (!selectedClassroom) return;
        try {
            const blob = await exportAttendanceCsv(selectedClassroom);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dochazka.csv';
            a.click();
            URL.revokeObjectURL(url);
        } catch { toast.error('Chyba exportu'); }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Docházka</h1>
                    <p className="text-muted-foreground">Záznam a správa docházky</p>
                </div>
                <Select value={selectedClassroom} onValueChange={setSelectedClassroom}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="Vyberte třídu" /></SelectTrigger>
                    <SelectContent>
                        {classrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <Tabs defaultValue="record" onValueChange={v => { if (v === 'stats') loadStats(); if (v === 'excuses') loadExcuses(); if (v === 'alerts') loadAlerts(); }}>
                <TabsList>
                    <TabsTrigger value="record">Záznam</TabsTrigger>
                    <TabsTrigger value="stats">Statistiky</TabsTrigger>
                    <TabsTrigger value="excuses">Omluvenky</TabsTrigger>
                    <TabsTrigger value="alerts">Eskalace</TabsTrigger>
                </TabsList>

                {/* ─── RECORD TAB ─── */}
                <TabsContent value="record">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <div className="space-y-1">
                                    <Label>Datum</Label>
                                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40" />
                                </div>
                                <div className="space-y-1">
                                    <Label>Hodina</Label>
                                    <Select value={String(lessonNumber)} onValueChange={v => setLessonNumber(parseInt(v))}>
                                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <SelectItem key={n} value={String(n)}>{n}. hod</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex gap-2 ml-auto items-end">
                                    <Button onClick={handleSave}>Uložit</Button>
                                    <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-1" />CSV</Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? <p className="text-muted-foreground text-center py-8">{t('common.loading')}</p> : !attendance ? (
                                <p className="text-center text-muted-foreground py-8">Vyberte třídu</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead className="text-center">Stav</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {attendance.students.map((s: any) => {
                                            const status = localRecords[s.id] || 'PRESENT';
                                            const Icon = STATUS_ICONS[status];
                                            return (
                                                <TableRow key={s.id} className="cursor-pointer" onClick={() => toggleStatus(s.id)}>
                                                    <TableCell>{s.lastName} {s.firstName}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className={`gap-1 ${STATUS_COLORS[status]}`}>
                                                            <Icon className="h-3 w-3" />{STATUS_LABELS[status]}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ─── STATS TAB ─── */}
                <TabsContent value="stats">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Statistiky docházky</CardTitle></CardHeader>
                        <CardContent>
                            {!stats ? <p className="text-muted-foreground text-center py-8">Vyberte třídu</p> : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead className="text-center">Celkem</TableHead>
                                            <TableHead className="text-center text-green-600">Přítomen</TableHead>
                                            <TableHead className="text-center text-red-600">Nepřítomen</TableHead>
                                            <TableHead className="text-center text-yellow-600">Pozdě</TableHead>
                                            <TableHead className="text-center text-blue-600">Omluven</TableHead>
                                            <TableHead className="text-center">%</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {stats.stats.map((s: any) => (
                                            <TableRow key={s.studentId}>
                                                <TableCell>{s.lastName} {s.firstName}</TableCell>
                                                <TableCell className="text-center">{s.total}</TableCell>
                                                <TableCell className="text-center text-green-600">{s.present}</TableCell>
                                                <TableCell className="text-center text-red-600">{s.absent}</TableCell>
                                                <TableCell className="text-center text-yellow-600">{s.late}</TableCell>
                                                <TableCell className="text-center text-blue-600">{s.excused}</TableCell>
                                                <TableCell className="text-center font-semibold">{s.presentPercent}%</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ─── EXCUSES TAB ─── */}
                <TabsContent value="excuses">
                    <Card>
                        <CardHeader><CardTitle>Omluvenky od rodičů</CardTitle></CardHeader>
                        <CardContent>
                            {excuses.length === 0 ? <p className="text-muted-foreground text-center py-8">Žádné omluvenky</p> : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Rodič</TableHead>
                                            <TableHead>Od</TableHead>
                                            <TableHead>Do</TableHead>
                                            <TableHead>Důvod</TableHead>
                                            <TableHead>Stav</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {excuses.map((e: any) => (
                                            <TableRow key={e.id}>
                                                <TableCell>{e.student?.user?.lastName} {e.student?.user?.firstName}</TableCell>
                                                <TableCell className="text-xs">{e.parent?.lastName} {e.parent?.firstName}</TableCell>
                                                <TableCell className="text-xs">{new Date(e.dateFrom).toLocaleDateString('cs-CZ')}</TableCell>
                                                <TableCell className="text-xs">{new Date(e.dateTo).toLocaleDateString('cs-CZ')}</TableCell>
                                                <TableCell className="max-w-xs truncate">{e.reason}</TableCell>
                                                <TableCell>
                                                    <Badge variant={e.status === 'APPROVED' ? 'default' : e.status === 'REJECTED' ? 'destructive' : 'outline'}>
                                                        {e.status === 'APPROVED' ? 'Schváleno' : e.status === 'REJECTED' ? 'Zamítnuto' : 'Čeká'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {e.status === 'PENDING' && (
                                                        <div className="flex gap-1">
                                                            <Button size="sm" variant="outline" className="text-green-600 h-7" onClick={() => handleReview(e.id, 'APPROVED')}>✓</Button>
                                                            <Button size="sm" variant="outline" className="text-red-600 h-7" onClick={() => handleReview(e.id, 'REJECTED')}>✗</Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ─── ALERTS TAB ─── */}
                <TabsContent value="alerts">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" />Neomluvené absence – eskalace</CardTitle></CardHeader>
                        <CardContent>
                            {alerts.length === 0 ? <p className="text-muted-foreground text-center py-8">Žádní studenti nad práhem</p> : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Třída</TableHead>
                                            <TableHead className="text-center">Neomluv. hodin</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {alerts.map((a: any) => (
                                            <TableRow key={a.student.id} className="text-red-600">
                                                <TableCell className="font-medium">{a.student.lastName} {a.student.firstName}</TableCell>
                                                <TableCell>{a.student.classroom?.name || '-'}</TableCell>
                                                <TableCell className="text-center font-bold">{a.count}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
