import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/api';

interface SchoolInfo {
    id: string;
    name: string;
    address?: string;
}

interface TokenInfo {
    tokenType: 'GLOBAL' | 'TENANT';
    userId: string | null;
    schoolId: string | null;
    isSystemAdmin: boolean;
    isSysAdminOverride: boolean;
    isImpersonated: boolean;
    readOnly: boolean;
    role: string | null;
}

interface SchoolContextType extends TokenInfo {
    currentSchool: SchoolInfo | null;
    schoolCount: number;
    sessionLoading: boolean;
    selectSchool: (schoolId: string, role?: string) => Promise<void>;
    leaveSchool: () => Promise<void>;
    refreshTokenInfo: () => Promise<TokenInfo>;
}

const EMPTY_TOKEN_INFO: TokenInfo = {
    tokenType: 'GLOBAL',
    userId: null,
    schoolId: null,
    isSystemAdmin: false,
    isSysAdminOverride: false,
    isImpersonated: false,
    readOnly: false,
    role: null,
};

const SchoolContext = createContext<SchoolContextType>({
    ...EMPTY_TOKEN_INFO,
    currentSchool: null,
    schoolCount: 0,
    sessionLoading: true,
    selectSchool: async () => {},
    leaveSchool: async () => {},
    refreshTokenInfo: async () => EMPTY_TOKEN_INFO,
});

/**
 * Fetches /api/auth/session — the server-side decode of the httpOnly JWT
 * cookie. We can't read the JWT directly any more (XSS exfil mitigation),
 * so this endpoint is the single source of truth for session claims.
 */
async function fetchSession(): Promise<TokenInfo> {
    try {
        const res = await api.get('/api/auth/session');
        const s = res.data || {};
        return {
            tokenType: (s.type === 'TENANT' ? 'TENANT' : 'GLOBAL') as 'GLOBAL' | 'TENANT',
            userId: s.userId ?? null,
            schoolId: s.schoolId ?? null,
            isSystemAdmin: !!s.isSystemAdmin,
            isSysAdminOverride: !!s.isSysAdminOverride,
            isImpersonated: !!s.isImpersonated,
            readOnly: !!s.readOnly,
            role: s.role ?? null,
        };
    } catch {
        return EMPTY_TOKEN_INFO;
    }
}

export function SchoolProvider({ children }: { children: ReactNode }) {
    const [tokenInfo, setTokenInfo] = useState<TokenInfo>(EMPTY_TOKEN_INFO);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [currentSchool, setCurrentSchool] = useState<SchoolInfo | null>(null);
    const [schoolCount, setSchoolCount] = useState(0);

    const refreshTokenInfo = useCallback(async () => {
        const info = await fetchSession();
        setTokenInfo(info);
        return info;
    }, []);

    // On mount, populate session from the cookie.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const info = await fetchSession();
            if (cancelled) return;
            setTokenInfo(info);
            setSessionLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Fetch school details when we have a schoolId
    useEffect(() => {
        if (tokenInfo.schoolId) {
            const schoolId = tokenInfo.schoolId;
            api.get('/api/auth/schools')
                .then((res) => {
                    const schools = res.data;
                    setSchoolCount(Array.isArray(schools) ? schools.length : 0);
                    const school = schools.find((s: any) => s.schoolId === schoolId || s.school?.id === schoolId);
                    if (school) {
                        setCurrentSchool({
                            id: school.schoolId || school.school?.id,
                            name: school.school?.name || 'Unknown',
                            address: school.school?.address,
                        });
                    } else if (tokenInfo.isSystemAdmin) {
                        api.get('/api/system/schools')
                            .then((sysRes) => {
                                const sysSchool = sysRes.data.find((s: any) => s.id === schoolId);
                                if (sysSchool) {
                                    setCurrentSchool({
                                        id: sysSchool.id,
                                        name: sysSchool.name,
                                        address: sysSchool.address,
                                    });
                                } else {
                                    setCurrentSchool({ id: schoolId, name: schoolId });
                                }
                            })
                            .catch(() => setCurrentSchool({ id: schoolId, name: schoolId }));
                    }
                })
                .catch(() => setCurrentSchool(null));
        } else {
            setCurrentSchool(null);
            if (tokenInfo.userId) {
                api.get('/api/auth/schools')
                    .then((res) => setSchoolCount(Array.isArray(res.data) ? res.data.length : 0))
                    .catch(() => setSchoolCount(0));
            }
        }
    }, [tokenInfo.schoolId, tokenInfo.isSystemAdmin, tokenInfo.userId]);

    const selectSchool = useCallback(
        async (schoolId: string, role?: string) => {
            const url = role
                ? `/api/auth/select-school/${schoolId}?role=${role}`
                : `/api/auth/select-school/${schoolId}`;
            // The backend swaps the cookie for a TENANT-scoped token on success.
            await api.post(url);
            await refreshTokenInfo();
        },
        [refreshTokenInfo],
    );

    const leaveSchool = useCallback(async () => {
        try {
            // Ask the backend for a fresh GLOBAL cookie. It replaces the
            // TENANT cookie set during selectSchool.
            await api.post('/api/auth/refresh-global');
        } catch {
            // If refresh-global fails (e.g. the user is impersonated), the
            // safest fallback is a hard logout.
            try {
                await api.post('/api/auth/logout');
            } catch {
                /* ignore */
            }
        }
        setCurrentSchool(null);
        await refreshTokenInfo();
    }, [refreshTokenInfo]);

    return (
        <SchoolContext.Provider
            value={{
                ...tokenInfo,
                currentSchool,
                schoolCount,
                sessionLoading,
                selectSchool,
                leaveSchool,
                refreshTokenInfo,
            }}
        >
            {children}
        </SchoolContext.Provider>
    );
}

export function useSchool() {
    return useContext(SchoolContext);
}
