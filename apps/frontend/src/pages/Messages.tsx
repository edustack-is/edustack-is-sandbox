import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
    getConversations,
    getMessages,
    sendMessage,
    createConversation,
    getAvailableRecipients,
    getMessagingClassrooms,
    createClassBroadcast,
    createSchoolBroadcast,
} from '@/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MessageSquare, Send, Plus, Search, Users, Megaphone, School, Loader2, ArrowLeft } from 'lucide-react';
import { useSchool } from '@/context/SchoolContext';

// ─── Types ─────────────────────────────────────────────

interface User {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    role?: string;
}

interface Message {
    id: string;
    content: string;
    sender: User;
    createdAt: string;
}

interface Conversation {
    id: string;
    subject: string | null;
    type: string;
    participants: User[];
    lastMessage: { id: string; content: string; sender: User; createdAt: string } | null;
    unreadCount: number;
    totalMessages: number;
    updatedAt: string;
}

// ─── Constants ──────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
    TEACHER: 'bg-blue-100 text-blue-700',
    STUDENT: 'bg-emerald-100 text-emerald-700',
    PARENT: 'bg-purple-100 text-purple-700',
    PRINCIPAL: 'bg-amber-100 text-amber-700',
    DEPUTY: 'bg-orange-100 text-orange-700',
    ADMIN: 'bg-red-100 text-red-700',
    DIRECTOR: 'bg-amber-100 text-amber-700',
};

// ─── Component ──────────────────────────────────────────

