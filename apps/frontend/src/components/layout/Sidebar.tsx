import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, GraduationCap, Calendar, Settings } from 'lucide-react';
import clsx from 'clsx';
import './Sidebar.css';

const navItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/registry', label: 'Registry', icon: Users },
    { path: '/grading', label: 'Grading', icon: GraduationCap },
    { path: '/schedule', label: 'Schedule', icon: Calendar },
    { path: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1>EduStack</h1>
            </div>
            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => clsx('nav-item', { active: isActive })}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
};
