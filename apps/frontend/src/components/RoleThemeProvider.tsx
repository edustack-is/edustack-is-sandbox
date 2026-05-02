import { useEffect, ReactNode } from 'react';
import { useSchool } from '@/context/SchoolContext';

interface RoleTheme {
    primary: string;
    primaryForeground: string;
    accent: string;
    accentForeground: string;
    ring: string;
}

const ROLE_THEMES: Record<string, RoleTheme> = {
    SYSTEM_ADMIN: {
        primary: '262 83% 58%', // Violet 600
        primaryForeground: '0 0% 100%',
        accent: '262 83% 95%', // Violet 50
        accentForeground: '262 83% 30%',
        ring: '262 83% 58%',
    },
    ADMIN: {
        primary: '221 83% 43%', // Blue 700
        primaryForeground: '0 0% 100%',
        accent: '221 83% 95%', // Blue 50
        accentForeground: '221 83% 25%',
        ring: '221 83% 43%',
    },
    PRINCIPAL: {
        primary: '221 83% 43%', // Blue 700
        primaryForeground: '0 0% 100%',
        accent: '221 83% 95%', // Blue 50
        accentForeground: '221 83% 25%',
        ring: '221 83% 43%',
    },
    DEPUTY: {
        primary: '199 89% 48%', // Sky 500
        primaryForeground: '0 0% 100%',
        accent: '199 89% 95%', // Sky 50
        accentForeground: '199 89% 25%',
        ring: '199 89% 48%',
    },
    TEACHER: {
        primary: '346 84% 61%', // Rose 500
        primaryForeground: '0 0% 100%',
        accent: '346 84% 95%', // Rose 50
        accentForeground: '346 84% 25%',
        ring: '346 84% 61%',
    },
    STUDENT: {
        primary: '38 92% 50%', // Amber 500
        primaryForeground: '0 0% 100%',
        accent: '38 92% 95%', // Amber 50
        accentForeground: '38 92% 25%',
        ring: '38 92% 50%',
    },
    PARENT: {
        primary: '160 84% 39%', // Emerald 600
        primaryForeground: '0 0% 100%',
        accent: '160 84% 95%', // Emerald 50
        accentForeground: '160 84% 20%',
        ring: '160 84% 39%',
    },
};

const DEFAULT_THEME: RoleTheme = {
    primary: '222.2 47.4% 11.2%', // Default slate
    primaryForeground: '210 40% 98%',
    accent: '210 40% 96.1%',
    accentForeground: '222.2 47.4% 11.2%',
    ring: '222.2 84% 4.9%',
};

export function RoleThemeProvider({ children }: { children: ReactNode }) {
    const { role, isSystemAdmin, tokenType } = useSchool();

    useEffect(() => {
        // Determine theme key
        let themeKey = role;
        if (tokenType === 'GLOBAL' && isSystemAdmin) {
            themeKey = 'SYSTEM_ADMIN';
        }

        const theme = (themeKey && ROLE_THEMES[themeKey]) || DEFAULT_THEME;

        // Apply to root
        const root = document.documentElement;
        root.style.setProperty('--primary', theme.primary);
        root.style.setProperty('--primary-foreground', theme.primaryForeground);
        root.style.setProperty('--accent', theme.accent);
        root.style.setProperty('--accent-foreground', theme.accentForeground);
        root.style.setProperty('--ring', theme.ring);

        // Also update a data attribute for conditional styling if needed
        root.setAttribute('data-role', themeKey || 'default');
    }, [role, isSystemAdmin, tokenType]);

    return <>{children}</>;
}
