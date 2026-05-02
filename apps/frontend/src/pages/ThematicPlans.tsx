import { useEffect, useState } from 'react';
import { Plus, Trash2, BookOpen, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getThematicPlans, createThematicPlan, deleteThematicPlan, getSubjectTemplates } from '../api/deputy';
import { api } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

export default function ThematicPlans() {
    const { t } = useTranslation();
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [years, setYears] = useState<any[]>([]);
    const [grades, setGrades] = useState<any[]>([]);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);

    const [form, setForm] = useState({ title: '', subjectTemplateId: '', academicYearId: '', gradeLevelId: '' });

    const load = async () => {
        setLoading(true);
        try {
            const data = await getThematicPlans();
            setPlans(data);
        } catch {
            toast.error('Nepodařilo se načíst tematické plány');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        getSubjectTemplates()
            .then(setSubjects)
            .catch(() => {});
        api.get('/api/deputy/academic-years')
            .then((r) => setYears(r.data))
            .catch(() => {});
        api.get('/api/deputy/grade-levels')
            .then((r) => setGrades(r.data))
            .catch(() => {});
    }, []);

    const handleCreate = async () => {
        if (!form.title || !form.subjectTemplateId || !form.academicYearId || !form.gradeLevelId) {
            toast.error('Vyplňte všechna pole');
            return;
        }
        try {
            await createThematicPlan(form);
            toast.success('Tematický plán vytvořen');
            setDialogOpen(false);
            setForm({ title: '', subjectTemplateId: '', academicYearId: '', gradeLevelId: '' });
            load();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Chyba');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteThematicPlan(deleteTarget.id);
            toast.success('Smazáno');
            setDeleteTarget(null);
            load();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Chyba');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Tematické plány</h1>
                    <p className="text-muted-foreground">Rozpis učiva po týdnech pro jednotlivé předměty a ročníky</p>
                </div>
                <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nový plán
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                    {t('common.loading')}
                </div>
            ) : plans.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Zatím nejsou žádné tematické plány
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {plans.map((plan) => (
                        <Card key={plan.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <CardTitle className="text-base">{plan.title}</CardTitle>
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(plan)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex gap-2 flex-wrap">
                                    <Badge variant="outline">{plan.subjectTemplate?.name}</Badge>
                                    <Badge variant="secondary">{plan.gradeLevel?.name}</Badge>
                                    <Badge variant="secondary">
                                        <CalendarDays className="h-3 w-3 mr-1" />
                                        {plan.academicYear?.name}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {plan.teacher?.firstName} {plan.teacher?.lastName} · {plan._count?.weeks ?? 0} týdnů
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nový tematický plán</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>{t('common.title')}</Label>
                            <Input
                                value={form.title}
                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                placeholder="Informatika 7.ročník 2024/25"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>{t('grading.subject')}</Label>
                            <Select
                                value={form.subjectTemplateId}
                                onValueChange={(v) => setForm((f) => ({ ...f, subjectTemplateId: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Vyberte předmět" />
                                </SelectTrigger>
                                <SelectContent>
                                    {subjects.map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>{t('sidebar.year_setup')}</Label>
                                <Select
                                    value={form.academicYearId}
                                    onValueChange={(v) => setForm((f) => ({ ...f, academicYearId: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Rok" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map((y: any) => (
                                            <SelectItem key={y.id} value={y.id}>
                                                {y.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Ročník</Label>
                                <Select
                                    value={form.gradeLevelId}
                                    onValueChange={(v) => setForm((f) => ({ ...f, gradeLevelId: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('common.classroom')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {grades.map((g: any) => (
                                            <SelectItem key={g.id} value={g.id}>
                                                {g.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleCreate}>{t('common.create')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('common.delete_plan_title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('common.delete_plan_confirm')}</AlertDialogDescription>
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
