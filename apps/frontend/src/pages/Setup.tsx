import { useState, useEffect, useRef } from 'react';
import { setupApp, getSeedFiles, setupWithSeed, restoreBackup } from '../api';
import { PasswordInput } from '../components/ui/password-input';
import { validatePassword } from '../lib/password-utils';
import { useTranslation } from 'react-i18next';
import {
    Sparkles, User, Loader2, CheckCircle2, Database, Key, Users, BookOpen,
    GraduationCap, School, ChevronRight, ChevronDown, Layers, Building2, Upload,
    History, FileCode
} from 'lucide-react';
import { InlineLanguageSwitcher } from '@/components/InlineLanguageSwitcher';
import { cn } from '@/lib/utils';

type SeedFile = { filename: string; name: string; description: string };

interface SeedResult {
    school: { id: string; name: string };
    counts: {
        gradeLevels: number;
        subjects: number;
        curriculumEntries: number;
        staff: number;
        students: number;
        rooms: number;
    };
    defaultPassword: string;
    summary: string;
}

export const Setup = () => {
    const { t } = useTranslation();
    const dragCounter = useRef(0);

    // ─── Read setup token from URL ?token=... ────────────────
    const setupToken = new URLSearchParams(window.location.search).get('token') || undefined;

    // ─── Form state ─────────────────────────────────────────
    const [formData, setFormData] = useState({
        adminFirstName: '',
        adminLastName: '',
        adminEmail: '',
        adminPassword: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // ─── Seed state ─────────────────────────────────────────
    const [seedMode, setSeedMode] = useState<'none' | 'file' | 'upload' | 'restore'>('none');
    const [seedFiles, setSeedFiles] = useState<SeedFile[]>([]);
    const [selectedSeed, setSelectedSeed] = useState('');
    const [uploadedSeedData, setUploadedSeedData] = useState<Record<string, any> | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [backupFile, setBackupFile] = useState<File | null>(null);
    const [backupFileName, setBackupFileName] = useState('');
    const [showAiKeys, setShowAiKeys] = useState(false);
    const [aiKeys, setAiKeys] = useState({ geminiApiKey: '', openAiApiKey: '', anthropicApiKey: '' });
    const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
    const [restoreSuccess, setRestoreSuccess] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // ─── Load seed files on mount ───────────────────────────
    useEffect(() => {
        getSeedFiles(setupToken)
            .then((files: SeedFile[]) => {
                setSeedFiles(files);
                if (files.length > 0) setSelectedSeed(files[0].filename);
            })
            .catch(() => { /* no seed files available */ });
    }, []);

    // ─── Drag and Drop handlers ─────────────────────────────
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only reset if we leave the parent container
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        if (file.name.endsWith('.json')) {
            setSeedMode('upload');
            processJsonFile(file);
        } else if (file.name.endsWith('.sqlite') || file.name.endsWith('.db')) {
            setSeedMode('restore');
            processSqliteFile(file);
        } else {
            setError(t('setup.invalid_file_type', 'Nepodporovaný typ souboru. Použijte .json nebo .sqlite.'));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const processJsonFile = (file: File) => {
        setUploadedFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                setUploadedSeedData(json);
                setError('');
            } catch (err) {
                setError(t('setup.invalid_json', 'Neplatný JSON soubor.'));
                setUploadedSeedData(null);
            }
        };
        reader.readAsText(file);
    };

    const processSqliteFile = (file: File) => {
        setBackupFile(file);
        setBackupFileName(file.name);
        setError('');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processJsonFile(file);
    };

    const handleBackupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processSqliteFile(file);
    };

    const handleRestore = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!backupFile) return;

        setLoading(true);
        setError('');
        try {
            await restoreBackup(backupFile, setupToken);
            setRestoreSuccess(true);
            setTimeout(() => {
                window.location.href = '/login';
            }, 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Restore failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const validation = validatePassword(formData.adminPassword);
        if (!validation.isValid) {
            setError(t(validation.errors[0]));
            return;
        }

        if (formData.adminPassword !== formData.confirmPassword) {
            setError(t('setup.passwords_mismatch'));
            return;
        }

        if (seedMode === 'upload' && !uploadedSeedData) {
            setError(t('setup.custom_seed_file'));
            return;
        }

        setLoading(true);
        try {
            if ((seedMode === 'file' && selectedSeed) || (seedMode === 'upload' && uploadedSeedData)) {
                const result = await setupWithSeed({
                    ...formData,
                    seedFilename: seedMode === 'file' ? selectedSeed : undefined,
                    seedData: seedMode === 'upload' ? uploadedSeedData : undefined,
                    aiKeys: hasAnyAiKey() ? aiKeys : undefined,
                }, setupToken);
                setSeedResult(result.seed);
                setTimeout(() => {
                    window.location.href = '/login';
                }, 4000);
            } else {
                await setupApp(formData, setupToken);
                window.location.href = '/login';
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Setup failed';
            if (msg.includes('already initialized') || err.response?.status === 403) {
                window.location.href = '/login';
                return;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const hasAnyAiKey = () => aiKeys.geminiApiKey || aiKeys.openAiApiKey || aiKeys.anthropicApiKey;

    // ─── Seed/Restore completed ─────────────────────────────
    if (restoreSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 px-4">
                <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 space-y-6 border border-green-100 animate-in zoom-in duration-300">
                    <div className="text-center space-y-3">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">{t('setup.restore_complete', 'Obnova dokončena!')}</h2>
                        <p className="text-muted-foreground">{t('setup.restore_complete_desc', 'Databáze byla úspěšně obnovena ze zálohy. Přesměrování na přihlášení...')}</p>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('setup.redirecting')}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (seedResult) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 px-4">
                <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 space-y-6 border border-indigo-100 animate-in zoom-in duration-300">
                    <div className="text-center space-y-3">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">{t('setup.seed_complete')}</h2>
                        <p className="text-muted-foreground">{t('setup.seed_complete_desc')}</p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-5 space-y-3">
                        <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-indigo-500" />
                            <span className="font-medium">{seedResult.school.name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            {[
                                { icon: <GraduationCap className="h-4 w-4" />, label: t('setup.seed_grades'), count: seedResult.counts.gradeLevels },
                                { icon: <BookOpen className="h-4 w-4" />, label: t('setup.seed_subjects'), count: seedResult.counts.subjects },
                                { icon: <Layers className="h-4 w-4" />, label: t('setup.seed_entries'), count: seedResult.counts.curriculumEntries },
                                { icon: <Users className="h-4 w-4" />, label: t('setup.seed_staff'), count: seedResult.counts.staff },
                                { icon: <User className="h-4 w-4" />, label: t('setup.seed_students'), count: seedResult.counts.students },
                                { icon: <School className="h-4 w-4" />, label: t('setup.seed_rooms'), count: seedResult.counts.rooms },
                            ].filter(i => i.count > 0).map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-gray-600">
                                    {item.icon}
                                    <span>{item.count} {item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                        <div className="font-medium mb-1">{t('setup.seed_password_title')}</div>
                        <code className="bg-amber-100 px-2 py-0.5 rounded text-amber-900 font-mono text-sm">
                            {seedResult.defaultPassword}
                        </code>
                        <p className="mt-1 text-xs text-amber-600">{t('setup.seed_password_hint')}</p>
                    </div>

                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('setup.redirecting')}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Main setup form ────────────────────────────────────
    return (
        <div 
            className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 py-12 px-4 relative overflow-hidden"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* ─── Global Drag Overlay ───────────────────────── */}
            {isDragging && (
                <div className="fixed inset-0 z-[100] bg-indigo-600/30 backdrop-blur-md pointer-events-none flex items-center justify-center border-[16px] border-white/30 m-4 rounded-[40px] animate-in fade-in duration-300">
                    <div className="bg-white p-12 rounded-3xl shadow-2xl flex flex-col items-center gap-6 scale-in-center">
                        <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center">
                            <Upload className="h-12 w-12 text-indigo-600 animate-bounce" />
                        </div>
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black text-gray-900">{t('setup.drop_to_upload', 'Pusťte pro nahrání')}</h2>
                            <p className="text-gray-500 font-medium">{t('setup.drop_hint', 'Automaticky rozpoznáme JSON dataset nebo SQLite zálohu.')}</p>
                        </div>
                    </div>
                </div>
            )}

            <InlineLanguageSwitcher />
            
            <div className={cn("max-w-xl w-full space-y-6 transition-all duration-500", isDragging && "blur-sm scale-[0.98] opacity-50")}>
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 mx-auto shadow-lg">
                        <School className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">{t('setup.title')}</h2>
                    <p className="text-gray-500">{t('setup.subtitle')}</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 text-center animate-in shake duration-500">
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    {/* ─── Mode Selector ────────────────────────── */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
                        <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                            <Layers className="h-5 w-5 text-indigo-500" />
                            {t('setup.mode_section', 'Metoda instalace')}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setSeedMode('none')}
                                className={cn(
                                    "p-4 rounded-xl border-2 text-left transition-all",
                                    seedMode !== 'restore' ? "border-indigo-500 bg-indigo-50/50 shadow-sm" : "border-gray-100 hover:border-indigo-200"
                                )}
                            >
                                <div className="flex items-center gap-2 font-bold text-indigo-900 mb-1">
                                    <Sparkles className="h-4 w-4" />
                                    {t('setup.mode_new', 'Nová instalace')}
                                </div>
                                <div className="text-xs text-indigo-600/70">
                                    {t('setup.mode_new_desc', 'Vytvořit prázdný systém nebo načíst demo data.')}
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSeedMode('restore')}
                                className={cn(
                                    "p-4 rounded-xl border-2 text-left transition-all",
                                    seedMode === 'restore' ? "border-violet-500 bg-violet-50/50 shadow-sm" : "border-gray-100 hover:border-violet-200"
                                )}
                            >
                                <div className="flex items-center gap-2 font-bold text-violet-900 mb-1">
                                    <History className="h-4 w-4" />
                                    {t('setup.mode_restore', 'Obnovit ze zálohy')}
                                </div>
                                <div className="text-xs text-violet-600/70">
                                    {t('setup.mode_restore_desc', 'Nahrát existující databázi (.sqlite).')}
                                </div>
                            </button>
                        </div>
                    </div>

                    {seedMode === 'restore' ? (
                        /* ─── RESTORE FORM ────────────────────────── */
                        <form onSubmit={handleRestore} className="bg-white rounded-2xl shadow-sm border border-violet-200 p-6 space-y-6 animate-in slide-in-from-right duration-300">
                            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                                <FileCode className="h-5 w-5 text-violet-500" />
                                {t('setup.restore_section', 'Nahrání zálohy')}
                            </div>

                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".sqlite,.db"
                                    onChange={handleBackupUpload}
                                    className="hidden"
                                    id="backup-file-upload"
                                />
                                <label
                                    htmlFor="backup-file-upload"
                                    className={cn(
                                        "flex flex-col items-center justify-center w-full p-10 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                                        backupFile ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-violet-400 hover:bg-violet-50"
                                    )}
                                >
                                    <Database className={cn("h-12 w-12 mb-3", backupFile ? "text-green-500" : "text-gray-400")} />
                                    <span className="text-sm font-medium text-gray-700 text-center">
                                        {backupFileName || t('setup.select_backup_file', 'Vyberte soubor zálohy (.sqlite)')}
                                    </span>
                                    <span className="text-xs text-gray-500 mt-2 text-center max-w-[300px]">
                                        {t('setup.restore_warning', 'Upozornění: Tato akce přepíše aktuální databázi daty ze zálohy.')}
                                    </span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !backupFile}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-medium
                                    bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700
                                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 
                                    disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        {t('setup.restoring', 'Obnovuji systém...')}
                                    </>
                                ) : (
                                    <>
                                        <History className="h-5 w-5" />
                                        {t('setup.restore_button', 'Obnovit systém ze zálohy')}
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        /* ─── REGULAR SETUP FORM ───────────────────── */
                        <form className="space-y-6 animate-in slide-in-from-left duration-300" onSubmit={handleSubmit}>
                            {/* Admin Account Card */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
                                <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                                    <User className="h-5 w-5 text-indigo-500" />
                                    {t('setup.admin_section')}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label htmlFor="adminFirstName" className="block text-sm font-medium text-gray-700">{t('setup.first_name')}</label>
                                        <input
                                            id="adminFirstName"
                                            name="adminFirstName"
                                            type="text"
                                            required
                                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                            value={formData.adminFirstName}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label htmlFor="adminLastName" className="block text-sm font-medium text-gray-700">{t('setup.last_name')}</label>
                                        <input
                                            id="adminLastName"
                                            name="adminLastName"
                                            type="text"
                                            required
                                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                            value={formData.adminLastName}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700">{t('setup.admin_email')}</label>
                                    <input
                                        id="adminEmail"
                                        name="adminEmail"
                                        type="email"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        value={formData.adminEmail}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700">{t('setup.password')}</label>
                                        <PasswordInput
                                            id="adminPassword"
                                            name="adminPassword"
                                            required
                                            value={formData.adminPassword}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">{t('setup.confirm_password')}</label>
                                        <PasswordInput
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            required
                                            showStrength={false}
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Demo Data Card */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
                                <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                                    <Database className="h-5 w-5 text-violet-500" />
                                    {t('setup.demo_data_section')}
                                </div>

                                <p className="text-sm text-gray-500">{t('setup.demo_data_desc')}</p>

                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSeedMode('none')}
                                        className={cn(
                                            "p-3 rounded-xl border-2 text-sm font-medium transition-all",
                                            seedMode === 'none' ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 hover:border-indigo-200 text-gray-600"
                                        )}
                                    >
                                        {t('setup.no_demo_data')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSeedMode('file')}
                                        disabled={seedFiles.length === 0}
                                        className={cn(
                                            "p-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-2",
                                            seedMode === 'file' ? "border-violet-500 bg-violet-50 text-violet-700" : (seedFiles.length === 0 ? "opacity-50 grayscale cursor-not-allowed" : "border-gray-200 hover:border-violet-200 text-gray-600")
                                        )}
                                    >
                                        <Sparkles className="h-4 w-4" />
                                        {t('setup.load_demo_data')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSeedMode('upload')}
                                        className={cn(
                                            "p-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-2",
                                            seedMode === 'upload' ? "border-violet-500 bg-violet-50 text-violet-700" : "border-gray-200 hover:border-violet-200 text-gray-600"
                                        )}
                                    >
                                        <Upload className="h-4 w-4" />
                                        {t('setup.upload_custom_seed')}
                                    </button>
                                </div>

                                {seedMode === 'file' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="space-y-2">
                                            {seedFiles.map((sf) => (
                                                <label
                                                    key={sf.filename}
                                                    className={cn(
                                                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                                        selectedSeed === sf.filename ? "border-violet-400 bg-violet-50" : "border-gray-200 hover:border-violet-200"
                                                    )}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="seedFile"
                                                        value={sf.filename}
                                                        checked={selectedSeed === sf.filename}
                                                        onChange={() => setSelectedSeed(sf.filename)}
                                                        className="mt-1 accent-violet-500"
                                                    />
                                                    <div>
                                                        <div className="font-medium text-sm">{sf.name}</div>
                                                        {sf.description && (
                                                            <div className="text-xs text-gray-500 mt-0.5">{sf.description}</div>
                                                        )}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {seedMode === 'upload' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept=".json"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                                id="seed-file-upload"
                                            />
                                            <label
                                                htmlFor="seed-file-upload"
                                                className={cn(
                                                    "flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                                                    uploadedSeedData ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-violet-400 hover:bg-violet-50"
                                                )}
                                            >
                                                <Upload className={cn("h-8 w-8 mb-2", uploadedSeedData ? "text-green-500" : "text-gray-400")} />
                                                <span className="text-sm font-medium text-gray-700">
                                                    {uploadedFileName || t('setup.custom_seed_file')}
                                                </span>
                                                <span className="text-xs text-gray-500 mt-1">
                                                    {t('setup.custom_seed_help')}
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {(seedMode === 'file' || seedMode === 'upload') && (
                                    <div className="border-t pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowAiKeys(!showAiKeys)}
                                            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                                        >
                                            {showAiKeys ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            <Key className="h-4 w-4" />
                                            {t('setup.ai_keys_optional')}
                                        </button>

                                        {showAiKeys && (
                                            <div className="space-y-3 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <p className="text-xs text-gray-500">{t('setup.ai_keys_hint')}</p>
                                                {[
                                                    { key: 'geminiApiKey', label: 'Google Gemini API Key', placeholder: 'AIza...' },
                                                    { key: 'openAiApiKey', label: 'OpenAI API Key', placeholder: 'sk-...' },
                                                    { key: 'anthropicApiKey', label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
                                                ].map(({ key, label, placeholder }) => (
                                                    <div key={key} className="space-y-1">
                                                        <label className="text-xs font-medium text-gray-600">{label}</label>
                                                        <input
                                                            type="password"
                                                            placeholder={placeholder}
                                                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                                            value={(aiKeys as any)[key]}
                                                            onChange={(e) => setAiKeys({ ...aiKeys, [key]: e.target.value })}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-medium
                                    bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700
                                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 
                                    disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        {(seedMode === 'file' || seedMode === 'upload') ? t('setup.creating_with_seed') : t('setup.creating')}
                                    </>
                                ) : (
                                    <>
                                        {(seedMode === 'file' || seedMode === 'upload') && <Sparkles className="h-5 w-5" />}
                                        {(seedMode === 'file' || seedMode === 'upload') ? t('setup.create_with_seed') : t('setup.create_button')}
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
