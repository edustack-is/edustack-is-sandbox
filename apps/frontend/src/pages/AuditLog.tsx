import { useEffect, useState } from 'react';
import { api } from '@/api';
import { useTranslation } from 'react-i18next';
import { ClipboardList, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface AuditLogEntry {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    details: any;
    createdAt: string;
    actor: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    } | null;
}

interface AuditLogResponse {
    data: AuditLogEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const ACTION_COLORS: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    LOGIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    INVITE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

export function AuditLog() {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 20;

    useEffect(() => {
        loadLogs();
    }, [page]);

    const loadLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get<AuditLogResponse>(`/api/principal/audit-logs?page=${page}&limit=${limit}`);
            setLogs(res.data.data);
            setTotalPages(res.data.totalPages);
            setTotal(res.data.total);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('cs-CZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).format(date);
    };

    const getActionColor = (action: string) => {
        const upper = action.toUpperCase();
        for (const [key, value] of Object.entries(ACTION_COLORS)) {
            if (upper.includes(key)) return value;
        }
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                    <ClipboardList className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {t('audit_log.title', 'Audit log')}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {t('audit_log.description', 'Historie akcí provedených v rámci školy')}
                    </p>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 text-destructive gap-2">
                    <AlertCircle className="h-8 w-8" />
                    <p className="text-sm">{error}</p>
                    <Button variant="outline" size="sm" onClick={loadLogs}>
                        {t('common.retry', 'Zkusit znovu')}
                    </Button>
                </div>
            ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <ClipboardList className="h-12 w-12 opacity-30" />
                    <p className="text-sm">{t('audit_log.empty', 'Zatím nejsou žádné záznamy')}</p>
                </div>
            ) : (
                <>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('audit_log.date', 'Datum')}</TableHead>
                                    <TableHead>{t('audit_log.actor', 'Uživatel')}</TableHead>
                                    <TableHead>{t('audit_log.action', 'Akce')}</TableHead>
                                    <TableHead>{t('audit_log.entity', 'Entita')}</TableHead>
                                    <TableHead>{t('audit_log.details', 'Detail')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {formatDate(log.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {log.actor
                                                ? `${log.actor.firstName} ${log.actor.lastName}`
                                                : <span className="text-muted-foreground italic">{t('common.system', 'Systém')}</span>
                                            }
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={getActionColor(log.action)}>
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            <span className="font-medium">{log.entityType}</span>
                                            <span className="text-xs text-muted-foreground ml-1">
                                                ({log.entityId?.slice(0, 8)}…)
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                                            {log.details ? JSON.stringify(log.details) : '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {t('audit_log.showing', 'Zobrazeno')} {(page - 1) * limit + 1}–{Math.min(page * limit, total)} {t('audit_log.of', 'z')} {total}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium px-2">
                                {page} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
