import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, GraduationCap, Calendar, Users, LogOut, Building2, Users2, ArrowLeft, Settings, DoorOpen, BookOpen, User } from 'lucide-react';
import clsx from 'clsx';
import { getMe } from '@/api';
import { useSchool } from '@/context/SchoolContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const schoolNavItems = [
    { path: '/dashboard', label: 'Nástěnka', icon: LayoutDashboard },
    { path: '/schedule', label: 'Rozvrh', icon: Calendar },
    { path: '/grading', label: 'Klasifikace', icon: GraduationCap },
];

const schoolAdminItems = [
    { path: '/school/users', label: 'Uživatelé', icon: Users },
    { path: '/school/rooms', label: 'Učebny', icon: DoorOpen },
    { path: '/school/curriculum', label: 'Předměty a ŠVP', icon: BookOpen },
    { path: '/year-setup', label: 'Příprava roku', icon: Settings },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) => clsx(
    'nav-item flex items-center space-x-3 px-4 py-2.5 rounded-md transition-colors duration-200',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    { 'bg-accent text-accent-foreground font-medium': isActive }
);

export const Sidebar: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const { tokenType, isSystemAdmin, currentSchool, leaveSchool, role } = useSchool();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const userData = await getMe();
                setUser(userData);
            } catch (e) {
                console.error('Failed to fetch user', e);
            }
        };
        fetchUser();
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
                    <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={currentSchool.name}>
                            {currentSchool.name}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={handleLeaveSchool}
                        >
                            <ArrowLeft size={12} className="mr-1" />
                            Zpět
                        </Button>
                    </div>
                )}
            </div>

            <nav className="sidebar-nav flex-1 p-4 space-y-2 overflow-y-auto" aria-label="Main Navigation">
                {/* System Admin Global Navigation */}
                {isSystemAdmin && !hasSchoolContext && (
                    <>
                        <NavLink to="/dashboard" className={navLinkClass}>
                            <LayoutDashboard size={18} />
                            <span>Nástěnka</span>
                        </NavLink>
                        <NavLink to="/select-school" className={navLinkClass}>
                            <Building2 size={18} />
                            <span>Výběr školy</span>
                        </NavLink>

                        <div className="px-4 py-2.5 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            System Admin
                        </div>
                        <NavLink to="/system/schools" className={navLinkClass}>
                            <Building2 size={18} />
                            <span>Školy</span>
                        </NavLink>
                        <NavLink to="/system/users" className={navLinkClass}>
                            <Users2 size={18} />
                            <span>Uživatelé</span>
                        </NavLink>
                        <NavLink to="/system/settings" className={navLinkClass}>
                            <Settings size={18} />
                            <span>Nastavení systému</span>
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
                                        Správa školy
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
                        <p>Vyberte školu pro zobrazení menu.</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/select-school')}>
                            Vybrat školu
                        </Button>
                    </div>
                )}
            </nav>

            <div className="p-4 border-t border-border">
                {user ? (
                    <div className="flex flex-col space-y-3">
                        <div className="flex items-center space-x-3">
                            <Avatar>
                                <AvatarFallback>{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>
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
                                    Můj profil
                                </Button>
                                <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 font-medium" onClick={handleLogout}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Odhlásit se
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-sm text-muted-foreground">Načítání profilu...</div>
                )}
            </div>
        </aside>
    );
};
