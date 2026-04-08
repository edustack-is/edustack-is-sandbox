import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '@/context/SchoolContext';
import {
    getGradesForClassroom,
    getStudentGrades,
    createGrade,
    updateGrade,
    deleteGrade,
    polishVerbalEvaluation,
    api,
} from '@/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
    GraduationCap, Plus, Trash2, Pencil, User, Sparkles, ArrowLeft, CalendarDays,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface StudentBrief {
    id: string;
    firstName: string;
    lastName: string;
}

interface SubjectBrief {
    id: string;
    name: string;
    code: string;
}

interface GradeItem {
    id: string;
    value: string;
    weight: number;
    description?: string;
    date: string;
    type: string;
    verbalText?: string;
    category?: string;
    subjectInstance: { id: string; template: { name: string; code: string } };
    teacherProfile: { user: { firstName: string; lastName: string } };
    studentProfile?: { firstName: string; lastName: string };
}

interface ClassroomOption { id: string; name: string; grade: number; }
interface SemesterOption { id: string; name: string; number: number; startDate: string; endDate: string; }
interface AcademicYearOption { id: string; name: string; isCurrent: boolean; }

const CATEGORIES = [
    { value: 'EXAM', label: 'Písemná práce' },
    { value: 'HOMEWORK', label: 'Domácí úkol' },
    { value: 'CLASSWORK', label: 'Práce v hodině' },
    { value: 'PROJECT', label: 'Projekt' },
    { value: 'OTHER', label: 'Ostatní' },
];

const GRADE_COLORS: Record<string, string> = {
    '1': 'bg-green-100 text-green-800 border-green-300',
    '2': 'bg-lime-100 text-lime-800 border-lime-300',
    '3': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    '4': 'bg-orange-100 text-orange-800 border-orange-300',
    '5': 'bg-red-100 text-red-800 border-red-300',
};

