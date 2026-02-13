import { api } from './index';

// ─── AI Settings ────────────────────────────────────────────────

export const getAiSettings = async () => {
    const response = await api.get('/api/system/settings/ai');
    return response.data; // { isConfigured, keyHint, updatedAt }
};

export const updateAiSettings = async (keys: {
    geminiApiKey?: string;
    openAiApiKey?: string;
    anthropicApiKey?: string;
}) => {
    const response = await api.put('/api/system/settings/ai', keys);
    return response.data;
};

// ─── AI Usage ───────────────────────────────────────────────────

export const getAiUsage = async () => {
    const response = await api.get('/api/system/ai-usage');
    return response.data;
    // { month, totals: { totalTokens, inputTokens, outputTokens, requestCount },
    //   perSchool: [...], daily: [...] }
};
