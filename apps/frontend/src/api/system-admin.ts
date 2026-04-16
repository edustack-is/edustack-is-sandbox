import { api } from './index';

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
    timestamp: string;
}

export const getHealth = async (): Promise<HealthStatus> => {
    const response = await api.get('/api/health');
    return response.data;
};

// ─── System Audit Log ───────────────────────────────────────────

export const getSystemAuditLog = async (params?: { page?: number; limit?: number; action?: string }) => {
    const response = await api.get('/api/system/audit-log', { params });
    return response.data;
};

// ─── Backups ────────────────────────────────────────────────────

export const createBackup = async () => {
    const response = await api.post('/api/system/backups');
    return response.data;
};

export const listBackups = async () => {
    const response = await api.get('/api/system/backups');
    return response.data;
};

export const downloadBackup = (filename: string) => {
    // Direct download via browser
    const token = localStorage.getItem('access_token');
    const url = `/api/system/backups/${encodeURIComponent(filename)}/download`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    // For auth, use fetch + blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.blob())
        .then(blob => {
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
