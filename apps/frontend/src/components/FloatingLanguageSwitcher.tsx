import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const languages = [
    { code: 'cs', label: 'Čeština', flag: '🇨🇿' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
];

export const FloatingLanguageSwitcher: React.FC = () => {
    const { i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const currentLang = i18n.language?.split('-')[0] || 'cs';
    const current = languages.find((l) => l.code === currentLang) ?? languages[0];

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleChange = (code: string) => {
        i18n.changeLanguage(code);
        setOpen(false);
    };

    return (
        <div ref={ref} className="fixed bottom-24 right-6 z-40">
            {/* Dropdown menu – opens upward */}
            {open && (
                <div className="absolute bottom-full right-0 mb-2 w-40 rounded-xl border border-border bg-popover/95 backdrop-blur-lg shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleChange(lang.code)}
                            className={`
                                w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                                hover:bg-accent hover:text-accent-foreground
                                ${lang.code === currentLang ? 'bg-accent/50 font-medium' : ''}
                            `}
                        >
                            <span className="text-base">{lang.flag}</span>
                            <span>{lang.label}</span>
                            {lang.code === currentLang && (
                                <span className="ml-auto text-primary text-xs">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* FAB trigger */}
            <button
                onClick={() => setOpen((o) => !o)}
                className="
                    group flex items-center gap-2
                    h-10 rounded-full
                    bg-card/90 backdrop-blur-md
                    border border-border/60
                    shadow-lg shadow-black/10
                    px-3.5
                    text-sm font-medium text-foreground
                    hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10
                    active:scale-95
                    transition-all duration-200
                "
                aria-label="Choose language"
            >
                <Globe className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-xs uppercase tracking-wider">{current.flag} {current.code.toUpperCase()}</span>
            </button>
        </div>
    );
};
