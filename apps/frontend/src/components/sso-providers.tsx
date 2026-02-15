import React from 'react';
import { Github, Apple, Globe } from 'lucide-react';

// ---- Provider-specific SVG icons ----

export function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}

export function MicrosoftIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="9" height="9" fill="#F25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
            <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
        </svg>
    );
}

/** Maps provider id → icon component */
export const SSO_PROVIDER_ICON: Record<string, React.FC<{ className?: string }>> = {
    google: GoogleIcon,
    microsoft: MicrosoftIcon,
    github: ({ className }) => <Github className={className} />,
    apple: ({ className }) => <Apple className={className} />,
};

/** Maps provider id → button color classes */
export const SSO_PROVIDER_COLORS: Record<string, string> = {
    google: 'hover:bg-gray-50 border-gray-300 text-gray-700',
    github: 'hover:bg-slate-50 border-slate-300 text-slate-900',
    microsoft: 'hover:bg-blue-50 border-blue-200 text-gray-700',
    apple: 'hover:bg-slate-50 border-slate-300 text-black',
};

/** Maps provider id → human-readable label */
export const SSO_PROVIDER_LABEL: Record<string, string> = {
    google: 'Google',
    github: 'GitHub',
    microsoft: 'Microsoft',
    apple: 'Apple',
};

/** Fallback icon component (generic globe) */
export const SsoFallbackIcon: React.FC<{ className?: string }> = ({ className }) => (
    <Globe className={className} />
);
