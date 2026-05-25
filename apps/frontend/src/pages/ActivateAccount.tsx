import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { acceptInvitation, getSsoOptions, getBackendBaseUrl } from '../api';
import { toast } from 'sonner';
import { PasswordInput } from '../components/ui/password-input';
import { validatePassword } from '../lib/password-utils';
import { useTranslation } from 'react-i18next';
import { InlineLanguageSwitcher } from '@/components/InlineLanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, Fingerprint } from 'lucide-react';
import {
    SSO_PROVIDER_ICON,
    SSO_PROVIDER_COLORS,
    SSO_PROVIDER_LABEL,
    SsoFallbackIcon,
} from '@/components/sso-providers';

export const ActivateAccount = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: '',
    });
    const [loading, setLoading] = useState(false);
    const [ssoOptions, setSsoOptions] = useState<string[]>([]);
    const [loadingSso, setLoadingSso] = useState(true);

    useEffect(() => {
        getSsoOptions()
            .then(setSsoOptions)
            .finally(() => setLoadingSso(false));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            toast.error(t('activate.missing_token'));
            return;
        }

        const validation = validatePassword(formData.password);
        if (!validation.isValid) {
            toast.error(t(validation.errors[0]));
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            toast.error(t('activate.passwords_mismatch'));
            return;
        }

        setLoading(true);
        try {
            await acceptInvitation({
                token,
                password: formData.password,
            });

            // Backend sets the session cookie; we just bounce to school select.
            toast.success(t('activate.success'));
            window.location.href = '/select-school';
        } catch (err: any) {
            const msg = err.response?.data?.message || t('common.error');
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleSsoActivate = (provider: string) => {
        if (!token) return;
        window.location.href = `${getBackendBaseUrl()}/api/auth/sso/${provider}?invitationToken=${encodeURIComponent(token)}`;
    };

    // ---- Invalid / missing token ----
    if (!token) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 gap-6">
                <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-center">
                    <div className="mx-auto h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <Shield className="h-6 w-6 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-red-600 mb-4">{t('activate.invalid_link')}</h2>
                    <p className="text-gray-600">{t('activate.link_expired')}</p>
                    <a href="/login" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500 font-medium">
                        {t('activate.back_to_login')}
                    </a>
                </div>
                <div className="flex justify-center">
                    <InlineLanguageSwitcher />
                </div>
            </div>
        );
    }

    // ---- Main activation page ----
    const hasSso = !loadingSso && ssoOptions.length > 0;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 gap-6">
            <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="mx-auto h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                        <Fingerprint className="h-6 w-6 text-indigo-600" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">{t('activate.title')}</h2>
                    <p className="mt-2 text-sm text-gray-600">{t('activate.subtitle')}</p>
                </div>

                {/* SSO section — shown when providers are configured */}
                {hasSso && (
                    <>
                        <div className="space-y-3 mb-6">
                            <p className="text-sm font-medium text-gray-700">{t('activate.sso_section_title')}</p>
                            {ssoOptions.map((provider) => {
                                const Icon = SSO_PROVIDER_ICON[provider] || SsoFallbackIcon;
                                const label = SSO_PROVIDER_LABEL[provider] || provider;
                                const colors = SSO_PROVIDER_COLORS[provider] || '';
                                return (
                                    <Button
                                        key={provider}
                                        variant="outline"
                                        className={`w-full h-11 justify-center gap-2.5 font-medium transition-all ${colors}`}
                                        onClick={() => handleSsoActivate(provider)}
                                    >
                                        <Icon className="h-5 w-5" />
                                        {t('activate.activate_via_sso', { provider: label })}
                                    </Button>
                                );
                            })}
                        </div>

                        {/* Divider */}
                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-200" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-4 text-gray-500 font-medium">
                                    {t('activate.or_use_password')}
                                </span>
                            </div>
                        </div>
                    </>
                )}

                {/* Loading SSO spinner */}
                {loadingSso && (
                    <div className="flex justify-center mb-6">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                )}

                {/* Password form — always visible */}
                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                {t('activate.new_password')}
                            </label>
                            <PasswordInput
                                id="password"
                                name="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                {t('activate.confirm_password')}
                            </label>
                            <PasswordInput
                                id="confirmPassword"
                                name="confirmPassword"
                                required
                                showStrength={false}
                                value={formData.confirmPassword}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <Button type="submit" className="w-full h-11 text-md font-semibold" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('activate.activating')}
                            </>
                        ) : (
                            t('activate.activate_button')
                        )}
                    </Button>
                </form>
            </div>
            <div className="flex justify-center">
                <InlineLanguageSwitcher />
            </div>
        </div>
    );
};
