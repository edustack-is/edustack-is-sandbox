import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Loader2,
    Upload,
    Link2,
    Sparkles,
    Check,
    ChevronRight,
    AlertTriangle,
    GraduationCap,
    BookOpen,
    ArrowRight,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { analyzeRvpFromUrl, analyzeRvpFromPdf, confirmRvpImport } from '../api/deputy';

// ─── Types ──────────────────────────────────────────────────────

interface RvpAllocation {
    subjectName: string;
    gradeLevel: number;
    hoursPerWeek: number;
    rvpDescription?: string;
}

interface RvpSubject {
    name: string;
    code: string;
    educationalArea?: string;
}

interface MatchedSubject {
    extractedName: string;
    extractedCode: string;
    existingId: string | null;
    existingName: string | null;
    action: 'match' | 'create';
}

interface MatchedGrade {
    gradeLevel: number;
    existingId: string | null;
    existingName: string | null;
    action: 'match' | 'create';
}

interface RvpPreviewData {
    extraction: {
        documentTitle: string;
        schoolType: string;
        subjects: RvpSubject[];
        allocations: RvpAllocation[];
        totalGrades: number;
        notes?: string;
    };
    existingSubjects: Array<{ id: string; name: string; code: string }>;
    existingGradeLevels: Array<{ id: string; name: string; levelNumber: number }>;
    matchedSubjects: MatchedSubject[];
    matchedGrades: MatchedGrade[];
}

type Step = 'input' | 'analyzing' | 'preview' | 'confirming' | 'done';

// ─── Component ──────────────────────────────────────────────────

