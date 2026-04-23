import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '@/context/SchoolContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Calendar,
    Building2,
    Users,
    Plus,
    Save,
    Check,
    Loader2,
    AlertCircle,
    ExternalLink,
    Trash2,
    ChevronDown,
    ChevronRight,
    BookOpen,
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

    useEffect(() => {
        fetchBaseData();
    }, [fetchBaseData]);

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
                            <>
                                {' '}
                                —{' '}
                                <Badge variant="outline" className="ml-1">
                                    {selectedYear.name}
                                </Badge>
                            </>
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
            setYearName('');
            setStartDate('');
            setEndDate('');
            setIsCurrent(false);
            setSelectedCvId('');
            setShowForm(false);
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
                            <Input
                                placeholder={t('year_setup.name_placeholder')}
                                value={yearName}
                                onChange={(e) => setYearName(e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground">
                                        {t('year_setup.start_label')}
                                    </label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">{t('year_setup.end_label')}</label>
                                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">
                                    {t('year_setup.svp_version_label')}
                                </label>
                                <select
                                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                    value={selectedCvId}
                                    onChange={(e) => setSelectedCvId(e.target.value)}
                                >
                                    <option value="">{t('year_setup.no_svp_selected')}</option>
                                    {curriculumVersions.map((cv) => (
                                        <option key={cv.id} value={cv.id}>
                                            {cv.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isCurrent}
                                    onChange={(e) => setIsCurrent(e.target.checked)}
                                    className="rounded"
                                />
                                {t('year_setup.set_as_current')}
                            </label>
                            <div className="flex gap-2">
                                <Button size="sm" onClick={handleCreateYear} disabled={saving}>
                                    {saving ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-1" />
                                    )}
                                    {t('year_setup.create_button')}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                                    {t('common.cancel')}
                                </Button>
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
                                    className={`w-full text-left p-3 rounded-lg border transition-all hover:border-primary/50 ${
                                        selectedYear?.id === year.id
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
                                        {new Date(year.startDate).toLocaleDateString('cs')} —{' '}
                                        {new Date(year.endDate).toLocaleDateString('cs')}
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
                            <CardDescription>
                                {t('year_setup.grade_levels_readonly_hint', 'Ročníky se spravují ve Správě ŠVP.')}
                            </CardDescription>
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

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

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
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t('year_setup.rooms_capacities')}</CardTitle>
                <CardDescription>{t('year_setup.rooms_edit_hint')}</CardDescription>
            </CardHeader>
            <CardContent>
                {rooms.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{t('year_setup.no_rooms')}</p>
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
                                <TableRow
                                    key={room.id}
                                    className="cursor-pointer"
                                    onClick={() => !editingId && startEdit(room)}
                                >
                                    <TableCell className="font-medium">{room.name}</TableCell>
                                    <TableCell>
                                        {editingId === room.id ? (
                                            <Input
                                                type="number"
                                                className="h-8 w-20"
                                                value={editValues.capacity ?? ''}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) =>
                                                    setEditValues({
                                                        ...editValues,
                                                        capacity: parseInt(e.target.value) || 0,
                                                    })
                                                }
                                            />
                                        ) : (
                                            <span>{room.capacity}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingId === room.id ? (
                                            <label
                                                className="flex items-center gap-2 cursor-pointer"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={editValues.isComputerLab ?? false}
                                                    onChange={(e) =>
                                                        setEditValues({
                                                            ...editValues,
                                                            isComputerLab: e.target.checked,
                                                        })
                                                    }
                                                    className="rounded"
                                                />
                                                <span className="text-xs">{t('common.yes')}</span>
                                            </label>
                                        ) : (
                                            <Badge
                                                variant={room.isComputerLab ? 'default' : 'outline'}
                                                className="text-xs"
                                            >
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
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 px-2"
                                                    onClick={() => handleSave(room.id)}
                                                    disabled={saving}
                                                >
                                                    {saving ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Save className="h-4 w-4" />
                                                    )}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 px-2 text-muted-foreground"
                                                    onClick={() => setEditingId(null)}
                                                >
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
    const [staff, setStaff] = useState<any[]>([]);
    const [workloads, setWorkloads] = useState<any[]>([]);
    const [subjectTemplates, setSubjectTemplates] = useState<any[]>([]);
    const [gradeLevels, setGradeLevels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formUserId, setFormUserId] = useState('');
    const [formVersionLabel, setFormVersionLabel] = useState('');
    const [formValidFrom, setFormValidFrom] = useState('');
    const [formTeachingLoad, setFormTeachingLoad] = useState(100);
    const [formAdminLoad, setFormAdminLoad] = useState(0);
    const [formNote, setFormNote] = useState('');

    // Expanded rows for subject assignments
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editAssignments, setEditAssignments] = useState<
        Array<{
            subjectTemplateId: string;
            gradeLevelIds: string[];
            canSubstitute: boolean;
        }>
    >([]);
    const [savingAssignments, setSavingAssignments] = useState(false);

    // Editing inline
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<any>({});

    const fetchData = useCallback(async () => {
        if (!selectedYear) return;
        try {
            setLoading(true);
            const deputy = await import('@/api/deputy');
            const [staffData, wlData, tplData, glData] = await Promise.all([
                deputy.getSchoolStaff().catch(() => []),
                deputy.getStaffWorkloads(selectedYear.id).catch(() => []),
                deputy.getSubjectTemplatesForWorkloads().catch(() => []),
                deputy.getGradeLevels().catch(() => []),
            ]);
            setStaff(staffData);
            setWorkloads(wlData);
            setSubjectTemplates(tplData);
            setGradeLevels(glData.sort((a: any, b: any) => a.levelNumber - b.levelNumber));
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const resetForm = () => {
        setFormUserId('');
        setFormVersionLabel('');
        setFormValidFrom('');
        setFormTeachingLoad(100);
        setFormAdminLoad(0);
        setFormNote('');
        setShowForm(false);
    };

    const handleCreate = async () => {
        if (!selectedYear || !formUserId || !formVersionLabel || !formValidFrom) return;
        try {
            setSaving(true);
            const { createStaffWorkload } = await import('@/api/deputy');
            await createStaffWorkload({
                userId: formUserId,
                academicYearId: selectedYear.id,
                versionLabel: formVersionLabel,
                validFrom: formValidFrom,
                teachingLoad: formTeachingLoad / 100,
                adminLoad: formAdminLoad / 100,
                note: formNote || undefined,
            });
            resetForm();
            await fetchData();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { deleteStaffWorkload } = await import('@/api/deputy');
            await deleteStaffWorkload(id);
            await fetchData();
        } catch {
            /* ignore */
        }
    };

    const startEdit = (wl: any) => {
        setEditingId(wl.id);
        setEditValues({
            teachingLoad: Math.round(wl.teachingLoad * 100),
            adminLoad: Math.round(wl.adminLoad * 100),
            note: wl.note || '',
        });
    };

    const handleSaveEdit = async (id: string) => {
        try {
            setSaving(true);
            const { updateStaffWorkload } = await import('@/api/deputy');
            await updateStaffWorkload(id, {
                teachingLoad: editValues.teachingLoad / 100,
                adminLoad: editValues.adminLoad / 100,
                note: editValues.note || null,
            });
            setEditingId(null);
            await fetchData();
        } finally {
            setSaving(false);
        }
    };

    const toggleExpand = (wl: any) => {
        if (expandedId === wl.id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(wl.id);
        // Load current assignments into edit state
        setEditAssignments(
            (wl.subjectAssignments || []).map((a: any) => ({
                subjectTemplateId: a.subjectTemplateId,
                gradeLevelIds: Array.isArray(a.gradeLevelIds) ? a.gradeLevelIds : [],
                canSubstitute: a.canSubstitute,
            })),
        );
    };

    const addAssignment = () => {
        setEditAssignments((prev) => [...prev, { subjectTemplateId: '', gradeLevelIds: [], canSubstitute: false }]);
    };

    const removeAssignment = (index: number) => {
        setEditAssignments((prev) => prev.filter((_, i) => i !== index));
    };

    const updateAssignment = (index: number, field: string, value: any) => {
        setEditAssignments((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
    };

    const toggleGradeLevel = (index: number, glId: string) => {
        setEditAssignments((prev) =>
            prev.map((a, i) => {
                if (i !== index) return a;
                const ids = a.gradeLevelIds.includes(glId)
                    ? a.gradeLevelIds.filter((id) => id !== glId)
                    : [...a.gradeLevelIds, glId];
                return { ...a, gradeLevelIds: ids };
            }),
        );
    };

    const handleSaveAssignments = async () => {
        if (!expandedId) return;
        try {
            setSavingAssignments(true);
            const { saveStaffSubjectAssignments } = await import('@/api/deputy');
            await saveStaffSubjectAssignments(
                expandedId,
                editAssignments.filter((a) => a.subjectTemplateId),
            );
            await fetchData();
        } finally {
            setSavingAssignments(false);
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
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Group workloads by version label
    const versionLabels = [...new Set(workloads.map((w: any) => w.versionLabel))];
    const staffWithoutWorkload = staff.filter((s) => !workloads.some((w: any) => w.userId === s.id));

    const renderAssignmentEditor = (_wl: any) => {
        const usedTemplateIds = editAssignments.map((a) => a.subjectTemplateId).filter(Boolean);
        return (
            <div className="p-4 bg-muted/20 border-t space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        {t('year_setup.subject_assignments', 'Přiřazené předměty')}
                    </h4>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={addAssignment}>
                            <Plus className="h-3 w-3 mr-1" /> {t('year_setup.add_subject', 'Přidat předmět')}
                        </Button>
                        <Button size="sm" onClick={handleSaveAssignments} disabled={savingAssignments}>
                            {savingAssignments ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                                <Save className="h-3 w-3 mr-1" />
                            )}
                            {t('common.save', 'Uložit')}
                        </Button>
                    </div>
                </div>

                {editAssignments.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                        {t('year_setup.no_subject_assignments', 'Žádné přiřazené předměty.')}
                    </p>
                ) : (
                    <div className="space-y-3">
                        {editAssignments.map((assignment, index) => (
                            <div key={index} className="border rounded-lg p-3 bg-card space-y-2">
                                <div className="flex items-center gap-2">
                                    <select
                                        className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-sm"
                                        value={assignment.subjectTemplateId}
                                        onChange={(e) => updateAssignment(index, 'subjectTemplateId', e.target.value)}
                                    >
                                        <option value="">{t('year_setup.select_subject', 'Vyberte předmět...')}</option>
                                        {subjectTemplates
                                            .filter(
                                                (tpl: any) =>
                                                    tpl.id === assignment.subjectTemplateId ||
                                                    !usedTemplateIds.includes(tpl.id),
                                            )
                                            .map((tpl: any) => (
                                                <option key={tpl.id} value={tpl.id}>
                                                    {tpl.name} ({tpl.code})
                                                </option>
                                            ))}
                                    </select>
                                    <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={assignment.canSubstitute}
                                            onChange={(e) => updateAssignment(index, 'canSubstitute', e.target.checked)}
                                            className="rounded"
                                        />
                                        {t('year_setup.can_substitute', 'Může suplovat')}
                                    </label>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2 text-destructive"
                                        onClick={() => removeAssignment(index)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    <span className="text-xs text-muted-foreground mr-1 self-center">
                                        {t('year_setup.grade_levels_label', 'Ročníky:')}
                                    </span>
                                    {gradeLevels.map((gl: any) => (
                                        <button
                                            key={gl.id}
                                            type="button"
                                            className={`inline-flex items-center justify-center h-7 min-w-[2rem] px-2 rounded-md text-xs font-medium border transition-colors ${
                                                assignment.gradeLevelIds.includes(gl.id)
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'bg-background text-muted-foreground border-input hover:bg-muted'
                                            }`}
                                            onClick={() => toggleGradeLevel(index, gl.id)}
                                        >
                                            {gl.levelNumber}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Create workload */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">
                                {t('year_setup.staff_workloads', 'Úvazky zaměstnanců')}
                            </CardTitle>
                            <CardDescription>
                                {t(
                                    'year_setup.staff_workloads_desc',
                                    'Spravujte úvazky zaměstnanců pro školní rok {{name}}.',
                                    { name: selectedYear.name },
                                )}
                            </CardDescription>
                        </div>
                        <Button size="sm" onClick={() => setShowForm(!showForm)}>
                            <Plus className="h-4 w-4 mr-1" /> {t('year_setup.new_workload', 'Nový úvazek')}
                        </Button>
                    </div>
                </CardHeader>

                {showForm && (
                    <CardContent className="border-t pt-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    {t('year_setup.employee', 'Zaměstnanec')}
                                </label>
                                <select
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                    value={formUserId}
                                    onChange={(e) => setFormUserId(e.target.value)}
                                >
                                    <option value="">
                                        {t('year_setup.select_employee', 'Vyberte zaměstnance...')}
                                    </option>
                                    {staff.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.lastName} {s.firstName} ({s.role})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    {t('year_setup.version_label', 'Označení verze')}
                                </label>
                                <Input
                                    placeholder={t('year_setup.version_label_placeholder', 'např. září 2025')}
                                    value={formVersionLabel}
                                    onChange={(e) => setFormVersionLabel(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    {t('year_setup.valid_from', 'Platnost od')}
                                </label>
                                <Input
                                    type="date"
                                    value={formValidFrom}
                                    onChange={(e) => setFormValidFrom(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                        {t('year_setup.teaching_load', 'Vyučování %')}
                                    </label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={formTeachingLoad}
                                        onChange={(e) => setFormTeachingLoad(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                        {t('year_setup.admin_load', 'Administrativa %')}
                                    </label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={formAdminLoad}
                                        onChange={(e) => setFormAdminLoad(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    {t('year_setup.note', 'Poznámka')}
                                </label>
                                <Input
                                    placeholder={t('year_setup.note_placeholder', 'Volitelná poznámka...')}
                                    value={formNote}
                                    onChange={(e) => setFormNote(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button
                                onClick={handleCreate}
                                disabled={saving || !formUserId || !formVersionLabel || !formValidFrom}
                            >
                                {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                    <Save className="h-4 w-4 mr-1" />
                                )}
                                {t('year_setup.create_workload', 'Vytvořit úvazek')}
                            </Button>
                            <Button variant="ghost" onClick={resetForm}>
                                {t('common.cancel', 'Zrušit')}
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Workload list */}
            {workloads.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                        {staffWithoutWorkload.length > 0
                            ? t(
                                  'year_setup.no_workloads_yet',
                                  'Zatím nejsou vytvořeny žádné úvazky. Klikněte na "Nový úvazek" výše.',
                              )
                            : t('year_setup.no_staff', 'V této škole nejsou žádní zaměstnanci.')}
                    </CardContent>
                </Card>
            ) : (
                versionLabels.map((label) => {
                    const versionWorkloads = workloads.filter((w: any) => w.versionLabel === label);
                    return (
                        <Card key={label}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                        {label}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {t('year_setup.workload_count', '{{count}} záznamů', {
                                            count: versionWorkloads.length,
                                        })}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[40px]" />
                                            <TableHead>{t('year_setup.employee', 'Zaměstnanec')}</TableHead>
                                            <TableHead className="w-[100px] text-center">
                                                {t('year_setup.teaching_short', 'Vyuč.')}
                                            </TableHead>
                                            <TableHead className="w-[100px] text-center">
                                                {t('year_setup.admin_short', 'Admin.')}
                                            </TableHead>
                                            <TableHead className="w-[100px] text-center">
                                                {t('year_setup.total_short', 'Celkem')}
                                            </TableHead>
                                            <TableHead className="w-[80px] text-center">
                                                {t('year_setup.subjects_count', 'Předm.')}
                                            </TableHead>
                                            <TableHead className="w-[120px]" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {versionWorkloads.map((wl: any) => {
                                            const totalLoad = Math.round((wl.teachingLoad + wl.adminLoad) * 100);
                                            const isExpanded = expandedId === wl.id;
                                            const isEditing = editingId === wl.id;
                                            return (
                                                <>
                                                    <TableRow
                                                        key={wl.id}
                                                        className="cursor-pointer hover:bg-muted/50"
                                                        onClick={() => toggleExpand(wl)}
                                                    >
                                                        <TableCell className="px-2">
                                                            {isExpanded ? (
                                                                <ChevronDown className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4" />
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            <div>
                                                                {wl.user.lastName} {wl.user.firstName}
                                                                {wl.note && (
                                                                    <span className="text-xs text-muted-foreground ml-2">
                                                                        ({wl.note})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell
                                                            className="text-center"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!isEditing) startEdit(wl);
                                                            }}
                                                        >
                                                            {isEditing ? (
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    className="h-7 w-16 mx-auto text-center text-xs"
                                                                    value={editValues.teachingLoad}
                                                                    onChange={(e) =>
                                                                        setEditValues({
                                                                            ...editValues,
                                                                            teachingLoad:
                                                                                parseFloat(e.target.value) || 0,
                                                                        })
                                                                    }
                                                                />
                                                            ) : (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {Math.round(wl.teachingLoad * 100)}%
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell
                                                            className="text-center"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!isEditing) startEdit(wl);
                                                            }}
                                                        >
                                                            {isEditing ? (
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    className="h-7 w-16 mx-auto text-center text-xs"
                                                                    value={editValues.adminLoad}
                                                                    onChange={(e) =>
                                                                        setEditValues({
                                                                            ...editValues,
                                                                            adminLoad: parseFloat(e.target.value) || 0,
                                                                        })
                                                                    }
                                                                />
                                                            ) : (
                                                                <Badge variant="outline" className="text-xs">
                                                                    {Math.round(wl.adminLoad * 100)}%
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <span
                                                                className={`text-sm font-bold ${totalLoad > 100 ? 'text-destructive' : 'text-primary'}`}
                                                            >
                                                                {totalLoad}%
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="outline" className="text-xs">
                                                                {wl.subjectAssignments?.length || 0}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex gap-1 justify-end">
                                                                {isEditing ? (
                                                                    <>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-7 px-2"
                                                                            onClick={() => handleSaveEdit(wl.id)}
                                                                            disabled={saving}
                                                                        >
                                                                            {saving ? (
                                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                            ) : (
                                                                                <Check className="h-3 w-3 text-emerald-500" />
                                                                            )}
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-7 px-2"
                                                                            onClick={() => setEditingId(null)}
                                                                        >
                                                                            ✕
                                                                        </Button>
                                                                    </>
                                                                ) : (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-7 px-2 text-destructive hover:text-destructive"
                                                                        onClick={() => handleDelete(wl.id)}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                    {isExpanded && (
                                                        <TableRow key={`${wl.id}-expand`}>
                                                            <TableCell colSpan={7} className="p-0">
                                                                {renderAssignmentEditor(wl)}
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    );
                })
            )}
        </div>
    );
}
