import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/api';

interface SchoolInfo {
    id: string;
    name: string;
    address?: string;
}

interface SchoolContextType {
    tokenType: 'GLOBAL' | 'TENANT';
    schoolId: string | null;
    isSystemAdmin: boolean;
    role: string | null;
    currentSchool: SchoolInfo | null;
    selectSchool: (schoolId: string) => Promise<void>;
    leaveSchool: () => void;
}

const SchoolContext = createContext<SchoolContextType>({
    tokenType: 'GLOBAL',
    schoolId: null,
    isSystemAdmin: false,
    role: null,
    currentSchool: null,
    selectSchool: async () => { },
    leaveSchool: () => { },
});

function decodeJwtPayload(token: string): any {
    try {
        const base64 = token.split('.')[1];
        return JSON.parse(atob(base64));
    } catch {
        return {};
    }
}

function getTokenInfo() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        return { tokenType: 'GLOBAL' as const, schoolId: null, isSystemAdmin: false, role: null };
    }
    const payload = decodeJwtPayload(token);
    return {
        tokenType: (payload.type === 'TENANT' ? 'TENANT' : 'GLOBAL') as 'GLOBAL' | 'TENANT',
        schoolId: payload.schoolId || null,
        isSystemAdmin: payload.isSystemAdmin || false,
        role: payload.role || null,
    };
}

export function SchoolProvider({ children }: { children: ReactNode }) {
    const [tokenInfo, setTokenInfo] = useState(getTokenInfo);
    const [currentSchool, setCurrentSchool] = useState<SchoolInfo | null>(null);

    // When token changes, re-read info
    const refreshTokenInfo = useCallback(() => {
        const info = getTokenInfo();
        setTokenInfo(info);
        return info;
    }, []);

    // Fetch school details when we have a schoolId
    useEffect(() => {
        if (tokenInfo.schoolId) {
            // Fetch the school name from the user's schools list
            api.get('/api/auth/schools')
                .then((res) => {
                    const schools = res.data;
                    const school = schools.find((s: any) => s.schoolId === tokenInfo.schoolId || s.school?.id === tokenInfo.schoolId);
                    if (school) {
                        setCurrentSchool({
                            id: school.schoolId || school.school?.id,
                            name: school.school?.name || 'Unknown',
                            address: school.school?.address,
                        });
                    }
                })
                .catch(() => setCurrentSchool(null));
        } else {
            setCurrentSchool(null);
        }
    }, [tokenInfo.schoolId]);

    const selectSchool = useCallback(async (schoolId: string) => {
        // Store GLOBAL token before switching
        const globalToken = localStorage.getItem('access_token');
        if (globalToken) {
            localStorage.setItem('global_token', globalToken);
        }

        const response = await api.post(`/api/auth/select-school/${schoolId}`);
        const { access_token } = response.data;
        localStorage.setItem('access_token', access_token);
        refreshTokenInfo();
    }, [refreshTokenInfo]);

    const leaveSchool = useCallback(() => {
        const globalToken = localStorage.getItem('global_token');
        if (globalToken) {
            localStorage.setItem('access_token', globalToken);
            localStorage.removeItem('global_token');
        }
        setCurrentSchool(null);
        refreshTokenInfo();
    }, [refreshTokenInfo]);

    return (
        <SchoolContext.Provider
            value={{
                ...tokenInfo,
                currentSchool,
                selectSchool,
                leaveSchool,
            }}
        >
            {children}
        </SchoolContext.Provider>
    );
}

export function useSchool() {
    return useContext(SchoolContext);
}
