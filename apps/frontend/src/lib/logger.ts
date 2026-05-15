/**
 * Frontend logger — sends errors and warnings to the backend relay endpoint.
 * Batch-buffered to minimize network impact.
 */
import { api } from '../api';

interface LogEntry {
    level: 'error' | 'warn' | 'info';
    message: string;
    stack?: string;
    url?: string;
    userAgent?: string;
    userId?: string;
    timestamp: string;
}

const BUFFER: LogEntry[] = [];
const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER_SIZE = 10;

let flushTimer: ReturnType<typeof setInterval> | null = null;

function getUserId(): string | undefined {
    // The JWT now lives in an httpOnly cookie and is no longer readable from
    // JS. The backend log endpoint can derive the actor from the request
    // cookie if it needs the user id.
    return undefined;
}

function createEntry(level: LogEntry['level'], message: string, stack?: string): LogEntry {
    return {
        level,
        message,
        stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: getUserId(),
        timestamp: new Date().toISOString(),
    };
}

async function flush() {
    if (BUFFER.length === 0) return;
    const batch = BUFFER.splice(0, BUFFER.length);

    for (const entry of batch) {
        try {
            await api.post('/api/logs', entry);
        } catch {
            // Silently ignore — log relay should never break the app
        }
    }
}

function enqueue(entry: LogEntry) {
    BUFFER.push(entry);
    if (BUFFER.length >= MAX_BUFFER_SIZE) {
        flush();
    }
}

/** Initialize the logger — call once at app startup */
export function initLogger() {
    // Start periodic flushing
    if (!flushTimer) {
        flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
    }

    // Global error handler
    window.onerror = (_msg, _source, _lineno, _colno, error) => {
        logger.error(error?.message || String(_msg), error?.stack);
    };

    // Unhandled promise rejections
    window.onunhandledrejection = (event) => {
        const reason = event.reason;
        logger.error(reason?.message || String(reason), reason?.stack);
    };
}

export const logger = {
    error(message: string, stack?: string) {
        console.error(`[Logger] ${message}`, stack);
        enqueue(createEntry('error', message, stack));
    },
    warn(message: string) {
        console.warn(`[Logger] ${message}`);
        enqueue(createEntry('warn', message));
    },
    info(message: string) {
        console.info(`[Logger] ${message}`);
        enqueue(createEntry('info', message));
    },
};
