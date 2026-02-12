import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { useSchool } from '@/context/SchoolContext';
import { api } from '@/api';
import { Building2, Users, UserCheck, Clock } from 'lucide-react';

interface DashboardStats {
    schoolCount: number;
    userCount: number;
    activeUserCount: number;
    recentLogins: {
        id: string;
        createdAt: string;
        actor?: { id: string; email: string; firstName: string; lastName: string };
        newValues?: any;
    }[];
}

// System Admin Dashboard (GLOBAL mode)
function SystemAdminDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/api/system/dashboard')
            .then((res) => setStats(res.data))
            .catch((err) => console.error('Failed to load dashboard stats', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="text-muted-foreground">Načítání statistik...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">System Admin Dashboard</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Celkem škol</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.schoolCount ?? 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Celkem uživatelů</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.userCount ?? 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aktivní členství</CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.activeUserCount ?? 0}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Poslední přihlášení
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {stats?.recentLogins && stats.recentLogins.length > 0 ? (
                        <div className="space-y-3">
                            {stats.recentLogins.map((login) => (
                                <div key={login.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">
                                            {login.actor
                                                ? `${login.actor.firstName} ${login.actor.lastName}`
                                                : 'Neznámý uživatel'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {login.actor?.email}
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(login.createdAt).toLocaleString('cs-CZ')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Žádná přihlášení dosud.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// School-scoped Dashboard (TENANT mode)
function SchoolDashboard() {
    const { currentSchool } = useSchool();

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">
                Nástěnka{currentSchool ? ` – ${currentSchool.name}` : ''}
            </h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Celkem studentů</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">—</div>
                        <p className="text-xs text-muted-foreground">Data budou k dispozici</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aktivní třídy</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">—</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Učitelé</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">—</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Rychlý přehled</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Zde bude graf nebo seznam posledních aktivit.</p>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Nadcházející události</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Žádné události pro dnešek.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Main Dashboard - context-aware
export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { tokenType, isSystemAdmin } = useSchool();

    useEffect(() => {
        // Regular user in GLOBAL mode → redirect to school selection
        if (tokenType === 'GLOBAL' && !isSystemAdmin) {
            navigate('/select-school', { replace: true });
        }
    }, [tokenType, isSystemAdmin, navigate]);

    // System Admin in GLOBAL mode → admin dashboard
    if (tokenType === 'GLOBAL' && isSystemAdmin) {
        return <SystemAdminDashboard />;
    }

    // TENANT mode (school selected) → school dashboard
    return <SchoolDashboard />;
};