export const Grading: React.FC = () => {
    const { t } = useTranslation();
    const { schoolId } = useSchool();

    // Data
    const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
    const [semesters, setSemesters] = useState<SemesterOption[]>([]);
    const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
    const [students, setStudents] = useState<StudentBrief[]>([]);
    const [subjects, setSubjects] = useState<SubjectBrief[]>([]);
    const [grades, setGrades] = useState<GradeItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedClassroomId, setSelectedClassroomId] = useState('');
    const [selectedSemesterId, setSelectedSemesterId] = useState('');
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');

    // Student detail
    const [selectedStudent, setSelectedStudent] = useState<StudentBrief | null>(null);
    const [studentGrades, setStudentGrades] = useState<GradeItem[]>([]);

    // Add grade dialog
    const [addDialog, setAddDialog] = useState<{ studentId: string; subjectId: string } | null>(null);
    const [editDialog, setEditDialog] = useState<GradeItem | null>(null);
    const [formValue, setFormValue] = useState('');
    const [formWeight, setFormWeight] = useState('1');
    const [formDescription, setFormDescription] = useState('');
    const [formType, setFormType] = useState('NUMERIC');
    const [formVerbalText, setFormVerbalText] = useState('');
    const [formCategory, setFormCategory] = useState('');
    const [saving, setSaving] = useState(false);
    const [polishing, setPolishing] = useState(false);



    // ─── Load reference data ────────────────────────────────

    useEffect(() => {
        if (!schoolId) return;

        // Load classrooms
        api.get('/api/deputy/classrooms')
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : [];
                setClassrooms(data);
                if (data.length > 0 && !selectedClassroomId) {
                    setSelectedClassroomId(data[0].id);
                }
            })
            .catch(() => setClassrooms([]));

        // Load academic years
        api.get('/api/deputy/academic-years')
            .then(res => {
                const years = Array.isArray(res.data) ? res.data : [];
                setAcademicYears(years);
                const current = years.find((y: any) => y.isCurrent);
                if (current && !selectedAcademicYearId) {
                    setSelectedAcademicYearId(current.id);
                }
            })
            .catch(() => setAcademicYears([]));
    }, [schoolId]);

    // Load semesters when academic year changes
    useEffect(() => {
        if (!schoolId || !selectedAcademicYearId) {
            setSemesters([]);
            return;
        }
        api.get('/api/deputy/semesters', { params: { academicYearId: selectedAcademicYearId } })
            .then(res => {
                const sems = Array.isArray(res.data) ? res.data : [];
                setSemesters(sems);
                // Auto-select current semester based on today's date
                const now = new Date();
                const currentSem = sems.find((s: any) => {
                    const start = new Date(s.startDate);
                    const end = new Date(s.endDate);
                    return now >= start && now <= end;
                });
                setSelectedSemesterId(currentSem?.id || '');
            })
            .catch(() => setSemesters([]));
    }, [schoolId, selectedAcademicYearId]);

    // ─── Load grades grid ───────────────────────────────────

    const loadGrades = useCallback(async () => {
        if (!schoolId || !selectedClassroomId) return;
        setLoading(true);
        try {
            const data = await getGradesForClassroom(selectedClassroomId, (selectedSemesterId && selectedSemesterId !== 'all') ? selectedSemesterId : undefined);
            setStudents(data.students || []);
            setSubjects(data.subjects || []);
            setGrades(data.grades || []);
        } catch {
            setStudents([]);
            setSubjects([]);
            setGrades([]);
        } finally {
            setLoading(false);
        }
    }, [schoolId, selectedClassroomId, selectedSemesterId]);

    useEffect(() => {
        loadGrades();
    }, [loadGrades]);

    // ─── Load student detail ────────────────────────────────

    const loadStudentDetail = async (student: StudentBrief) => {
        setSelectedStudent(student);
        try {
            const data = await getStudentGrades(student.id, (selectedSemesterId && selectedSemesterId !== 'all') ? selectedSemesterId : undefined);
            setStudentGrades(data.grades || []);
        } catch {
            setStudentGrades([]);
        }
    };

    // ─── Grade helpers ──────────────────────────────────────




    const getAverageColor = (avg: number | null): string => {
        if (avg === null) return '';
        if (avg <= 1.5) return 'text-green-600';
        if (avg <= 2.5) return 'text-lime-600';
        if (avg <= 3.5) return 'text-yellow-600';
        if (avg <= 4.5) return 'text-orange-600';
        return 'text-red-600';
    };

    // ─── Handlers ───────────────────────────────────────────

    const openAddDialog = (studentId: string, subjectId: string) => {
        setFormValue('');
        setFormWeight('1');
        setFormDescription('');
        setFormType('NUMERIC');
        setFormVerbalText('');
        setFormCategory('');
        setAddDialog({ studentId, subjectId });
    };

    const openEditDialog = (grade: GradeItem) => {
        setFormValue(grade.value);
        setFormWeight(String(grade.weight));
        setFormDescription(grade.description || '');
        setFormType(grade.type);
        setFormVerbalText(grade.verbalText || '');
        setFormCategory(grade.category || '');
        setEditDialog(grade);
    };

    const handleCreateGrade = async () => {
        if (!addDialog) return;
        if (formType === 'NUMERIC' && !formValue) {
            toast.error('Zadejte známku.');
            return;
        }

        setSaving(true);
        try {
            await createGrade({
                studentId: addDialog.studentId,
                subjectInstanceId: addDialog.subjectId,
                value: formValue || 'N',
                weight: parseFloat(formWeight) || 1,
                description: formDescription || undefined,
                type: formType,
                verbalText: formVerbalText || undefined,
                category: formCategory || undefined,
                semesterId: (selectedSemesterId && selectedSemesterId !== 'all') ? selectedSemesterId : undefined,
            });
            toast.success('Známka uložena.');
            setAddDialog(null);
            loadGrades();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Chyba při ukládání známky.');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateGrade = async () => {
        if (!editDialog) return;
        setSaving(true);
        try {
            await updateGrade(editDialog.id, {
                value: formValue || undefined,
                weight: parseFloat(formWeight) || undefined,
                description: formDescription || undefined,
                verbalText: formVerbalText || undefined,
                category: formCategory || undefined,
            });
            toast.success('Známka aktualizována.');
            setEditDialog(null);
            loadGrades();
            if (selectedStudent) loadStudentDetail(selectedStudent);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Chyba při aktualizaci.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGrade = async (gradeId: string) => {
        try {
            await deleteGrade(gradeId);
            toast.success('Známka odstraněna.');
            loadGrades();
            if (selectedStudent) loadStudentDetail(selectedStudent);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Chyba při odstraňování.');
        }
    };

    const handleAiPolish = async () => {
        if (!formVerbalText.trim()) {
            toast.error('Napište hodnocení pro AI úpravu.');
            return;
        }

        const student = selectedStudent || students.find(s => s.id === addDialog?.studentId);
        const subject = subjects.find(s => s.id === (addDialog?.subjectId || editDialog?.subjectInstance.id));

        setPolishing(true);
        try {
            const result = await polishVerbalEvaluation({
                text: formVerbalText,
                studentName: student ? `${student.firstName} ${student.lastName}` : 'Žák',
                subjectName: subject?.name || 'Předmět',
            });
            setFormVerbalText(result.polishedText);
            toast.success('Hodnocení upraveno pomocí AI.');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'AI služba není dostupná.');
        } finally {
            setPolishing(false);
        }
    };

    // ─── Render ─────────────────────────────────────────────

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <GraduationCap className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">{t('grading.title', 'Klasifikace')}</h1>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                    {academicYears.length > 0 && (
                        <Select value={selectedAcademicYearId} onValueChange={(val) => {
                            setSelectedAcademicYearId(val);
                            setSelectedSemesterId('');
                            setSelectedStudent(null);
                        }}>
                            <SelectTrigger className="w-40">
                                <CalendarDays className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                <SelectValue placeholder="Rok..." />
                            </SelectTrigger>
                            <SelectContent>
                                {academicYears.map(y => (
                                    <SelectItem key={y.id} value={y.id}>
                                        {y.name} {y.isCurrent ? '(aktuální)' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <Select value={selectedClassroomId} onValueChange={val => {
                        setSelectedClassroomId(val);
                        setSelectedStudent(null);
                    }}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Třída..." />
                        </SelectTrigger>
                        <SelectContent>
                            {classrooms.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {semesters.length > 0 && (
                        <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
                            <SelectTrigger className="w-36">
                                <SelectValue placeholder="Pololetí..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Vše</SelectItem>
                                {semesters.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            <Tabs defaultValue="grid" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="grid">Klasifikace</TabsTrigger>
                    <TabsTrigger value="student" disabled={!selectedStudent}>
                        {selectedStudent ? `${selectedStudent.lastName} ${selectedStudent.firstName}` : 'Přehled studenta'}
                    </TabsTrigger>
                </TabsList>

                {/* ─── Grid Tab ───────────────────────────────── */}
                <TabsContent value="grid">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : students.length === 0 || subjects.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-40" />
                                <p className="text-lg font-medium">
                                    {students.length === 0
                                        ? 'V této třídě nejsou žádní studenti.'
                                        : 'Nemáte přiřazené předměty v této třídě.'}
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
                                                <th key={sub.id} className="text-center p-2 font-medium min-w-[100px]">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                <span className="text-xs">{sub.code}</span>
                                                            </TooltipTrigger>
                                                            <TooltipContent>{sub.name}</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students
                                            .sort((a, b) => a.lastName.localeCompare(b.lastName))
                                            .map((student, idx) => (
                                                <tr key={student.id} className={`border-t ${idx % 2 === 0 ? '' : 'bg-muted/20'} hover:bg-muted/30 transition-colors`}>
                                                    <td className="p-2 font-medium sticky left-0 bg-background z-10">
                                                        <button
                                                            className="text-left hover:text-primary transition-colors flex items-center gap-1"
                                                            onClick={() => loadStudentDetail(student)}
                                                        >
                                                            <User className="h-3 w-3" />
                                                            {student.lastName} {student.firstName}
                                                        </button>
                                                    </td>
                                                    {subjects.map(sub => {
                                                        const cellGrades = grades.filter(g =>
                                                            g.subjectInstance.id === sub.id
                                                        );
                                                        // Note: grades are filtered server-side per classroom.
                                                        // For a proper per-student filter we'd need studentId on each grade.
                                                        // This simplified view shows all grades for the subject.
                                                        return (
                                                            <td key={sub.id} className="p-1 text-center">
                                                                <div className="flex flex-wrap gap-0.5 justify-center items-center min-h-[28px]">
                                                                    {cellGrades.slice(0, 5).map(g => (
                                                                        <TooltipProvider key={g.id}>
                                                                            <Tooltip>
                                                                                <TooltipTrigger>
                                                                                    <Badge
                                                                                        variant="outline"
                                                                                        className={`text-[10px] px-1 py-0 cursor-pointer ${GRADE_COLORS[g.value] || ''}`}
                                                                                        onClick={() => openEditDialog(g)}
                                                                                    >
                                                                                        {g.type === 'VERBAL' ? 'S' : g.value}
                                                                                    </Badge>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent className="max-w-xs">
                                                                                    <div className="space-y-1">
                                                                                        <div className="font-medium">{g.description || g.category || 'Hodnocení'}</div>
                                                                                        {g.verbalText && <div className="text-xs italic">{g.verbalText}</div>}
                                                                                        <div className="text-xs text-muted-foreground">
                                                                                            Váha: {g.weight} | {new Date(g.date).toLocaleDateString('cs-CZ')} | {g.teacherProfile.user.lastName}
                                                                                        </div>
                                                                                    </div>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                        </TooltipProvider>
                                                                    ))}
                                                                    {cellGrades.length > 5 && (
                                                                        <span className="text-[10px] text-muted-foreground">+{cellGrades.length - 5}</span>
                                                                    )}
                                                                    <button
                                                                        className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                                                        onClick={() => openAddDialog(student.id, sub.id)}
                                                                    >
                                                                        <Plus className="h-3 w-3" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ─── Student Detail Tab ─────────────────────── */}
                <TabsContent value="student">
                    {selectedStudent && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>
                                    <ArrowLeft className="h-4 w-4 mr-1" /> Zpět
                                </Button>
                                <h2 className="text-lg font-semibold">
                                    {selectedStudent.lastName} {selectedStudent.firstName}
                                </h2>
                            </div>

                            {/* Group grades by subject */}
                            {(() => {
                                const grouped = studentGrades.reduce((acc, g) => {
                                    const key = g.subjectInstance.id;
                                    if (!acc[key]) acc[key] = { subject: g.subjectInstance, grades: [] };
                                    acc[key].grades.push(g);
                                    return acc;
                                }, {} as Record<string, { subject: GradeItem['subjectInstance']; grades: GradeItem[] }>);

                                return Object.entries(grouped).map(([subId, { subject, grades: subGrades }]) => {
                                    const numericGrades = subGrades.filter(g => g.type === 'NUMERIC');
                                    let avg: number | null = null;
                                    if (numericGrades.length > 0) {
                                        let tw = 0, w = 0;
                                        numericGrades.forEach(g => {
                                            const v = parseFloat(g.value);
                                            if (!isNaN(v)) { tw += v * g.weight; w += g.weight; }
                                        });
                                        avg = w > 0 ? Math.round((tw / w) * 100) / 100 : null;
                                    }

                                    return (
                                        <Card key={subId}>
                                            <CardHeader className="pb-2">
                                                <div className="flex items-center justify-between">
                                                    <CardTitle className="text-sm font-medium">
                                                        {subject.template.code} — {subject.template.name}
                                                    </CardTitle>
                                                    {avg !== null && (
                                                        <Badge className={`${getAverageColor(avg)} bg-transparent border`}>
                                                            Ø {avg}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-1">
                                                    {subGrades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(g => (
                                                        <div key={g.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 transition-colors">
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-xs min-w-[26px] text-center ${GRADE_COLORS[g.value] || ''}`}
                                                            >
                                                                {g.type === 'VERBAL' ? 'S' : g.value}
                                                            </Badge>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-xs font-medium">{g.description || g.category || '—'}</span>
                                                                {g.verbalText && (
                                                                    <p className="text-xs text-muted-foreground italic truncate">{g.verbalText}</p>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                                w:{g.weight} | {new Date(g.date).toLocaleDateString('cs-CZ')}
                                                            </span>
                                                            <div className="flex gap-1">
                                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEditDialog(g)}>
                                                                    <Pencil className="h-3 w-3" />
                                                                </Button>
                                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => handleDeleteGrade(g.id)}>
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                });
                            })()}

                            {studentGrades.length === 0 && (
                                <Card>
                                    <CardContent className="py-8 text-center text-muted-foreground">
                                        Žádné známky pro tohoto studenta.
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* ─── Add/Edit Grade Dialog ──────────────────── */}
            <Dialog
                open={!!addDialog || !!editDialog}
                onOpenChange={(open) => { if (!open) { setAddDialog(null); setEditDialog(null); } }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editDialog ? 'Upravit hodnocení' : 'Nové hodnocení'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3">
                        {/* Grade type */}
                        <div>
                            <Label>Typ hodnocení</Label>
                            <Select value={formType} onValueChange={setFormType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NUMERIC">Známka (1-5)</SelectItem>
                                    <SelectItem value="VERBAL">Slovní hodnocení</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Numeric grade */}
                        {formType === 'NUMERIC' && (
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Label>Známka *</Label>
                                    <Select value={formValue} onValueChange={setFormValue}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="1-5" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['1', '2', '3', '4', '5'].map(v => (
                                                <SelectItem key={v} value={v}>
                                                    {v} — {v === '1' ? 'výborný' : v === '2' ? 'chvalitebný' : v === '3' ? 'dobrý' : v === '4' ? 'dostatečný' : 'nedostatečný'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-20">
                                    <Label>Váha</Label>
                                    <Input
                                        type="number"
                                        min="0.1"
                                        max="1"
                                        step="0.1"
                                        value={formWeight}
                                        onChange={e => setFormWeight(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Category */}
                        <div>
                            <Label>Kategorie</Label>
                            <Select value={formCategory} onValueChange={setFormCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Vyberte kategorii..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">— Bez kategorie —</SelectItem>
                                    {CATEGORIES.map(c => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>

                            </Select>
                        </div>

                        {/* Description */}
                        <div>
                            <Label>Popis</Label>
                            <Input
                                value={formDescription}
                                onChange={e => setFormDescription(e.target.value)}
                                placeholder="Např. 'Pololetní písemka z matematiky'"
                            />
                        </div>

                        {/* Verbal text */}
                        <div>
                            <Label className="flex items-center gap-1">
                                Slovní hodnocení
                                {formType === 'VERBAL' && <span className="text-destructive">*</span>}
                            </Label>
                            <Textarea
                                value={formVerbalText}
                                onChange={e => setFormVerbalText(e.target.value)}
                                placeholder="Napište slovní hodnocení žáka..."
                                rows={3}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-1"
                                onClick={handleAiPolish}
                                disabled={polishing || !formVerbalText.trim()}
                            >
                                <Sparkles className="h-3 w-3 mr-1" />
                                {polishing ? 'AI zpracovává...' : 'Učesat pomocí AI'}
                            </Button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setAddDialog(null); setEditDialog(null); }}>
                            Zrušit
                        </Button>
                        {editDialog && (
                            <Button variant="destructive" size="sm" onClick={() => {
                                handleDeleteGrade(editDialog.id);
                                setEditDialog(null);
                            }}>
                                <Trash2 className="h-4 w-4 mr-1" /> Smazat
                            </Button>
                        )}
                        <Button onClick={editDialog ? handleUpdateGrade : handleCreateGrade} disabled={saving}>
                            {saving ? 'Ukládám...' : editDialog ? 'Aktualizovat' : 'Uložit známku'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
