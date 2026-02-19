import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, GraduationCap, Calendar, CalendarDays, Users, LogOut, Building2, Users2, ArrowLeft, Settings, DoorOpen, BookOpen, User, Globe, PanelLeftClose, PanelLeftOpen, ClipboardList, FileText, MessageSquare, Target, Presentation, Clock, GitCompare } from 'lucide-react';
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

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

// ─── NavItem with optional tooltip ────────────────────
interface SidebarNavItemProps {
    to: string;
    icon: React.ElementType;
    label: string;
    collapsed: boolean;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({ to, icon: Icon, label, collapsed }) => {
    const link = (
        <NavLink
            to={to}
            className={({ isActive }) => clsx(
                'nav-item flex items-center rounded-md transition-colors duration-200',
                'hover:bg-accent hover:text-accent-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                collapsed ? 'justify-center px-2 py-3' : 'space-x-3 px-4 py-2.5',
                { 'bg-accent text-accent-foreground font-medium': isActive }
            )}
        >
            <Icon size={collapsed ? 21 : 18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
        </NavLink>
    );

    if (collapsed) {
        return (
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                    <p>{label}</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    return link;
};

export const Sidebar: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const { tokenType, isSystemAdmin, currentSchool, leaveSchool, role, schoolCount } = useSchool();
    const [collapsed, setCollapsed] = useState(() => {
        return localStorage.getItem('sidebar-collapsed') === 'true';
    });

    const toggleCollapsed = () => {
        setCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('sidebar-collapsed', String(next));
            return next;
        });
    };

    const schoolNavItems = [
        { path: '/dashboard', label: t('common.dashboard'), icon: LayoutDashboard },
        { path: '/schedule', label: t('sidebar.schedule', 'Rozvrh'), icon: Calendar },
        { path: '/grading', label: t('sidebar.grading', 'Klasifikace'), icon: GraduationCap },
        { path: '/school/white-book', label: t('sidebar.white_book', 'Bílá kniha'), icon: FileText },
        { path: '/messages', label: t('sidebar.messages', 'Zprávy'), icon: MessageSquare },
    ];

    const schoolAdminItems = [
        { path: '/school/rooms', label: t('sidebar.rooms', 'Učebny'), icon: DoorOpen },
        { path: '/school/events', label: t('sidebar.events', 'Události'), icon: CalendarDays },
        { path: '/school/curriculum', label: t('sidebar.curriculum', 'Předměty a ŠVP'), icon: BookOpen },
        { path: '/school/thematic-plans', label: t('sidebar.thematic_plans', 'Tematické plány'), icon: ClipboardList },
        { path: '/school/lesson-preparations', label: t('sidebar.lesson_preparations', 'Přípravy na hodiny'), icon: FileText },
        { path: '/school/teaching-materials', label: t('sidebar.teaching_materials', 'Materiály'), icon: Presentation },
        { path: '/school/competency-mapping', label: t('sidebar.competency_mapping', 'Výstupy RVP'), icon: Target },
        { path: '/schedule/planner', label: t('sidebar.schedule_planner', 'Plánování rozvrhu'), icon: CalendarDays },
        { path: '/schedule/substitutions', label: t('sidebar.substitutions', 'Suplování'), icon: CalendarDays },
        { path: '/schedule/bell', label: t('sidebar.bell_schedule', 'Zvonění'), icon: Clock },
        { path: '/schedule/diff', label: t('sidebar.schedule_diff', 'Porovnání rozvrhů'), icon: GitCompare },
        { path: '/schedule/recurring-events', label: t('sidebar.recurring_events', 'Kroužky'), icon: Calendar },
        { path: '/grading/report-cards', label: t('sidebar.report_cards', 'Vysvědčení'), icon: FileText },
        { path: '/year-setup', label: t('sidebar.year_setup', 'Příprava roku'), icon: Settings },
    ];

    // Principal/Deputy items (also visible to ADMIN)
    const principalItems = [
        { path: '/school/users', label: t('common.users'), icon: Users },
        { path: '/school/audit-log', label: t('sidebar.audit_log', 'Audit log'), icon: ClipboardList },
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

    const handleLeaveSchool = async () => {
        await leaveSchool();
        navigate('/select-school');
    };

    const hasSchoolContext = tokenType === 'TENANT';
    const isSchoolAdmin = role === 'ADMIN' || role === 'DEPUTY' || role === 'PRINCIPAL';
    const isPrincipalOrAdmin = role === 'ADMIN' || role === 'PRINCIPAL';
    const canSwitchSchool = isSystemAdmin || schoolCount > 1;

    return (
        <TooltipProvider>
            <aside
                className={clsx(
                    'sidebar border-r border-border bg-card text-card-foreground flex flex-col h-full transition-all duration-300 ease-in-out overflow-hidden',
                    collapsed ? 'w-16' : 'w-64'
                )}
            >
                {/* Header */}
                <div className={clsx(
                    'sidebar-header border-b border-border flex items-center',
                    collapsed ? 'p-3 justify-center' : 'p-6 justify-between'
                )}>
                    {!collapsed ? (
                        <>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl font-bold text-primary">EduStack</h1>
                                {hasSchoolContext && currentSchool && (
                                    <div className="mt-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={14} className="text-muted-foreground shrink-0" />
                                            <span className="text-sm font-medium truncate" title={currentSchool.name}>
                                                {currentSchool.name}
                                            </span>
                                        </div>
                                        {isSystemAdmin ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 w-full text-xs"
                                                onClick={async () => {
                                                    await leaveSchool();
                                                    navigate('/dashboard');
                                                }}
                                            >
                                                <ArrowLeft size={12} className="mr-1" />
                                                {t('sidebar.back_to_system', 'Zpět na správu')}
                                            </Button>
                                        ) : canSwitchSchool ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 w-full text-xs"
                                                onClick={handleLeaveSchool}
                                            >
                                                <ArrowLeft size={12} className="mr-1" />
                                                {t('sidebar.change_school', 'Změnit školu')}
                                            </Button>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={toggleCollapsed}
                                className="ml-2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                                title={t('sidebar.collapse', 'Sbalit menu')}
                            >
                                <PanelLeftClose size={18} />
                            </button>
                        </>
                    ) : (
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={toggleCollapsed}
                                    className="p-1.5 rounded-md text-primary hover:bg-accent transition-colors"
                                    title={t('sidebar.expand', 'Rozbalit menu')}
                                >
                                    <PanelLeftOpen size={22} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={8}>
                                <p>{t('sidebar.expand', 'Rozbalit menu')}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>

                {/* Navigation */}
                <nav className={clsx(
                    'sidebar-nav flex-1 overflow-y-auto space-y-1',
                    collapsed ? 'p-2 space-y-2' : 'p-4 space-y-2'
                )} aria-label="Main Navigation">
                    {/* System Admin Global Navigation */}
                    {isSystemAdmin && !hasSchoolContext && (
                        <>
                            <SidebarNavItem to="/dashboard" icon={LayoutDashboard} label={t('common.dashboard')} collapsed={collapsed} />

                            {!collapsed && (
                                <div className="px-4 py-2.5 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {t('sidebar.system_admin')}
                                </div>
                            )}
                            {collapsed && <div className="my-2 border-t border-border" />}
                            <SidebarNavItem to="/system/schools" icon={Building2} label={t('sidebar.schools')} collapsed={collapsed} />
                            <SidebarNavItem to="/system/users" icon={Users2} label={t('sidebar.users')} collapsed={collapsed} />
                            <SidebarNavItem to="/system/settings" icon={Settings} label={t('sidebar.system_settings')} collapsed={collapsed} />
                        </>
                    )}

                    {/* School-specific items */}
                    {hasSchoolContext && (
                        <>
                            {schoolNavItems.map((item) => (
                                <SidebarNavItem
                                    key={item.path}
                                    to={item.path}
                                    icon={item.icon}
                                    label={item.label}
                                    collapsed={collapsed}
                                />
                            ))}

                            {/* Admin Section */}
                            {isSchoolAdmin && !collapsed && (
                                <Accordion type="single" collapsible className="w-full border-none">
                                    <AccordionItem value="school-admin" className="border-none">
                                        <AccordionTrigger className="py-2.5 px-4 hover:no-underline hover:bg-accent rounded-md text-sm font-semibold text-muted-foreground uppercase tracking-wider text-left">
                                            {t('sidebar.school_management')}
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-1 pb-0 space-y-1">
                                            {schoolAdminItems.map((item) => (
                                                <SidebarNavItem
                                                    key={item.path}
                                                    to={item.path}
                                                    icon={item.icon}
                                                    label={item.label}
                                                    collapsed={false}
                                                />
                                            ))}
                                            {isPrincipalOrAdmin && principalItems.map((item) => (
                                                <SidebarNavItem
                                                    key={item.path}
                                                    to={item.path}
                                                    icon={item.icon}
                                                    label={item.label}
                                                    collapsed={false}
                                                />
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            )}

                            {/* Collapsed: show admin items as icons with separator */}
                            {isSchoolAdmin && collapsed && (
                                <>
                                    <div className="my-2 border-t border-border" />
                                    {schoolAdminItems.map((item) => (
                                        <SidebarNavItem
                                            key={item.path}
                                            to={item.path}
                                            icon={item.icon}
                                            label={item.label}
                                            collapsed={collapsed}
                                        />
                                    ))}
                                    {isPrincipalOrAdmin && principalItems.map((item) => (
                                        <SidebarNavItem
                                            key={item.path}
                                            to={item.path}
                                            icon={item.icon}
                                            label={item.label}
                                            collapsed={collapsed}
                                        />
                                    ))}
                                </>
                            )}
                        </>
                    )}

                    {/* Prompt to select school */}
                    {!hasSchoolContext && !isSystemAdmin && !collapsed && (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                            <p>{t('sidebar.select_school_prompt')}</p>
                            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/select-school')}>
                                {t('sidebar.select_school_button')}
                            </Button>
                        </div>
                    )}
                    {!hasSchoolContext && !isSystemAdmin && collapsed && (
                        <SidebarNavItem to="/select-school" icon={Building2} label={t('sidebar.select_school_button')} collapsed={collapsed} />
                    )}
                </nav>

                {/* Language Switcher */}
                <div className={clsx('border-t border-border', collapsed ? 'px-2 py-2' : 'px-4 py-2')}>
                    {collapsed ? (
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => {
                                        const currentLang = i18n.language?.split('-')[0] || 'cs';
                                        i18n.changeLanguage(currentLang === 'cs' ? 'en' : 'cs');
                                    }}
                                    className="w-full flex justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                                >
                                    <Globe size={21} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={8}>
                                <p>{(i18n.language?.split('-')[0] || 'cs') === 'cs' ? '🇬🇧 Switch to English' : '🇨🇿 Přepnout do češtiny'}</p>
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <Globe size={14} className="text-muted-foreground shrink-0" />
                            <div className="flex gap-1 flex-1">
                                {[
                                    { code: 'cs', label: 'CZ', flag: '🇨🇿' },
                                    { code: 'en', label: 'EN', flag: '🇬🇧' },
                                ].map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => i18n.changeLanguage(lang.code)}
                                        className={`
                                            flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors
                                            ${(i18n.language?.split('-')[0] || 'cs') === lang.code
                                                ? 'bg-accent text-accent-foreground'
                                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                                            }
                                        `}
                                    >
                                        <span>{lang.flag}</span>
                                        <span>{lang.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* User section */}
                <div className={clsx('border-t border-border', collapsed ? 'p-2' : 'p-4')}>
                    {user ? (
                        collapsed ? (
                            /* Collapsed user section — just avatar with tooltip */
                            <div className="flex flex-col items-center gap-2">
                                <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                        <button onClick={() => navigate('/profile')} className="rounded-full hover:ring-2 hover:ring-primary/30 transition-all">
                                            <Avatar className="h-9 w-9">
                                                {user.avatarUrl?.startsWith('emoji:') ? (
                                                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getEmojiAvatarBg(user.avatarUrl)}`}>
                                                        <span className="text-sm">{getEmojiAvatarEmoji(user.avatarUrl)}</span>
                                                    </div>
                                                ) : user.avatarUrl?.startsWith('data:') ? (
                                                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                                                ) : (
                                                    <AvatarFallback className="text-xs">{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>
                                                )}
                                            </Avatar>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" sideOffset={8}>
                                        <p className="font-medium">{user.firstName} {user.lastName}</p>
                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleLogout}
                                            className="p-2 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                                        >
                                            <LogOut size={18} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" sideOffset={8}>
                                        <p>{t('common.logout')}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        ) : (
                            /* Expanded user section — full info */
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
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-medium truncate">{user.firstName} {user.lastName}</span>
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
                        )
                    ) : (
                        <div className={clsx("text-sm text-muted-foreground", collapsed ? "text-center" : "text-center")}>{collapsed ? '...' : t('common.loading')}</div>
                    )}
                </div>
            </aside>
        </TooltipProvider>
    );
};
