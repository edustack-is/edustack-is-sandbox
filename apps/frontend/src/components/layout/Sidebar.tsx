import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, GraduationCap, Calendar, Users } from 'lucide-react';
import clsx from 'clsx';


const navItems = [
    { path: '/dashboard', label: 'Nástěnka', icon: LayoutDashboard },
    { path: '/users', label: 'Uživatelé', icon: Users },
    { path: '/schedule', label: 'Rozvrh', icon: Calendar },
    { path: '/grading', label: 'Klasifikace', icon: GraduationCap },
    { path: '/ai-tutor', label: 'AI Tutor', icon: BookOpen },
];

export const Sidebar: React.FC = () => {
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
        </aside>
    );
};
