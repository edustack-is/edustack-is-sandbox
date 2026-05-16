import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
    login,
    getSsoOptions,
    exchangeSsoToken,
    getLoginHelperConfig,
    getLoginHelperUsers,
    LoginHelperUser,
    LoginHelperConfig,
} from '../api';
import { Loader2, UserCircle, ChevronRight, GraduationCap, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { useSchool } from '@/context/SchoolContext';
import { toast } from 'sonner';
import { InlineLanguageSwitcher } from '@/components/InlineLanguageSwitcher';
import {
    SSO_PROVIDER_ICON,
    SSO_PROVIDER_COLORS,
    SSO_PROVIDER_LABEL,
    SsoFallbackIcon,
} from '@/components/sso-providers';

// Map known backend error messages to i18n keys
const ERROR_MAP: Record<string, string> = {
    'Invalid credentials': 'login.invalid_credentials',
    'User not found - you must be invited by the school first.': 'login.user_not_found',
    'User not found': 'login.user_not_found',
    'Account not activated': 'login.account_not_activated',
    'Account is locked': 'login.account_locked',
};

function translateBackendError(message: string, t: (key: string, opts?: any) => string): string {
    if (!message) return t('login.invalid_credentials');
    // Handle parametric lockout message: 'account_locked_until:N'
    if (message.startsWith('account_locked_until:')) {
        const minutes = message.split(':')[1];
        return t('login.account_locked_until', { minutes });
    }
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

interface FieldErrors {
    email?: string;
    password?: string;
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
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [ssoOptions, setSsoOptions] = useState<string[]>([]);
    const [loadingSso, setLoadingSso] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // ─── Login Helper state ─────────────────────────────────
    const [helperConfig, setHelperConfig] = useState<LoginHelperConfig | null>(null);
    const [helperUsers, setHelperUsers] = useState<LoginHelperUser[]>([]);
    const [loadingHelper, setLoadingHelper] = useState(false);

    // ─── Filter state ───────────────────────────────────────
    const [selectedSchool, setSelectedSchool] = useState<string>('all');
    const [selectedRole, setSelectedRole] = useState<string>('all');

    // Compute unique options for filters
    const uniqueSchools = Array.from(
        new Set(helperUsers.flatMap((u) => u.memberships.map((m) => m.schoolName))),
    ).sort();
    const uniqueRoles = Array.from(new Set(helperUsers.flatMap((u) => u.memberships.map((m) => m.role)))).sort();

    // Apply filters
    const filteredUsers = helperUsers.filter((user) => {
        const matchesSchool = selectedSchool === 'all' || user.memberships.some((m) => m.schoolName === selectedSchool);
        const matchesRole = selectedRole === 'all' || user.memberships.some((m) => m.role === selectedRole);
        return matchesSchool && matchesRole;
    });

    useEffect(() => {
        // Handle SSO callback — the backend already set the session cookie
        // via exchange-token; we just refresh our session view and bounce.
        const ssoOk = searchParams.get('sso');
        if (ssoOk === 'ok') {
            exchangeSsoToken()
                .then(async () => {
                    await refreshTokenInfo();
                    navigate('/');
                })
                .catch(() => {
                    toast.error(t('login.sso_failed'));
                });
            return; // don't load SSO options while exchanging
        }

        // Legacy: ?token= callbacks would have written localStorage previously.
        // Now the backend should be doing the cookie set itself; if a token
        // arrives here we just trigger a session refresh and ignore the value.
        const token = searchParams.get('token');
        if (token) {
            refreshTokenInfo().then(() => navigate('/'));
        }

        const ssoError = searchParams.get('error');
        if (ssoError) {
            const decoded = decodeURIComponent(ssoError);
            toast.error(decoded === 'sso_failed' ? t('login.sso_failed') : translateBackendError(decoded, t));
        }

        getSsoOptions()
            .then(setSsoOptions)
            .finally(() => setLoadingSso(false));

        // Fetch login helper config
        getLoginHelperConfig().then((config) => {
            setHelperConfig(config);
            if (config.enabled) {
                setLoadingHelper(true);
                getLoginHelperUsers()
                    .then(setHelperUsers)
                    .finally(() => setLoadingHelper(false));
            }
        });
    }, [searchParams, navigate, t]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        // Clear error for this field on change
        if (fieldErrors[name as keyof FieldErrors]) {
            setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const validate = (): boolean => {
        const errors: FieldErrors = {};

        if (!formData.email.trim()) {
            errors.email = t('login.validation_email_required', 'Email je povinný');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = t('login.validation_email_invalid', 'Neplatný formát emailu');
        }

        if (!formData.password.trim()) {
            errors.password = t('login.validation_password_required', 'Heslo je povinné');
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setSubmitting(true);

        try {
            const data = await login(formData);
            if (data.access_token) {
                // Token is set as httpOnly cookie by the backend; we just
                // need to refresh our local session view.
                await refreshTokenInfo();
                navigate('/');
            } else {
                toast.error(t('login.login_failed'));
            }
        } catch (err: any) {
            const backendMsg = err.response?.data?.message || '';
            toast.error(translateBackendError(backendMsg, t));
        } finally {
            setSubmitting(false);
        }
    };

    const handleSsoClick = (provider: string) => {
        const backendUrl = window.location.origin === 'http://localhost:5173' ? 'http://localhost:3000' : '';
        window.location.href = `${backendUrl}/api/auth/sso/${provider}`;
    };

    const handleHelperLogin = async (user: any) => {
        if (!helperConfig?.defaultPassword) return;

        setSubmitting(true);
        try {
            const data = await login({
                email: user.email,
                password: helperConfig.defaultPassword,
            });
            if (data.access_token) {
                await refreshTokenInfo();
                navigate('/');
            } else {
                toast.error(t('login.login_failed'));
            }
        } catch (err: any) {
            const backendMsg = err.response?.data?.message || '';
            toast.error(translateBackendError(backendMsg, t));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <InlineLanguageSwitcher />
            <div
                className={`w-full transition-all duration-500 ease-in-out flex flex-col md:flex-row items-stretch justify-center gap-8 ${helperConfig?.enabled && helperUsers.length > 0 ? 'max-w-4xl' : 'max-w-md'}`}
            >
                {/* ─── Main Login Card ────────────────────────── */}
                <div className="flex-1 bg-white p-8 rounded-xl shadow-lg border border-gray-100 max-w-md w-full mx-auto">
                    <div className="text-center">
                        {/* Brand mark — show the dark-text variant on the
                            white login card; the white-text variant kicks in
                            via Tailwind's `dark:` class when the user has
                            toggled their OS / app to dark mode. */}
                        <img
                            src="/edustack-logo-light.png"
                            alt="EduStack IS"
                            className="mx-auto h-20 w-auto mb-4 block dark:hidden"
                        />
                        <img
                            src="/edustack-logo-dark.png"
                            alt="EduStack IS"
                            className="mx-auto h-20 w-auto mb-4 hidden dark:block"
                        />
                        <h2 className="text-3xl font-extrabold text-gray-900">{t('login.welcome_back')}</h2>
                        <p className="mt-2 text-sm text-gray-600">{t('login.sign_in_subtitle')}</p>
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
                        <div className="space-y-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="email">{t('login.email_label')}</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="name@example.com"
                                    className={fieldErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                                    aria-invalid={!!fieldErrors.email}
                                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                                />
                                {fieldErrors.email && (
                                    <p id="email-error" className="text-sm text-red-600 mt-0.5">
                                        {fieldErrors.email}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="password">{t('login.password_label')}</Label>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    className={fieldErrors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}
                                    aria-invalid={!!fieldErrors.password}
                                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                                />
                                {fieldErrors.password && (
                                    <p id="password-error" className="text-sm text-red-600 mt-0.5">
                                        {fieldErrors.password}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Link
                                to="/forgot-password"
                                className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                            >
                                {t('login.forgot_password')}
                            </Link>
                        </div>

                        <Button type="submit" className="w-full h-11 text-md font-semibold" disabled={submitting}>
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('login.sign_in')}
                                </>
                            ) : (
                                t('login.sign_in')
                            )}
                        </Button>
                    </form>

                    {ssoOptions.length > 0 && (
                        <div className="mt-8">
                            <div className="relative mb-6">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-gray-200"></span>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-4 text-gray-500 font-medium">
                                        {t('login.or_continue_with')}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {ssoOptions.map((provider) => {
                                    const Icon = SSO_PROVIDER_ICON[provider] || SsoFallbackIcon;
                                    const label = SSO_PROVIDER_LABEL[provider] || provider;
                                    const colors = SSO_PROVIDER_COLORS[provider] || '';
                                    return (
                                        <Button
                                            key={provider}
                                            variant="outline"
                                            className={`w-full h-11 justify-center gap-2.5 font-medium transition-all ${colors}`}
                                            onClick={() => handleSsoClick(provider)}
                                        >
                                            <Icon className="h-5 w-5" />
                                            {label}
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

                {/* ─── Login Helper Card (visible if enabled) ────────── */}
                {helperConfig?.enabled && helperUsers.length > 0 && (
                    <div className="flex-1 bg-white p-8 rounded-xl shadow-lg border border-indigo-100 max-w-md w-full mx-auto flex flex-col">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <GraduationCap className="h-5 w-5 text-indigo-600" />
                                {t('login.helper_title')}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">{t('login.helper_desc')}</p>
                        </div>
                        {/* ─── Filters ───────────────────────────────── */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <select
                                value={selectedSchool}
                                onChange={(e) => setSelectedSchool(e.target.value)}
                                className="text-xs border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            >
                                <option value="all">{t('login.filter_all_schools', 'Všechny školy')}</option>
                                {uniqueSchools.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="text-xs border border-gray-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            >
                                <option value="all">{t('login.filter_all_roles', 'Všechny role')}</option>
                                {uniqueRoles.map((r) => (
                                    <option key={r} value={r}>
                                        {t(`roles.${r}`)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
                            {loadingHelper ? (
                                <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                    <span className="text-sm">{t('login.helper_searching')}</span>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {filteredUsers.map((user) => (
                                        <button
                                            key={user.email}
                                            type="button"
                                            onClick={() => handleHelperLogin(user)}
                                            disabled={submitting}
                                            className="group w-full text-left p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-indigo-50 hover:border-indigo-200 transition-all disabled:opacity-50"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-white border border-gray-200 flex items-center justify-center group-hover:border-indigo-300">
                                                        <UserCircle className="h-6 w-6 text-gray-400 group-hover:text-indigo-500" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 group-hover:text-indigo-900">
                                                            {user.firstName} {user.lastName}
                                                        </div>
                                                        <div className="text-xs text-gray-500">{user.email}</div>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-400 transition-transform group-hover:translate-x-1" />
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {user.memberships.map((m: any, idx: number) => (
                                                    <span
                                                        key={idx}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[10px] font-medium text-gray-600 group-hover:border-indigo-100 group-hover:text-indigo-700"
                                                    >
                                                        <Building2 className="h-2.5 w-2.5" />
                                                        {m.schoolName} • {t(`roles.${m.role}`)}
                                                    </span>
                                                ))}
                                            </div>
                                        </button>
                                    ))}
                                    {filteredUsers.length === 0 && !loadingHelper && (
                                        <div className="text-center py-10 text-gray-400 text-sm">
                                            {t('login.no_users_found', 'Žádní uživatelé nevyhovují filtrům')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>{' '}
                    </div>
                )}
            </div>
        </div>
    );
};
