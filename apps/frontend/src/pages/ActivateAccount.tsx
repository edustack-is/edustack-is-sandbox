import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { acceptInvitation } from '../api';
import { toast } from 'sonner';
import { PasswordInput } from '../components/ui/password-input';
import { validatePassword } from '../lib/password-utils';
import { useTranslation } from 'react-i18next';

export const ActivateAccount = () => {
    const { t } = useTranslation();
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
            const res = await acceptInvitation({
                token,
                password: formData.password
            });

            // Save token and redirect
            localStorage.setItem('access_token', res.access_token);
            toast.success(t('activate.success'));
            window.location.href = '/select-school';
        } catch (err: any) {
            const msg = err.response?.data?.message || t('common.error');
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="max-w-md w-full bg-white p-8 rounded shadow text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">{t('activate.invalid_link')}</h2>
                    <p className="text-gray-600">{t('activate.link_expired')}</p>
                    <a href="/login" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500">
                        {t('activate.back_to_login')}
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded shadow">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        {t('activate.title')}
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        {t('activate.subtitle')}
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="mb-4">
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
                        <div className="mb-4">
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

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {loading ? t('activate.activating') : t('activate.activate_button')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
