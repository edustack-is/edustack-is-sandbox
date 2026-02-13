import { useState, useEffect, useCallback } from 'react';
import { useSchool } from '@/context/SchoolContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Calendar, BookOpen, Building2, Users, Plus, Save, Check, Loader2, AlertCircle,
} from 'lucide-react';
import {
    getAcademicYears,
    createAcademicYear,
    getGradeLevels,
    createGradeLevel,
    getRooms,
    updateRoom,
    getSubjectTemplates,
    getSubjectInstances,
    createSubjectInstance,
} from '@/api/deputy';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface AcademicYear {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
}

interface GradeLevel {
    id: string;
    name: string;
    levelNumber: number;
}

interface Room {
    id: string;
    name: string;
    capacity: number;
    isComputerLab: boolean;
    specialEquipment: string[] | undefined;
}

interface SubjectTemplate {
    id: string;
    name: string;
    code: string;
    svpDescription?: string;
}

interface SubjectInstance {
    id: string;
    templateId: string;
    gradeLevelId: string;
    hoursPerWeek: number;
    template?: SubjectTemplate;
    gradeLevel?: GradeLevel;
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export function DeputyYearSetup() {
    const { currentSchool } = useSchool();

    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
    const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);
    const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchBaseData = useCallback(async () => {
        try {
            setLoading(true);
            const [years, levels] = await Promise.all([
                getAcademicYears().catch(() => []),
                getGradeLevels().catch(() => []),
            ]);
            setAcademicYears(years);
            setGradeLevels(levels);
            // Auto-select current year
            const current = years.find((y: AcademicYear) => y.isCurrent);
            if (current) setSelectedYear(current);
            else if (years.length > 0) setSelectedYear(years[0]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchBaseData(); }, [fetchBaseData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ─── Context Header ─────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Příprava školního roku</h1>
                    <p className="text-muted-foreground mt-1">
                        {currentSchool?.name ?? 'Škola'}
                        {selectedYear && (
                            <> — <Badge variant="outline" className="ml-1">{selectedYear.name}</Badge></>
                        )}
                    </p>
                </div>
                {selectedYear?.isCurrent && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <Check className="mr-1 h-3 w-3" /> Aktuální rok
                    </Badge>
                )}
            </div>

            {/* ─── Wizard Tabs ─────────────────────────────── */}
            <Tabs defaultValue="year" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 h-12">
                    <TabsTrigger value="year" className="gap-2 text-xs sm:text-sm">
                        <Calendar className="h-4 w-4" />
                        <span className="hidden sm:inline">Rok & Ročníky</span>
                        <span className="sm:hidden">Rok</span>
                    </TabsTrigger>
                    <TabsTrigger value="rooms" className="gap-2 text-xs sm:text-sm">
                        <Building2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Místnosti</span>
                        <span className="sm:hidden">Míst.</span>
                    </TabsTrigger>
                    <TabsTrigger value="teachers" className="gap-2 text-xs sm:text-sm">
                        <Users className="h-4 w-4" />
                        <span className="hidden sm:inline">Úvazky</span>
                        <span className="sm:hidden">Úvaz.</span>
                    </TabsTrigger>
                    <TabsTrigger value="curriculum" className="gap-2 text-xs sm:text-sm">
                        <BookOpen className="h-4 w-4" />
                        <span className="hidden sm:inline">ŠVP Kurikulum</span>
                        <span className="sm:hidden">ŠVP</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="year">
                    <StepAcademicYear
                        academicYears={academicYears}
                        selectedYear={selectedYear}
                        gradeLevels={gradeLevels}
                        onSelectYear={setSelectedYear}
                        onRefresh={fetchBaseData}
                    />
                </TabsContent>

                <TabsContent value="rooms">
                    <StepRooms />
                </TabsContent>

                <TabsContent value="teachers">
                    <StepTeacherWorkloads selectedYear={selectedYear} />
                </TabsContent>

                <TabsContent value="curriculum">
                    <StepCurriculum selectedYear={selectedYear} gradeLevels={gradeLevels} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// STEP 1: Academic Year & Grade Levels
// ═══════════════════════════════════════════════════════════════

function StepAcademicYear({
    academicYears,
    selectedYear,
    gradeLevels,
    onSelectYear,
    onRefresh,
}: {
    academicYears: AcademicYear[];
    selectedYear: AcademicYear | null;
    gradeLevels: GradeLevel[];
    onSelectYear: (y: AcademicYear) => void;
    onRefresh: () => Promise<void>;
}) {
    const [showForm, setShowForm] = useState(false);
    const [yearName, setYearName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isCurrent, setIsCurrent] = useState(false);
    const [saving, setSaving] = useState(false);

    const [showLevelForm, setShowLevelForm] = useState(false);
    const [levelName, setLevelName] = useState('');
    const [levelNumber, setLevelNumber] = useState('');
    const [savingLevel, setSavingLevel] = useState(false);

    const [error, setError] = useState('');

    const handleCreateYear = async () => {
        if (!yearName || !startDate || !endDate) return;
        try {
            setSaving(true);
            setError('');
            await createAcademicYear({ name: yearName, startDate, endDate, isCurrent });
            setYearName(''); setStartDate(''); setEndDate('');
            setIsCurrent(false); setShowForm(false);
            await onRefresh();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Chyba při vytváření roku.');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateLevel = async () => {
        if (!levelName || !levelNumber) return;
        try {
            setSavingLevel(true);
            setError('');
            await createGradeLevel({ name: levelName, levelNumber: parseInt(levelNumber) });
            setLevelName(''); setLevelNumber(''); setShowLevelForm(false);
            await onRefresh();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Chyba při vytváření ročníku.');
        } finally {
            setSavingLevel(false);
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Academic Years */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Školní roky</CardTitle>
                            <CardDescription>Vyberte nebo vytvořte školní rok</CardDescription>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
                            <Plus className="h-4 w-4 mr-1" /> Nový
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {error && (
                        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                            <AlertCircle className="h-4 w-4" /> {error}
                        </div>
                    )}

                    {showForm && (
                        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                            <Input placeholder="Název (např. 2025/2026)" value={yearName} onChange={(e) => setYearName(e.target.value)} />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground">Začátek</label>
                                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">Konec</label>
                                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} className="rounded" />
                                Nastavit jako aktuální rok
                            </label>
                            <div className="flex gap-2">
                                <Button size="sm" onClick={handleCreateYear} disabled={saving}>
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                    Vytvořit
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Zrušit</Button>
                            </div>
                        </div>
                    )}

                    {academicYears.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Zatím žádné školní roky.</p>
                    ) : (
                        <div className="space-y-2">
                            {academicYears.map((year) => (
                                <button
                                    key={year.id}
                                    className={`w-full text-left p-3 rounded-lg border transition-all hover:border-primary/50 ${selectedYear?.id === year.id
                                        ? 'border-primary bg-primary/5 shadow-sm'
                                        : 'border-border'
                                        }`}
                                    onClick={() => onSelectYear(year)}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-sm">{year.name}</span>
                                        {year.isCurrent && (
                                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                                                Aktuální
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(year.startDate).toLocaleDateString('cs')} — {new Date(year.endDate).toLocaleDateString('cs')}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Grade Levels */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Ročníky (stupně)</CardTitle>
                            <CardDescription>Definujte aktivní ročníky školy</CardDescription>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setShowLevelForm(!showLevelForm)}>
                            <Plus className="h-4 w-4 mr-1" /> Nový
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {showLevelForm && (
                        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                            <Input placeholder="Název (např. 1. ročník)" value={levelName} onChange={(e) => setLevelName(e.target.value)} />
                            <Input type="number" placeholder="Číslo úrovně (pro řazení)" value={levelNumber} onChange={(e) => setLevelNumber(e.target.value)} />
                            <div className="flex gap-2">
                                <Button size="sm" onClick={handleCreateLevel} disabled={savingLevel}>
                                    {savingLevel ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                    Vytvořit
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setShowLevelForm(false)}>Zrušit</Button>
                            </div>
                        </div>
                    )}

                    {gradeLevels.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Zatím žádné ročníky.</p>
                    ) : (
                        <div className="space-y-2">
                            {gradeLevels
                                .sort((a, b) => a.levelNumber - b.levelNumber)
                                .map((level) => (
                                    <div
                                        key={level.id}
                                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                                                {level.levelNumber}
                                            </span>
                                            <span className="text-sm font-medium">{level.name}</span>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// STEP 2: Rooms & Capacities
// ═══════════════════════════════════════════════════════════════

function StepRooms() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<Room>>({});
    const [saving, setSaving] = useState(false);

    const fetchRooms = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getRooms().catch(() => []);
            setRooms(data);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRooms(); }, [fetchRooms]);

    const startEdit = (room: Room) => {
        setEditingId(room.id);
        setEditValues({ capacity: room.capacity, isComputerLab: room.isComputerLab });
    };

    const handleSave = async (id: string) => {
        try {
            setSaving(true);
            await updateRoom(id, editValues);
            setEditingId(null);
            await fetchRooms();
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Místnosti & kapacity</CardTitle>
                <CardDescription>Upravte kapacity a vybavení kliknutím na řádek</CardDescription>
            </CardHeader>
            <CardContent>
                {rooms.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        Žádné místnosti. Vytvořte je v sekci <strong>Správa školy</strong>.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Místnost</TableHead>
                                <TableHead className="w-[120px]">Kapacita</TableHead>
                                <TableHead className="w-[120px]">PC učebna</TableHead>
                                <TableHead className="w-[200px]">Vybavení</TableHead>
                                <TableHead className="w-[100px]" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rooms.map((room) => (
                                <TableRow key={room.id} className="cursor-pointer" onClick={() => !editingId && startEdit(room)}>
                                    <TableCell className="font-medium">{room.name}</TableCell>
                                    <TableCell>
                                        {editingId === room.id ? (
                                            <Input
                                                type="number"
                                                className="h-8 w-20"
                                                value={editValues.capacity ?? ''}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => setEditValues({ ...editValues, capacity: parseInt(e.target.value) || 0 })}
                                            />
                                        ) : (
                                            <span>{room.capacity}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingId === room.id ? (
                                            <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={editValues.isComputerLab ?? false}
                                                    onChange={(e) => setEditValues({ ...editValues, isComputerLab: e.target.checked })}
                                                    className="rounded"
                                                />
                                                <span className="text-xs">Ano</span>
                                            </label>
                                        ) : (
                                            <Badge variant={room.isComputerLab ? 'default' : 'outline'} className="text-xs">
                                                {room.isComputerLab ? 'Ano' : 'Ne'}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs text-muted-foreground">
                                            {room.specialEquipment?.length
                                                ? (room.specialEquipment as string[]).join(', ')
                                                : '—'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {editingId === room.id && (
                                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => handleSave(room.id)} disabled={saving}>
                                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground" onClick={() => setEditingId(null)}>
                                                    ✕
                                                </Button>
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
    );
}

// ═══════════════════════════════════════════════════════════════
// STEP 3: Teacher Workloads
// ═══════════════════════════════════════════════════════════════

function StepTeacherWorkloads({ selectedYear }: { selectedYear: AcademicYear | null }) {
    const [teachers, setTeachers] = useState<any[]>([]);
    const [workloads, setWorkloads] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [saved, setSaved] = useState<Record<string, boolean>>({});

    const fetchData = useCallback(async () => {
        if (!selectedYear) return;
        try {
            setLoading(true);
            const teacherData = await import('@/api/deputy').then((m) => m.getTeachers()).catch(() => []);
            setTeachers(teacherData);

            const workloadData = await import('@/api/deputy').then((m) => m.getTeacherWorkloads(selectedYear.id)).catch(() => []);
            const map: Record<string, number> = {};
            for (const w of workloadData) {
                map[w.teacherId] = w.workloadPercentage * 100;
            }
            setWorkloads(map);
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (teacherId: string) => {
        if (!selectedYear) return;
        try {
            setSaving(teacherId);
            const { saveTeacherWorkload } = await import('@/api/deputy');
            await saveTeacherWorkload({
                teacherId,
                academicYearId: selectedYear.id,
                workloadPercentage: (workloads[teacherId] ?? 100) / 100,
            });
            setSaved((prev) => ({ ...prev, [teacherId]: true }));
            setTimeout(() => setSaved((prev) => ({ ...prev, [teacherId]: false })), 2000);
        } finally {
            setSaving(null);
        }
    };

    if (!selectedYear) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                    Nejprve vyberte školní rok v záložce „Rok & Ročníky".
                </CardContent>
            </Card>
        );
    }

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Úvazky učitelů</CardTitle>
                <CardDescription>
                    Nastavte pracovní úvazek pro rok <strong>{selectedYear.name}</strong>
                </CardDescription>
            </CardHeader>
            <CardContent>
                {teachers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Žádní učitelé nalezeni.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Učitel</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead className="w-[150px]">Úvazek (%)</TableHead>
                                <TableHead className="w-[100px]" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teachers.map((teacher: any) => {
                                const teacherId = teacher.teacherProfile?.id || teacher.id;
                                return (
                                    <TableRow key={teacherId}>
                                        <TableCell className="font-medium">
                                            {teacher.firstName} {teacher.lastName}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{teacher.email}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={200}
                                                    className="h-8 w-20"
                                                    value={workloads[teacherId] ?? 100}
                                                    onChange={(e) =>
                                                        setWorkloads((prev) => ({ ...prev, [teacherId]: parseFloat(e.target.value) || 0 }))
                                                    }
                                                />
                                                <span className="text-xs text-muted-foreground">%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8"
                                                onClick={() => handleSave(teacherId)}
                                                disabled={saving === teacherId}
                                            >
                                                {saving === teacherId ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : saved[teacherId] ? (
                                                    <Check className="h-4 w-4 text-emerald-500" />
                                                ) : (
                                                    <Save className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════════
// STEP 4: Curriculum (ŠVP) Matrix
// ═══════════════════════════════════════════════════════════════

function StepCurriculum({
    selectedYear,
    gradeLevels,
}: {
    selectedYear: AcademicYear | null;
    gradeLevels: GradeLevel[];
}) {
    const [templates, setTemplates] = useState<SubjectTemplate[]>([]);
    const [instances, setInstances] = useState<SubjectInstance[]>([]);
    const [loading, setLoading] = useState(true);
    const [cellValues, setCellValues] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState<string | null>(null);
    const [saved, setSaved] = useState<Record<string, boolean>>({});

    const sortedLevels = [...gradeLevels].sort((a, b) => a.levelNumber - b.levelNumber);

    const cellKey = (templateId: string, levelId: string) => `${templateId}__${levelId}`;

    const fetchData = useCallback(async () => {
        if (!selectedYear) return;
        try {
            setLoading(true);
            const [tpls, insts] = await Promise.all([
                getSubjectTemplates().catch(() => []),
                getSubjectInstances(selectedYear.id).catch(() => []),
            ]);
            setTemplates(tpls);
            setInstances(insts);

            // Pre-fill cell values from existing instances
            const values: Record<string, number> = {};
            for (const inst of insts) {
                values[cellKey(inst.templateId, inst.gradeLevelId)] = inst.hoursPerWeek;
            }
            setCellValues(values);
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSaveCell = async (templateId: string, gradeLevelId: string) => {
        if (!selectedYear) return;
        const key = cellKey(templateId, gradeLevelId);
        const hours = cellValues[key];
        if (!hours || hours < 1) return;

        try {
            setSaving(key);
            await createSubjectInstance({
                templateId,
                academicYearId: selectedYear.id,
                gradeLevelId,
                hoursPerWeek: hours,
            });
            setSaved((prev) => ({ ...prev, [key]: true }));
            setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 2000);
            await fetchData();
        } catch {
            // already exists or validation error — silently refresh
            await fetchData();
        } finally {
            setSaving(null);
        }
    };

    if (!selectedYear) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                    Nejprve vyberte školní rok v záložce „Rok & Ročníky".
                </CardContent>
            </Card>
        );
    }

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    if (templates.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    Žádné šablony předmětů. Vytvořte je přes správu školy (Předměty).
                </CardContent>
            </Card>
        );
    }

    if (sortedLevels.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    Žádné ročníky. Vytvořte je v záložce „Rok & Ročníky".
                </CardContent>
            </Card>
        );
    }

    // Calculate totals per grade level
    const totalPerLevel: Record<string, number> = {};
    for (const level of sortedLevels) {
        totalPerLevel[level.id] = 0;
        for (const tpl of templates) {
            totalPerLevel[level.id] += cellValues[cellKey(tpl.id, level.id)] || 0;
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Kurikulum (ŠVP)</CardTitle>
                <CardDescription>
                    Matice hodin/týden pro rok <strong>{selectedYear.name}</strong>.
                    Zadejte počet hodin a uložte kliknutím na <Save className="inline h-3 w-3" />.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky left-0 bg-card z-10 min-w-[180px]">Předmět</TableHead>
                                {sortedLevels.map((level) => (
                                    <TableHead key={level.id} className="text-center min-w-[110px]">
                                        <div className="flex flex-col items-center">
                                            <span className="font-medium">{level.name}</span>
                                            <span className="text-[10px] text-muted-foreground">h/týden</span>
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {templates.map((tpl) => (
                                <TableRow key={tpl.id}>
                                    <TableCell className="sticky left-0 bg-card z-10">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] font-mono">{tpl.code}</Badge>
                                            <span className="text-sm font-medium">{tpl.name}</span>
                                        </div>
                                    </TableCell>
                                    {sortedLevels.map((level) => {
                                        const key = cellKey(tpl.id, level.id);
                                        const existingInstance = instances.find(
                                            (i) => i.templateId === tpl.id && i.gradeLevelId === level.id
                                        );
                                        return (
                                            <TableCell key={level.id} className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={20}
                                                        className="h-8 w-16 text-center"
                                                        value={cellValues[key] ?? ''}
                                                        onChange={(e) =>
                                                            setCellValues((prev) => ({
                                                                ...prev,
                                                                [key]: parseInt(e.target.value) || 0,
                                                            }))
                                                        }
                                                    />
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => handleSaveCell(tpl.id, level.id)}
                                                        disabled={saving === key || (existingInstance?.hoursPerWeek === cellValues[key])}
                                                    >
                                                        {saving === key ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : saved[key] ? (
                                                            <Check className="h-3 w-3 text-emerald-500" />
                                                        ) : (
                                                            <Save className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}

                            {/* Totals row */}
                            <TableRow className="bg-muted/30 font-medium">
                                <TableCell className="sticky left-0 bg-muted/30 z-10 text-sm">
                                    Celkem hodin / týden
                                </TableCell>
                                {sortedLevels.map((level) => (
                                    <TableCell key={level.id} className="text-center">
                                        <span className={`text-sm font-bold ${totalPerLevel[level.id] > 30 ? 'text-destructive' : 'text-primary'}`}>
                                            {totalPerLevel[level.id] || '—'}
                                        </span>
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
