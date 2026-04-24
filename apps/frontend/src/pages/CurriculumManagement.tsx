import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import {
    Plus,
    Trash2,
    BookOpen,
    Save,
    Loader2,
    Check,
    Monitor,
    GraduationCap,
    FileText,
    Wrench,
    CalendarDays,
    History,
    ChevronDown,
    ChevronRight,
    Layers,
    Pencil,
    Sparkles,
    Copy,
    GitCompareArrows,
    ArrowUpDown,
    X,
    ArrowUp,
    ArrowDown,
    Minus,
    Equal,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import {
    getSubjectTemplates,
    createSubject,
    updateSubject,
    deleteSubject,
    getGradeLevels,
    createGradeLevel,
    updateGradeLevel,
    deleteGradeLevel,
    getCurriculumVersions,
    createCurriculumVersion,
    deleteCurriculumVersion,
    duplicateCurriculumVersion,
    compareCurriculumVersions,
    saveCurriculumEntry,
    deleteCurriculumEntry,
} from '../api/deputy';
import { RvpImportDialog } from '../components/RvpImportDialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// ─── Types ──────────────────────────────────────────────────────

interface SubjectTemplate {
    id: string;
    name: string;
    code: string;
    svpDescription: string | null;
    schoolId: string;
    curriculumVersionId?: string | null;
}

interface GradeLevel {
    id: string;
    name: string;
    levelNumber: number;
}

interface AcademicYear {
    id: string;
    name: string;
    isCurrent: boolean;
}

interface CurriculumEntry {
    id: string;
    curriculumVersionId: string;
    subjectTemplateId: string;
    gradeLevelId: string;
    hoursPerWeek: number;
    rvpDescription: string | null;
    svpApproach: string | null;
    equipmentRequirements: string[] | null;
    needsComputerLab: boolean;
    gradingType: string;
    gradeLevel?: GradeLevel;
    subjectTemplate?: SubjectTemplate;
}

interface CurriculumVersion {
    id: string;
    name: string;
    validFrom: string;
    validTo: string | null;
    entries: CurriculumEntry[];
    subjectTemplates?: SubjectTemplate[];
    academicYears?: AcademicYear[];
}

// ─── Component ──────────────────────────────────────────────────

export default function CurriculumManagement() {
    const { t } = useTranslation();
    const [subjects, setSubjects] = useState<SubjectTemplate[]>([]);
    const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
    const [versions, setVersions] = useState<CurriculumVersion[]>([]);
    const [loading, setLoading] = useState(true);

    // Selected version for editing
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

    // Active tab
    const [activeTab, setActiveTab] = useState<'versions' | 'subjects' | 'grades'>('versions');
    const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
    const [isCreatingSubject, setIsCreatingSubject] = useState(false);
    const [showRvpImport, setShowRvpImport] = useState(false);
    const [showCompare, setShowCompare] = useState(false);

    const subjectForm = useForm<{ name: string; code: string; svpDescription: string }>({
        defaultValues: { name: '', code: '', svpDescription: '' },
    });

    const sortedLevels = [...gradeLevels].sort((a, b) => a.levelNumber - b.levelNumber);
    const selectedVersion = versions.find((v) => v.id === selectedVersionId) || null;

    // ── Load all data ──────────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [subs, levels, vers] = await Promise.all([
                getSubjectTemplates().catch(() => []),
                getGradeLevels().catch(() => []),
                getCurriculumVersions().catch(() => []),
            ]);
            setSubjects(subs);
            setGradeLevels(levels);
            setVersions(vers);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ── Refresh just versions ──────────────────────────────
    const refreshVersions = useCallback(async () => {
        const vers = await getCurriculumVersions().catch(() => []);
        setVersions(vers);
    }, []);

    // ── Refresh just gradeLevels ──────────────────────────────
    const refreshGradeLevels = useCallback(async () => {
        const levels = await getGradeLevels().catch(() => []);
        setGradeLevels(levels);
    }, []);

    // ── Subject CRUD ───────────────────────────────────────
    const startEditSubject = (s: SubjectTemplate) => {
        setEditingSubjectId(s.id);
        setIsCreatingSubject(false);
        subjectForm.reset({ name: s.name, code: s.code, svpDescription: s.svpDescription || '' });
    };

    const startCreateSubject = () => {
        setEditingSubjectId(null);
        setIsCreatingSubject(true);
        subjectForm.reset({ name: '', code: '', svpDescription: '' });
    };

    const handleSubjectSubmit = subjectForm.handleSubmit(async (data) => {
        if (!data.name.trim() || !data.code.trim()) {
            toast.error(t('curriculum.name_code_required'));
            return;
        }
        try {
            const payload = {
                name: data.name.trim(),
                code: data.code.trim().toUpperCase(),
                svpDescription: data.svpDescription.trim() || undefined,
            };
            if (editingSubjectId) await updateSubject(editingSubjectId, payload);
            else await createSubject(payload);
            setEditingSubjectId(null);
            setIsCreatingSubject(false);
            await loadData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || t('common.error'));
        }
    });

    const handleDeleteSubject = async (id: string) => {
        const s = subjects.find((x) => x.id === id);
        if (!confirm(t('curriculum.delete_confirm', { name: s?.name }))) return;
        try {
            await deleteSubject(id);
            await loadData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || t('common.error'));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                {t('common.loading')}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t('curriculum.title')}</h1>
                    <p className="text-muted-foreground">{t('curriculum.subtitle')}</p>
                </div>
                <button
                    onClick={() => setShowRvpImport(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm"
                >
                    <Sparkles className="h-4 w-4" />
                    {t('rvp_import.btn_label')}
                </button>
            </div>

            {showRvpImport && <RvpImportDialog onClose={() => setShowRvpImport(false)} onImported={loadData} />}

            {showCompare && <VersionCompareDialog versions={versions} onClose={() => setShowCompare(false)} />}

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList>
                    <TabsTrigger value="versions" className="gap-1.5">
                        <History className="h-4 w-4" /> {t('curriculum.versions_title')}
                    </TabsTrigger>
                    <TabsTrigger value="subjects" className="gap-1.5">
                        <BookOpen className="h-4 w-4" /> {t('curriculum.subjects_catalog')}
                    </TabsTrigger>
                    <TabsTrigger value="grades" className="gap-1.5">
                        <Layers className="h-4 w-4" /> {t('curriculum.grade_levels_title')}
                    </TabsTrigger>
                </TabsList>

                {/* ══════════ VERSIONS TAB ══════════ */}
                <TabsContent value="versions" className="space-y-6 mt-4">
                    <VersionManager
                        versions={versions}
                        selectedVersionId={selectedVersionId}
                        onSelect={setSelectedVersionId}
                        onRefresh={refreshVersions}
                        onCompare={() => setShowCompare(true)}
                    />

                    {selectedVersion && (
                        <CurriculumEditor
                            version={selectedVersion}
                            subjects={subjects}
                            gradeLevels={sortedLevels}
                            onRefresh={refreshVersions}
                        />
                    )}
                </TabsContent>

                {/* ══════════ SUBJECTS CATALOG TAB ══════════ */}
                <TabsContent value="subjects" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg">{t('curriculum.subjects_catalog')}</CardTitle>
                                    <CardDescription>{t('curriculum.subjects_catalog_desc')}</CardDescription>
                                </div>
                                <Button size="sm" variant="outline" onClick={startCreateSubject}>
                                    <Plus className="h-3 w-3 mr-1" /> {t('curriculum.new_subject')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {isCreatingSubject && (
                                <SubjectFormInline
                                    form={subjectForm}
                                    onSubmit={handleSubjectSubmit}
                                    onCancel={() => setIsCreatingSubject(false)}
                                    isNew
                                />
                            )}
                            {subjects.length === 0 && !isCreatingSubject ? (
                                <div className="py-8 text-center text-muted-foreground text-sm">
                                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                    {t('curriculum.no_subjects')}
                                </div>
                            ) : (
                                subjects.map((s) =>
                                    editingSubjectId === s.id ? (
                                        <SubjectFormInline
                                            key={s.id}
                                            form={subjectForm}
                                            onSubmit={handleSubjectSubmit}
                                            onCancel={() => setEditingSubjectId(null)}
                                        />
                                    ) : (
                                        <div
                                            key={s.id}
                                            className="flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-muted/30 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {s.code}
                                                </Badge>
                                                <span className="font-medium text-sm">{s.name}</span>
                                                {s.svpDescription && (
                                                    <span className="text-xs text-muted-foreground truncate max-w-xs">
                                                        {s.svpDescription}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 px-2"
                                                    onClick={() => startEditSubject(s)}
                                                >
                                                    <FileText className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 px-2 text-destructive hover:text-destructive"
                                                    onClick={() => handleDeleteSubject(s.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ),
                                )
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ══════════ GRADE LEVELS TAB ══════════ */}
                <TabsContent value="grades" className="space-y-4 mt-4">
                    <GradeLevelManager gradeLevels={sortedLevels} onRefresh={refreshGradeLevels} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// Subject inline form
// ═══════════════════════════════════════════════════════════════

function SubjectFormInline({
    form,
    onSubmit,
    onCancel,
    isNew,
}: {
    form: any;
    onSubmit: () => void;
    onCancel: () => void;
    isNew?: boolean;
}) {
    const { t } = useTranslation();
    return (
        <form onSubmit={onSubmit} className="border rounded-lg p-4 bg-muted/20 space-y-3">
            <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs">{t('curriculum.subject_name')} *</Label>
                    <Input placeholder="e.g. Informatika" className="h-8" {...form.register('name')} />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">{t('curriculum.subject_code')} *</Label>
                    <Input placeholder="e.g. INF" className="h-8" {...form.register('code')} />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">{t('curriculum.svp_description')}</Label>
                    <Input
                        placeholder={t('curriculum.svp_placeholder_short')}
                        className="h-8"
                        {...form.register('svpDescription')}
                    />
                </div>
            </div>
            <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" size="sm">
                    <Save className="h-3 w-3 mr-1" />{' '}
                    {isNew ? t('curriculum.create_subject') : t('curriculum.save_changes')}
                </Button>
            </div>
        </form>
    );
}

// ═══════════════════════════════════════════════════════════════
// Grade Level Manager — global school-wide grade levels
// ═══════════════════════════════════════════════════════════════

function GradeLevelManager({ gradeLevels, onRefresh }: { gradeLevels: GradeLevel[]; onRefresh: () => Promise<void> }) {
    const { t } = useTranslation();
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newLevel, setNewLevel] = useState('');
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editLevel, setEditLevel] = useState('');

    const handleCreate = async () => {
        if (!newName.trim() || !newLevel) {
            toast.error(t('curriculum.grade_name_required'));
            return;
        }
        setCreating(true);
        try {
            await createGradeLevel({ name: newName.trim(), levelNumber: parseInt(newLevel) });
            setShowCreate(false);
            setNewName('');
            setNewLevel('');
            await onRefresh();
            toast.success(t('curriculum.grade_created'));
        } catch (error: any) {
            toast.error(error.response?.data?.message || t('common.error'));
        } finally {
            setCreating(false);
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editName.trim() || !editLevel) return;
        try {
            await updateGradeLevel(id, { name: editName.trim(), levelNumber: parseInt(editLevel) });
            setEditingId(null);
            await onRefresh();
        } catch (error: any) {
            toast.error(error.response?.data?.message || t('common.error'));
        }
    };

    const handleDelete = async (id: string) => {
        const gl = gradeLevels.find((x) => x.id === id);
        if (!confirm(t('curriculum.grade_delete_confirm', { name: gl?.name }))) return;
        try {
            await deleteGradeLevel(id);
            await onRefresh();
        } catch (error: any) {
            toast.error(error.response?.data?.message || t('common.error'));
        }
    };

    const startEdit = (gl: GradeLevel) => {
        setEditingId(gl.id);
        setEditName(gl.name);
        setEditLevel(String(gl.levelNumber));
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{t('curriculum.grade_levels_title')}</CardTitle>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)}>
                        <Plus className="h-3 w-3 mr-1" /> {t('curriculum.new_grade_level')}
                    </Button>
                </div>
                <CardDescription>{t('curriculum.grade_levels_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {showCreate && (
                    <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">{t('curriculum.grade_name')} *</Label>
                                <Input
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder={t('year_setup.level_name_placeholder')}
                                    className="h-8"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">{t('curriculum.grade_number')} *</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={13}
                                    value={newLevel}
                                    onChange={(e) => setNewLevel(e.target.value)}
                                    placeholder={t('year_setup.level_number_placeholder')}
                                    className="h-8"
                                />
                            </div>
                            <div className="flex items-end gap-1">
                                <Button size="sm" className="h-8" onClick={handleCreate} disabled={creating}>
                                    {creating ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Plus className="h-3 w-3 mr-1" />
                                    )}
                                    {t('common.create')}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowCreate(false)}>
                                    {t('common.cancel')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {gradeLevels.length === 0 && !showCreate ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                        <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        {t('year_setup.no_levels')}
                    </div>
                ) : (
                    gradeLevels.map((gl) =>
                        editingId === gl.id ? (
                            <div key={gl.id} className="border rounded-lg p-3 bg-muted/20">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">{t('curriculum.grade_name')}</Label>
                                        <Input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="h-8"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">{t('curriculum.grade_number')}</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={13}
                                            value={editLevel}
                                            onChange={(e) => setEditLevel(e.target.value)}
                                            className="h-8"
                                        />
                                    </div>
                                    <div className="flex items-end gap-1">
                                        <Button size="sm" className="h-8" onClick={() => handleUpdate(gl.id)}>
                                            <Save className="h-3 w-3 mr-1" /> {t('common.save')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8"
                                            onClick={() => setEditingId(null)}
                                        >
                                            {t('common.cancel')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div
                                key={gl.id}
                                className="flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-muted/30 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="font-mono text-xs w-8 justify-center">
                                        {gl.levelNumber}
                                    </Badge>
                                    <span className="font-medium text-sm">{gl.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2"
                                        onClick={() => startEdit(gl)}
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-destructive hover:text-destructive"
                                        onClick={() => handleDelete(gl.id)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ),
                    )
                )}
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════════
// Version Manager — school-wide ŠVP versions with date validity
// ═══════════════════════════════════════════════════════════════

function VersionManager({
    versions,
    selectedVersionId,
    onSelect,
    onRefresh,
    onCompare,
}: {
    versions: CurriculumVersion[];
    selectedVersionId: string | null;
    onSelect: (id: string | null) => void;
    onRefresh: () => Promise<void>;
    onCompare: () => void;
}) {
    const { t } = useTranslation();
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState('');
    const [validFrom, setValidFrom] = useState('');
    const [validTo, setValidTo] = useState('');
    const [creating, setCreating] = useState(false);

    // Duplicate state
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
    const [dupName, setDupName] = useState('');
    const [dupValidFrom, setDupValidFrom] = useState('');
    const [dupValidTo, setDupValidTo] = useState('');
    const [duplicating, setDuplicating] = useState(false);

    const handleCreate = async () => {
        if (!name.trim() || !validFrom) {
            toast.error(t('curriculum.version_name_required'));
            return;
        }
        setCreating(true);
        try {
            const created = await createCurriculumVersion({
                name: name.trim(),
                validFrom,
                validTo: validTo || undefined,
            });
            setShowCreate(false);
            setName('');
            setValidFrom('');
            setValidTo('');
            await onRefresh();
            onSelect(created.id);
            toast.success(t('curriculum.version_created'));
        } catch (error: any) {
            toast.error(error.response?.data?.message || t('common.error'));
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('curriculum.version_delete_confirm'))) return;
        try {
            await deleteCurriculumVersion(id);
            if (selectedVersionId === id) onSelect(null);
            await onRefresh();
            toast.success(t('curriculum.version_deleted'));
        } catch (error: any) {
            toast.error(error.response?.data?.message || t('common.error'));
        }
    };

    const startDuplicate = (v: CurriculumVersion) => {
        setDuplicatingId(v.id);
        const today = new Date().toISOString().split('T')[0];
        setDupName(`${v.name} (kopie)`);
        setDupValidFrom(today);
        setDupValidTo('');
    };

    const handleDuplicate = async () => {
        if (!duplicatingId || !dupName.trim() || !dupValidFrom) {
            toast.error(t('curriculum.version_name_required'));
            return;
        }
        setDuplicating(true);
        try {
            const created = await duplicateCurriculumVersion(duplicatingId, {
                name: dupName.trim(),
                validFrom: dupValidFrom,
                validTo: dupValidTo || undefined,
            });
            setDuplicatingId(null);
            await onRefresh();
            onSelect(created.id);
            toast.success(t('curriculum.version_duplicated', 'Verze byla úspěšně duplikována'));
        } catch (error: any) {
            toast.error(error.response?.data?.message || t('common.error'));
        } finally {
            setDuplicating(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{t('curriculum.versions_title')}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        {versions.length >= 2 && (
                            <Button size="sm" variant="outline" onClick={onCompare} className="gap-1.5">
                                <GitCompareArrows className="h-3 w-3" />
                                {t('curriculum.compare_versions', 'Porovnat verze')}
                            </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)}>
                            <Plus className="h-3 w-3 mr-1" /> {t('curriculum.new_version')}
                        </Button>
                    </div>
                </div>
                <CardDescription>{t('curriculum.versions_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {showCreate && (
                    <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
                        <div className="grid grid-cols-4 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">{t('curriculum.version_name')} *</Label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. ŠVP v1.0"
                                    className="h-8"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">{t('curriculum.valid_from')} *</Label>
                                <Input
                                    type="date"
                                    value={validFrom}
                                    onChange={(e) => setValidFrom(e.target.value)}
                                    className="h-8"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">{t('curriculum.valid_to')}</Label>
                                <Input
                                    type="date"
                                    value={validTo}
                                    onChange={(e) => setValidTo(e.target.value)}
                                    className="h-8"
                                />
                            </div>
                            <div className="flex items-end gap-1">
                                <Button size="sm" className="h-8" onClick={handleCreate} disabled={creating}>
                                    {creating ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Plus className="h-3 w-3 mr-1" />
                                    )}
                                    {t('curriculum.create_version')}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowCreate(false)}>
                                    {t('common.cancel')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {versions.length === 0 && !showCreate ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                        <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        {t('curriculum.no_versions')}
                    </div>
                ) : (
                    versions.map((v) => (
                        <div key={v.id}>
                            <div
                                onClick={() => onSelect(selectedVersionId === v.id ? null : v.id)}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-colors border cursor-pointer ${selectedVersionId === v.id ? 'bg-primary/5 border-primary/40' : 'border-transparent hover:bg-muted/50'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {selectedVersionId === v.id ? (
                                            <ChevronDown className="h-4 w-4 text-primary" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <div>
                                            <span className="font-medium text-sm">{v.name}</span>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                <CalendarDays className="h-3 w-3" />
                                                {formatDate(v.validFrom)}
                                                {v.validTo
                                                    ? ` → ${formatDate(v.validTo)}`
                                                    : ` → ${t('curriculum.indefinite')}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-xs">
                                            {v.entries.length} {t('curriculum.entries_count')}
                                        </Badge>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0"
                                            title={t('curriculum.duplicate_version', 'Duplikovat verzi')}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                startDuplicate(v);
                                            }}
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(v.id);
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Duplicate form inline */}
                            {duplicatingId === v.id && (
                                <div className="ml-8 mt-2 border rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                                        <Copy className="h-4 w-4" />
                                        {t('curriculum.duplicating_version', 'Duplikovat verzi')}: {v.name}
                                    </div>
                                    <div className="grid grid-cols-4 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">{t('curriculum.version_name')} *</Label>
                                            <Input
                                                value={dupName}
                                                onChange={(e) => setDupName(e.target.value)}
                                                className="h-8"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">{t('curriculum.valid_from')} *</Label>
                                            <Input
                                                type="date"
                                                value={dupValidFrom}
                                                onChange={(e) => setDupValidFrom(e.target.value)}
                                                className="h-8"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">{t('curriculum.valid_to')}</Label>
                                            <Input
                                                type="date"
                                                value={dupValidTo}
                                                onChange={(e) => setDupValidTo(e.target.value)}
                                                className="h-8"
                                            />
                                        </div>
                                        <div className="flex items-end gap-1">
                                            <Button
                                                size="sm"
                                                className="h-8"
                                                onClick={handleDuplicate}
                                                disabled={duplicating}
                                            >
                                                {duplicating ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Copy className="h-3 w-3 mr-1" />
                                                )}
                                                {t('curriculum.duplicate', 'Duplikovat')}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8"
                                                onClick={() => setDuplicatingId(null)}
                                            >
                                                {t('common.cancel')}
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {t(
                                            'curriculum.duplicate_hint',
                                            'Bude vytvořena nová verze ŠVP se všemi záznamy z vybrané verze.',
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════════
// Curriculum Editor — subject × grade matrix within a version
// ═══════════════════════════════════════════════════════════════

function CurriculumEditor({
    version,
    subjects,
    gradeLevels,
    onRefresh,
}: {
    version: CurriculumVersion;
    subjects: SubjectTemplate[];
    gradeLevels: GradeLevel[];
    onRefresh: () => Promise<void>;
}) {
    const { t } = useTranslation();

    // Currently editing entry
    // Currently editing entry (unused but kept for future)
    const [_editKey, _setEditKey] = useState<string | null>(null);

    // Find entry for subject×grade
    const getEntry = (subjectId: string, gradeId: string) =>
        version.entries.find((e) => e.subjectTemplateId === subjectId && e.gradeLevelId === gradeId);

    // Subjects that have at least one entry in this version
    const subjectsWithEntries = new Set(version.entries.map((e) => e.subjectTemplateId));
    // Show all subjects (catalog), marking which ones have entries
    const sortedSubjects = [...subjects].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">
                        {t('curriculum.editor_title')}: {version.name}
                    </CardTitle>
                </div>
                <CardDescription>{t('curriculum.editor_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
                {gradeLevels.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                        <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        {t('curriculum.no_grade_levels_hint')}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sortedSubjects.map((subject) => (
                            <SubjectRow
                                key={subject.id}
                                subject={subject}
                                version={version}
                                gradeLevels={gradeLevels}
                                hasEntries={subjectsWithEntries.has(subject.id)}
                                getEntry={getEntry}
                                onRefresh={onRefresh}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════════
// Subject Row — expandable row for a subject within the editor
// ═══════════════════════════════════════════════════════════════

function SubjectRow({
    subject,
    version,
    gradeLevels,
    hasEntries,
    getEntry,
    onRefresh,
}: {
    subject: SubjectTemplate;
    version: CurriculumVersion;
    gradeLevels: GradeLevel[];
    hasEntries: boolean;
    getEntry: (subjectId: string, gradeId: string) => CurriculumEntry | undefined;
    onRefresh: () => Promise<void>;
}) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const entriesForSubject = gradeLevels.filter((gl) => getEntry(subject.id, gl.id));

    return (
        <div className={`border rounded-lg transition-colors ${hasEntries ? 'border-primary/20' : ''}`}>
            {/* Subject header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/30 rounded-lg transition-colors"
            >
                <div className="flex items-center gap-3">
                    {expanded ? (
                        <ChevronDown className="h-4 w-4 text-primary" />
                    ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Badge variant="outline" className="font-mono text-xs">
                        {subject.code}
                    </Badge>
                    <span className="font-medium text-sm">{subject.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    {entriesForSubject.length > 0 && (
                        <div className="flex gap-1">
                            {entriesForSubject.map((gl) => {
                                const entry = getEntry(subject.id, gl.id)!;
                                return (
                                    <Badge key={gl.id} variant="secondary" className="text-[10px] px-1.5">
                                        {gl.name}: {entry.hoursPerWeek}h
                                    </Badge>
                                );
                            })}
                        </div>
                    )}
                    {!hasEntries && (
                        <span className="text-xs text-muted-foreground italic">{t('curriculum.not_in_plan')}</span>
                    )}
                </div>
            </button>

            {/* Grade tabs when expanded */}
            {expanded && (
                <div className="px-4 pb-4 border-t">
                    <Tabs defaultValue={gradeLevels[0]?.id} className="mt-3">
                        <TabsList className="flex flex-wrap h-auto gap-1">
                            {gradeLevels.map((gl) => {
                                const entry = getEntry(subject.id, gl.id);
                                return (
                                    <TabsTrigger key={gl.id} value={gl.id} className="gap-1.5 text-xs">
                                        {gl.name}
                                        {entry && <Check className="h-3 w-3 text-emerald-500" />}
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>

                        {gradeLevels.map((gl) => (
                            <TabsContent key={gl.id} value={gl.id} className="mt-3">
                                <EntryForm
                                    versionId={version.id}
                                    subjectId={subject.id}
                                    gradeLevelId={gl.id}
                                    existing={getEntry(subject.id, gl.id) || null}
                                    onRefresh={onRefresh}
                                />
                            </TabsContent>
                        ))}
                    </Tabs>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// Entry Form — RVP + ŠVP + Equipment per subject × grade
// ═══════════════════════════════════════════════════════════════

function EntryForm({
    versionId,
    subjectId,
    gradeLevelId,
    existing,
    onRefresh,
}: {
    versionId: string;
    subjectId: string;
    gradeLevelId: string;
    existing: CurriculumEntry | null;
    onRefresh: () => Promise<void>;
}) {
    const { t } = useTranslation();
    const [hours, setHours] = useState(existing?.hoursPerWeek || 0);
    const [rvp, setRvp] = useState(existing?.rvpDescription || '');
    const [svp, setSvp] = useState(existing?.svpApproach || '');
    const [equip, setEquip] = useState((existing?.equipmentRequirements || []).join(', '));
    const [computerLab, setComputerLab] = useState(existing?.needsComputerLab || false);
    const [gradingType, setGradingType] = useState(existing?.gradingType || 'BOTH');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Sync with existing when switching tabs
    useEffect(() => {
        setHours(existing?.hoursPerWeek || 0);
        setRvp(existing?.rvpDescription || '');
        setSvp(existing?.svpApproach || '');
        setEquip((existing?.equipmentRequirements || []).join(', '));
        setComputerLab(existing?.needsComputerLab || false);
        setGradingType(existing?.gradingType || 'BOTH');
        setSaved(false);
    }, [existing?.id, gradeLevelId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const equipment = equip
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            await saveCurriculumEntry({
                curriculumVersionId: versionId,
                subjectTemplateId: subjectId,
                gradeLevelId,
                hoursPerWeek: hours,
                rvpDescription: rvp || undefined,
                svpApproach: svp || undefined,
                equipmentRequirements: equipment.length > 0 ? equipment : undefined,
                needsComputerLab: computerLab,
                gradingType,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            await onRefresh();
            toast.success(t('curriculum.instance_saved'));
        } catch (error: any) {
            toast.error(error.response?.data?.message || t('common.error'));
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async () => {
        if (!existing) return;
        if (!confirm(t('curriculum.remove_entry_confirm'))) return;
        try {
            await deleteCurriculumEntry(existing.id);
            await onRefresh();
            toast.success(t('curriculum.entry_removed'));
        } catch (error: any) {
            toast.error(error.response?.data?.message || t('common.error'));
        }
    };

    return (
        <div className="space-y-4">
            {/* Hours + computer lab */}
            <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30">
                <Label className="font-medium whitespace-nowrap">{t('curriculum.hours_per_week')}</Label>
                <Input
                    type="number"
                    min={0}
                    max={20}
                    className="w-20 h-8"
                    value={hours}
                    onChange={(e) => setHours(parseInt(e.target.value) || 0)}
                />
                <span className="text-sm text-muted-foreground">{t('curriculum.hours_unit')}</span>
                <div className="ml-auto flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                            type="checkbox"
                            checked={computerLab}
                            onChange={(e) => setComputerLab(e.target.checked)}
                            className="rounded"
                        />
                        <Monitor className="h-4 w-4" /> {t('curriculum.needs_computer_lab')}
                    </label>
                </div>
            </div>

            {/* RVP + ŠVP */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <Label className="font-medium">{t('curriculum.rvp_label')}</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('curriculum.rvp_hint')}</p>
                    <Textarea
                        rows={5}
                        placeholder={t('curriculum.rvp_placeholder')}
                        value={rvp}
                        onChange={(e) => setRvp(e.target.value)}
                        className="text-sm"
                    />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-emerald-500" />
                        <Label className="font-medium">{t('curriculum.svp_label')}</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('curriculum.svp_hint')}</p>
                    <Textarea
                        rows={5}
                        placeholder={t('curriculum.svp_approach_placeholder')}
                        value={svp}
                        onChange={(e) => setSvp(e.target.value)}
                        className="text-sm"
                    />
                </div>
            </div>

            {/* Equipment */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-orange-500" />
                    <Label className="font-medium">{t('curriculum.equipment_label')}</Label>
                </div>
                <p className="text-xs text-muted-foreground">{t('curriculum.equipment_hint')}</p>
                <Input
                    placeholder={t('curriculum.equipment_placeholder')}
                    value={equip}
                    onChange={(e) => setEquip(e.target.value)}
                />
                {equip && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {equip.split(',').map(
                            (item, i) =>
                                item.trim() && (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                        {item.trim()}
                                    </Badge>
                                ),
                        )}
                    </div>
                )}
            </div>

            {/* Grading Type */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-purple-500" />
                    <Label className="font-medium">{t('curriculum.grading_type', 'Typ hodnocení')}</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                    {t(
                        'curriculum.grading_type_hint',
                        'Jaký typ hodnocení je povolen pro tento předmět v tomto ročníku?',
                    )}
                </p>
                <div className="flex gap-2">
                    {[
                        { value: 'NUMERIC_ONLY', label: 'Jen známky' },
                        { value: 'VERBAL_ONLY', label: 'Jen slovní' },
                        { value: 'BOTH', label: 'Obojí' },
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            className={`px-3 py-1.5 rounded-md text-sm border transition-all ${
                                gradingType === opt.value
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-muted/30 hover:bg-muted border-border text-muted-foreground'
                            }`}
                            onClick={() => setGradingType(opt.value)}
                            type="button"
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-2 border-t">
                {existing ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={handleRemove}
                    >
                        <Trash2 className="h-3 w-3 mr-1" /> {t('curriculum.remove_from_plan')}
                    </Button>
                ) : (
                    <div />
                )}
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : saved ? (
                        <Check className="h-4 w-4 text-emerald-500 mr-1" />
                    ) : (
                        <Save className="h-4 w-4 mr-1" />
                    )}
                    {existing ? t('curriculum.update_instance') : t('curriculum.create_instance')}
                </Button>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// Version Compare Dialog — diff between two ŠVP versions
// ═══════════════════════════════════════════════════════════════

function VersionCompareDialog({ versions, onClose }: { versions: CurriculumVersion[]; onClose: () => void }) {
    const { t } = useTranslation();
    const [versionAId, setVersionAId] = useState(versions[0]?.id || '');
    const [versionBId, setVersionBId] = useState(versions[1]?.id || '');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCompare = async () => {
        if (!versionAId || !versionBId) {
            toast.error(t('curriculum.select_both_versions', 'Vyberte obě verze'));
            return;
        }
        if (versionAId === versionBId) {
            toast.error(t('curriculum.same_version_error', 'Vyberte dvě různé verze'));
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await compareCurriculumVersions(versionAId, versionBId);
            setResult(data);
        } catch (err: any) {
            setError(err.response?.data?.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-8">
            <div className="bg-background rounded-xl shadow-2xl w-full max-w-5xl mx-4 border">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <GitCompareArrows className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">
                                {t('curriculum.compare_versions', 'Porovnání verzí ŠVP')}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {t('curriculum.compare_desc', 'Vyberte dvě verze pro porovnání rozdílů')}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Version selectors */}
                <div className="p-6 border-b">
                    <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-4 items-end">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">
                                {t('curriculum.version_a', 'Verze A (starší)')}
                            </Label>
                            <select
                                value={versionAId}
                                onChange={(e) => setVersionAId(e.target.value)}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {versions.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.name} ({formatDate(v.validFrom)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center justify-center pb-1">
                            <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">
                                {t('curriculum.version_b', 'Verze B (novější)')}
                            </Label>
                            <select
                                value={versionBId}
                                onChange={(e) => setVersionBId(e.target.value)}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {versions.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.name} ({formatDate(v.validFrom)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <Button onClick={handleCompare} disabled={loading} className="gap-1.5">
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <GitCompareArrows className="h-4 w-4" />
                            )}
                            {t('curriculum.compare', 'Porovnat')}
                        </Button>
                    </div>
                </div>

                {/* Results */}
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    {error && <div className="rounded-lg bg-destructive/10 text-destructive p-4 text-sm">{error}</div>}

                    {loading && (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" /> {t('common.loading')}
                        </div>
                    )}

                    {result && !loading && (
                        <>
                            {/* Summary */}
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                <SummaryCard
                                    label={t('curriculum.added', 'Přidáno')}
                                    value={result.summary.addedCount}
                                    icon={<Plus className="h-4 w-4" />}
                                    color="emerald"
                                />
                                <SummaryCard
                                    label={t('curriculum.removed_label', 'Odebráno')}
                                    value={result.summary.removedCount}
                                    icon={<Minus className="h-4 w-4" />}
                                    color="red"
                                />
                                <SummaryCard
                                    label={t('curriculum.changed_label', 'Změněno')}
                                    value={result.summary.changedCount}
                                    icon={<ArrowUpDown className="h-4 w-4" />}
                                    color="amber"
                                />
                                <SummaryCard
                                    label={t('curriculum.unchanged_label', 'Beze změny')}
                                    value={result.summary.unchangedCount}
                                    icon={<Equal className="h-4 w-4" />}
                                    color="slate"
                                />
                                <SummaryCard
                                    label={t('curriculum.total_hours_a', 'Hodiny A')}
                                    value={result.summary.totalHoursA}
                                    icon={<CalendarDays className="h-4 w-4" />}
                                    color="slate"
                                />
                                <SummaryCard
                                    label={t('curriculum.total_hours_b', 'Hodiny B')}
                                    value={result.summary.totalHoursB}
                                    icon={<CalendarDays className="h-4 w-4" />}
                                    color="indigo"
                                />
                            </div>

                            {/* Added subjects */}
                            {result.added.length > 0 && (
                                <CompareSection
                                    title={t('curriculum.added_subjects', 'Přidané předměty')}
                                    icon={<Plus className="h-4 w-4" />}
                                    color="emerald"
                                    items={result.added}
                                    type="added"
                                />
                            )}

                            {/* Removed subjects */}
                            {result.removed.length > 0 && (
                                <CompareSection
                                    title={t('curriculum.removed_subjects', 'Odebrané předměty')}
                                    icon={<Minus className="h-4 w-4" />}
                                    color="red"
                                    items={result.removed}
                                    type="removed"
                                />
                            )}

                            {/* Changed subjects */}
                            {result.changed.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                        <ArrowUpDown className="h-4 w-4" />
                                        {t('curriculum.changed_subjects', 'Změněné předměty')}
                                        <Badge variant="outline" className="text-xs">
                                            {result.changed.length}
                                        </Badge>
                                    </h3>
                                    <div className="space-y-2">
                                        {result.changed.map((item: any) => (
                                            <div
                                                key={item.subjectId}
                                                className="border rounded-lg p-3 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="font-mono text-xs">
                                                            {item.code}
                                                        </Badge>
                                                        <span className="font-medium text-sm">{item.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-muted-foreground">
                                                            {item.totalHoursA}h →
                                                        </span>
                                                        <span className="font-semibold">{item.totalHoursB}h</span>
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-xs ${item.totalDiff > 0 ? 'text-emerald-600 border-emerald-300' : item.totalDiff < 0 ? 'text-red-600 border-red-300' : ''}`}
                                                        >
                                                            {item.totalDiff > 0 ? '+' : ''}
                                                            {item.totalDiff}h
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {item.grades.map((g: any) => (
                                                        <div
                                                            key={g.gradeLevelId}
                                                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${
                                                                g.status === 'added'
                                                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                                                                    : g.status === 'removed'
                                                                      ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                                                                      : g.status === 'changed'
                                                                        ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                                                                        : 'bg-muted/50 border-muted-foreground/20'
                                                            }`}
                                                        >
                                                            <span className="font-medium">{g.name}:</span>
                                                            {g.status === 'same' ? (
                                                                <span>{g.hoursA}h</span>
                                                            ) : (
                                                                <>
                                                                    <span className="line-through opacity-60">
                                                                        {g.hoursA}h
                                                                    </span>
                                                                    <span>→</span>
                                                                    <span className="font-semibold">{g.hoursB}h</span>
                                                                    {g.diff !== 0 && (
                                                                        <span className="ml-0.5">
                                                                            {g.diff > 0 ? (
                                                                                <ArrowUp className="h-3 w-3 inline" />
                                                                            ) : (
                                                                                <ArrowDown className="h-3 w-3 inline" />
                                                                            )}
                                                                        </span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Unchanged subjects */}
                            {result.unchanged.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                                        <Equal className="h-4 w-4" />
                                        {t('curriculum.unchanged_subjects', 'Předměty beze změny')}
                                        <Badge variant="outline" className="text-xs">
                                            {result.unchanged.length}
                                        </Badge>
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {result.unchanged.map((item: any) => (
                                            <div
                                                key={item.subjectId}
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/30 text-sm"
                                            >
                                                <Badge variant="outline" className="font-mono text-[10px]">
                                                    {item.code}
                                                </Badge>
                                                <span>{item.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    ({item.totalHours}h, {item.gradeCount}{' '}
                                                    {t('curriculum.grades_short', 'roč.')})
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* No differences */}
                            {result.added.length === 0 &&
                                result.removed.length === 0 &&
                                result.changed.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Check className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                                        <p className="text-sm font-medium">
                                            {t('curriculum.no_differences', 'Verze jsou totožné')}
                                        </p>
                                        <p className="text-xs">
                                            {t(
                                                'curriculum.no_differences_desc',
                                                'Nebyl nalezen žádný rozdíl mezi vybranými verzemi.',
                                            )}
                                        </p>
                                    </div>
                                )}
                        </>
                    )}

                    {!result && !loading && !error && (
                        <div className="text-center py-12 text-muted-foreground">
                            <GitCompareArrows className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">
                                {t(
                                    'curriculum.compare_prompt',
                                    'Vyberte dva ŠVP a klikněte na „Porovnat" pro zobrazení rozdílů.',
                                )}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t flex justify-end">
                    <Button variant="outline" onClick={onClose}>
                        {t('common.close', 'Zavřít')}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Summary Card helper ────────────────────────────────────────

function SummaryCard({
    label,
    value,
    icon,
    color,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
}) {
    const colorClasses: Record<string, string> = {
        emerald:
            'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
        red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
        amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
        slate: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800',
        indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800',
    };

    return (
        <div className={`rounded-lg border p-3 text-center ${colorClasses[color] || colorClasses.slate}`}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
                {icon}
                <span className="text-xs font-medium">{label}</span>
            </div>
            <div className="text-2xl font-bold">{value}</div>
        </div>
    );
}

// ─── Compare Section helper ─────────────────────────────────────

function CompareSection({
    title,
    icon,
    color,
    items,
}: {
    title: string;
    icon: React.ReactNode;
    color: string;
    items: any[];
    type?: 'added' | 'removed';
}) {
    const colorClasses: Record<string, { header: string; row: string }> = {
        emerald: {
            header: 'text-emerald-700 dark:text-emerald-400',
            row: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20',
        },
        red: {
            header: 'text-red-700 dark:text-red-400',
            row: 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20',
        },
    };
    const cls = colorClasses[color] || colorClasses.emerald;

    return (
        <div className="space-y-3">
            <h3 className={`text-sm font-semibold flex items-center gap-2 ${cls.header}`}>
                {icon} {title}
                <Badge variant="outline" className="text-xs">
                    {items.length}
                </Badge>
            </h3>
            <div className="space-y-2">
                {items.map((item: any) => (
                    <div key={item.subjectId} className={`border rounded-lg p-3 ${cls.row}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs">
                                    {item.code}
                                </Badge>
                                <span className="font-medium text-sm">{item.name}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                                {item.totalHours}h celkem
                            </Badge>
                        </div>
                        {item.grades && item.grades.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {item.grades.map((g: any) => (
                                    <Badge key={g.gradeLevelId} variant="outline" className="text-[10px]">
                                        {g.name}: {g.hoursPerWeek}h
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
