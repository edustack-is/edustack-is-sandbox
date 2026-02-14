import { useState, useEffect, useRef } from 'react';
import { useTaskQueue, TaskItem, TaskStatus } from '@/context/TaskQueueContext';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import {
    ChevronUp, ChevronDown, Loader2,
    CheckCircle2, XCircle, ListTodo, Trash2,
} from 'lucide-react';

// ─── Tool label helper (i18n-aware) ─────────────────────────────

export function getToolLabel(t: (key: string, fallback?: any) => string, name: string): string {
    const translated = t(`taskQueue.tools.${name}`, '');
    if (translated) return translated;
    // Smart fallback: convert snake_case to readable text
    return name
        .replace(/_/g, ' ')
        .replace(/^\w/, c => c.toUpperCase());
}

// ─── Main Component ─────────────────────────────────────────────

export function TaskQueuePanel() {
    const { tasks, clearFinished, hasRunning, runningCount } = useTaskQueue();
    const [expanded, setExpanded] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    // Auto-expand when new tasks arrive
    useEffect(() => {
        if (hasRunning) {
            setExpanded(true);
        }
    }, [hasRunning]);

    // Auto-scroll to top when new task added
    useEffect(() => {
        if (panelRef.current && expanded) {
            panelRef.current.scrollTop = 0;
        }
    }, [tasks.length, expanded]);

    // Don't render if no tasks ever
    if (tasks.length === 0 && !expanded) return null;

    // Sort: running first, then by time (newest first for running, oldest first for done)
    const sortedTasks = [...tasks].sort((a, b) => {
        const statusOrder: Record<TaskStatus, number> = { running: 0, error: 1, done: 2 };
        const sDiff = statusOrder[a.status] - statusOrder[b.status];
        if (sDiff !== 0) return sDiff;
        if (a.status === 'running') return b.createdAt - a.createdAt;
        return (b.finishedAt || b.createdAt) - (a.finishedAt || a.createdAt);
    });

    const doneCount = tasks.filter(t => t.status === 'done').length;
    const errorCount = tasks.filter(t => t.status === 'error').length;

    return (
        <div
            className={cn(
                'fixed bottom-0 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-in-out',
                'w-1/3 min-w-[360px] max-w-[520px]',
                'bg-background/95 backdrop-blur-md border border-border border-b-0 rounded-t-xl shadow-2xl',
            )}
            style={{
                maxHeight: expanded ? '320px' : '0px',
                minHeight: tasks.length > 0 ? '44px' : '0px',
            }}
        >
            {/* Header bar - always visible when there are tasks */}
            <button
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    'w-full flex items-center justify-between px-4 py-2.5',
                    'hover:bg-muted/50 transition-colors cursor-pointer',
                    'border-b border-border/50',
                )}
            >
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <ListTodo className="h-4 w-4 text-violet-500" />
                        {runningCount > 0 && (
                            <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-violet-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                                {runningCount}
                            </span>
                        )}
                    </div>
                    <span className="text-sm font-medium">
                        {t('taskQueue.title')}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {runningCount > 0 && (
                            <span className="flex items-center gap-1 text-violet-500">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {runningCount} {t('taskQueue.running')}
                            </span>
                        )}
                        {doneCount > 0 && (
                            <span className="flex items-center gap-1 text-green-500">
                                <CheckCircle2 className="h-3 w-3" />
                                {doneCount}
                            </span>
                        )}
                        {errorCount > 0 && (
                            <span className="flex items-center gap-1 text-red-500">
                                <XCircle className="h-3 w-3" />
                                {errorCount}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {tasks.some(t => t.status !== 'running') && (
                        <button
                            onClick={(e) => { e.stopPropagation(); clearFinished(); }}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            title={t('taskQueue.clear_finished')}
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    )}
                    {expanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    )}
                </div>
            </button>

            {/* Task list */}
            {expanded && (
                <div
                    ref={panelRef}
                    className="overflow-y-auto"
                    style={{ maxHeight: '272px' }}
                >
                    {sortedTasks.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                            {t('taskQueue.empty')}
                        </div>
                    ) : (
                        <div className="divide-y divide-border/30">
                            {sortedTasks.map(task => (
                                <TaskRow key={task.id} task={task} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Task Row ───────────────────────────────────────────────────

function TaskRow({ task }: { task: TaskItem }) {
    const { t } = useTranslation();
    const elapsed = task.finishedAt
        ? ((task.finishedAt - task.createdAt) / 1000).toFixed(1)
        : null;
    const label = getToolLabel(t, task.name);

    return (
        <div
            className={cn(
                'flex items-center gap-3 px-4 py-2.5 transition-colors',
                task.status === 'running' && 'bg-violet-500/5',
                task.status === 'error' && 'bg-red-500/5',
                task.status === 'done' && 'opacity-60',
            )}
        >
            {/* Status icon */}
            <div className="flex-shrink-0">
                {task.status === 'running' && (
                    <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                )}
                {task.status === 'done' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {task.status === 'error' && (
                    <XCircle className="h-4 w-4 text-red-500" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className={cn(
                    'text-sm truncate',
                    task.status === 'done' && 'line-through text-muted-foreground',
                    task.status === 'error' && 'text-red-400',
                )}>
                    {label}
                </p>
                {task.error && (
                    <p className="text-xs text-red-400 truncate mt-0.5">{task.error}</p>
                )}
            </div>

            {/* Time info */}
            <div className="flex-shrink-0 text-xs text-muted-foreground">
                {task.status === 'running' ? (
                    <RunningTimer startTime={task.createdAt} />
                ) : elapsed ? (
                    <span>{elapsed}s</span>
                ) : null}
            </div>
        </div>
    );
}

// ─── Running Timer ──────────────────────────────────────────────

function RunningTimer({ startTime }: { startTime: number }) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    return <span className="text-violet-400 tabular-nums">{elapsed}s</span>;
}
