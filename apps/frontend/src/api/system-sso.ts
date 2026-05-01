import { api } from './index';

export interface SsoProviderSettings {
    clientId: string;
    isActive: boolean;
    isConfigured: boolean;
    teamId?: string;
    keyId?: string;
}

export interface SsoSettings {
    google: SsoProviderSettings;
    github: SsoProviderSettings;
    microsoft: SsoProviderSettings;
    apple: SsoProviderSettings;
}

export const getSsoSettings = async (): Promise<SsoSettings> => {
    const response = await api.get('/api/system/sso');
    return response.data;
};

export const updateSsoProvider = async (provider: string, data: any) => {
    const response = await api.put(`/api/system/sso/\${provider}`, data);
    return response.data;
};

export const deleteSsoProvider = async (provider: string) => {
    const response = await api.delete(`/api/system/sso/\${provider}`);
    return response.data;
};

export const reloadSsoStrategies = async () => {
    const response = await api.post('/api/system/sso/reload');
    return response.data;
};
