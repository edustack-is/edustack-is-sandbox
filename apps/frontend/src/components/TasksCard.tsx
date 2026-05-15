import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { ListTodo, Plus, Trash2, Loader2 } from 'lucide-react';
import { getTasks, createTask, toggleTask, deleteTask } from '@/api';
import { toast } from 'sonner';

export const TasksCard = () => {
    const { t } = useTranslation();
    const [tasks, setTasks] = useState<any[]>([]);
    const [newTitle, setNewTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);

    const loadTasks = async () => {
        try {
            const data = await getTasks();
            setTasks(data || []);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        setAdding(true);
        try {
            await createTask(newTitle.trim());
            setNewTitle('');
            loadTasks();
        } catch {
            toast.error(t('common.error'));
        } finally {
            setAdding(false);
        }
    };

    const handleToggle = async (id: string) => {
        try {
            await toggleTask(id);
            // Optimistic update
            setTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
        } catch {
            loadTasks();
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteTask(id);
            setTasks(tasks.filter((t) => t.id !== id));
        } catch {
            toast.error(t('common.error'));
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ListTodo className="h-5 w-5 text-indigo-500" />
                    {t('dashboard.my_tasks', 'Moje úkoly')}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
                <form onSubmit={handleAdd} className="flex gap-2">
                    <Input
                        placeholder={t('dashboard.new_task_placeholder', 'Přidat úkol...')}
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="h-9"
                    />
                    <Button
                        type="submit"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        disabled={adding || !newTitle.trim()}
                    >
                        {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                </form>

                <div className="flex-1 overflow-auto space-y-2">
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : tasks.length === 0 ? (
                        <p className="text-center py-8 text-sm text-muted-foreground italic">
                            {t('dashboard.no_tasks', 'Žádné úkoly')}
                        </p>
                    ) : (
                        tasks.map((task) => (
                            <div
                                key={task.id}
                                className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 group transition-colors"
                            >
                                <Checkbox checked={!!task.completed} onCheckedChange={() => handleToggle(task.id)} />
                                <span
                                    className={`text-sm flex-1 truncate ${
                                        task.completed ? 'line-through text-muted-foreground' : ''
                                    }`}
                                >
                                    {task.title}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleDelete(task.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
