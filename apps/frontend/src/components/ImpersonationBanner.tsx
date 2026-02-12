import { useEffect, useState } from 'react';
import { ShieldAlert, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function decodeJwtPayload(token: string): any {
    try {
        const base64 = token.split('.')[1];
        return JSON.parse(atob(base64));
    } catch {
        return {};
    }
}

export const ImpersonationBanner = () => {
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [targetEmail, setTargetEmail] = useState('');

    useEffect(() => {
        const originalToken = localStorage.getItem('original_admin_token') ||
            localStorage.getItem('impersonation_original_token');
        if (originalToken) {
            setIsImpersonating(true);

            // Decode current token to get target user info
            const currentToken = localStorage.getItem('access_token');
            if (currentToken) {
                const payload = decodeJwtPayload(currentToken);
                if (payload.isImpersonated) {
                    setTargetEmail(payload.email || 'unknown user');
                }
            }
        }
    }, []);

    const stopImpersonation = () => {
        const originalToken = localStorage.getItem('original_admin_token') ||
            localStorage.getItem('impersonation_original_token');
        if (originalToken) {
            localStorage.setItem('access_token', originalToken);
            localStorage.removeItem('original_admin_token');
            localStorage.removeItem('impersonation_original_token');
            window.location.reload();
        }
    };

    if (!isImpersonating) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-white font-semibold shadow-lg">
            <ShieldAlert size={18} />
            <span>
                You are currently viewing the system on behalf of <strong>{targetEmail}</strong>
            </span>
            <Button
                variant="outline"
                size="sm"
                className="ml-2 bg-white text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700 font-semibold"
                onClick={stopImpersonation}
            >
                <StopCircle size={14} className="mr-1" />
                Stop Impersonation
            </Button>
        </div>
    );
};
