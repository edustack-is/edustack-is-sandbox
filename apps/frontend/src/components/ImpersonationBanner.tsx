import { useEffect, useState } from 'react';
import { StopCircle } from 'lucide-react';

export const ImpersonationBanner = () => {
    const [isImpersonating, setIsImpersonating] = useState(false);

    useEffect(() => {
        // Check for 'impersonation_original_token' or decode token payload to see 'isImpersonated'
        // For simplicity, we'll check if we stored original token
        const originalToken = localStorage.getItem('impersonation_original_token');
        if (originalToken) {
            setIsImpersonating(true);
        }
    }, []);

    const stopImpersonation = () => {
        const originalToken = localStorage.getItem('impersonation_original_token');
        if (originalToken) {
            localStorage.setItem('access_token', originalToken);
            localStorage.removeItem('impersonation_original_token');
            window.location.reload();
        }
    };

    if (!isImpersonating) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '40px',
            backgroundColor: '#ff9800',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            fontWeight: 'bold',
            gap: '10px'
        }}>
            <span>Viewing as another user</span>
            <button
                onClick={stopImpersonation}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 8px',
                    backgroundColor: 'white',
                    color: '#ff9800',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
            >
                <StopCircle size={16} /> Stop Impersonation
            </button>
        </div>
    );
};
