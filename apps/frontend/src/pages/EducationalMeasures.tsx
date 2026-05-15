import { useEffect, useState } from 'react';
import { Plus, Trash2, Award, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getMeasures, createMeasure, deleteMeasure } from '../api';
import { api } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function EducationalMeasures() {
    const { t, i18n } = useTranslation();

    const MEASURE_TYPES = [
        { value: 'PRAISE', label: t('measures.types.praise'), color: 'bg-green-500/10 text-green-700' },
        { value: 'REPRIMAND', label: t('measures.types.reprimand'), color: 'bg-yellow-500/10 text-yellow-700' },
        {
            value: 'CLASS_REPRIMAND',
            label: t('measures.types.class_reprimand'),
            color: 'bg-orange-500/10 text-orange-700',
        },
        {
            value: 'PRINCIPAL_REPRIMAND',
            label: t('measures.types.principal_reprimand'),
            color: 'bg-red-500/10 text-red-700',
        },
    ];

    const [measures, setMeasures] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [classrooms, setClassrooms] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState('');

    const emptyForm = { studentId: '', type: 'PRAISE', reason: '' };
    const [form, setForm] = useState(emptyForm);

    const load = async () => {
        setLoading(true);
        try {
            setMeasures(
                await getMeasures(
                    selectedClassroom && selectedClassroom !== 'all' ? { classroomId: selectedClassroom } : undefined,
                ),
            );
        } catch {
            toast.error(t('measures.load_error'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        api.get('/api/deputy/classrooms')
            .then((r) => setClassrooms(r.data))
            .catch(() => {});
    }, []);

    useEffect(() => {
        load();
    }, [selectedClassroom]);

    const loadStudents = async (classroomId: string) => {
        try {
            const r = await api.get(`/api/deputy/classrooms/${classroomId}/students`);
            setStudents(r.data);
        } catch {
            setStudents([]);
        }
    };

    const handleSubmit = async () => {
        if (!form.studentId || !form.reason) {
            toast.error(t('measures.fill_required'));
            return;
        }
        try {
            await createMeasure(form);
            toast.success(t('measures.create_success'));
            setDialogOpen(false);
            setForm(emptyForm);
            load();
        } catch (e: any) {
            toast.error(e.response?.data?.message || t('common.error'));
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteMeasure(deleteTarget.id);
            toast.success(t('common.success'));
            setDeleteTarget(null);
            load();
        } catch (e: any) {
            toast.error(e.response?.data?.message || t('common.error'));
        }
    };

    const getTypeInfo = (type: string) => MEASURE_TYPES.find((t) => t.value === type) || MEASURE_TYPES[0];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t('measures.title')}</h1>
                    <p className="text-muted-foreground">{t('measures.subtitle')}</p>
                </div>
                <div className="flex gap-2 items-center">
                    <Select value={selectedClassroom} onValueChange={setSelectedClassroom}>
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder={t('measures.all_classes')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('measures.all_classes')}</SelectItem>
                            {classrooms
                                .filter((c: any) => c.id)
                                .map((c: any) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('measures.new')}
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                    {t('common.loading')}
                </div>
            ) : measures.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        {t('measures.no_measures')}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('common.date')}</TableHead>
                                    <TableHead>{t('common.student')}</TableHead>
                                    <TableHead>{t('common.type')}</TableHead>
                                    <TableHead>{t('common.reason')}</TableHead>
                                    <TableHead>{t('common.issued_by')}</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {measures.map((m) => {
                                    const typeInfo = getTypeInfo(m.type);
                                    return (
                                        <TableRow key={m.id}>
                                            <TableCell className="text-xs">
                                                {new Date(m.date).toLocaleDateString(i18n.language)}
                                            </TableCell>
                                            <TableCell>
                                                {m.student?.user?.lastName} {m.student?.user?.firstName}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={typeInfo.color}>
                                                    {m.type === 'PRAISE' ? (
                                                        <Award className="h-3 w-3 mr-1" />
                                                    ) : (
                                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                                    )}
                                                    {typeInfo.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate">{m.reason}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {m.issuedBy?.lastName} {m.issuedBy?.firstName}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => setDeleteTarget(m)}
                                                >
                                                    <Trash2 className="h-3 w-3 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('measures.new')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>{t('common.class')}</Label>
                            <Select
                                onValueChange={(v) => {
                                    loadStudents(v);
                                    setForm((f) => ({ ...f, studentId: '' }));
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={t('common.select_class')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {classrooms
                                        .filter((c: any) => c.id)
                                        .map((c: any) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>{t('common.student')}</Label>
                            <Select
                                value={form.studentId}
                                onValueChange={(v) => setForm((f) => ({ ...f, studentId: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={t('measures.select_student')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {students
                                        .filter((s: any) => s.id)
                                        .map((s: any) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.lastName} {s.firstName}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>{t('common.type')}</Label>
                            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MEASURE_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>{t('common.reason')}</Label>
                            <Textarea
                                value={form.reason}
                                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                                placeholder={t('measures.describe_reason')}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleSubmit}>{t('common.create')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('common.delete_measure_title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('common.delete_measure_confirm')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground"
                        >
                            {t('common.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
