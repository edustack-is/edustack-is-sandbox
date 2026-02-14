import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sparkles, Send, Loader2, Bot, User, Trash2 } from 'lucide-react';
import { api } from '@/api';
import { getAvailableProviders, AiProvider } from '@/api/ai';
import { cn } from '@/lib/utils';
import { useSchool } from '@/context/SchoolContext';
import { useTranslation } from 'react-i18next';

// ─── Types ──────────────────────────────────────────────────────

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

// ═══════════════════════════════════════════════════════════════
// AiChatDrawer — global chat side-panel
// ═══════════════════════════════════════════════════════════════

export function AiChatDrawer() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();

    // Provider State
    const [providers, setProviders] = useState<AiProvider[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<string>('google');
    const [providersLoading, setProvidersLoading] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { userId } = useSchool();

    // Storage key based on userId
    const storageKey = userId ? `ai-chat-history-${userId}` : null;

    // Load history from localStorage on mount or when userId changes
    useEffect(() => {
        if (storageKey) {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    setMessages(JSON.parse(saved));
                } catch (e) {
                    console.error('Failed to parse chat history', e);
                }
            } else {
                setMessages([]);
            }
        }
    }, [storageKey]);

    // Save history to localStorage whenever messages change
    useEffect(() => {
        if (storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(messages));
        }
    }, [messages, storageKey]);

    // Fetch available providers on mount
    useEffect(() => {
        const fetchProviders = async () => {
            try {
                setProvidersLoading(true);
                const available = await getAvailableProviders();
                setProviders(available);

                // Set default if current selection is not available, or just default to first
                if (available.length > 0) {
                    // If previously selected is not in list, reset to first
                    if (!available.find(p => p.id === selectedProvider)) {
                        setSelectedProvider(available[0].id);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch AI providers', err);
            } finally {
                setProvidersLoading(false);
            }
        };

        if (open) {
            fetchProviders();
        }
    }, [open]); // Re-fetch when opening drawer to ensure up-to-date keys

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading, open]);

    // Focus input when drawer opens
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [open]);

    const sendMessage = useCallback(async () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        const userMsg: ChatMessage = { role: 'user', text: trimmed };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInput('');
        setLoading(true);

        // Reset height content
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }

        try {
            const res = await api.post('/api/ai/chat', {
                messages: newHistory,
                provider: selectedProvider
            });
            const aiText = res.data?.response || t('aitutor.errors.no_answer');
            setMessages((prev) => [...prev, { role: 'model', text: aiText }]);
        } catch (err: any) {
            const errMsg = err.response?.data?.message || t('aitutor.errors.communication');
            setMessages((prev) => [...prev, { role: 'model', text: `⚠️ ${errMsg}` }]);
        } finally {
            setLoading(false);
        }
    }, [input, loading, messages, selectedProvider]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([]);
        if (storageKey) {
            localStorage.removeItem(storageKey);
        }
    };

    return (
        <>
            {/* ─── FAB ───────────────────────────────────── */}
            <button
                onClick={() => setOpen(true)}
                className={cn(
                    'fixed bottom-6 right-6 z-40',
                    'flex items-center justify-center',
                    'h-14 w-14 rounded-full',
                    'bg-gradient-to-br from-violet-600 to-indigo-600',
                    'text-white shadow-lg shadow-violet-500/30',
                    'hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105',
                    'active:scale-95',
                    'transition-all duration-200',
                    'group',
                )}
                aria-label={t('aitutor.open_chat')}
            >
                <Sparkles className="h-6 w-6 group-hover:rotate-12 transition-transform" />

                {/* Pulse ring */}
                <span className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping pointer-events-none" />
            </button>

            {/* ─── Sheet ─────────────────────────────────── */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent
                    side="right"
                    className="flex flex-col p-0 w-full sm:max-w-md"
                >
                    {/* Header */}
                    <SheetHeader className="px-5 pt-5 pb-3 border-b bg-gradient-to-r from-violet-600/5 to-indigo-600/5 space-y-4">
                        <div className="flex items-center justify-between pr-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
                                    <Sparkles className="h-4 w-4" />
                                </div>
                                <div>
                                    <SheetTitle>{t('aitutor.title')}</SheetTitle>
                                    <SheetDescription className="text-xs">{t('aitutor.description')}</SheetDescription>
                                </div>
                            </div>
                            {messages.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearChat}
                                    className="text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Select value={selectedProvider} onValueChange={setSelectedProvider} disabled={providers.length === 0}>
                                <SelectTrigger className="w-full h-8 text-xs bg-background/50 border-input/50">
                                    <SelectValue placeholder={t('aitutor.loading_models')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {providersLoading ? (
                                        <div className="flex items-center justify-center p-2 text-xs text-muted-foreground">
                                            <Loader2 className="h-3 w-3 animate-spin mr-2" /> {t('aitutor.loading_models')}
                                        </div>
                                    ) : providers.length > 0 ? (
                                        providers.map(p => (
                                            <SelectItem key={p.id} value={p.id} className="text-xs">
                                                {p.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-2 text-xs text-muted-foreground">{t('aitutor.no_models')}</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </SheetHeader>

                    {/* Messages area */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
                    >
                        {messages.length === 0 && !loading && (
                            <EmptyState />
                        )}

                        {messages.map((msg, i) => (
                            <MessageBubble key={i} message={msg} />
                        ))}

                        {loading && <TypingIndicator />}
                    </div>

                    {/* Input area */}
                    <div className="border-t bg-muted/30 p-4">
                        <div className="flex gap-2 items-end">
                            <Textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={providers.length > 0 ? t('aitutor.placeholder') : t('aitutor.disabled_placeholder')}
                                disabled={loading || providers.length === 0}
                                className="flex-1 bg-background min-h-[44px] max-h-[150px] resize-none py-3"
                                rows={1}
                            />
                            <Button
                                onClick={sendMessage}
                                disabled={loading || !input.trim() || providers.length === 0}
                                size="icon"
                                className="bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shrink-0 h-10 w-10 mb-[2px]"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 text-center">
                            {t('aitutor.footer_note')}
                        </p>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════
// Message Bubble
// ═══════════════════════════════════════════════════════════════

function MessageBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';

    return (
        <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
            {/* Avatar */}
            <div
                className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                    isUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white',
                )}
            >
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            {/* Bubble */}
            <div
                className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    isUser
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-muted rounded-tl-sm',
                )}
            >
                {isUser ? (
                    <p className="whitespace-pre-wrap">{message.text}</p>
                ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2 prose-headings:my-2 prose-code:text-xs prose-pre:text-xs prose-pre:bg-background/50 prose-pre:rounded-lg">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.text}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════════════

function EmptyState() {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-600/10 to-indigo-600/10 mb-4">
                <Sparkles className="h-8 w-8 text-violet-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('aitutor.empty_state.title')}</h3>
            <p className="text-sm text-muted-foreground max-w-[260px]">
                {t('aitutor.empty_state.description')}
            </p>
            <div className="mt-6 space-y-2 text-xs text-muted-foreground">
                <SuggestionPill text={t('aitutor.empty_state.suggestions.school')} />
                <SuggestionPill text={t('aitutor.empty_state.suggestions.schema')} />
                <SuggestionPill text={t('aitutor.empty_state.suggestions.backend')} />
            </div>
        </div>
    );
}

function SuggestionPill({ text }: { text: string }) {
    return (
        <div className="inline-block px-3 py-1.5 rounded-full bg-muted/80 text-muted-foreground text-xs">
            💡 {text}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// Typing Indicator
// ═══════════════════════════════════════════════════════════════

function TypingIndicator() {
    return (
        <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
                <Bot className="h-4 w-4" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
            </div>
        </div>
    );
}
