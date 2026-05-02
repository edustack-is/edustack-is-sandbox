import { useState, useEffect, useRef, useCallback } from 'react';
import { setupApp, restoreBackup } from '../api';
import { PasswordInput } from '../components/ui/password-input';
import { validatePassword } from '../lib/password-utils';
import { useTranslation } from 'react-i18next';
import {
    Sparkles,
    User,
    Loader2,
    CheckCircle2,
    Database,
    School,
    Layers,
    Upload,
    History,
    FileCode,
} from 'lucide-react';
import { InlineLanguageSwitcher } from '@/components/InlineLanguageSwitcher';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const Setup = () => {
    const { t } = useTranslation();
    const dragCounter = useRef(0);

    useEffect(() => {
        console.log('Setup Component Version: 2026-04-19-2158');
    }, []);

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

    // ─── Setup state ────────────────────────────────────────
    const [mode, setMode] = useState<'new' | 'restore'>('new');
    const [backupFile, setBackupFile] = useState<File | null>(null);
    const [backupFileName, setBackupFileName] = useState('');
    const [restoreSuccess, setRestoreSuccess] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isDraggingOverRestore, setIsDraggingOverRestore] = useState(false);

    const processSqliteFile = useCallback((file: File) => {
        setBackupFile(file);
        setBackupFileName(file.name);
        setError('');
    }, []);

    const handleDroppedFile = useCallback(
        (file: File) => {
            const name = file.name.toLowerCase();
            if (name.endsWith('.sqlite') || name.endsWith('.db')) {
                setMode('restore');
                processSqliteFile(file);
                toast.success(t('setup.sqlite_detected', 'Detekována SQLite záloha'));
            } else {
                toast.error(
                    t('setup.invalid_file_type_sqlite', 'Nepodporovaný typ souboru. Použijte .sqlite nebo .db.'),
                );
            }
        },
        [processSqliteFile, t],
    );

    // ─── Setup/Restore completed ─────────────────────────────

    useEffect(() => {
        const onDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        };

        const onDragEnter = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter.current++;
            if (dragCounter.current === 1) {
                setIsDragging(true);
            }
        };

        const onDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter.current--;
            if (dragCounter.current <= 0) {
                dragCounter.current = 0;
                setIsDragging(false);
            }
        };

        const onDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            dragCounter.current = 0;

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                handleDroppedFile(files[0]);
            }
        };

        window.addEventListener('dragover', onDragOver);
        window.addEventListener('dragenter', onDragEnter);
        window.addEventListener('dragleave', onDragLeave);
        window.addEventListener('drop', onDrop);

        return () => {
            window.removeEventListener('dragover', onDragOver);
            window.removeEventListener('dragenter', onDragEnter);
            window.removeEventListener('dragleave', onDragLeave);
            window.removeEventListener('drop', onDrop);
        };
    }, [handleDroppedFile]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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
        } catch (err) {
            const error = err as { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || 'Restore failed');
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

        setLoading(true);
        try {
            await setupApp(formData, setupToken);
            window.location.href = '/login';
        } catch (err) {
            const error = err as { response?: { data?: { message?: string }; status?: number } };
            const msg = error.response?.data?.message || 'Setup failed';
            if (msg.includes('already initialized') || error.response?.status === 403) {
                window.location.href = '/login';
                return;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // ─── Seed/Restore completed ─────────────────────────────
    if (restoreSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 px-4">
                <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl p-10 space-y-8 border border-green-50 animate-in zoom-in duration-300">
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-50 mx-auto border-4 border-white shadow-sm">
                            <CheckCircle2 className="h-10 w-10 text-green-500" />
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                            {t('setup.restore_complete', 'Obnova dokončena!')}
                        </h2>
                        <p className="text-gray-500 font-medium text-lg leading-relaxed">
                            {t('setup.restore_complete_desc', 'Databáze byla úspěšně přepsána vaší zálohou.')}
                        </p>
                    </div>

                    <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100/50 flex flex-col items-center gap-4">
                        <div className="flex items-center gap-3 text-indigo-600 font-bold">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>{t('setup.redirecting', 'Přesměrovávám na přihlášení...')}</span>
                        </div>
                        <div className="flex flex-col gap-2 w-full">
                            <button
                                onClick={() => (window.location.href = '/login')}
                                className="text-sm font-bold text-indigo-500 hover:text-indigo-700 underline underline-offset-4 decoration-2"
                            >
                                {t('setup.redirect_manual', 'Klikněte zde, pokud nebudete přesměrováni automaticky')}
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="text-xs text-gray-400 hover:text-gray-600"
                            >
                                {t('setup.refresh_status', 'Zkontrolovat stav systému')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isAnyLocalDragging = isDraggingOverRestore;

    // ─── Main setup form ────────────────────────────────────
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 py-12 px-4 relative overflow-hidden">
            {/* ─── Global Drag Overlay ───────────────────────── */}
            {isDragging && !isAnyLocalDragging && (
                <div className="fixed inset-0 z-[100] bg-indigo-600/40 backdrop-blur-md pointer-events-none flex items-center justify-center border-[16px] border-white/30 m-4 rounded-[40px] animate-in fade-in duration-300">
                    <div className="bg-white p-12 rounded-3xl shadow-2xl flex flex-col items-center gap-6 scale-in-center">
                        <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center">
                            <Upload className="h-12 w-12 text-indigo-600 animate-bounce" />
                        </div>
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black text-gray-900">
                                {t('setup.drop_to_upload', 'Pusťte pro nahrání')}
                            </h2>
                            <p className="text-gray-500 font-medium">
                                {t('setup.drop_hint', 'Automaticky rozpoznáme SQLite zálohu.')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <InlineLanguageSwitcher />

            <div
                className={cn(
                    'max-w-xl w-full space-y-6 transition-all duration-500',
                    isDragging && !isAnyLocalDragging && 'blur-sm scale-[0.98] opacity-50',
                )}
            >
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
                                onClick={() => setMode('new')}
                                className={cn(
                                    'p-4 rounded-xl border-2 text-left transition-all',
                                    mode !== 'restore'
                                        ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                                        : 'border-gray-100 hover:border-indigo-200',
                                )}
                            >
                                <div className="flex items-center gap-2 font-bold text-indigo-900 mb-1">
                                    <Sparkles className="h-4 w-4" />
                                    {t('setup.mode_new', 'Nová instalace')}
                                </div>
                                <div className="text-xs text-indigo-600/70">
                                    {t('setup.mode_new_desc', 'Vytvořit prázdný systém.')}
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('restore')}
                                className={cn(
                                    'p-4 rounded-xl border-2 text-left transition-all',
                                    mode === 'restore'
                                        ? 'border-violet-500 bg-violet-50/50 shadow-sm'
                                        : 'border-gray-100 hover:border-violet-200',
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

                    {mode === 'restore' ? (
                        /* ─── RESTORE FORM ────────────────────────── */
                        <form
                            onSubmit={handleRestore}
                            className="bg-white rounded-2xl shadow-sm border border-violet-200 p-6 space-y-6 animate-in slide-in-from-right duration-300"
                        >
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
                                    onDragEnter={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsDraggingOverRestore(true);
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsDraggingOverRestore(true);
                                    }}
                                    onDragLeave={() => setIsDraggingOverRestore(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsDraggingOverRestore(false);
                                        setIsDragging(false);
                                        dragCounter.current = 0;
                                        const files = e.dataTransfer?.files;
                                        if (files && files.length > 0) {
                                            handleDroppedFile(files[0]);
                                        }
                                    }}
                                    className={cn(
                                        'flex flex-col items-center justify-center w-full p-10 border-2 border-dashed rounded-xl cursor-pointer transition-all',
                                        isDraggingOverRestore
                                            ? 'border-violet-500 bg-violet-50'
                                            : backupFile
                                              ? 'border-green-400 bg-green-50'
                                              : 'border-gray-300 hover:border-violet-400 hover:bg-violet-50',
                                    )}
                                >
                                    <div className="pointer-events-none flex flex-col items-center justify-center">
                                        <Database
                                            className={cn(
                                                'h-12 w-12 mb-3',
                                                backupFile ? 'text-green-500' : 'text-gray-400',
                                            )}
                                        />
                                        <span className="text-sm font-medium text-gray-700 text-center">
                                            {backupFileName ||
                                                t('setup.select_backup_file', 'Vyberte soubor zálohy (.sqlite)')}
                                        </span>
                                        <span className="text-xs text-gray-500 mt-2 text-center max-w-[300px]">
                                            {t(
                                                'setup.restore_warning',
                                                'Upozornění: Tato akce přepíše aktuální databázi daty ze zálohy.',
                                            )}
                                        </span>
                                    </div>
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
                                        <label
                                            htmlFor="adminFirstName"
                                            className="block text-sm font-medium text-gray-700"
                                        >
                                            {t('setup.first_name')}
                                        </label>
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
                                        <label
                                            htmlFor="adminLastName"
                                            className="block text-sm font-medium text-gray-700"
                                        >
                                            {t('setup.last_name')}
                                        </label>
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
                                    <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700">
                                        {t('setup.admin_email')}
                                    </label>
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
                                        <label
                                            htmlFor="adminPassword"
                                            className="block text-sm font-medium text-gray-700"
                                        >
                                            {t('setup.password')}
                                        </label>
                                        <PasswordInput
                                            id="adminPassword"
                                            name="adminPassword"
                                            required
                                            value={formData.adminPassword}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label
                                            htmlFor="confirmPassword"
                                            className="block text-sm font-medium text-gray-700"
                                        >
                                            {t('setup.confirm_password')}
                                        </label>
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
                                        {t('setup.creating')}
                                    </>
                                ) : (
                                    <>{t('setup.create_button')}</>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
