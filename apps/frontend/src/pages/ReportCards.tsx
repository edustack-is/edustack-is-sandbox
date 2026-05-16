import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '@/context/SchoolContext';
import { getReportCards, upsertReportCard, api } from '@/api';
import { PolishWithAiDialog } from '@/components/grading/PolishWithAiDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Sparkles, CheckCircle, AlertCircle, Printer } from 'lucide-react';

interface ClassroomOption {
    id: string;
    name: string;
    grade: number;
}
interface SemesterOption {
    id: string;
    name: string;
    number: number;
}

interface SubjectBrief {
    id: string;
    name: string;
    code: string;
}

interface ReportCardEntry {
    id?: string;
    finalGrade?: string;
    verbalEvaluation?: string;
    aiPolished?: boolean;
    subjectInstance?: { template: { name: string; code: string } };
}

interface StudentReportData {
    id: string;
    firstName: string;
    lastName: string;
    subjects: Array<{
        subjectInstanceId: string;
        average: number;
        reportCard: ReportCardEntry | null;
    }>;
}

export const ReportCards: React.FC = () => {
    const { t } = useTranslation();
    const { schoolId } = useSchool();

    const FINAL_GRADES = [
        { value: '1', label: `1 — ${t('report_cards.grades.excellent')}`, color: 'bg-green-100 text-green-800' },
        { value: '2', label: `2 — ${t('report_cards.grades.commendable')}`, color: 'bg-lime-100 text-lime-800' },
        { value: '3', label: `3 — ${t('report_cards.grades.good')}`, color: 'bg-yellow-100 text-yellow-800' },
        { value: '4', label: `4 — ${t('report_cards.grades.sufficient')}`, color: 'bg-orange-100 text-orange-800' },
        { value: '5', label: `5 — ${t('report_cards.grades.insufficient')}`, color: 'bg-red-100 text-red-800' },
        { value: 'N', label: `N — ${t('report_cards.grades.not_graded')}`, color: 'bg-gray-100 text-gray-800' },
    ];

    const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
    const [semesters, setSemesters] = useState<SemesterOption[]>([]);
    const [subjects, setSubjects] = useState<SubjectBrief[]>([]);
    const [studentsData, setStudentsData] = useState<StudentReportData[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedClassroomId, setSelectedClassroomId] = useState('');
    const [selectedSemesterId, setSelectedSemesterId] = useState('');

    // Edit dialog
    const [editDialog, setEditDialog] = useState<{
        student: StudentReportData;
        subjectInstanceId: string;
        subjectName: string;
    } | null>(null);
    const [editGrade, setEditGrade] = useState('');
    const [editVerbal, setEditVerbal] = useState('');
    const [saving, setSaving] = useState(false);
    // The polish flow now opens a side-by-side dialog of variants
    // instead of overwriting the textarea. `polishOpen` toggles the
    // dialog; the final replacement happens in `handleAcceptPolish`
    // when the teacher picks a variant.
    const [polishOpen, setPolishOpen] = useState(false);

    // ─── Load reference data ────────────────────────────────

    useEffect(() => {
        if (!schoolId) return;

        api.get('/api/deputy/classrooms')
            .then((res) => {
                const data = Array.isArray(res.data) ? res.data : [];
                setClassrooms(data);
                if (data.length > 0 && !selectedClassroomId) setSelectedClassroomId(data[0].id);
            })
            .catch(() => setClassrooms([]));

        api.get('/api/deputy/academic-years')
            .then((res) => {
                const years = Array.isArray(res.data) ? res.data : [];
                const current = years.find((y: any) => y.isCurrent);
                if (current?.id) {
                    api.get(`/api/deputy/semesters`, { params: { academicYearId: current.id } })
                        .then((semRes) => {
                            const sems = Array.isArray(semRes.data) ? semRes.data : [];
                            setSemesters(sems);
                            if (sems.length > 0 && !selectedSemesterId) setSelectedSemesterId(sems[0].id);
                        })
                        .catch(() => setSemesters([]));
                }
            })
            .catch(() => setSemesters([]));
    }, [schoolId]);

    // ─── Load report cards ──────────────────────────────────

    const loadReportCards = useCallback(async () => {
        if (!selectedClassroomId || !selectedSemesterId) return;
        setLoading(true);
        try {
            const data = await getReportCards(selectedClassroomId, selectedSemesterId);
            setSubjects(data.subjects || []);
            setStudentsData(data.students || []);
        } catch {
            setSubjects([]);
            setStudentsData([]);
        } finally {
            setLoading(false);
        }
    }, [selectedClassroomId, selectedSemesterId]);

    useEffect(() => {
        loadReportCards();
    }, [loadReportCards]);

    // ─── Handlers ───────────────────────────────────────────

    const openEditDialog = (student: StudentReportData, subjectInstanceId: string, subjectName: string) => {
        const subEntry = student.subjects.find((s) => s.subjectInstanceId === subjectInstanceId);
        setEditGrade(subEntry?.reportCard?.finalGrade || '');
        setEditVerbal(subEntry?.reportCard?.verbalEvaluation || '');
        setEditDialog({ student, subjectInstanceId, subjectName });
    };

    const handleSave = async () => {
        if (!editDialog) return;
        setSaving(true);
        try {
            await upsertReportCard({
                studentId: editDialog.student.id,
                subjectInstanceId: editDialog.subjectInstanceId,
                semesterId: selectedSemesterId,
                finalGrade: editGrade || undefined,
                verbalEvaluation: editVerbal || undefined,
            });
            toast.success(t('report_cards.update_success'));
            setEditDialog(null);
            loadReportCards();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || t('report_cards.save_error'));
        } finally {
            setSaving(false);
        }
    };

    const handleOpenPolish = () => {
        if (!editDialog || !editVerbal.trim()) {
            toast.error(t('report_cards.polish_error'));
            return;
        }
        setPolishOpen(true);
    };

    const handleAcceptPolish = (text: string) => {
        // The dialog hands back the variant the teacher picked. Replace
        // the textarea content; the polished text is otherwise never
        // persisted server-side.
        setEditVerbal(text);
        toast.success(t('report_cards.polish_success'));
    };

    const handlePrint = () => {
        window.print();
    };

    // ─── Completeness check ─────────────────────────────────

    const getCompleteness = (student: StudentReportData) => {
        const total = subjects.length;
        const filled = student.subjects.filter((s) => s.reportCard?.finalGrade).length;
        return { filled, total, complete: filled === total };
    };

    // ─── Render ─────────────────────────────────────────────

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <FileText className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">{t('report_cards.title')}</h1>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Select value={selectedClassroomId} onValueChange={setSelectedClassroomId}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder={`${t('common.class')}...`} />
                        </SelectTrigger>
                        <SelectContent>
                            {classrooms.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
                        <SelectTrigger className="w-36">
                            <SelectValue placeholder={`${t('common.semester')}...`} />
                        </SelectTrigger>
                        <SelectContent>
                            {semesters.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
                        <Printer className="h-4 w-4 mr-1" /> {t('common.print')}
                    </Button>
                </div>
            </div>

            {/* Report Cards Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : studentsData.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                        <p className="text-lg font-medium">{t('report_cards.select_prompt')}</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/50">
                                    <th className="text-left p-2 font-medium sticky left-0 bg-muted/50 z-10 min-w-[160px]">
                                        {t('common.student')}
                                    </th>
                                    {subjects.map((sub) => (
                                        <th key={sub.id} className="text-center p-2 font-medium min-w-[70px] text-xs">
                                            {sub.code}
                                        </th>
                                    ))}
                                    <th className="text-center p-2 font-medium min-w-[80px]">{t('common.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {studentsData
                                    .sort((a, b) => a.lastName.localeCompare(b.lastName))
                                    .map((student, idx) => {
                                        const { filled, total, complete } = getCompleteness(student);
                                        return (
                                            <tr
                                                key={student.id}
                                                className={`border-t ${idx % 2 === 0 ? '' : 'bg-muted/20'} hover:bg-muted/30`}
                                            >
                                                <td className="p-2 font-medium sticky left-0 bg-background z-10">
                                                    {student.lastName} {student.firstName}
                                                </td>
                                                {subjects.map((sub) => {
                                                    const entry = student.subjects.find(
                                                        (s) => s.subjectInstanceId === sub.id,
                                                    );
                                                    const finalGrade = entry?.reportCard?.finalGrade;
                                                    const hasVerbal = !!entry?.reportCard?.verbalEvaluation;
                                                    const gradeInfo = FINAL_GRADES.find((g) => g.value === finalGrade);

                                                    return (
                                                        <td key={sub.id} className="p-1 text-center">
                                                            <button
                                                                className="w-full p-1 rounded hover:bg-muted/40 transition-colors"
                                                                onClick={() =>
                                                                    openEditDialog(student, sub.id, sub.name)
                                                                }
                                                            >
                                                                {finalGrade ? (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={`${gradeInfo?.color || ''} text-xs`}
                                                                    >
                                                                        {finalGrade}
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-muted-foreground text-xs">
                                                                        {entry?.average ? `Ø${entry.average}` : '—'}
                                                                    </span>
                                                                )}
                                                                {hasVerbal && (
                                                                    <div className="mt-0.5">
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className="text-[9px] px-1 py-0"
                                                                        >
                                                                            S
                                                                        </Badge>
                                                                    </div>
                                                                )}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                                <td className="p-2 text-center">
                                                    {complete ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="bg-green-50 text-green-700 border-green-300"
                                                        >
                                                            <CheckCircle className="h-3 w-3 mr-1" />{' '}
                                                            {t('common.active')}
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className="bg-amber-50 text-amber-700 border-amber-300"
                                                        >
                                                            <AlertCircle className="h-3 w-3 mr-1" /> {filled}/{total}
                                                        </Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {/* ─── Edit Report Card Dialog ───────────────── */}
            <Dialog
                open={!!editDialog}
                onOpenChange={(open) => {
                    if (!open) setEditDialog(null);
                }}
            >
                {/* Wide enough + tall enough to show ~300 words of the
                    verbal evaluation without scrolling. max-h-[90vh] +
                    overflow-y-auto handles the small-screen edge. */}
                <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editDialog?.student.lastName} {editDialog?.student.firstName} — {editDialog?.subjectName}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Weighted average hint */}
                        {editDialog &&
                            (() => {
                                const entry = editDialog.student.subjects.find(
                                    (s) => s.subjectInstanceId === editDialog.subjectInstanceId,
                                );
                                return entry?.average ? (
                                    <div className="text-sm text-muted-foreground bg-muted/30 rounded p-2">
                                        {t('report_cards.weighted_average')} <strong>{entry.average}</strong>
                                        {!editGrade && (
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="ml-2 h-auto p-0"
                                                onClick={() => setEditGrade(String(Math.round(entry.average)))}
                                            >
                                                {t('report_cards.use_suggestion')}
                                            </Button>
                                        )}
                                    </div>
                                ) : null;
                            })()}

                        {/* Final grade */}
                        <div>
                            <label className="text-sm font-medium">{t('report_cards.final_grade')}</label>
                            <div className="flex gap-2 mt-1">
                                {FINAL_GRADES.map((g) => (
                                    <button
                                        key={g.value}
                                        className={`w-9 h-9 rounded-lg border text-sm font-bold transition-all ${
                                            editGrade === g.value
                                                ? `${g.color} ring-2 ring-primary scale-110`
                                                : 'bg-muted/30 hover:bg-muted text-muted-foreground'
                                        }`}
                                        onClick={() => setEditGrade(g.value)}
                                    >
                                        {g.value}
                                    </button>
                                ))}
                                {editGrade && (
                                    <button
                                        className="text-xs text-muted-foreground underline ml-2"
                                        onClick={() => setEditGrade('')}
                                    >
                                        {t('common.cancel')}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Verbal evaluation */}
                        <div>
                            <label className="text-sm font-medium">{t('report_cards.verbal_evaluation')}</label>
                            <span className="hidden">
                                {t('report_cards.grades.excellent')}
                                {t('report_cards.grades.commendable')}
                                {t('report_cards.grades.good')}
                                {t('report_cards.grades.sufficient')}
                                {t('report_cards.grades.insufficient')}
                                {t('report_cards.grades.not_graded')}
                            </span>
                            {/* 15 visible rows fits ~300 Czech words without
                                scrolling; min-h keeps the height stable when
                                the user is still typing. */}
                            <Textarea
                                value={editVerbal}
                                onChange={(e) => setEditVerbal(e.target.value)}
                                placeholder={t('report_cards.verbal_placeholder')}
                                rows={15}
                                className="mt-1 min-h-[260px]"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={handleOpenPolish}
                                disabled={!editVerbal.trim()}
                            >
                                <Sparkles className="h-3 w-3 mr-1" />
                                {t('grading.ai_polish')}
                            </Button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialog(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? t('common.saving') : t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* AI polish — opens with N standalone variants, leaves
                the textarea untouched until the teacher picks one. */}
            {editDialog && (
                <PolishWithAiDialog
                    open={polishOpen}
                    onOpenChange={setPolishOpen}
                    originalText={editVerbal}
                    studentName={`${editDialog.student.firstName} ${editDialog.student.lastName}`}
                    subjectName={editDialog.subjectName}
                    onAccept={handleAcceptPolish}
                />
            )}

            {/* Print styles */}
            <style>{`
                @media print {
                    .print\\:hidden { display: none !important; }
                    body { font-size: 10pt; }
                    table { font-size: 9pt; }
                }
            `}</style>
        </div>
    );
};
