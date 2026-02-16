import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
    Calendar, Building2, Users, Plus, Save, Check, Loader2, AlertCircle, ExternalLink,
} from 'lucide-react';
import {
    getAcademicYears,
    createAcademicYear,
    getGradeLevels,
    getRooms,
    updateRoom,
    getCurriculumVersions,
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

interface CurriculumVersionSimple {
    id: string;
    name: string;
    validFrom: string;
    validTo: string | null;
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export function DeputyYearSetup() {
    const { t } = useTranslation();
    const { currentSchool } = useSchool();

    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
    const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);
    const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
    const [curriculumVersions, setCurriculumVersions] = useState<CurriculumVersionSimple[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchBaseData = useCallback(async () => {
        try {
            setLoading(true);
            const [years, levels, cvs] = await Promise.all([
                getAcademicYears().catch(() => []),
                getGradeLevels().catch(() => []),
                getCurriculumVersions().catch(() => []),
            ]);
            setAcademicYears(years);
            setGradeLevels(levels);
            setCurriculumVersions(cvs);
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
                    <h1 className="text-2xl font-bold tracking-tight">{t('year_setup.title')}</h1>
                    <p className="text-muted-foreground mt-1">
                        {currentSchool?.name ?? t('year_setup.school_label')}
                        {selectedYear && (
                            <> — <Badge variant="outline" className="ml-1">{selectedYear.name}</Badge></>
                        )}
                    </p>
                </div>
                {selectedYear?.isCurrent && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <Check className="mr-1 h-3 w-3" /> {t('year_setup.current_year')}
                    </Badge>
                )}
            </div>

            {/* ─── Wizard Tabs ─────────────────────────────── */}
            <Tabs defaultValue="year" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 h-12">
                    <TabsTrigger value="year" className="gap-2 text-xs sm:text-sm">
                        <Calendar className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('year_setup.tab_year')}</span>
                        <span className="sm:hidden">{t('year_setup.tab_year_short')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="rooms" className="gap-2 text-xs sm:text-sm">
                        <Building2 className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('year_setup.tab_rooms')}</span>
                        <span className="sm:hidden">{t('year_setup.tab_rooms_short')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="teachers" className="gap-2 text-xs sm:text-sm">
                        <Users className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('year_setup.tab_workloads')}</span>
                        <span className="sm:hidden">{t('year_setup.tab_workloads_short')}</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="year">
                    <StepAcademicYear
                        academicYears={academicYears}
                        selectedYear={selectedYear}
                        gradeLevels={gradeLevels}
                        curriculumVersions={curriculumVersions}
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
    curriculumVersions,
    onSelectYear,
    onRefresh,
}: {
    academicYears: AcademicYear[];
    selectedYear: AcademicYear | null;
    gradeLevels: GradeLevel[];
    curriculumVersions: CurriculumVersionSimple[];
    onSelectYear: (y: AcademicYear) => void;
    onRefresh: () => Promise<void>;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [showForm, setShowForm] = useState(false);
    const [yearName, setYearName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isCurrent, setIsCurrent] = useState(false);
    const [selectedCvId, setSelectedCvId] = useState('');
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState('');

    const handleCreateYear = async () => {
        if (!yearName || !startDate || !endDate) return;
        try {
            setSaving(true);
            setError('');
            await createAcademicYear({
                name: yearName,
                startDate,
                endDate,
                isCurrent,
                curriculumVersionId: selectedCvId || undefined,
            });
            setYearName(''); setStartDate(''); setEndDate('');
            setIsCurrent(false); setSelectedCvId(''); setShowForm(false);
            await onRefresh();
        } catch (err: any) {
            setError(err.response?.data?.message || t('year_setup.create_year_error'));
        } finally {
            setSaving(false);
        }
    };



    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Academic Years */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">{t('year_setup.academic_years')}</CardTitle>
                            <CardDescription>{t('year_setup.select_or_create_year')}</CardDescription>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
                            <Plus className="h-4 w-4 mr-1" /> {t('year_setup.new_button')}
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
                            <Input placeholder={t('year_setup.name_placeholder')} value={yearName} onChange={(e) => setYearName(e.target.value)} />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground">{t('year_setup.start_label')}</label>
                                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">{t('year_setup.end_label')}</label>
                                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">{t('year_setup.svp_version_label')}</label>
                                <select
                                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                    value={selectedCvId}
                                    onChange={(e) => setSelectedCvId(e.target.value)}
                                >
                                    <option value="">{t('year_setup.no_svp_selected')}</option>
                                    {curriculumVersions.map((cv) => (
                                        <option key={cv.id} value={cv.id}>{cv.name}</option>
                                    ))}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} className="rounded" />
                                {t('year_setup.set_as_current')}
                            </label>
                            <div className="flex gap-2">
                                <Button size="sm" onClick={handleCreateYear} disabled={saving}>
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                    {t('year_setup.create_button')}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
                            </div>
                        </div>
                    )}

                    {academicYears.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">{t('year_setup.no_years')}</p>
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
                                                {t('year_setup.current_year')}
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

            {/* Grade Levels — read-only, managed in Správa ŠVP */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">{t('year_setup.grade_levels')}</CardTitle>
                            <CardDescription>{t('year_setup.grade_levels_readonly_hint', 'Ročníky se spravují ve Správě ŠVP.')}</CardDescription>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => navigate('/school/curriculum')}>
                            <ExternalLink className="h-4 w-4 mr-1" /> {t('year_setup.manage_in_svp', 'Spravovat')}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {gradeLevels.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">{t('year_setup.no_levels')}</p>
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
    const { t } = useTranslation();
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
                <CardTitle className="text-lg">{t('year_setup.rooms_capacities')}</CardTitle>
                <CardDescription>{t('year_setup.rooms_edit_hint')}</CardDescription>
            </CardHeader>
            <CardContent>
                {rooms.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        {t('year_setup.no_rooms')}
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('year_setup.room_column')}</TableHead>
                                <TableHead className="w-[120px]">{t('rooms.capacity_column')}</TableHead>
                                <TableHead className="w-[120px]">{t('year_setup.pc_lab_column')}</TableHead>
                                <TableHead className="w-[200px]">{t('rooms.equipment_column')}</TableHead>
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
                                                <span className="text-xs">{t('common.yes')}</span>
                                            </label>
                                        ) : (
                                            <Badge variant={room.isComputerLab ? 'default' : 'outline'} className="text-xs">
                                                {room.isComputerLab ? t('common.yes') : t('common.no')}
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
    const { t } = useTranslation();
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
                    {t('year_setup.select_year_first')}
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
                <CardTitle className="text-lg">{t('year_setup.teacher_workloads')}</CardTitle>
                <CardDescription>
                    {t('year_setup.set_workload_for_year', { name: selectedYear.name })}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {teachers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{t('year_setup.no_teachers')}</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('year_setup.teacher_column')}</TableHead>
                                <TableHead>{t('common.email')}</TableHead>
                                <TableHead className="w-[150px]">{t('year_setup.workload_percent')}</TableHead>
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