export function RvpImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>('input');
    const [inputMode, setInputMode] = useState<'url' | 'pdf'>('url');
    const [url, setUrl] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
                setSelectedFile(file);
                setInputMode('pdf');
            } else if (file) {
                toast.error(t('rvp_import.pdf_only', 'Podporovány jsou pouze PDF soubory.'));
            }
        },
        [t],
    );

    const [preview, setPreview] = useState<RvpPreviewData | null>(null);

    // Editable version metadata
    const [versionName, setVersionName] = useState('');
    const [validFrom, setValidFrom] = useState(() => new Date().toISOString().substring(0, 10));

    // Editable mappings
    const [subjectMappings, setSubjectMappings] = useState<MatchedSubject[]>([]);
    const [gradeMappings, setGradeMappings] = useState<MatchedGrade[]>([]);
    const [allocations, setAllocations] = useState<RvpAllocation[]>([]);

    // Result
    const [result, setResult] = useState<{
        versionId: string;
        subjectsCreated: number;
        gradeLevelsCreated: number;
        entriesCreated: number;
    } | null>(null);

    // ─── Step 1: Analyze ────────────────────────────────────────────

    const handleAnalyze = useCallback(async () => {
        setStep('analyzing');
        try {
            let data: RvpPreviewData;
            if (inputMode === 'pdf' && selectedFile) {
                data = await analyzeRvpFromPdf(selectedFile);
            } else if (inputMode === 'url' && url.trim()) {
                data = await analyzeRvpFromUrl(url.trim());
            } else {
                toast.error(t('rvp_import.no_input'));
                setStep('input');
                return;
            }

            setPreview(data);
            setSubjectMappings(data.matchedSubjects);
            setGradeMappings(data.matchedGrades);
            setAllocations(data.extraction.allocations);
            setVersionName(data.extraction.documentTitle || 'ŠVP import');
            setStep('preview');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || t('rvp_import.analyze_error'));
            setStep('input');
        }
    }, [inputMode, selectedFile, url, t]);

    // ─── Step 2: Confirm import ─────────────────────────────────────

    const handleConfirm = useCallback(async () => {
        if (!versionName.trim() || !validFrom) {
            toast.error(t('rvp_import.version_required'));
            return;
        }

        setStep('confirming');
        try {
            const res = await confirmRvpImport({
                versionName: versionName.trim(),
                validFrom: new Date(validFrom).toISOString(),
                subjectMappings: subjectMappings.map((sm) => ({
                    extractedName: sm.extractedName,
                    extractedCode: sm.extractedCode,
                    existingId: sm.existingId,
                })),
                gradeMappings: gradeMappings.map((gm) => ({
                    gradeLevel: gm.gradeLevel,
                    existingId: gm.existingId,
                    name: gm.existingName || `${gm.gradeLevel}. ročník`,
                })),
                allocations: allocations.filter((a) => a.hoursPerWeek > 0),
            });

            setResult(res);
            setStep('done');
            toast.success(t('rvp_import.import_success'));
        } catch (err: any) {
            toast.error(err?.response?.data?.message || t('rvp_import.confirm_error'));
            setStep('preview');
        }
    }, [versionName, validFrom, subjectMappings, gradeMappings, allocations, t]);

    // ─── Toggle subject skip ────────────────────────────────────────

    const toggleSubjectSkip = (index: number) => {
        setSubjectMappings((prev) =>
            prev.map((sm, i) =>
                i === index
                    ? {
                          ...sm,
                          action:
                              sm.action === 'create' && !sm.existingId
                                  ? 'create'
                                  : sm.action === 'match'
                                    ? 'create'
                                    : 'match',
                      }
                    : sm,
            ),
        );
    };

    // ─── Render ─────────────────────────────────────────────────────

    const gradeNumbers = [...new Set(allocations.map((a) => a.gradeLevel))].sort((a, b) => a - b);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-xl shadow-2xl border w-full max-w-5xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                            <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">{t('rvp_import.title')}</h2>
                            <p className="text-sm text-muted-foreground">{t('rvp_import.subtitle')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Steps indicator */}
                <div className="flex items-center gap-2 px-6 py-3 bg-muted/30 border-b text-sm">
                    <StepDot
                        active={step === 'input'}
                        done={['analyzing', 'preview', 'confirming', 'done'].includes(step)}
                        label={t('rvp_import.step_input')}
                    />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <StepDot
                        active={step === 'analyzing'}
                        done={['preview', 'confirming', 'done'].includes(step)}
                        label={t('rvp_import.step_analyze')}
                    />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <StepDot
                        active={step === 'preview'}
                        done={['confirming', 'done'].includes(step)}
                        label={t('rvp_import.step_preview')}
                    />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <StepDot active={step === 'done'} done={step === 'done'} label={t('rvp_import.step_done')} />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* ─── STEP: Input ─────────────────────────────────────── */}
                    {step === 'input' && (
                        <div
                            className="space-y-6 max-w-2xl mx-auto"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <div className="text-center space-y-2">
                                <p className="text-muted-foreground">{t('rvp_import.input_desc')}</p>
                            </div>

                            {/* Mode toggle */}
                            <div className="flex gap-2 bg-muted/50 p-1 rounded-lg">
                                <button
                                    onClick={() => setInputMode('url')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${inputMode === 'url' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Link2 className="h-4 w-4" /> {t('rvp_import.from_url')}
                                </button>
                                <button
                                    onClick={() => setInputMode('pdf')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${inputMode === 'pdf' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Upload className="h-4 w-4" /> {t('rvp_import.from_pdf')}
                                </button>
                            </div>

                            {inputMode === 'url' ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('rvp_import.url_label')}</label>
                                    <input
                                        type="url"
                                        className="w-full rounded-lg border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        placeholder="https://www.edu.cz/rvp/..."
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">{t('rvp_import.url_hint')}</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('rvp_import.pdf_label')}</label>
                                    <div
                                        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                                            isDragging ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
                                        }`}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        {selectedFile ? (
                                            <div className="flex items-center justify-center gap-3">
                                                <Check className="h-5 w-5 text-green-500" />
                                                <span className="font-medium">{selectedFile.name}</span>
                                                <Badge variant="secondary">
                                                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                                                </Badge>
                                            </div>
                                        ) : isDragging ? (
                                            <div className="space-y-2 text-primary">
                                                <Upload className="h-8 w-8 mx-auto" />
                                                <p className="text-sm font-medium">
                                                    {t('rvp_import.drop_here', 'Pusťte soubor zde')}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 text-muted-foreground">
                                                <Upload className="h-8 w-8 mx-auto opacity-50" />
                                                <p className="text-sm">{t('rvp_import.pdf_dropzone')}</p>
                                                <p className="text-xs opacity-70">
                                                    {t(
                                                        'rvp_import.drag_or_click',
                                                        'Přetáhněte PDF nebo klikněte pro výběr',
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf"
                                        className="hidden"
                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                    />
                                </div>
                            )}

                            <button
                                onClick={handleAnalyze}
                                disabled={inputMode === 'url' ? !url.trim() : !selectedFile}
                                className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                <Sparkles className="h-4 w-4" />
                                {t('rvp_import.analyze_btn')}
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    {/* ─── STEP: Analyzing ─────────────────────────────────── */}
                    {step === 'analyzing' && (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-600/20 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                                <Sparkles className="h-5 w-5 text-violet-500 absolute -top-1 -right-1 animate-pulse" />
                            </div>
                            <div className="text-center space-y-1">
                                <p className="font-semibold">{t('rvp_import.analyzing_title')}</p>
                                <p className="text-sm text-muted-foreground">{t('rvp_import.analyzing_desc')}</p>
                            </div>
                        </div>
                    )}

                    {/* ─── STEP: Preview ───────────────────────────────────── */}
                    {step === 'preview' && preview && (
                        <div className="space-y-6">
                            {/* Document info */}
                            <Card className="border-violet-200 dark:border-violet-800">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-violet-500" />
                                        {preview.extraction.documentTitle}
                                    </CardTitle>
                                    <CardDescription>
                                        {preview.extraction.schoolType} • {preview.extraction.totalGrades}{' '}
                                        {t('rvp_import.grades')} • {preview.extraction.subjects.length}{' '}
                                        {t('rvp_import.subjects_found')}
                                    </CardDescription>
                                </CardHeader>
                                {preview.extraction.notes && (
                                    <CardContent className="pt-0">
                                        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                            <p>{preview.extraction.notes}</p>
                                        </div>
                                    </CardContent>
                                )}
                            </Card>

                            {/* Version metadata */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">
                                        {t('rvp_import.version_name_label')}
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                                        value={versionName}
                                        onChange={(e) => setVersionName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">
                                        {t('rvp_import.valid_from_label')}
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                                        value={validFrom}
                                        onChange={(e) => setValidFrom(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Subject mappings */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <BookOpen className="h-4 w-4" />
                                        {t('rvp_import.subjects_mapping')} ({subjectMappings.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-1">
                                        {subjectMappings.map((sm, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/30 transition-colors text-sm"
                                            >
                                                <Badge
                                                    variant="outline"
                                                    className="font-mono text-[10px] w-10 justify-center shrink-0"
                                                >
                                                    {sm.extractedCode}
                                                </Badge>
                                                <span className="flex-1">{sm.extractedName}</span>
                                                {sm.existingId ? (
                                                    <Badge variant="secondary" className="text-[10px] text-green-600">
                                                        <Check className="h-3 w-3 mr-1" />
                                                        {t('rvp_import.matched')}
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-[10px] text-blue-600 cursor-pointer"
                                                        onClick={() => toggleSubjectSkip(i)}
                                                    >
                                                        <Sparkles className="h-3 w-3 mr-1" />
                                                        {t('rvp_import.will_create')}
                                                    </Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Grade level mappings */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <GraduationCap className="h-4 w-4" />
                                        {t('rvp_import.grades_mapping')} ({gradeMappings.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {gradeMappings.map((gm, i) => (
                                            <Badge
                                                key={i}
                                                variant={gm.existingId ? 'secondary' : 'outline'}
                                                className="py-1.5 px-3"
                                            >
                                                {gm.existingId ? (
                                                    <Check className="h-3 w-3 mr-1 text-green-600" />
                                                ) : (
                                                    <Sparkles className="h-3 w-3 mr-1 text-blue-600" />
                                                )}
                                                {gm.gradeLevel}. ročník
                                                {gm.existingName && ` (${gm.existingName})`}
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Hours matrix preview */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">{t('rvp_import.hours_matrix')}</CardTitle>
                                    <CardDescription className="text-xs">
                                        {t('rvp_import.hours_editable')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="border-b bg-muted/50">
                                                    <th className="text-left py-2 px-2 font-semibold">
                                                        {t('rvp_import.subject')}
                                                    </th>
                                                    {gradeNumbers.map((g) => (
                                                        <th key={g} className="text-center py-2 px-2 font-medium w-12">
                                                            {g}.
                                                        </th>
                                                    ))}
                                                    <th className="text-center py-2 px-2 font-semibold bg-muted/70">
                                                        Σ
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {subjectMappings.map((sm) => {
                                                    let total = 0;
                                                    return (
                                                        <tr
                                                            key={sm.extractedName}
                                                            className="border-b hover:bg-muted/20"
                                                        >
                                                            <td className="py-1.5 px-2">
                                                                <span className="font-medium">{sm.extractedName}</span>
                                                            </td>
                                                            {gradeNumbers.map((g) => {
                                                                const alloc = allocations.find(
                                                                    (a) =>
                                                                        a.subjectName === sm.extractedName &&
                                                                        a.gradeLevel === g,
                                                                );
                                                                const hours = alloc?.hoursPerWeek || 0;
                                                                total += hours;
                                                                return (
                                                                    <td key={g} className="text-center py-1.5 px-1">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max="20"
                                                                            step="1"
                                                                            className="w-10 text-center rounded border bg-background px-0.5 py-0.5 text-xs"
                                                                            value={hours}
                                                                            onChange={(e) => {
                                                                                const val =
                                                                                    parseInt(e.target.value) || 0;
                                                                                setAllocations((prev) => {
                                                                                    const existing = prev.findIndex(
                                                                                        (a) =>
                                                                                            a.subjectName ===
                                                                                                sm.extractedName &&
                                                                                            a.gradeLevel === g,
                                                                                    );
                                                                                    if (existing >= 0) {
                                                                                        const copy = [...prev];
                                                                                        copy[existing] = {
                                                                                            ...copy[existing],
                                                                                            hoursPerWeek: val,
                                                                                        };
                                                                                        return copy;
                                                                                    }
                                                                                    return [
                                                                                        ...prev,
                                                                                        {
                                                                                            subjectName:
                                                                                                sm.extractedName,
                                                                                            gradeLevel: g,
                                                                                            hoursPerWeek: val,
                                                                                        },
                                                                                    ];
                                                                                });
                                                                            }}
                                                                        />
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="text-center py-1.5 px-2 bg-muted/30 font-semibold">
                                                                {total}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {/* Totals row */}
                                                <tr className="bg-muted/50 font-semibold border-t-2 border-primary/30">
                                                    <td className="py-2 px-2">{t('rvp_import.total')}</td>
                                                    {gradeNumbers.map((g) => {
                                                        const total = allocations
                                                            .filter((a) => a.gradeLevel === g)
                                                            .reduce((s, a) => s + a.hoursPerWeek, 0);
                                                        return (
                                                            <td key={g} className="text-center py-2 px-2">
                                                                {total || '—'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="text-center py-2 px-2 bg-primary/10 text-primary">
                                                        {allocations.reduce((s, a) => s + a.hoursPerWeek, 0)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* ─── STEP: Confirming ────────────────────────────────── */}
                    {step === 'confirming' && (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="font-semibold">{t('rvp_import.confirming')}</p>
                        </div>
                    )}

                    {/* ─── STEP: Done ──────────────────────────────────────── */}
                    {step === 'done' && result && (
                        <div className="flex flex-col items-center justify-center py-16 space-y-6">
                            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <Check className="h-8 w-8 text-green-600" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-xl font-bold">{t('rvp_import.done_title')}</p>
                                <p className="text-muted-foreground">{t('rvp_import.done_desc')}</p>
                            </div>
                            <div className="flex flex-wrap gap-3 justify-center">
                                <Badge variant="secondary" className="py-2 px-4 text-sm">
                                    <BookOpen className="h-4 w-4 mr-2" />
                                    {result.subjectsCreated} {t('rvp_import.new_subjects')}
                                </Badge>
                                <Badge variant="secondary" className="py-2 px-4 text-sm">
                                    <GraduationCap className="h-4 w-4 mr-2" />
                                    {result.gradeLevelsCreated} {t('rvp_import.new_grades')}
                                </Badge>
                                <Badge variant="secondary" className="py-2 px-4 text-sm">
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    {result.entriesCreated} {t('rvp_import.entries_created')}
                                </Badge>
                            </div>
                            <button
                                onClick={() => {
                                    onImported();
                                    onClose();
                                }}
                                className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                            >
                                {t('rvp_import.close_btn')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                {step === 'preview' && (
                    <div className="border-t p-4 flex items-center justify-between bg-muted/20">
                        <button
                            onClick={() => setStep('input')}
                            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            ← {t('rvp_import.back')}
                        </button>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                                {subjectMappings.filter((s) => !s.existingId).length} {t('rvp_import.new_subjects')} •{' '}
                                {gradeMappings.filter((g) => !g.existingId).length} {t('rvp_import.new_grades')} •{' '}
                                {allocations.filter((a) => a.hoursPerWeek > 0).length} {t('rvp_import.entries_count')}
                            </span>
                            <button
                                onClick={handleConfirm}
                                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium hover:from-green-700 hover:to-emerald-700 transition-all flex items-center gap-2"
                            >
                                <Check className="h-4 w-4" />
                                {t('rvp_import.confirm_btn')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Step indicator dot ─────────────────────────────────────────

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
    return (
        <div
            className={`flex items-center gap-1.5 ${active ? 'text-primary font-medium' : done ? 'text-green-600' : 'text-muted-foreground'}`}
        >
            <div
                className={`w-2 h-2 rounded-full ${active ? 'bg-primary' : done ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
            />
            <span>{label}</span>
        </div>
    );
}
