import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login, getSsoOptions } from '../api';
import { Globe, Github, Apple, Mail, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { useSchool } from '@/context/SchoolContext';

const SSO_ICONS: Record<string, any> = {
    google: Globe,
    github: Github,
    microsoft: Mail,
    apple: Apple,
};

const SSO_COLORS: Record<string, string> = {
    google: 'hover:bg-blue-50 border-blue-200 text-blue-700',
    github: 'hover:bg-slate-100 border-slate-200 text-slate-900',
    microsoft: 'hover:bg-blue-50 border-blue-200 text-blue-600',
    apple: 'hover:bg-slate-100 border-slate-200 text-black',
};

// Map known backend error messages to i18n keys
const ERROR_MAP: Record<string, string> = {
    'Invalid credentials': 'login.invalid_credentials',
    'User not found - you must be invited by the school first.': 'login.user_not_found',
    'User not found': 'login.user_not_found',
    'Account not activated': 'login.account_not_activated',
    'Account is locked': 'login.account_locked',
};

function translateBackendError(message: string, t: (key: string) => string): string {
    if (!message) return t('login.invalid_credentials');
    const key = ERROR_MAP[message];
    if (key) return t(key);
    // Fallback: try partial match
    for (const [pattern, translationKey] of Object.entries(ERROR_MAP)) {
        if (message.toLowerCase().includes(pattern.toLowerCase())) {
            return t(translationKey);
        }
    }
    return t('login.invalid_credentials');
}

export const Login = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { refreshTokenInfo } = useSchool();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [ssoOptions, setSsoOptions] = useState<string[]>([]);
    const [loadingSso, setLoadingSso] = useState(true);

    useEffect(() => {
        // Handle SSO callback token
        const token = searchParams.get('token');
        if (token) {
            localStorage.setItem('access_token', token);
            refreshTokenInfo();
            navigate('/');
        }

        const ssoError = searchParams.get('error');
        if (ssoError) {
            const decoded = decodeURIComponent(ssoError);
            setError(decoded === 'sso_failed' ? t('login.sso_failed') : translateBackendError(decoded, t));
        }

        getSsoOptions().then(setSsoOptions).finally(() => setLoadingSso(false));
    }, [searchParams, navigate, t]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const data = await login(formData);
            if (data.access_token) {
                localStorage.setItem('access_token', data.access_token);
                refreshTokenInfo();
                navigate('/');
            } else {
                setError(t('login.login_failed'));
            }
        } catch (err: any) {
            const backendMsg = err.response?.data?.message || '';
            setError(translateBackendError(backendMsg, t));
        }
    };

    const handleSsoClick = (provider: string) => {
        const backendUrl = window.location.origin === 'http://localhost:5173' ? 'http://localhost:3000' : '';
        window.location.href = `${backendUrl}/api/auth/sso/${provider}`;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                        <Shield className="h-6 w-6 text-indigo-600" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">
                        {t('login.welcome_back')}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        {t('login.sign_in_subtitle')}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded text-red-700 text-sm animate-in fade-in slide-in-from-top-1">
                        {error}
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="email">{t('login.email_label')}</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="name@example.com"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="password">{t('login.password_label')}</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <Button type="submit" className="w-full h-11 text-md font-semibold">
                        {t('login.sign_in')}
                    </Button>
                </form>

                {ssoOptions.length > 0 && (
                    <div className="mt-8">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-200"></span>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-4 text-gray-500 font-medium">{t('login.or_continue_with')}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {ssoOptions.map((provider) => {
                                const Icon = SSO_ICONS[provider] || Globe;
                                return (
                                    <Button
                                        key={provider}
                                        variant="outline"
                                        className={`w-full h-11 justify-center gap-2 font-medium capitalize transition-all ${SSO_COLORS[provider] || ''}`}
                                        onClick={() => handleSsoClick(provider)}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {provider}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {loadingSso && ssoOptions.length === 0 && (
                    <div className="mt-6 flex justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                )}
            </div>
        </div>
    );
};
