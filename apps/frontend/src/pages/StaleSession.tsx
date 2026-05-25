import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Database, Loader2, History, LogOut, Upload, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import { uploadBackup, restoreBackup } from '@/api/system-admin';
import { useSchool } from '@/context/SchoolContext';
import { InlineLanguageSwitcher } from '@/components/InlineLanguageSwitcher';

/**
 * Recovery screen shown when the JWT in the session cookie decodes to a
 * userId that no longer exists in the database — typically right after a
 * sysadmin restored a backup that does not contain their account. The
 * routed pages would otherwise spam 404s on every "/me"-style request.
 *
 * Offers two ways out:
 *  1. Upload + restore another backup (uses the still-valid sysadmin JWT;
 *     the guard only checks JWT claims, not DB state).
 *  2. Log out and return to /login.
 */
export const StaleSession = () => {
    const { t } = useTranslation();
    const { isSystemAdmin, email } = useSchool();

    const [file, setFile] = useState<File | null>(null);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    const acceptFile = useCallback(
        (incoming: File) => {
            const name = incoming.name.toLowerCase();
            if (!name.endsWith('.sqlite') && !name.endsWith('.db')) {
                toast.error(t('stale_session.invalid_file', 'Nepodporovaný typ souboru. Použijte .sqlite nebo .db.'));
                return;
            }
            setFile(incoming);
            setError('');
        },
        [t],
    );

    // Whole-window drag overlay so the user can drop the backup anywhere.
    useEffect(() => {
        const onDragOver = (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        };
        const onDragEnter = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current++;
            if (dragCounter.current === 1) setIsDragging(true);
        };
        const onDragLeave = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current--;
            if (dragCounter.current <= 0) {
                dragCounter.current = 0;
                setIsDragging(false);
            }
        };
        const onDrop = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current = 0;
            setIsDragging(false);
            const dropped = e.dataTransfer?.files?.[0];
            if (dropped) acceptFile(dropped);
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
    }, [acceptFile]);

    const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files?.[0];
        if (picked) acceptFile(picked);
    };

    const handleRestore = async () => {
        if (!file) return;
        setWorking(true);
        setError('');
        try {
            const uploaded = (await uploadBackup(file)) as { filename: string };
            await restoreBackup(uploaded.filename);
            toast.success(t('stale_session.restore_success', 'Databáze obnovena. Načítám aplikaci…'));
            // Force a hard reload so SchoolContext re-evaluates /me against
            // the new database.
            setTimeout(() => {
                window.location.href = '/login';
            }, 1200);
        } catch (err: any) {
            const msg =
                err?.response?.data?.message || err?.message || t('stale_session.restore_failed', 'Obnova selhala');
            setError(msg);
            toast.error(msg);
        } finally {
            setWorking(false);
        }
    };

    const handleLogout = async () => {
        try {
            await api.post('/api/auth/logout');
        } catch {
            /* ignore — cookie is cleared either way once we navigate. */
        }
        window.location.href = '/login';
    };

    return (
        <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-white to-indigo-50 px-4 py-12 gap-6">
            {isDragging && (
                <div className="fixed inset-0 z-50 bg-indigo-600/40 backdrop-blur-md pointer-events-none flex items-center justify-center">
                    <div className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
                        <Upload className="h-12 w-12 text-indigo-600 animate-bounce" />
                        <p className="text-lg font-bold text-gray-900">
                            {t('stale_session.drop_to_upload', 'Pusťte zálohu zde')}
                        </p>
                    </div>
                </div>
            )}

            <div className="max-w-lg w-full space-y-6">
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 shadow-sm">
                        <AlertTriangle className="h-8 w-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {t('stale_session.title', 'Účet z této relace v databázi neexistuje')}
                    </h1>
                    <p className="text-gray-600">
                        {t(
                            'stale_session.subtitle',
                            'Nejspíš byla obnovena záloha, ve které není váš účet. Můžete nahrát jinou zálohu nebo se odhlásit a přihlásit znovu.',
                        )}
                    </p>
                    {email && (
                        <p className="text-xs text-gray-400">
                            {t('stale_session.session_email', 'Cookie přihlášena pro: {{email}}', { email })}
                        </p>
                    )}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 text-center">
                        {error}
                    </div>
                )}

                {/* Restore card — only meaningful for sysadmins (backup endpoints are gated). */}
                {isSystemAdmin && (
                    <div className="bg-white rounded-2xl shadow-sm border border-violet-200 p-6 space-y-4">
                        <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                            <History className="h-5 w-5 text-violet-500" />
                            {t('stale_session.upload_section', 'Obnovit ze zálohy')}
                        </div>

                        <input
                            type="file"
                            accept=".sqlite,.db"
                            id="stale-backup-input"
                            className="hidden"
                            onChange={handlePick}
                        />
                        <label
                            htmlFor="stale-backup-input"
                            className={cn(
                                'flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all',
                                file
                                    ? 'border-green-400 bg-green-50'
                                    : 'border-gray-300 hover:border-violet-400 hover:bg-violet-50',
                            )}
                        >
                            <Database className={cn('h-10 w-10 mb-2', file ? 'text-green-500' : 'text-gray-400')} />
                            <span className="text-sm font-medium text-gray-700 text-center">
                                {file?.name || t('stale_session.select_file', 'Vyberte soubor zálohy (.sqlite)')}
                            </span>
                            <span className="text-xs text-gray-500 mt-2 text-center max-w-[320px]">
                                {t(
                                    'stale_session.upload_hint',
                                    'Soubor bude nahrán do úložiště záloh a aplikován jako aktuální databáze.',
                                )}
                            </span>
                        </label>

                        <button
                            type="button"
                            onClick={handleRestore}
                            disabled={!file || working}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-medium bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                        >
                            {working ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    {t('stale_session.restoring', 'Obnovuji systém…')}
                                </>
                            ) : (
                                <>
                                    <History className="h-5 w-5" />
                                    {t('stale_session.restore_button', 'Obnovit ze zálohy')}
                                </>
                            )}
                        </button>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-3">
                    <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <LogOut className="h-5 w-5 text-gray-500" />
                        {t('stale_session.logout_section', 'Odhlásit se a začít znovu')}
                    </div>
                    <p className="text-sm text-gray-500">
                        {t('stale_session.logout_desc', 'Smaže přihlašovací cookie a přesměruje na přihlášení.')}
                    </p>
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={working}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-all"
                    >
                        <LogOut className="h-5 w-5" />
                        {t('stale_session.logout_button', 'Odhlásit se')}
                    </button>
                </div>
            </div>
            <div className="flex justify-center">
                <InlineLanguageSwitcher />
            </div>
        </div>
    );
};
