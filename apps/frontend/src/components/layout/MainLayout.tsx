import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AiChatDrawer } from '../AiChatDrawer';
import { TaskQueuePanel } from '../TaskQueuePanel';
import { NotificationBell } from '../NotificationBell';

export const MainLayout: React.FC = () => {
    return (
        <div className="layout h-full bg-background text-foreground flex overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                {/* Top bar with notification bell */}
                <div className="flex items-center justify-end px-6 py-2 border-b bg-card/50">
                    <NotificationBell />
                </div>
                <main className="main-content flex-1 p-8 overflow-auto">
                    <Outlet />
                </main>
            </div>
            <AiChatDrawer />
            <TaskQueuePanel />
        </div>
    );
};
