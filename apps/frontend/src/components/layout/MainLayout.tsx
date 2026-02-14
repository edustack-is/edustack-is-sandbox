import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AiChatDrawer } from '../AiChatDrawer';
import { LanguageSwitcher } from './LanguageSwitcher';

export const MainLayout: React.FC = () => {
    return (
        <div className="layout min-h-screen bg-background text-foreground flex">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-14 border-b border-border bg-card flex items-center justify-end px-8 shrink-0">
                    <LanguageSwitcher />
                </header>
                <main className="main-content flex-1 p-8 overflow-auto">
                    <Outlet />
                </main>
            </div>
            <AiChatDrawer />
        </div>
    );
};
