import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Loader2,
    Plus,
    Trash2,
    AlertTriangle,
    CheckCircle2,
    School,
    Users,
    BookOpen,
    Calendar,
    GraduationCap,
    MessageSquare,
    ClipboardList,
    Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { generateTestData, wipeSchoolData, wipeAllData, getSystemSchools, aiGenerateSchoolName } from '@/api/index';

// ─── Types ──────────────────────────────────────────────────────

interface SchoolInfo {
    id: string;
    name: string;
    _count?: { members: number };
}

const SCHOOL_TYPES = [
    { value: 'elementary_1', label: 'ZŠ – 1. stupeň (1.–5. třída)', icon: '🏫' },
    { value: 'elementary_full', label: 'ZŠ – 1. i 2. stupeň (1.–9. třída)', icon: '🏫' },
    { value: 'gymnasium_8', label: 'Osmileté gymnázium (Prima–Oktáva)', icon: '🎓' },
    { value: 'gymnasium_4', label: 'Čtyřleté gymnázium (1.–4. ročník)', icon: '🎓' },
];

// ═════════════════════════════════════════════════════════════════

export function TestDataGenerator() {
    // ─── Generate state ──────────────────────────────────
    const [schoolName, setSchoolName] = useState('Testovací škola');
    const [schoolType, setSchoolType] = useState('elementary_full');
    const [teacherCount, setTeacherCount] = useState(15);
    const [teacherActive, setTeacherActive] = useState(12);
    const [teacherInvited, setTeacherInvited] = useState(3);
    const [studentCount, setStudentCount] = useState(100);
    const [studentActive, setStudentActive] = useState(80);
    const [studentInvited, setStudentInvited] = useState(20);
    const [parentCount, setParentCount] = useState(0); // 0 = auto
    const [generateSubjects, setGenerateSubjects] = useState(true);
    const [generateSchedule, setGenerateSchedule] = useState(true);
    const [generateGrades, setGenerateGrades] = useState(true);
    const [generateCommunication, setGenerateCommunication] = useState(true);
    const [generateAttendance, setGenerateAttendance] = useState(true);
    const [generateReportCards, setGenerateReportCards] = useState(true);
    const [generateCommunity, setGenerateCommunity] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generatingName, setGeneratingName] = useState(false);
    const [lastResult, setLastResult] = useState<any>(null);

    // ─── Wipe state ──────────────────────────────────────
    const [schools, setSchools] = useState<SchoolInfo[]>([]);
    const [selectedSchoolId, setSelectedSchoolId] = useState('');
    const [wipeDialogOpen, setWipeDialogOpen] = useState(false);
    const [wipeAllDialogOpen, setWipeAllDialogOpen] = useState(false);
    const [wipeConfirmText, setWipeConfirmText] = useState('');
    const [wiping, setWiping] = useState(false);

    useEffect(() => {
        loadSchools();
    }, []);

    const loadSchools = async () => {
        try {
            const data = await getSystemSchools();
            setSchools(data);
        } catch {
            /* ignore */
        }
    };

    // ─── Generate handler ────────────────────────────────

    const handleGenerateName = async () => {
        try {
            setGeneratingName(true);
            const res = await aiGenerateSchoolName(schoolType);
            if (res.name) {
                setSchoolName(res.name);
                toast.success('Název úspěšně vygenerován');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Chyba při generování názvu');
        } finally {
            setGeneratingName(false);
        }
    };

    const handleGenerate = async () => {
        if (!schoolName.trim()) {
            toast.error('Zadejte název školy');
            return;
        }
        try {
            setGenerating(true);
            setLastResult(null);
            const result = await generateTestData({
                schoolName: schoolName.trim(),
                schoolType,
                teacherCount,
                teacherActiveCount: teacherActive,
                teacherInvitedCount: teacherInvited,
                studentCount,
                studentActiveCount: studentActive,
                studentInvitedCount: studentInvited,
                parentCount,
                generateSubjects,
                generateSchedule,
                generateGrades,
                generateCommunication,
                generateAttendance,
                generateReportCards,
                generateCommunity,
            });
            setLastResult(result);
            toast.success(`Škola '${result.schoolName}' byla úspěšně vytvořena s testovacími daty!`);
            loadSchools();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Chyba při generování dat');
        } finally {
            setGenerating(false);
        }
    };

    // ─── Wipe handlers ───────────────────────────────────

    const handleWipeSchool = async () => {
        if (!selectedSchoolId) return;
        try {
            setWiping(true);
            const result = await wipeSchoolData(selectedSchoolId);
            toast.success(`Škola '${result.deletedSchool}' byla smazána včetně všech dat.`);
            setWipeDialogOpen(false);
            setSelectedSchoolId('');
            loadSchools();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Chyba při mazání dat');
        } finally {
            setWiping(false);
        }
    };

    const handleWipeAll = async () => {
        try {
            setWiping(true);
            const result = await wipeAllData();
            toast.success(`Smazáno ${result.deletedSchools} škol a ${result.deletedUsers} uživatelů.`);
            setWipeAllDialogOpen(false);
            setWipeConfirmText('');
            loadSchools();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Chyba při mazání dat');
        } finally {
            setWiping(false);
        }
    };

    // ─── Render ──────────────────────────────────────────

    return (
        <div className="space-y-8">
            {/* ═══ GENERATE SECTION ═══ */}
            <Card className="border-2 border-dashed border-primary/20">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Plus className="h-5 w-5 text-primary" />
                        Generovat testovací data
                    </CardTitle>
                    <CardDescription>
                        Vytvoří kompletní školu s realistickými testovacími daty. Můžete přidávat více škol.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* School info */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <School className="h-4 w-4 text-muted-foreground" />
                                Název školy
                            </Label>
                            <div className="relative">
                                <Input
                                    value={schoolName}
                                    onChange={(e) => setSchoolName(e.target.value)}
                                    placeholder="Testovací škola"
                                    className="pr-10"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1 bottom-1 h-auto w-8 text-primary hover:text-primary hover:bg-primary/10 transition-colors"
                                    onClick={handleGenerateName}
                                    disabled={generatingName}
                                    title="AI generovat název"
                                >
                                    {generatingName ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Typ školy</Label>
                            <Select value={schoolType} onValueChange={setSchoolType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SCHOOL_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.icon} {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Users */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" /> Uživatelé
                        </h4>

                        {/* Teachers */}
                        <div className="grid gap-3 md:grid-cols-3 pl-4 border-l-2 border-blue-200">
                            <div className="space-y-1">
                                <Label className="text-xs">Učitelé (celkem)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={teacherCount}
                                    onChange={(e) => setTeacherCount(parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs flex items-center gap-1">
                                    <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600">
                                        ACTIVE
                                    </Badge>
                                </Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={teacherCount}
                                    value={teacherActive}
                                    onChange={(e) => setTeacherActive(parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs flex items-center gap-1">
                                    <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600">
                                        INVITED
                                    </Badge>
                                </Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={teacherCount}
                                    value={teacherInvited}
                                    onChange={(e) => setTeacherInvited(parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        {/* Students */}
                        <div className="grid gap-3 md:grid-cols-3 pl-4 border-l-2 border-green-200">
                            <div className="space-y-1">
                                <Label className="text-xs">Studenti (celkem)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={500}
                                    value={studentCount}
                                    onChange={(e) => setStudentCount(parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs flex items-center gap-1">
                                    <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600">
                                        ACTIVE
                                    </Badge>
                                </Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={studentCount}
                                    value={studentActive}
                                    onChange={(e) => setStudentActive(parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs flex items-center gap-1">
                                    <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600">
                                        INVITED
                                    </Badge>
                                </Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={studentCount}
                                    value={studentInvited}
                                    onChange={(e) => setStudentInvited(parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        {/* Parents */}
                        <div className="grid gap-3 md:grid-cols-3 pl-4 border-l-2 border-purple-200">
                            <div className="space-y-1">
                                <Label className="text-xs">Rodiče</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={500}
                                    value={parentCount}
                                    onChange={(e) => setParentCount(parseInt(e.target.value) || 0)}
                                />
                                <p className="text-[10px] text-muted-foreground">0 = automaticky (1 na studenta)</p>
                            </div>
                        </div>
                    </div>

                    {/* Feature toggles */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                            <ClipboardList className="h-4 w-4" /> Moduly k vygenerování
                        </h4>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            <FeatureToggle
                                icon={<BookOpen className="h-4 w-4" />}
                                label="Předměty (RVP)"
                                checked={generateSubjects}
                                onCheckedChange={setGenerateSubjects}
                            />
                            <FeatureToggle
                                icon={<Calendar className="h-4 w-4" />}
                                label="Rozvrh"
                                checked={generateSchedule}
                                onCheckedChange={setGenerateSchedule}
                            />
                            <FeatureToggle
                                icon={<GraduationCap className="h-4 w-4" />}
                                label="Klasifikace"
                                checked={generateGrades}
                                onCheckedChange={setGenerateGrades}
                            />
                            <FeatureToggle
                                icon={<MessageSquare className="h-4 w-4" />}
                                label="Zprávy (komunikace)"
                                checked={generateCommunication}
                                onCheckedChange={setGenerateCommunication}
                            />
                            <FeatureToggle
                                icon={<ClipboardList className="h-4 w-4" />}
                                label="Docházka a omluvenky"
                                checked={generateAttendance}
                                onCheckedChange={setGenerateAttendance}
                            />
                            <FeatureToggle
                                icon={<GraduationCap className="h-4 w-4" />}
                                label="Vysvědčení a chování"
                                checked={generateReportCards}
                                onCheckedChange={setGenerateReportCards}
                            />
                            <FeatureToggle
                                icon={<MessageSquare className="h-4 w-4" />}
                                label="Komunita (ankety, nástěnka)"
                                checked={generateCommunity}
                                onCheckedChange={setGenerateCommunity}
                            />
                        </div>
                    </div>

                    {/* Generate button */}
                    <Button onClick={handleGenerate} disabled={generating} className="w-full" size="lg">
                        {generating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Generuji testovací data...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 mr-2" /> Generovat školu s daty
                            </>
                        )}
                    </Button>

                    {/* Result */}
                    {lastResult && (
                        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                            <CardContent className="pt-4">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                                    <div className="space-y-2">
                                        <p className="font-medium text-emerald-800 dark:text-emerald-200">
                                            Škola „{lastResult.schoolName}" vytvořena
                                        </p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                                            <StatBadge label="Školní rok" value={lastResult.stats.academicYear} />
                                            <StatBadge label="Ročníky" value={lastResult.stats.gradeLevels} />
                                            <StatBadge label="Třídy" value={lastResult.stats.classrooms} />
                                            <StatBadge label="Předměty" value={lastResult.stats.subjects} />
                                            <StatBadge label="Učitelé" value={lastResult.stats.teachers} />
                                            <StatBadge label="Studenti" value={lastResult.stats.students} />
                                            <StatBadge label="Rodiče" value={lastResult.stats.parents} />
                                            <StatBadge
                                                label="Instance předmětů"
                                                value={lastResult.stats.subjectInstances}
                                            />
                                            <StatBadge
                                                label="Události rozvrhu"
                                                value={lastResult.stats.scheduleEvents}
                                            />
                                            <StatBadge label="Známky" value={lastResult.stats.grades} />
                                            <StatBadge label="Konverzace" value={lastResult.stats.conversations} />
                                            <StatBadge label="Zprávy" value={lastResult.stats.messages} />
                                            <StatBadge label="Docházka" value={lastResult.stats.attendanceRecords} />
                                            <StatBadge label="Omluvenky" value={lastResult.stats.excuses} />
                                            <StatBadge label="Vysvědčení" value={lastResult.stats.reportCards} />
                                            <StatBadge label="Chování" value={lastResult.stats.behaviorGrades} />
                                            <StatBadge label="Nástěnka" value={lastResult.stats.bulletinPosts} />
                                            <StatBadge label="Ankety" value={lastResult.stats.polls} />
                                            <StatBadge label="Události" value={lastResult.stats.calendarEvents} />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-2">
                                            🔑 Heslo pro všechny demo účty:{' '}
                                            <code className="font-mono bg-muted px-1 rounded">Demo1234!</code>
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>

            {/* ═══ DANGER ZONE ═══ */}
            <Card className="border-destructive/30">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        Nebezpečná zóna
                    </CardTitle>
                    <CardDescription>Tyto akce jsou nevratné. Data budou trvale smazána.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Wipe school */}
                    <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                        <div>
                            <p className="font-medium text-sm">Smazat data školy</p>
                            <p className="text-xs text-muted-foreground">
                                Smaže školu a všechna její data (uživatele, předměty, rozvrh, klasifikaci, komunikaci).
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                                <SelectTrigger className="w-[260px]">
                                    <SelectValue placeholder="Vyberte školu..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {schools.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={!selectedSchoolId}
                                onClick={() => setWipeDialogOpen(true)}
                            >
                                <Trash2 className="h-4 w-4 mr-1" /> Smazat
                            </Button>
                        </div>
                    </div>

                    {/* Wipe all */}
                    <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/40 bg-destructive/10">
                        <div>
                            <p className="font-medium text-sm text-destructive">Smazat VŠECHNA data</p>
                            <p className="text-xs text-muted-foreground">
                                Smaže všechny školy, uživatele a data v celém systému. Zůstanou pouze systémoví
                                administrátoři.
                            </p>
                        </div>
                        <Button variant="destructive" onClick={() => setWipeAllDialogOpen(true)}>
                            <Trash2 className="h-4 w-4 mr-1" /> Smazat vše
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* ═══ DIALOGS ═══ */}

            {/* Wipe school dialog */}
            <Dialog open={wipeDialogOpen} onOpenChange={setWipeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Smazat školu a všechna data
                        </DialogTitle>
                        <DialogDescription>
                            Opravdu chcete smazat školu „{schools.find((s) => s.id === selectedSchoolId)?.name}" a
                            všechna přidružená data? Tato akce je nevratná.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setWipeDialogOpen(false)}>
                            Zrušit
                        </Button>
                        <Button variant="destructive" onClick={handleWipeSchool} disabled={wiping}>
                            {wiping && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Smazat nenávratně
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Wipe all dialog */}
            <Dialog open={wipeAllDialogOpen} onOpenChange={setWipeAllDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Smazat VŠECHNA data v systému
                        </DialogTitle>
                        <DialogDescription>
                            Tato akce smaže VŠECHNY školy, uživatele a data. Zůstanou pouze systémoví administrátoři.
                            Pro potvrzení napište „SMAZAT VŠE":
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={wipeConfirmText}
                        onChange={(e) => setWipeConfirmText(e.target.value)}
                        placeholder='Napište "SMAZAT VŠE"'
                        className="font-mono"
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setWipeAllDialogOpen(false);
                                setWipeConfirmText('');
                            }}
                        >
                            Zrušit
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleWipeAll}
                            disabled={wiping || wipeConfirmText !== 'SMAZAT VŠE'}
                        >
                            {wiping && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Smazat vše nenávratně
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Sub-components ─────────────────────────────────────────────

function FeatureToggle({
    icon,
    label,
    checked,
    onCheckedChange,
}: {
    icon: React.ReactNode;
    label: string;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <Label className="flex items-center gap-2 cursor-pointer text-sm">
                {icon} {label}
            </Label>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="flex justify-between gap-2">
            <span className="opacity-70">{label}:</span>
            <span className="font-mono font-semibold">{value}</span>
        </div>
    );
}
