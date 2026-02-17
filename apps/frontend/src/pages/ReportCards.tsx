import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '@/context/SchoolContext';
import {
    getReportCards,
    upsertReportCard,
    polishVerbalEvaluation,
    api,
} from '@/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
    FileText, Sparkles, CheckCircle, AlertCircle, Printer,
} from 'lucide-react';

interface ClassroomOption { id: string; name: string; grade: number; }
interface SemesterOption { id: string; name: string; number: number; }

interface SubjectBrief { id: string; name: string; code: string; }

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

const FINAL_GRADES = [
    { value: '1', label: '1 — výborný', color: 'bg-green-100 text-green-800' },
    { value: '2', label: '2 — chvalitebný', color: 'bg-lime-100 text-lime-800' },
    { value: '3', label: '3 — dobrý', color: 'bg-yellow-100 text-yellow-800' },
    { value: '4', label: '4 — dostatečný', color: 'bg-orange-100 text-orange-800' },
    { value: '5', label: '5 — nedostatečný', color: 'bg-red-100 text-red-800' },
    { value: 'N', label: 'N — nehodnocen', color: 'bg-gray-100 text-gray-800' },
];

export const ReportCards: React.FC = () => {
    const { t } = useTranslation();
    const { schoolId } = useSchool();

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
    const [polishing, setPolishing] = useState(false);

    // ─── Load reference data ────────────────────────────────

    useEffect(() => {
        if (!schoolId) return;

        api.get('/api/deputy/classrooms')
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : [];
                setClassrooms(data);
                if (data.length > 0 && !selectedClassroomId) setSelectedClassroomId(data[0].id);
            })
            .catch(() => setClassrooms([]));

        api.get('/api/deputy/academic-years')
            .then(res => {
                const years = Array.isArray(res.data) ? res.data : [];
                const current = years.find((y: any) => y.isCurrent);
                if (current?.id) {
                    api.get(`/api/deputy/semesters`, { params: { academicYearId: current.id } })
                        .then(semRes => {
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
        const subEntry = student.subjects.find(s => s.subjectInstanceId === subjectInstanceId);
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
            toast.success('Vysvědčení aktualizováno.');
            setEditDialog(null);
            loadReportCards();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Chyba při ukládání.');
        } finally {
            setSaving(false);
        }
    };

    const handleAiPolish = async () => {
        if (!editDialog || !editVerbal.trim()) {
            toast.error('Napište hodnocení pro AI úpravu.');
            return;
        }

        setPolishing(true);
        try {
            const result = await polishVerbalEvaluation({
                text: editVerbal,
                studentName: `${editDialog.student.firstName} ${editDialog.student.lastName}`,
                subjectName: editDialog.subjectName,
            });
            setEditVerbal(result.polishedText);
            toast.success('Hodnocení upraveno pomocí AI.');
        } catch {
            toast.error('AI služba není dostupná.');
        } finally {
            setPolishing(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // ─── Completeness check ─────────────────────────────────

    const getCompleteness = (student: StudentReportData) => {
        const total = subjects.length;
        const filled = student.subjects.filter(s => s.reportCard?.finalGrade).length;
        return { filled, total, complete: filled === total };
    };

    // ─── Render ─────────────────────────────────────────────

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <FileText className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">{t('report_cards.title', 'Vysvědčení')}</h1>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Select value={selectedClassroomId} onValueChange={setSelectedClassroomId}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Třída..." />
                        </SelectTrigger>
                        <SelectContent>
                            {classrooms.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
                        <SelectTrigger className="w-36">
                            <SelectValue placeholder="Pololetí..." />
                        </SelectTrigger>
                        <SelectContent>
                            {semesters.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
                        <Printer className="h-4 w-4 mr-1" /> Tisk
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
                        <p className="text-lg font-medium">
                            Vyberte třídu a pololetí pro přípravu vysvědčení.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/50">
                                    <th className="text-left p-2 font-medium sticky left-0 bg-muted/50 z-10 min-w-[160px]">
                                        Student
                                    </th>
                                    {subjects.map(sub => (
                                        <th key={sub.id} className="text-center p-2 font-medium min-w-[70px] text-xs">
                                            {sub.code}
                                        </th>
                                    ))}
                                    <th className="text-center p-2 font-medium min-w-[80px]">Stav</th>
                                </tr>
                            </thead>
                            <tbody>
                                {studentsData
                                    .sort((a, b) => a.lastName.localeCompare(b.lastName))
                                    .map((student, idx) => {
                                        const { filled, total, complete } = getCompleteness(student);
                                        return (
                                            <tr key={student.id} className={`border-t ${idx % 2 === 0 ? '' : 'bg-muted/20'} hover:bg-muted/30`}>
                                                <td className="p-2 font-medium sticky left-0 bg-background z-10">
                                                    {student.lastName} {student.firstName}
                                                </td>
                                                {subjects.map(sub => {
                                                    const entry = student.subjects.find(s => s.subjectInstanceId === sub.id);
                                                    const finalGrade = entry?.reportCard?.finalGrade;
                                                    const hasVerbal = !!entry?.reportCard?.verbalEvaluation;
                                                    const gradeInfo = FINAL_GRADES.find(g => g.value === finalGrade);

                                                    return (
                                                        <td key={sub.id} className="p-1 text-center">
                                                            <button
                                                                className="w-full p-1 rounded hover:bg-muted/40 transition-colors"
                                                                onClick={() => openEditDialog(student, sub.id, sub.name)}
                                                            >
                                                                {finalGrade ? (
                                                                    <Badge variant="outline" className={`${gradeInfo?.color || ''} text-xs`}>
                                                                        {finalGrade}
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-muted-foreground text-xs">
                                                                        {entry?.average ? `Ø${entry.average}` : '—'}
                                                                    </span>
                                                                )}
                                                                {hasVerbal && (
                                                                    <div className="mt-0.5">
                                                                        <Badge variant="secondary" className="text-[9px] px-1 py-0">S</Badge>
                                                                    </div>
                                                                )}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                                <td className="p-2 text-center">
                                                    {complete ? (
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                            <CheckCircle className="h-3 w-3 mr-1" /> Hotovo
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
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
                onOpenChange={(open) => { if (!open) setEditDialog(null); }}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editDialog?.student.lastName} {editDialog?.student.firstName} — {editDialog?.subjectName}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Weighted average hint */}
                        {editDialog && (() => {
                            const entry = editDialog.student.subjects.find(s => s.subjectInstanceId === editDialog.subjectInstanceId);
                            return entry?.average ? (
                                <div className="text-sm text-muted-foreground bg-muted/30 rounded p-2">
                                    Vážený průměr známek: <strong>{entry.average}</strong>
                                    {!editGrade && (
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="ml-2 h-auto p-0"
                                            onClick={() => setEditGrade(String(Math.round(entry.average)))}
                                        >
                                            Použít jako návrh
                                        </Button>
                                    )}
                                </div>
                            ) : null;
                        })()}

                        {/* Final grade */}
                        <div>
                            <label className="text-sm font-medium">Závěrečná známka</label>
                            <div className="flex gap-2 mt-1">
                                {FINAL_GRADES.map(g => (
                                    <button
                                        key={g.value}
                                        className={`w-9 h-9 rounded-lg border text-sm font-bold transition-all ${editGrade === g.value
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
                                        Zrušit
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Verbal evaluation */}
                        <div>
                            <label className="text-sm font-medium">Slovní hodnocení na vysvědčení</label>
                            <Textarea
                                value={editVerbal}
                                onChange={e => setEditVerbal(e.target.value)}
                                placeholder="Napište slovní hodnocení pro vysvědčení..."
                                rows={4}
                                className="mt-1"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={handleAiPolish}
                                disabled={polishing || !editVerbal.trim()}
                            >
                                <Sparkles className="h-3 w-3 mr-1" />
                                {polishing ? 'AI zpracovává...' : 'Učesat pomocí AI'}
                            </Button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialog(null)}>Zrušit</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Ukládám...' : 'Uložit'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
