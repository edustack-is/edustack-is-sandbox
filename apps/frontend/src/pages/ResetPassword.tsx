import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api';
import { toast } from 'sonner';
import { PasswordInput } from '../components/ui/password-input';
import { validatePassword } from '../lib/password-utils';
import { useTranslation } from 'react-i18next';
import { InlineLanguageSwitcher } from '@/components/InlineLanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Loader2, KeyRound, Shield } from 'lucide-react';

export const ResetPassword = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: '',
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            toast.error(t('reset_password.invalid_token'));
            return;
        }

        const validation = validatePassword(formData.password);
        if (!validation.isValid) {
            toast.error(t(validation.errors[0]));
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            toast.error(t('reset_password.passwords_mismatch'));
            return;
        }

        setLoading(true);
        try {
            await resetPassword({
                token,
                password: formData.password,
            });

            toast.success(t('reset_password.success'));
            navigate('/login');
        } catch (err: any) {
            const msg = err.response?.data?.message || t('reset_password.invalid_token');
            toast.error(Array.isArray(msg) ? msg[0] : msg);
        } finally {
            setLoading(false);
        }
    };

    // Invalid / missing token
    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <InlineLanguageSwitcher />
                <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-center">
                    <div className="mx-auto h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <Shield className="h-6 w-6 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-red-600 mb-4">{t('reset_password.invalid_token')}</h2>
                    <a href="/login" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500 font-medium">
                        {t('reset_password.back_to_login')}
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <InlineLanguageSwitcher />
            <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <div className="text-center mb-8">
                    <div className="mx-auto h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                        <KeyRound className="h-6 w-6 text-indigo-600" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">{t('reset_password.title')}</h2>
                    <p className="mt-2 text-sm text-gray-600">{t('reset_password.subtitle')}</p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                {t('reset_password.new_password')}
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
                                {t('reset_password.confirm_password')}
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
                                {t('reset_password.submitting')}
                            </>
                        ) : (
                            t('reset_password.submit')
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
};