export default function Messages() {
    const { t, i18n } = useTranslation();
    const { role } = useSchool();
    const [searchParams, setSearchParams] = useSearchParams();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('conversation'));
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [newDialogOpen, setNewDialogOpen] = useState(false);
    const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const currentUserId = localStorage.getItem('user_id') || '';
    const canBroadcast = ['PRINCIPAL', 'DEPUTY', 'ADMIN', 'DIRECTOR', 'TEACHER'].includes(role || '');
    const canSchoolBroadcast = ['PRINCIPAL', 'DEPUTY', 'ADMIN', 'DIRECTOR'].includes(role || '');

    const fetchConversations = useCallback(async () => {
        try {
            const data = await getConversations();
            setConversations(data || []);
        } catch {
            toast.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchConversations();
        const interval = setInterval(fetchConversations, 15000);
        return () => clearInterval(interval);
    }, [fetchConversations]);

    useEffect(() => {
        if (selectedId) {
            loadMessages(selectedId);
            setSearchParams({ conversation: selectedId });
        }
    }, [selectedId]);

    const loadMessages = async (convId: string) => {
        setLoadingMessages(true);
        try {
            const data = await getMessages(convId);
            setMessages(data.messages || []);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch {
            toast.error(t('common.error'));
        }
        setLoadingMessages(false);
    };

    const handleSend = async () => {
        if (!selectedId || !newMessage.trim()) return;
        setSending(true);
        try {
            await sendMessage(selectedId, newMessage.trim());
            setNewMessage('');
            await loadMessages(selectedId);
            await fetchConversations();
        } catch {
            toast.error(t('common.error'));
        }
        setSending(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const getConversationTitle = (conv: Conversation) => {
        if (conv.subject) return conv.subject;
        if (conv.type === 'CLASS_BROADCAST') return `📢 ${t('messages.broadcast')}`;
        if (conv.type === 'SCHOOL_BROADCAST') return `🏫 ${t('messages.broadcast')}`;
        const others = conv.participants.filter((p) => p.id !== currentUserId);
        if (others.length === 0) return t('common.message');
        return others.map((p) => `${p.firstName} ${p.lastName}`).join(', ');
    };

    const getConversationIcon = (type: string) => {
        if (type === 'CLASS_BROADCAST') return <Users className="h-4 w-4 text-blue-500" />;
        if (type === 'SCHOOL_BROADCAST') return <School className="h-4 w-4 text-amber-500" />;
        return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return t('common.loading'); // Use a placeholder for "now"
        if (mins < 60) return `${mins}m`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d`;
        return new Date(dateStr).toLocaleDateString(i18n.language);
    };

    const filteredConversations = conversations.filter((c) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const title = getConversationTitle(c).toLowerCase();
        const lastMsg = c.lastMessage?.content?.toLowerCase() || '';
        return title.includes(q) || lastMsg.includes(q);
    });

    const selectedConv = conversations.find((c) => c.id === selectedId);

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold">{t('messages.title')}</h1>
                <div className="flex gap-2">
                    {canBroadcast && (
                        <Button variant="outline" size="sm" onClick={() => setBroadcastDialogOpen(true)}>
                            <Megaphone className="h-4 w-4 mr-1" /> {t('messages.broadcast')}
                        </Button>
                    )}
                    <Button size="sm" onClick={() => setNewDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> {t('messages.new_message')}
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex gap-4 min-h-0">
                {/* Conversation List */}
                <Card className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col shrink-0`}>
                    <div className="p-3 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={t('messages.search_placeholder')}
                                className="pl-9 h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                                {searchQuery ? t('common.no_results') : t('messages.empty_state')}
                            </div>
                        ) : (
                            filteredConversations.map((conv) => (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedId(conv.id)}
                                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-accent/50 transition-colors border-b ${
                                        selectedId === conv.id ? 'bg-accent' : ''
                                    } ${conv.unreadCount > 0 ? 'bg-primary/5' : ''}`}
                                >
                                    <div className="mt-1 shrink-0">{getConversationIcon(conv.type)}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span
                                                className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold' : ''}`}
                                            >
                                                {getConversationTitle(conv)}
                                            </span>
                                            {conv.lastMessage && (
                                                <span className="text-[10px] text-muted-foreground shrink-0">
                                                    {timeAgo(conv.lastMessage.createdAt)}
                                                </span>
                                            )}
                                        </div>
                                        {conv.lastMessage && (
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                <span className="font-medium">
                                                    {conv.lastMessage.sender.firstName}:
                                                </span>{' '}
                                                {conv.lastMessage.content}
                                            </p>
                                        )}
                                    </div>
                                    {conv.unreadCount > 0 && (
                                        <Badge
                                            variant="default"
                                            className="shrink-0 h-5 min-w-[20px] flex items-center justify-center text-[10px]"
                                        >
                                            {conv.unreadCount}
                                        </Badge>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </Card>

                {/* Message Thread */}
                <Card className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
                    {selectedConv ? (
                        <>
                            {/* Thread Header */}
                            <div className="px-4 py-3 border-b flex items-center gap-3">
                                <button
                                    className="md:hidden shrink-0 p-1 rounded hover:bg-accent"
                                    onClick={() => setSelectedId(null)}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-sm truncate">
                                        {getConversationTitle(selectedConv)}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {selectedConv.participants.length} {t('common.users')} ·{' '}
                                        {selectedConv.totalMessages} {t('common.message')}
                                    </p>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-auto px-4 py-4 space-y-3">
                                {loadingMessages ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center py-12 text-sm text-muted-foreground">
                                        {t('common.no_entries')}
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const isMine = msg.sender.id === currentUserId;
                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div className={`max-w-[75%] ${isMine ? 'order-1' : ''}`}>
                                                    {!isMine && (
                                                        <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">
                                                            {msg.sender.firstName} {msg.sender.lastName}
                                                        </p>
                                                    )}
                                                    <div
                                                        className={`rounded-2xl px-4 py-2 text-sm ${
                                                            isMine
                                                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                                                : 'bg-muted rounded-bl-md'
                                                        }`}
                                                    >
                                                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                                    </div>
                                                    <p
                                                        className={`text-[10px] text-muted-foreground mt-0.5 ${isMine ? 'text-right mr-1' : 'ml-1'}`}
                                                    >
                                                        {new Date(msg.createdAt).toLocaleTimeString(i18n.language, {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="px-4 py-3 border-t">
                                <div className="flex gap-2">
                                    <Textarea
                                        ref={inputRef}
                                        placeholder={t('common.write_message')}
                                        rows={1}
                                        className="resize-none min-h-[40px] max-h-32"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                    />
                                    <Button size="icon" onClick={handleSend} disabled={sending || !newMessage.trim()}>
                                        {sending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <CardContent className="flex-1 flex items-center justify-center">
                            <div className="text-center text-muted-foreground">
                                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">{t('messages.empty_state')}</p>
                            </div>
                        </CardContent>
                    )}
                </Card>
            </div>

            {/* New Message Dialog */}
            <NewMessageDialog
                open={newDialogOpen}
                onOpenChange={setNewDialogOpen}
                onCreated={(convId) => {
                    setSelectedId(convId);
                    fetchConversations();
                    setNewDialogOpen(false);
                }}
            />

            {/* Broadcast Dialog */}
            {canBroadcast && (
                <BroadcastDialog
                    open={broadcastDialogOpen}
                    onOpenChange={setBroadcastDialogOpen}
                    canSchoolBroadcast={canSchoolBroadcast}
                    onCreated={(convId) => {
                        setSelectedId(convId);
                        fetchConversations();
                        setBroadcastDialogOpen(false);
                    }}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// New Message Dialog
// ═══════════════════════════════════════════════════════════

function NewMessageDialog({
    open,
    onOpenChange,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (id: string) => void;
}) {
    const { t } = useTranslation();
    const [recipients, setRecipients] = useState<User[]>([]);

    const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (open) {
            setLoading(true);
            getAvailableRecipients()
                .then((data) => setRecipients(data || []))
                .catch(() => toast.error(t('common.error')))
                .finally(() => setLoading(false));
            setSelectedRecipients([]);
            setSubject('');
            setMessage('');
            setSearch('');
        }
    }, [open, t]);

    const filteredRecipients = recipients.filter((r) => {
        if (!search) return true;
        const q = search.toLowerCase();
        const name = `${r.firstName} ${r.lastName}`.toLowerCase();
        return name.includes(q) || (r.role || '').toLowerCase().includes(q);
    });

    const handleSend = async () => {
        if (selectedRecipients.length === 0 || !message.trim()) return;
        setSending(true);
        try {
            const conv = await createConversation({
                recipientIds: selectedRecipients,
                subject: subject || undefined,
                initialMessage: message.trim(),
            });
            onCreated(conv.id);
            toast.success(t('common.success'));
        } catch {
            toast.error(t('common.error'));
        }
        setSending(false);
    };

    const toggleRecipient = (id: string) => {
        setSelectedRecipients((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" /> {t('messages.new_message')}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 flex-1 overflow-auto">
                    <div className="space-y-2">
                        <Label>{t('common.subject_optional')}</Label>
                        <Input
                            placeholder={t('common.enter_subject')}
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('messages.recipients')}</Label>
                        {selectedRecipients.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {selectedRecipients.map((id) => {
                                    const r = recipients.find((rr) => rr.id === id);
                                    if (!r) return null;
                                    return (
                                        <Badge
                                            key={id}
                                            variant="secondary"
                                            className="cursor-pointer hover:bg-destructive/20"
                                            onClick={() => toggleRecipient(id)}
                                        >
                                            {r.firstName} {r.lastName} ✕
                                        </Badge>
                                    );
                                })}
                            </div>
                        )}
                        <Input
                            placeholder={t('common.search_recipient')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <div className="max-h-40 overflow-auto border rounded-md">
                            {loading ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    {t('common.loading')}
                                </div>
                            ) : filteredRecipients.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    {t('common.no_results')}
                                </div>
                            ) : (
                                filteredRecipients.map((r) => (
                                    <button
                                        key={r.id}
                                        onClick={() => toggleRecipient(r.id)}
                                        className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-accent/50 text-sm border-b last:border-b-0 ${
                                            selectedRecipients.includes(r.id) ? 'bg-primary/10' : ''
                                        }`}
                                    >
                                        <span className="flex-1">
                                            {r.firstName} {r.lastName}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] ${ROLE_COLORS[r.role || ''] || ''}`}
                                        >
                                            {t(`roles.${r.role}`)}
                                        </Badge>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('messages.text')}</Label>
                        <Textarea
                            rows={4}
                            placeholder={t('common.write_message')}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={sending || selectedRecipients.length === 0 || !message.trim()}
                    >
                        {sending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                            <Send className="h-4 w-4 mr-1" />
                        )}
                        {t('messages.send')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ═══════════════════════════════════════════════════════════
// Broadcast Dialog
// ═══════════════════════════════════════════════════════════

function BroadcastDialog({
    open,
    onOpenChange,
    canSchoolBroadcast,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    canSchoolBroadcast: boolean;
    onCreated: (convId: string) => void;
}) {
    const { t } = useTranslation();
    const [type, setType] = useState<'class' | 'school'>('class');
    const [classrooms, setClassrooms] = useState<{ id: string; name: string; grade: number }[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (open) {
            setLoading(true);
            getMessagingClassrooms()
                .then((data) => {
                    setClassrooms(data || []);
                    if (data?.length > 0) setSelectedClassroom(data[0].id);
                })
                .finally(() => setLoading(false));
            setSubject('');
            setMessage('');
        }
    }, [open]);

    const handleSend = async () => {
        if (!subject.trim() || !message.trim()) return;
        setSending(true);
        try {
            let conv;
            if (type === 'class') {
                conv = await createClassBroadcast({
                    classroomId: selectedClassroom,
                    subject: subject.trim(),
                    message: message.trim(),
                });
            } else {
                conv = await createSchoolBroadcast({
                    subject: subject.trim(),
                    message: message.trim(),
                });
            }
            onCreated(conv.id);
            toast.success(t('common.success'));
        } catch {
            toast.error(t('common.error'));
        }
        setSending(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Megaphone className="h-5 w-5" /> {t('messages.broadcast')}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex gap-2">
                        <button
                            className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all ${
                                type === 'class'
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-muted/30 hover:bg-muted'
                            }`}
                            onClick={() => setType('class')}
                        >
                            <Users className="h-4 w-4 mx-auto mb-1" />
                            {t('common.class')}
                        </button>
                        {canSchoolBroadcast && (
                            <button
                                className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all ${
                                    type === 'school'
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-muted/30 hover:bg-muted'
                                }`}
                                onClick={() => setType('school')}
                            >
                                <School className="h-4 w-4 mx-auto mb-1" />
                                {t('sidebar.schools')}
                            </button>
                        )}
                    </div>

                    {type === 'class' && (
                        <div className="space-y-2">
                            <Label>{t('common.class')}</Label>
                            {loading ? (
                                <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                            ) : (
                                <select
                                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                    value={selectedClassroom}
                                    onChange={(e) => setSelectedClassroom(e.target.value)}
                                >
                                    {classrooms.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>{t('common.subject_optional')}</Label>
                        <Input
                            placeholder={t('common.enter_subject')}
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('messages.text')}</Label>
                        <Textarea
                            rows={4}
                            placeholder={t('common.write_message')}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={handleSend} disabled={sending || !subject.trim() || !message.trim()}>
                        {sending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                            <Send className="h-4 w-4 mr-1" />
                        )}
                        {t('messages.send')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
