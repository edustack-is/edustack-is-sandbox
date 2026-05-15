import { ShieldAlert, ShieldCheck, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useSchool } from '@/context/SchoolContext';
import { api } from '@/api';

export const ImpersonationBanner = () => {
    const { t } = useTranslation();
    const { userId, isSysAdminOverride, isImpersonated, readOnly, role, currentSchool, leaveSchool } = useSchool();

    // With the JWT now in an httpOnly cookie we can't decode the target
    // user's email client-side. We fall back to "current user" since the
    // banner is mostly about the action, not who you're impersonating.
    const targetLabel = userId ?? t('common.unknown_user');

    const stopImpersonation = async () => {
        try {
            await api.post('/api/auth/leave-impersonation');
        } catch {
            /* fall through to reload — backend will reject and we'll re-auth */
        }
        window.location.href = '/';
    };

    const handleLeaveSchool = async () => {
        await leaveSchool();
        window.location.href = '/select-school';
    };

    // Sys Admin Override banner (admin visiting school without membership)
    if (isSysAdminOverride && !isImpersonated) {
        const roleLabel = role ? t(`roles.${role}`, role) : 'ADMIN';
        return (
            <div className="flex-shrink-0 flex items-center justify-center gap-3 bg-blue-600 px-4 py-2 text-white font-semibold shadow-lg z-50">
                <ShieldCheck size={18} />
                <span>
                    {t('impersonation.admin_override', 'Správce systému')} — {currentSchool?.name || '…'} ({roleLabel})
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    className="ml-2 bg-white text-blue-600 border-blue-300 hover:bg-blue-50 hover:text-blue-700 font-semibold"
                    onClick={handleLeaveSchool}
                >
                    <StopCircle size={14} className="mr-1" />
                    {t('impersonation.leave_school', 'Opustit školu')}
                </Button>
            </div>
        );
    }

    // Standard impersonation banner
    if (!isImpersonated) return null;

    return (
        <div className="flex-shrink-0 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-white font-semibold shadow-lg z-50">
            <ShieldAlert size={18} />
            <span>
                {t('impersonation.banner_text')} <strong>{targetLabel}</strong>
                {readOnly && (
                    <span className="ml-2 inline-flex items-center rounded bg-amber-700 px-1.5 py-0.5 text-xs font-medium">
                        {t('impersonation.read_only', 'Jen pro čtení')}
                    </span>
                )}
            </span>
            <Button
                variant="outline"
                size="sm"
                className="ml-2 bg-white text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700 font-semibold"
                onClick={stopImpersonation}
            >
                <StopCircle size={14} className="mr-1" />
                {t('impersonation.stop')}
            </Button>
        </div>
    );
};
