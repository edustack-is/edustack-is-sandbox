import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, GraduationCap, Calendar, Users, LogOut, Building2, Users2, ArrowLeft, Settings } from 'lucide-react';
import clsx from 'clsx';
import { getMe } from '@/api';
import { useSchool } from '@/context/SchoolContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const schoolNavItems = [
    { path: '/dashboard', label: 'Nástěnka', icon: LayoutDashboard },
    { path: '/users', label: 'Uživatelé', icon: Users },
    { path: '/schedule', label: 'Rozvrh', icon: Calendar },
    { path: '/grading', label: 'Klasifikace', icon: GraduationCap },
    { path: '/year-setup', label: 'Příprava roku', icon: Settings },
    { path: '/ai-tutor', label: 'AI Tutor', icon: BookOpen },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) => clsx(
    'nav-item flex items-center space-x-3 px-4 py-3 rounded-md transition-colors duration-200',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    { 'bg-accent text-accent-foreground font-medium': isActive }
);

export const Sidebar: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const { tokenType, isSystemAdmin, currentSchool, leaveSchool } = useSchool();

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
        if (isSystemAdmin) {
            navigate('/system/schools');
        } else {
            navigate('/select-school');
        }
    };

    const hasSchoolContext = tokenType === 'TENANT';

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
                {/* School-specific items — only when a school is selected */}
                {hasSchoolContext && (
                    <>
                        {schoolNavItems.map((item) => (
                            <NavLink key={item.path} to={item.path} className={navLinkClass}>
                                <item.icon size={20} />
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </>
                )}

                {/* System Admin Section — only visible when no school is selected */}
                {isSystemAdmin && !hasSchoolContext && (
                    <>
                        <div className={clsx(
                            'px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider',
                            hasSchoolContext ? 'mt-4 mb-2' : 'mb-2'
                        )}>
                            System Admin
                        </div>
                        <NavLink to="/system/schools" className={navLinkClass}>
                            <Building2 size={20} />
                            <span>Školy</span>
                        </NavLink>
                        <NavLink to="/system/users" className={navLinkClass}>
                            <Users2 size={20} />
                            <span>Uživatelé</span>
                        </NavLink>
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
                        <Badge variant="outline" className="w-fit">{user.role || (isSystemAdmin ? 'System Admin' : 'User')}</Badge>
                        <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Odhlásit se
                        </Button>
                    </div>
                ) : (
                    <div className="text-center text-sm text-muted-foreground">Načítání profilu...</div>
                )}
            </div>
        </aside>
    );
};
