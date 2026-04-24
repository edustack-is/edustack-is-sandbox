import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestPasswordReset } from '../api';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { InlineLanguageSwitcher } from '@/components/InlineLanguageSwitcher';

export const ForgotPassword = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [emailError, setEmailError] = useState('');

    const validate = (): boolean => {
        if (!email.trim()) {
            setEmailError(t('login.validation_email_required'));
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setEmailError(t('login.validation_email_invalid'));
            return false;
        }
        setEmailError('');
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        try {
            await requestPasswordReset(email);
            setSubmitted(true);
        } catch {
            // Always show success to prevent email enumeration
            setSubmitted(true);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <InlineLanguageSwitcher />
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                {submitted ? (
                    // Success state
                    <div className="text-center space-y-4">
                        <div className="mx-auto h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">{t('forgot_password.success_title')}</h2>
                        <p className="text-sm text-gray-600">{t('forgot_password.success_message')}</p>
                        <Button variant="outline" className="mt-4" onClick={() => navigate('/login')}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            {t('forgot_password.back_to_login')}
                        </Button>
                    </div>
                ) : (
                    // Form state
                    <>
                        <div className="text-center">
                            <div className="mx-auto h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                                <Mail className="h-6 w-6 text-indigo-600" />
                            </div>
                            <h2 className="text-3xl font-extrabold text-gray-900">{t('forgot_password.title')}</h2>
                            <p className="mt-2 text-sm text-gray-600">{t('forgot_password.subtitle')}</p>
                        </div>

                        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
                            <div className="grid gap-1.5">
                                <Label htmlFor="email">{t('forgot_password.email_label')}</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (emailError) setEmailError('');
                                    }}
                                    placeholder="name@example.com"
                                    className={emailError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                                    aria-invalid={!!emailError}
                                    aria-describedby={emailError ? 'email-error' : undefined}
                                />
                                {emailError && (
                                    <p id="email-error" className="text-sm text-red-600 mt-0.5">
                                        {emailError}
                                    </p>
                                )}
                            </div>

                            <Button type="submit" className="w-full h-11 text-md font-semibold" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t('forgot_password.submitting')}
                                    </>
                                ) : (
                                    t('forgot_password.submit')
                                )}
                            </Button>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => navigate('/login')}
                                    className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                                >
                                    <ArrowLeft className="inline-block mr-1 h-3.5 w-3.5" />
                                    {t('forgot_password.back_to_login')}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};
