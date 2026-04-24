import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, BookOpen, Monitor, Wrench, GraduationCap, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { getWhiteBookData } from '../api/deputy';

// ─── Types (shared with CurriculumManagement) ───────────────────

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
interface SubjectTemplate {
    id: string;
    name: string;
    code: string;
    svpDescription: string | null;
}

interface CurriculumEntry {
    id: string;
    subjectTemplateId: string;
    gradeLevelId: string;
    hoursPerWeek: number;
    rvpDescription: string | null;
    svpApproach: string | null;
    equipmentRequirements: string[] | null;
    needsComputerLab: boolean;
    gradeLevel?: GradeLevel;
    subjectTemplate?: SubjectTemplate;
}

interface CurriculumVersion {
    id: string;
    name: string;
    validFrom: string;
    validTo: string | null;
    entries: CurriculumEntry[];
}

interface WhiteBookData {
    versions: CurriculumVersion[];
    gradeLevels: GradeLevel[];
    subjectTemplates: SubjectTemplate[];
    academicYears: AcademicYear[];
}

// ─── Component ──────────────────────────────────────────────────

export default function WhiteBook() {
    const { t } = useTranslation();
    const [data, setData] = useState<WhiteBookData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getWhiteBookData();
            setData(result);
            // Auto-select the first (most recent) version
            if (result.versions.length > 0) {
                setSelectedVersionId(result.versions[0].id);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center h-96 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                {t('common.loading')}
            </div>
        );
    }

    const selectedVersion = data.versions.find((v) => v.id === selectedVersionId) || null;
    const gradeLevels = [...data.gradeLevels].sort((a, b) => a.levelNumber - b.levelNumber);

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Build subject×grade hours matrix
    const getEntry = (entries: CurriculumEntry[], subjectId: string, gradeId: string) =>
        entries.find((e) => e.subjectTemplateId === subjectId && e.gradeLevelId === gradeId);

    // Get unique subjects from current version's entries
    const subjectsInVersion = selectedVersion
        ? ([...new Set(selectedVersion.entries.map((e) => e.subjectTemplateId))]
              .map((sid) => data.subjectTemplates.find((s) => s.id === sid))
              .filter(Boolean)
              .sort((a, b) => a!.name.localeCompare(b!.name)) as SubjectTemplate[])
        : [];

    // Equipment per grade
    const equipmentByGrade = (gradeId: string) => {
        if (!selectedVersion) return [];
        const entries = selectedVersion.entries.filter((e) => e.gradeLevelId === gradeId);
        const allEquip = new Set<string>();
        entries.forEach((e) => {
            if (e.equipmentRequirements) {
                (e.equipmentRequirements as string[]).forEach((eq) => allEquip.add(eq));
            }
            if (e.needsComputerLab) allEquip.add('Počítačová učebna');
        });
        return [...allEquip].sort();
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <BookOpen className="h-6 w-6 text-primary" /> {t('white_book.title')}
                </h1>
                <p className="text-muted-foreground mt-1">{t('white_book.subtitle')}</p>
            </div>

            {/* Version selector */}
            {data.versions.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p>{t('white_book.no_versions')}</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">{t('white_book.select_version')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {data.versions.map((v) => (
                                    <button
                                        key={v.id}
                                        onClick={() => setSelectedVersionId(v.id)}
                                        className={`px-4 py-2 rounded-lg text-sm transition-all border ${
                                            selectedVersionId === v.id
                                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                                : 'bg-background hover:bg-muted border-muted-foreground/20'
                                        }`}
                                    >
                                        <div className="font-medium">{v.name}</div>
                                        <div className="text-[11px] opacity-80">
                                            {formatDate(v.validFrom)}
                                            {v.validTo
                                                ? ` → ${formatDate(v.validTo)}`
                                                : ` → ${t('white_book.indefinite')}`}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {selectedVersion && (
                        <>
                            {/* Hours Matrix */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <GraduationCap className="h-5 w-5 text-primary" />
                                        <CardTitle className="text-lg">{t('white_book.hours_matrix')}</CardTitle>
                                    </div>
                                    <CardDescription>
                                        {t('white_book.hours_matrix_desc', { name: selectedVersion.name })}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {subjectsInVersion.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground text-sm">
                                            {t('white_book.no_entries')}
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm border-collapse">
                                                <thead>
                                                    <tr className="border-b bg-muted/50">
                                                        <th className="text-left py-2 px-3 font-semibold">
                                                            {t('year_setup.subject_column')}
                                                        </th>
                                                        {gradeLevels.map((gl) => (
                                                            <th
                                                                key={gl.id}
                                                                className="text-center py-2 px-3 font-medium min-w-16"
                                                            >
                                                                {gl.name}
                                                            </th>
                                                        ))}
                                                        <th className="text-center py-2 px-3 font-semibold bg-muted/70">
                                                            {t('white_book.total')}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {subjectsInVersion.map((subject) => {
                                                        let total = 0;
                                                        return (
                                                            <tr
                                                                key={subject.id}
                                                                className="border-b hover:bg-muted/20 transition-colors"
                                                            >
                                                                <td className="py-2 px-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="font-mono text-[10px] px-1"
                                                                        >
                                                                            {subject.code}
                                                                        </Badge>
                                                                        <span className="font-medium">
                                                                            {subject.name}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                {gradeLevels.map((gl) => {
                                                                    const entry = getEntry(
                                                                        selectedVersion.entries,
                                                                        subject.id,
                                                                        gl.id,
                                                                    );
                                                                    const hours = entry?.hoursPerWeek || 0;
                                                                    total += hours;
                                                                    return (
                                                                        <td
                                                                            key={gl.id}
                                                                            className="text-center py-2 px-3"
                                                                        >
                                                                            {hours > 0 ? (
                                                                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                                                                                    {hours}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-muted-foreground">
                                                                                    —
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="text-center py-2 px-3 bg-muted/30 font-semibold">
                                                                    {total}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* Totals row */}
                                                    <tr className="bg-muted/50 font-semibold border-t-2 border-primary/30">
                                                        <td className="py-2 px-3">
                                                            {t('year_setup.total_hours_per_week')}
                                                        </td>
                                                        {gradeLevels.map((gl) => {
                                                            const total = selectedVersion.entries
                                                                .filter((e) => e.gradeLevelId === gl.id)
                                                                .reduce((s, e) => s + e.hoursPerWeek, 0);
                                                            return (
                                                                <td key={gl.id} className="text-center py-2 px-3">
                                                                    {total || '—'}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="text-center py-2 px-3 bg-primary/10 text-primary">
                                                            {selectedVersion.entries.reduce(
                                                                (s, e) => s + e.hoursPerWeek,
                                                                0,
                                                            )}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Equipment per Grade */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <Wrench className="h-5 w-5 text-orange-500" />
                                        <CardTitle className="text-lg">{t('white_book.equipment_title')}</CardTitle>
                                    </div>
                                    <CardDescription>{t('white_book.equipment_desc')}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {gradeLevels.map((gl) => {
                                            const equipment = equipmentByGrade(gl.id);
                                            const entriesForGrade = selectedVersion.entries.filter(
                                                (e) => e.gradeLevelId === gl.id,
                                            );
                                            return (
                                                <div key={gl.id} className="border rounded-lg p-4">
                                                    <div className="font-medium text-sm mb-2 flex items-center gap-2">
                                                        <GraduationCap className="h-4 w-4 text-primary" />
                                                        {gl.name}
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {entriesForGrade.length} {t('white_book.subjects')}
                                                        </Badge>
                                                    </div>
                                                    {equipment.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {equipment.map((eq, i) => (
                                                                <Badge key={i} variant="outline" className="text-xs">
                                                                    {eq === 'Počítačová učebna' && (
                                                                        <Monitor className="h-3 w-3 mr-1" />
                                                                    )}
                                                                    {eq}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">
                                                            {t('white_book.no_equipment')}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Subject details */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-blue-500" />
                                        <CardTitle className="text-lg">{t('white_book.subject_details')}</CardTitle>
                                    </div>
                                    <CardDescription>{t('white_book.subject_details_desc')}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {subjectsInVersion.map((subject) => (
                                        <SubjectDetailAccordion
                                            key={subject.id}
                                            subject={subject}
                                            entries={selectedVersion.entries.filter(
                                                (e) => e.subjectTemplateId === subject.id,
                                            )}
                                            gradeLevels={gradeLevels}
                                        />
                                    ))}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// Subject Detail Accordion — read-only details per grade
// ═══════════════════════════════════════════════════════════════

function SubjectDetailAccordion({
    subject,
    entries,
    gradeLevels,
}: {
    subject: SubjectTemplate;
    entries: CurriculumEntry[];
    gradeLevels: GradeLevel[];
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const sortedEntries = [...entries].sort((a, b) => {
        const aLevel = gradeLevels.find((gl) => gl.id === a.gradeLevelId)?.levelNumber || 0;
        const bLevel = gradeLevels.find((gl) => gl.id === b.gradeLevelId)?.levelNumber || 0;
        return aLevel - bLevel;
    });

    return (
        <div className="border rounded-lg">
            <button
                onClick={() => setOpen(!open)}
                className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-lg"
            >
                <div className="flex items-center gap-3">
                    {open ? (
                        <ChevronDown className="h-4 w-4 text-primary" />
                    ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Badge variant="outline" className="font-mono text-xs">
                        {subject.code}
                    </Badge>
                    <span className="font-medium">{subject.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    {sortedEntries.map((e) => {
                        const gl = gradeLevels.find((g) => g.id === e.gradeLevelId);
                        return (
                            <Badge key={e.id} variant="secondary" className="text-[10px]">
                                {gl?.name}: {e.hoursPerWeek}h
                            </Badge>
                        );
                    })}
                </div>
            </button>
            {open && (
                <div className="px-4 pb-4 border-t">
                    {sortedEntries.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">{t('white_book.no_entries_for_subject')}</p>
                    ) : (
                        <div className="space-y-4 mt-3">
                            {sortedEntries.map((entry) => {
                                const gl = gradeLevels.find((g) => g.id === entry.gradeLevelId);
                                return (
                                    <div key={entry.id} className="border rounded-lg p-4 bg-muted/10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <GraduationCap className="h-4 w-4 text-primary" />
                                            <span className="font-medium text-sm">{gl?.name}</span>
                                            <Badge className="text-xs">
                                                {entry.hoursPerWeek} {t('curriculum.hours_unit')}
                                            </Badge>
                                            {entry.needsComputerLab && (
                                                <Badge variant="outline" className="text-xs">
                                                    <Monitor className="h-3 w-3 mr-1" /> PC
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            {entry.rvpDescription && (
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-blue-600 flex items-center gap-1">
                                                        <FileText className="h-3 w-3" /> RVP
                                                    </p>
                                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                                        {entry.rvpDescription}
                                                    </p>
                                                </div>
                                            )}
                                            {entry.svpApproach && (
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                                                        <BookOpen className="h-3 w-3" /> ŠVP
                                                    </p>
                                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                                        {entry.svpApproach}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        {entry.equipmentRequirements &&
                                            (entry.equipmentRequirements as string[]).length > 0 && (
                                                <div className="mt-3 flex items-center gap-2">
                                                    <Wrench className="h-3 w-3 text-orange-500" />
                                                    <div className="flex flex-wrap gap-1">
                                                        {(entry.equipmentRequirements as string[]).map((eq, i) => (
                                                            <Badge key={i} variant="outline" className="text-[10px]">
                                                                {eq}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
