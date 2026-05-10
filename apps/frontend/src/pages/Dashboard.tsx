import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { useSchool } from '@/context/SchoolContext';
import { api } from '@/api';
import {
    Building2,
    Users,
    UserCheck,
    Clock,
    CalendarDays,
    GraduationCap,
    MessageSquare,
    AlertCircle,
    CheckCircle2,
    ArrowRight,
    TrendingUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TasksCard } from '@/components/TasksCard';

// ─── Constants ──────────────────────────────────────────

const EVENT_TYPE_COLORS: Record<string, string> = {
    HOLIDAY: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    EXAM_PERIOD: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    PARENT_MEETING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    SCHOOL_TRIP: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    SPORTS_DAY: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

// ─── Shared Components ────────────────────────────────────

const UnreadMessagesCard = ({ count }: { count: number }) => {
    const { t } = useTranslation();
    return (
        <Card className="hover:bg-accent/10 transition-colors cursor-pointer" asChild>
            <Link to="/messages">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">{t('messages.title')}</p>
                            <div className="text-2xl font-bold">
                                {count} {t('dashboard.unread_count', 'nepřečtených')}
                            </div>
                        </div>
                        <div className="bg-blue-100 p-2 rounded-full">
                            <MessageSquare className="h-5 w-5 text-blue-600" />
                        </div>
                    </div>
                </CardContent>
            </Link>
        </Card>
    );
};

const NextLessonCard = ({ lesson }: { lesson: any }) => {
    const { t } = useTranslation();
    if (!lesson) {
        return (
            <Card>
                <CardContent className="pt-6 flex flex-col items-center justify-center text-center py-10 opacity-60">
                    <Clock className="h-8 w-8 mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">{t('dashboard.no_next_lesson', 'Žádná další hodina dnes')}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
                <CardDescription className="uppercase text-[10px] font-bold tracking-wider text-primary">
                    {t('dashboard.next_lesson', 'Následující hodina')}
                </CardDescription>
                <CardTitle className="text-xl">{lesson.subjectName}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between text-sm">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" />
                            <span>{lesson.classroomName || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5" />
                            <span>{lesson.roomName || '-'}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-mono font-bold">{lesson.startTime}</div>
                        <div className="text-[10px] text-muted-foreground">
                            {lesson.lessonNumber}. {t('common.hour').toLowerCase()}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// ─── Role Dashboards ──────────────────────────────────────

function TeacherDashboard({ data }: { data: any }) {
    const { t, i18n } = useTranslation();
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-primary">
                    {t('dashboard.teacher_welcome', 'Vítejte zpět, pane učiteli / paní učitelko')}
                </h1>
                <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                    {t('roles.TEACHER')}
                </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <UnreadMessagesCard count={data.unreadMessages} />
                <Card className="hover:bg-accent/10 transition-colors">
                    <Link to="/classbook">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">
                                        {t('dashboard.missing_data', 'Chybějící zápisy')}
                                    </p>
                                    <div className="text-2xl font-bold text-amber-600">
                                        {data.missingData?.length || 0}
                                    </div>
                                </div>
                                <div className="bg-amber-100 p-2 rounded-full">
                                    <AlertCircle className="h-5 w-5 text-amber-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Link>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <NextLessonCard lesson={data.nextLesson} />

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-amber-500" />
                                {t('dashboard.missing_data_detail', 'Nutno doplnit v třídní knize')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.missingData?.length > 0 ? (
                                <div className="space-y-4">
                                    {data.missingData.map((m: any) => (
                                        <div
                                            key={m.id}
                                            className="flex items-center justify-between p-3 rounded-lg border border-amber-100 bg-amber-50/30"
                                        >
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold">{m.classroomName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(m.date).toLocaleDateString(i18n.language)} ·{' '}
                                                    {m.lessonNumber}. {t('common.hour').toLowerCase()}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {m.missingTopic && (
                                                    <Badge variant="outline" className="text-[10px] text-amber-700">
                                                        {t('common.topic', 'Téma')}
                                                    </Badge>
                                                )}
                                                {m.missingSignature && (
                                                    <Badge variant="outline" className="text-[10px] text-amber-700">
                                                        {t('common.signature', 'Podpis')}
                                                    </Badge>
                                                )}
                                                <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                                                    <Link to={`/classbook?classroom=${m.classroomId}&date=${m.date}`}>
                                                        <ArrowRight className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground opacity-60">
                                    <CheckCircle2 className="h-10 w-10 mb-2 text-green-500" />
                                    <p className="text-sm">
                                        {t('dashboard.all_completed', 'Všechny zápisy jsou v pořádku')}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <TasksCard />
                </div>
            </div>
        </div>
    );
}

function StudentDashboard({ data }: { data: any; childName?: string }) {
    const { t, i18n } = useTranslation();
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-primary">
                    {childName
                        ? `${t('dashboard.parent_view', 'Agenda')} - ${childName}`
                        : t('dashboard.student_welcome', 'Ahoj, jak se dnes máš?')}
                </h1>
                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                    {childName ? t('roles.PARENT') : t('roles.STUDENT')}
                </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {!childName && <UnreadMessagesCard count={data.unreadMessages} />}

                {data.lastGrade && (
                    <Card className="hover:bg-accent/10 transition-colors">
                        <Link to="/grading">
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">
                                            {t('dashboard.latest_grade', 'Poslední známka')}
                                        </p>
                                        <div className="text-2xl font-bold flex items-center gap-2">
                                            {data.lastGrade.value}
                                            <span className="text-xs font-normal text-muted-foreground truncate max-w-[100px]">
                                                {data.lastGrade.subjectName}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-emerald-100 p-2 rounded-full">
                                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Link>
                    </Card>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <NextLessonCard lesson={data.nextLesson} />
                </div>
                {!childName && <TasksCard />}
            </div>
        </div>
    );
}

function ParentDashboard({ data }: { data: any }) {
    const { t } = useTranslation();
    return (
        <div className="space-y-10">
            {data.children?.map((child: any) => (
                <StudentDashboard key={child.childId} data={child} childName={child.childName} />
            ))}

            <div className="border-t pt-8 grid gap-6 md:grid-cols-2">
                <UnreadMessagesCard count={data.unreadMessages} />
                <TasksCard />
            </div>
        </div>
    );
}

function LeadershipDashboard({ data }: { data: any }) {
    const { t, i18n } = useTranslation();
    const { currentSchool } = useSchool();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-primary">
                    {t('dashboard.school_dashboard_title')} – {currentSchool?.name}
                </h1>
                <div className="flex gap-2">
                    <UnreadMessagesCard count={data.unreadMessages} />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('dashboard.total_students')}</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.studentCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('dashboard.active_classes')}</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.classroomCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('dashboard.teachers')}</CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.teacherCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('dashboard.subjects')}</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.subjectCount}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            {t('dashboard.recent_members')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.recentMembers?.map((member: any) => (
                                <div
                                    key={member.id}
                                    className="flex items-center justify-between border-b pb-2 last:border-0"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{member.name}</span>
                                        <span className="text-xs text-muted-foreground">{member.email}</span>
                                    </div>
                                    <Badge variant={member.status === 'ACTIVE' ? 'default' : 'outline'}>
                                        {member.role}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="col-span-3 space-y-6">
                    <TasksCard />
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <CalendarDays className="h-5 w-5 text-indigo-500" />
                                {t('dashboard.upcoming_events')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {data.upcomingEvents?.map((evt: any) => (
                                    <div
                                        key={evt.id}
                                        className="flex items-center justify-between border-b pb-2 last:border-0"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{evt.title}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(evt.date).toLocaleDateString(i18n.language)}
                                            </span>
                                        </div>
                                        <Badge className={EVENT_TYPE_COLORS[evt.type] || EVENT_TYPE_COLORS.OTHER}>
                                            {evt.type}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// System Admin Dashboard (GLOBAL mode)
function SystemAdminDashboard() {
    const { t, i18n } = useTranslation();
    const [stats, setStats] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/api/system/dashboard')
            .then((res) => setStats(res.data))
            .catch((err) => console.error('Failed to load dashboard stats', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="text-muted-foreground p-10 text-center">{t('dashboard.loading_stats')}</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-primary">{t('dashboard.system_admin_title')}</h1>

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
                    {stats?.recentLogins?.length > 0 ? (
                        <div className="space-y-3">
                            {stats.recentLogins.map((login: any) => (
                                <div
                                    key={login.id}
                                    className="flex items-center justify-between border-b border-border pb-2 last:border-0"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">
                                            {login.actor
                                                ? `${login.actor.firstName} ${login.actor.lastName}`
                                                : t('common.unknown_user')}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{login.actor?.email}</span>
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

// ─── Main Switcher ──────────────────────────────────────

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { tokenType, isSystemAdmin, currentSchool, role } = useSchool();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (tokenType === 'GLOBAL' && !isSystemAdmin) {
            navigate('/select-school', { replace: true });
        }
    }, [tokenType, isSystemAdmin, navigate]);

    useEffect(() => {
        if (tokenType === 'TENANT' && currentSchool) {
            setLoading(true);
            api.get('/api/deputy/dashboard')
                .then((res) => setData(res.data))
                .catch(() => setData(null))
                .finally(() => setLoading(false));
        }
    }, [tokenType, currentSchool]);

    if (tokenType === 'GLOBAL') {
        if (isSystemAdmin) return <SystemAdminDashboard />;
        return null;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
        );
    }

    if (!data) return null;

    if (['PRINCIPAL', 'DEPUTY', 'ADMIN', 'DIRECTOR'].includes(role || '')) {
        return <LeadershipDashboard data={data} />;
    }

    if (role === 'TEACHER') {
        return <TeacherDashboard data={data} />;
    }

    if (role === 'STUDENT') {
        return <StudentDashboard data={data} />;
    }

    if (role === 'PARENT') {
        return <ParentDashboard data={data} />;
    }

    return <LeadershipDashboard data={data} />; // Default
};
