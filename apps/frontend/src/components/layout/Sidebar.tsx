import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, GraduationCap, Calendar, Users, LogOut, Building2, Users2, ArrowLeft, Settings, DoorOpen, BookOpen, User } from 'lucide-react';
import clsx from 'clsx';
import { getMe } from '@/api';
import { useSchool } from '@/context/SchoolContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const navLinkClass = ({ isActive }: { isActive: boolean }) => clsx(
    'nav-item flex items-center space-x-3 px-4 py-2.5 rounded-md transition-colors duration-200',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    { 'bg-accent text-accent-foreground font-medium': isActive }
);

// ─── Emoji Avatar Helpers ─────────────────────────────
const EMOJI_AVATARS: Record<string, { emoji: string; bg: string }> = {
    fox: { emoji: '🦊', bg: 'from-orange-400 to-amber-500' },
    cat: { emoji: '🐱', bg: 'from-pink-400 to-rose-500' },
    bear: { emoji: '🐻', bg: 'from-amber-500 to-yellow-600' },
    rabbit: { emoji: '🐰', bg: 'from-emerald-400 to-teal-500' },
    owl: { emoji: '🦉', bg: 'from-blue-400 to-indigo-500' },
    robot: { emoji: '🤖', bg: 'from-cyan-400 to-blue-500' },
    astronaut: { emoji: '🧑‍🚀', bg: 'from-violet-400 to-purple-500' },
    panda: { emoji: '🐼', bg: 'from-green-400 to-emerald-500' },
    unicorn: { emoji: '🦄', bg: 'from-fuchsia-400 to-pink-500' },
    dragon: { emoji: '🐉', bg: 'from-red-400 to-orange-500' },
    penguin: { emoji: '🐧', bg: 'from-slate-400 to-slate-600' },
    butterfly: { emoji: '🦋', bg: 'from-sky-400 to-blue-500' },
};

function getEmojiAvatarBg(avatarUrl: string): string {
    const id = avatarUrl.replace('emoji:', '');
    return EMOJI_AVATARS[id]?.bg || 'from-primary/10 to-primary/20';
}

function getEmojiAvatarEmoji(avatarUrl: string): string {
    const id = avatarUrl.replace('emoji:', '');
    return EMOJI_AVATARS[id]?.emoji || '👤';
}

