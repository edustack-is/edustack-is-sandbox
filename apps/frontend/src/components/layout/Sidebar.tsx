import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, GraduationCap, Calendar, Users, LogOut, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';
import { getMe } from '@/api';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const navItems = [
    { path: '/dashboard', label: 'Nástěnka', icon: LayoutDashboard },
    { path: '/users', label: 'Uživatelé', icon: Users },
    { path: '/schedule', label: 'Rozvrh', icon: Calendar },
    { path: '/grading', label: 'Klasifikace', icon: GraduationCap },
    { path: '/ai-tutor', label: 'AI Tutor', icon: BookOpen },
];

export const Sidebar: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);

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
        navigate('/login');
    };

    return (
        <aside className="sidebar w-64 border-r border-border bg-card text-card-foreground flex flex-col h-screen">
            <div className="sidebar-header p-6 border-b border-border">
                <h1 className="text-xl font-bold text-primary">EduStack</h1>
            </div>
            <nav className="sidebar-nav flex-1 p-4 space-y-2" aria-label="Main Navigation">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => clsx(
                            'nav-item flex items-center space-x-3 px-4 py-3 rounded-md transition-colors duration-200',
                            'hover:bg-accent hover:text-accent-foreground',
                            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                            { 'bg-accent text-accent-foreground font-medium': isActive }
                        )}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
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
                        <Badge variant="outline" className="w-fit">{user.role}</Badge>
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
