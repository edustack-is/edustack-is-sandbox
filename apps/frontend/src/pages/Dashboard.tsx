import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { useSchool } from '@/context/SchoolContext';
import { api } from '@/api';
import { Building2, Users, UserCheck, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    const { t, i18n } = useTranslation();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/api/system/dashboard')
            .then((res) => setStats(res.data))
            .catch((err) => console.error('Failed to load dashboard stats', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="text-muted-foreground">{t('dashboard.loading_stats')}</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.system_admin_title')}</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('dashboard.total_schools')}</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.schoolCount ?? 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('dashboard.total_users')}</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.userCount ?? 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('dashboard.active_memberships')}</CardTitle>
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
                        {t('dashboard.recent_logins')}
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
                                                : t('common.unknown_user')}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {login.actor?.email}
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(login.createdAt).toLocaleString(i18n.language)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">{t('dashboard.no_logins_yet')}</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// School-scoped Dashboard (TENANT mode)
function SchoolDashboard() {
    const { t } = useTranslation();
    const { currentSchool } = useSchool();

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">
                {t('dashboard.school_dashboard_title')}{currentSchool ? ` – ${currentSchool.name}` : ''}
            </h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('dashboard.total_students')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">—</div>
                        <p className="text-xs text-muted-foreground">{t('dashboard.data_coming_soon')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('dashboard.active_classes')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">—</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('dashboard.teachers')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">—</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>{t('dashboard.quick_overview')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">{t('dashboard.overview_placeholder')}</p>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>{t('dashboard.upcoming_events')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">{t('dashboard.no_events_today')}</p>
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
