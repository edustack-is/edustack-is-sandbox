import { api, getBackendBaseUrl } from './index';

// ─── System Settings ────────────────────────────────────────────

export const getSystemSettings = async (): Promise<Record<string, string>> => {
    const response = await api.get('/api/system/settings');
    return response.data;
};

export const updateSystemSettings = async (settings: Record<string, string>) => {
    const response = await api.put('/api/system/settings', settings);
    return response.data;
};

// ─── Health ─────────────────────────────────────────────────────

export interface HealthStatus {
    status: string;
    uptime: number;
    database: string;
    memory: { rss: number; heapUsed: number; heapTotal: number };
    version: string;
    /** Git SHA of the deployed image. "unknown" for local dev (no docker build). */
    commit?: string;
    /** ISO UTC timestamp baked into the image at build time. "unknown" for local dev. */
    buildTime?: string;
    timestamp: string;
}

export const getHealth = async (): Promise<HealthStatus> => {
    const response = await api.get('/api/health');
    return response.data;
};

// ─── System Audit Log ───────────────────────────────────────────

export const getSystemAuditLog = async (params?: {
    page?: number;
    limit?: number;
    action?: string;
    entity?: string;
    actorId?: string;
    dateFrom?: string;
    dateTo?: string;
}) => {
    const response = await api.get('/api/system/audit-log', { params });
    return response.data;
};

// ─── Backups ────────────────────────────────────────────────────

export const createBackup = async (name?: string) => {
    const response = await api.post('/api/system/backups', {}, { params: { name } });
    return response.data;
};

export const listBackups = async () => {
    const response = await api.get('/api/system/backups');
    return response.data;
};

export const downloadBackup = (filename: string) => {
    // Resolve against the backend origin — a relative URL stays on the
    // frontend domain (Cloudflare Pages) and Pages returns the SPA's
    // index.html (~1.3 kB) for unknown routes, so the download silently
    // saved an HTML file instead of the actual .sqlite blob.
    const url = `${getBackendBaseUrl()}/api/system/backups/${encodeURIComponent(filename)}/download`;
    const a = document.createElement('a');
    a.download = filename;
    fetch(url, { credentials: 'include' })
        .then((r) => {
            if (!r.ok) throw new Error(`Download failed: HTTP ${r.status}`);
            return r.blob();
        })
        .then((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            a.href = blobUrl;
            a.click();
            URL.revokeObjectURL(blobUrl);
        });
};

export const restoreBackup = async (filename: string) => {
    const response = await api.post(`/api/system/backups/${encodeURIComponent(filename)}/restore`);
    return response.data;
};

export const deleteBackup = async (filename: string) => {
    const response = await api.delete(`/api/system/backups/${encodeURIComponent(filename)}`);
    return response.data;
};

export const uploadBackup = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/system/backups/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};
