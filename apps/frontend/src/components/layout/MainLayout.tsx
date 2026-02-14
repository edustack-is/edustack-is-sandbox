import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AiChatDrawer } from '../AiChatDrawer';

export const MainLayout: React.FC = () => {
    return (
        <div className="layout min-h-screen bg-background text-foreground flex">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <main className="main-content flex-1 p-8 overflow-auto">
                    <Outlet />
                </main>
            </div>
            <AiChatDrawer />
        </div>
    );
};
