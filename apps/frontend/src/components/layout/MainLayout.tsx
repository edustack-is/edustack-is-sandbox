import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AiChatDrawer } from '../AiChatDrawer';
import { TaskQueuePanel } from '../TaskQueuePanel';

export const MainLayout: React.FC = () => {
    return (
        <div className="layout h-full bg-background text-foreground flex overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <main className="main-content flex-1 p-8 overflow-auto">
                    <Outlet />
                </main>
            </div>
            <AiChatDrawer />
            <TaskQueuePanel />
        </div>
    );
};
