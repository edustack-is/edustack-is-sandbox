import { api } from './index';

export interface AiProvider {
    id: 'google' | 'openai' | 'anthropic' | 'opencode';
    name: string;
}

export const getAvailableProviders = async (): Promise<AiProvider[]> => {
    const response = await api.get('/api/ai/providers');
    return response.data;
};
