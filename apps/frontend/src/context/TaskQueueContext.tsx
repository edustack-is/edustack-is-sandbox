import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────

export type TaskStatus = 'running' | 'done' | 'error';

export interface TaskItem {
    id: string;
    name: string;
    label: string;
    status: TaskStatus;
    error?: string;
    createdAt: number;   // timestamp
    finishedAt?: number; // timestamp
}

interface TaskQueueContextType {
    tasks: TaskItem[];
    addTask: (name: string, label: string) => string;
    updateTask: (id: string, updates: Partial<Pick<TaskItem, 'status' | 'error'>>) => void;
    completeTask: (id: string, success: boolean, error?: string) => void;
    clearFinished: () => void;
    clearAll: () => void;
    hasRunning: boolean;
    runningCount: number;
}

const TaskQueueContext = createContext<TaskQueueContextType | null>(null);

// ─── Provider ───────────────────────────────────────────────────

export function TaskQueueProvider({ children }: { children: React.ReactNode }) {
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const idCounter = useRef(0);

    const addTask = useCallback((name: string, label: string): string => {
        const id = `task-${Date.now()}-${++idCounter.current}`;
        const task: TaskItem = {
            id,
            name,
            label,
            status: 'running',
            createdAt: Date.now(),
        };
        setTasks(prev => [task, ...prev]);
        return id;
    }, []);

    const updateTask = useCallback((id: string, updates: Partial<Pick<TaskItem, 'status' | 'error'>>) => {
        setTasks(prev => prev.map(t => {
            if (t.id !== id) return t;
            return {
                ...t,
                ...updates,
                ...(updates.status && updates.status !== 'running' ? { finishedAt: Date.now() } : {}),
            };
        }));
    }, []);

    const completeTask = useCallback((id: string, success: boolean, error?: string) => {
        updateTask(id, {
            status: success ? 'done' : 'error',
            ...(error ? { error } : {}),
        });
    }, [updateTask]);

    const clearFinished = useCallback(() => {
        setTasks(prev => prev.filter(t => t.status === 'running'));
    }, []);

    const clearAll = useCallback(() => {
        setTasks([]);
    }, []);

    const runningCount = tasks.filter(t => t.status === 'running').length;
    const hasRunning = runningCount > 0;

    return (
        <TaskQueueContext.Provider value={{
            tasks,
            addTask,
            updateTask,
            completeTask,
            clearFinished,
            clearAll,
            hasRunning,
            runningCount,
        }}>
            {children}
        </TaskQueueContext.Provider>
    );
}

// ─── Hook ───────────────────────────────────────────────────────

export function useTaskQueue() {
    const ctx = useContext(TaskQueueContext);
    if (!ctx) throw new Error('useTaskQueue must be used within TaskQueueProvider');
    return ctx;
}
