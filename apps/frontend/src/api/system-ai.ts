import { api } from './index';

// ─── AI Settings ────────────────────────────────────────────────

export const getAiSettings = async () => {
    const response = await api.get('/api/system/settings/ai');
    return response.data; // { isConfigured, keyHint, updatedAt }
};

export const updateAiSettings = async (geminiApiKey: string) => {
    const response = await api.put('/api/system/settings/ai', { geminiApiKey });
    return response.data;
};

// ─── AI Usage ───────────────────────────────────────────────────

export const getAiUsage = async () => {
    const response = await api.get('/api/system/ai-usage');
    return response.data;
    // { month, totals: { totalTokens, inputTokens, outputTokens, requestCount },
    //   perSchool: [...], daily: [...] }
};
