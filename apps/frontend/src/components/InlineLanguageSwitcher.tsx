import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const languages = [
    { code: 'cs', label: 'CZ', flag: '🇨🇿' },
    { code: 'en', label: 'EN', flag: '🇬🇧' },
];

export const InlineLanguageSwitcher: React.FC = () => {
    const { i18n } = useTranslation();
    const currentLang = i18n.language?.split('-')[0] || 'cs';

    return (
        <div className="fixed top-4 right-4 z-40 flex items-center gap-1.5 bg-white/80 dark:bg-card/80 backdrop-blur-md rounded-full border border-border/60 shadow-sm px-2 py-1">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            {languages.map((lang) => (
                <button
                    key={lang.code}
                    onClick={() => i18n.changeLanguage(lang.code)}
                    className={`
                        flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors
                        ${currentLang === lang.code
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                        }
                    `}
                >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                </button>
            ))}
        </div>
    );
};