export const Sidebar: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const { tokenType, isSystemAdmin, currentSchool, leaveSchool, role } = useSchool();

    const schoolNavItems = [
        { path: '/dashboard', label: t('common.dashboard'), icon: LayoutDashboard },
        { path: '/schedule', label: t('sidebar.schedule', 'Rozvrh'), icon: Calendar },
        { path: '/grading', label: t('sidebar.grading', 'Klasifikace'), icon: GraduationCap },
    ];

    const schoolAdminItems = [
        { path: '/school/users', label: t('common.users'), icon: Users },
        { path: '/school/rooms', label: t('sidebar.rooms', 'Učebny'), icon: DoorOpen },
        { path: '/school/curriculum', label: t('sidebar.curriculum', 'Předměty a ŠVP'), icon: BookOpen },
        { path: '/year-setup', label: t('sidebar.year_setup', 'Příprava roku'), icon: Settings },
    ];

    useEffect(() => {
        getMe()
            .then(setUser)
            .catch((e) => console.error('Failed to fetch user', e));
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('global_token');
        localStorage.removeItem('original_admin_token');
        localStorage.removeItem('impersonation_original_token');
        navigate('/login');
    };

    const handleLeaveSchool = () => {
        leaveSchool();
        navigate('/select-school');
    };

    const hasSchoolContext = tokenType === 'TENANT';
    const isSchoolAdmin = role === 'ADMIN' || role === 'DEPUTY' || role === 'PRINCIPAL';

    return (
        <aside className="sidebar w-64 border-r border-border bg-card text-card-foreground flex flex-col h-screen">
            <div className="sidebar-header p-6 border-b border-border">
                <h1 className="text-xl font-bold text-primary">EduStack</h1>
                {hasSchoolContext && currentSchool && (
                    <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate" title={currentSchool.name}>
                                {currentSchool.name}
                            </span>
                        </div>
                        <div className="flex gap-1.5">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 text-xs flex-1"
                                onClick={handleLeaveSchool}
                            >
                                <ArrowLeft size={12} className="mr-1" />
                                {t('sidebar.change_school', 'Změnit školu')}
                            </Button>
                            {isSystemAdmin && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs flex-1"
                                    onClick={() => {
                                        leaveSchool();
                                        // Let React process the state update before navigating
                                        setTimeout(() => navigate('/dashboard'), 0);
                                    }}
                                >
                                    <Settings size={12} className="mr-1" />
                                    {t('sidebar.system_admin_short', 'Systém')}
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <nav className="sidebar-nav flex-1 p-4 space-y-2 overflow-y-auto" aria-label="Main Navigation">
                {/* System Admin Global Navigation */}
                {isSystemAdmin && !hasSchoolContext && (
                    <>
                        <NavLink to="/dashboard" className={navLinkClass}>
                            <LayoutDashboard size={18} />
                            <span>{t('common.dashboard')}</span>
                        </NavLink>

                        <NavLink to="/select-school" className={navLinkClass}>
                            <Building2 size={18} />
                            <span>{t('sidebar.enter_school', 'Vstoupit do školy')}</span>
                        </NavLink>

                        <div className="px-4 py-2.5 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {t('sidebar.system_admin')}
                        </div>
                        <NavLink to="/system/schools" className={navLinkClass}>
                            <Building2 size={18} />
                            <span>{t('sidebar.schools')}</span>
                        </NavLink>
                        <NavLink to="/system/users" className={navLinkClass}>
                            <Users2 size={18} />
                            <span>{t('sidebar.users')}</span>
                        </NavLink>
                        <NavLink to="/system/settings" className={navLinkClass}>
                            <Settings size={18} />
                            <span>{t('sidebar.system_settings')}</span>
                        </NavLink>
                    </>
                )}

                {/* School-specific items — only when a school is selected */}
                {hasSchoolContext && (
                    <>
                        {schoolNavItems.map((item) => (
                            <NavLink key={item.path} to={item.path} className={navLinkClass}>
                                <item.icon size={18} />
                                <span>{item.label}</span>
                            </NavLink>
                        ))}

                        {/* Admin Section for Deputy/Principal/Admin */}
                        {isSchoolAdmin && (
                            <Accordion type="single" collapsible className="w-full border-none">
                                <AccordionItem value="school-admin" className="border-none">
                                    <AccordionTrigger className="py-2.5 px-4 hover:no-underline hover:bg-accent rounded-md text-sm font-semibold text-muted-foreground uppercase tracking-wider text-left">
                                        {t('sidebar.school_management')}
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-1 pb-0 space-y-1">
                                        {schoolAdminItems.map((item) => (
                                            <NavLink key={item.path} to={item.path} className={navLinkClass}>
                                                <item.icon size={18} />
                                                <span>{item.label}</span>
                                            </NavLink>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}
                    </>
                )}

                {/* Prompt to select school if GLOBAL and not system admin */}
                {!hasSchoolContext && !isSystemAdmin && (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        <p>{t('sidebar.select_school_prompt')}</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/select-school')}>
                            {t('sidebar.select_school_button')}
                        </Button>
                    </div>
                )}
            </nav>

            <div className="p-4 border-t border-border">
                {user ? (
                    <div className="flex flex-col space-y-3">
                        <div className="flex items-center space-x-3">
                            <Avatar>
                                {user.avatarUrl?.startsWith('emoji:') ? (
                                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getEmojiAvatarBg(user.avatarUrl)}`}>
                                        <span className="text-lg">{getEmojiAvatarEmoji(user.avatarUrl)}</span>
                                    </div>
                                ) : user.avatarUrl?.startsWith('data:') ? (
                                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    <AvatarFallback>{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>
                                )}
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium">{user.firstName} {user.lastName}</span>
                                <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={user.email}>{user.email}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 w-full mt-2">
                            <Badge variant="outline" className="w-fit">{user.role || (isSystemAdmin ? 'System Admin' : 'User')}</Badge>
                            <div className="space-y-1 w-full">
                                <Button variant="ghost" size="sm" className="w-full justify-start font-medium" onClick={() => navigate('/profile')}>
                                    <User className="mr-2 h-4 w-4 text-muted-foreground" />
                                    {t('common.profile')}
                                </Button>
                                <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 font-medium" onClick={handleLogout}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    {t('common.logout')}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-sm text-muted-foreground">{t('common.loading')}</div>
                )}
            </div>
        </aside>
    );
};
