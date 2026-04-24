import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, MessageSquare, GraduationCap, AlertCircle } from 'lucide-react';
import { getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } from '@/api';
import { useNavigate } from 'react-router-dom';

interface Notification {
    id: string;
    type: string;
    title: string;
    body: string | null;
    linkUrl: string | null;
    read: boolean;
    createdAt: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
    MESSAGE: MessageSquare,
    GRADE: GraduationCap,
    SYSTEM: AlertCircle,
};

export const NotificationBell: React.FC = () => {
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const data = await getUnreadNotificationCount();
            setUnreadCount(data.count || 0);
        } catch {
            /* ignore */
        }
    }, []);

    // Poll for unread count every 30s
    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const data = await getNotifications(15);
            setNotifications(data.notifications || []);
        } catch {
            /* ignore */
        }
        setLoading(false);
    };

    const handleToggle = () => {
        if (!open) fetchNotifications();
        setOpen(!open);
    };

    const handleClick = async (n: Notification) => {
        if (!n.read) {
            await markNotificationRead(n.id);
            setNotifications((prev) => prev.map((nn) => (nn.id === n.id ? { ...nn, read: true } : nn)));
            setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        if (n.linkUrl) {
            navigate(n.linkUrl);
            setOpen(false);
        }
    };

    const handleMarkAllRead = async () => {
        await markAllNotificationsRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'právě teď';
        if (mins < 60) return `${mins} min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        return `${days}d`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleToggle}
                className="relative p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label="Notifikace"
            >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-80 bg-popover border rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                        <span className="font-semibold text-sm">Notifikace</span>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                                <CheckCheck className="h-3 w-3" /> Označit vše
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-80 overflow-auto">
                        {loading ? (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Načítání...</div>
                        ) : notifications.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Žádné notifikace</div>
                        ) : (
                            notifications.map((n) => {
                                const Icon = ICON_MAP[n.type] || Bell;
                                return (
                                    <button
                                        key={n.id}
                                        onClick={() => handleClick(n)}
                                        className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-accent/50 transition-colors border-b last:border-b-0 ${!n.read ? 'bg-primary/5' : ''}`}
                                    >
                                        <div
                                            className={`mt-0.5 shrink-0 ${!n.read ? 'text-primary' : 'text-muted-foreground'}`}
                                        >
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm truncate ${!n.read ? 'font-medium' : ''}`}>
                                                {n.title}
                                            </p>
                                            {n.body && (
                                                <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {timeAgo(n.createdAt)}
                                            </p>
                                        </div>
                                        {!n.read && (
                                            <div className="mt-1.5 shrink-0">
                                                <div className="h-2 w-2 rounded-full bg-primary" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-2 border-t bg-muted/30">
                            <button
                                onClick={() => {
                                    navigate('/messages');
                                    setOpen(false);
                                }}
                                className="text-xs text-primary hover:text-primary/80 w-full text-center"
                            >
                                Zobrazit zprávy →
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
