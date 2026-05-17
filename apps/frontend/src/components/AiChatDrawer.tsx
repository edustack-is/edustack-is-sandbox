import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Send, Loader2, Bot, User, Trash2, PanelRightClose } from 'lucide-react';
import { getAvailableProviders, AiProvider } from '@/api/ai';
import { getBackendBaseUrl } from '@/api';
import { cn } from '@/lib/utils';
import { useSchool } from '@/context/SchoolContext';
import { useTaskQueue } from '@/context/TaskQueueContext';
import { getToolLabel } from './TaskQueuePanel';
import { useTranslation } from 'react-i18next';

// ─── Types ──────────────────────────────────────────────────────

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

// ═══════════════════════════════════════════════════════════════
// AiChatDrawer — global chat side-panel
// ═══════════════════════════════════════════════════════════════

interface ToolProgress {
    name: string;
    status: 'running' | 'done' | 'error';
}

export function AiChatDrawer() {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingSeconds, setLoadingSeconds] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [toolsUsed, setToolsUsed] = useState<ToolProgress[]>([]);
    const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const taskIdsRef = useRef<Record<string, string>>({}); // toolName → taskId
    const { t } = useTranslation();
    const { addTask, completeTask } = useTaskQueue();

    // Provider State
    const [providers, setProviders] = useState<AiProvider[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<string>('google-flash');
    const [providersLoading, setProvidersLoading] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { userId } = useSchool();

    // Storage key based on userId
    const storageKey = userId ? `ai-chat-history-${userId}` : null;

    // Lazy-initialize messages from localStorage
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        if (!userId) return [];
        const key = `ai-chat-history-${userId}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                /* ignore */
            }
        }
        return [];
    });

    const initialized = useRef(false);

    // Re-load history when userId changes (e.g. school switch)
    useEffect(() => {
        initialized.current = false;
        if (storageKey) {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    setMessages(JSON.parse(saved));
                } catch (e) {
                    console.error('Failed to parse chat history', e);
                    setMessages([]);
                }
            } else {
                setMessages([]);
            }
        } else {
            setMessages([]);
        }
        // Mark as initialized after the state update is queued
        requestAnimationFrame(() => {
            initialized.current = true;
        });
    }, [storageKey]);

    // Save history to localStorage whenever messages change (only after init)
    useEffect(() => {
        if (storageKey && initialized.current) {
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

                // Always select the first available provider from the list
                if (available.length > 0) {
                    setSelectedProvider(available[0].id);
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

    const startLoading = useCallback(() => {
        setLoading(true);
        setLoadingSeconds(0);
        setStatusMessage('Připravuji odpověď...');
        setToolsUsed([]);
        loadingTimerRef.current = setInterval(() => {
            setLoadingSeconds((s) => s + 1);
        }, 1000);
    }, []);

    const stopLoading = useCallback(() => {
        setLoading(false);
        setLoadingSeconds(0);
        setStatusMessage('');
        setToolsUsed([]);
        if (loadingTimerRef.current) {
            clearInterval(loadingTimerRef.current);
            loadingTimerRef.current = null;
        }
    }, []);

    const streamChat = useCallback(
        async (history: ChatMessage[]) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 180000); // 3min timeout

            try {
                const response = await fetch(`${getBackendBaseUrl()}/api/ai/chat/stream`, {
                    method: 'POST',
                    // Send the session cookie alongside the streaming POST.
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept-Language': 'cs',
                    },
                    body: JSON.stringify({
                        messages: history,
                        provider: selectedProvider,
                    }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(response.statusText || 'Chyba komunikace s AI');
                }

                const reader = response.body?.getReader();
                if (!reader) throw new Error('Stream not supported');

                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Parse SSE events from buffer
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer

                    let currentEventType = '';
                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            currentEventType = line.slice(7).trim();
                        } else if (line.startsWith('data: ') && currentEventType) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                handleStreamEvent(currentEventType, data, history);
                            } catch {
                                // Skip malformed JSON
                            }
                            currentEventType = '';
                        }
                    }
                }
            } catch (err: any) {
                if (err.name === 'AbortError') {
                    setMessages((prev) => [
                        ...prev,
                        { role: 'model', text: '⚠️ AI odpověď trvala příliš dlouho. Zkuste to znovu.' },
                    ]);
                } else {
                    setMessages((prev) => [
                        ...prev,
                        { role: 'model', text: `⚠️ ${err.message || t('aitutor.errors.communication')}` },
                    ]);
                }
            } finally {
                clearTimeout(timeout);
                stopLoading();
            }
        },
        [selectedProvider, stopLoading],
    );

    const handleStreamEvent = useCallback((type: string, data: any, _history: ChatMessage[]) => {
        switch (type) {
            case 'status':
                setStatusMessage(data.message || '');
                break;

            case 'tool_start': {
                const label = getToolLabel(t, data.name);
                setStatusMessage(t('taskQueue.calling_tool', { name: label }));
                setToolsUsed((prev) => [...prev, { name: data.name, status: 'running' }]);
                // Register in global task queue
                const taskId = addTask(data.name, getToolLabel(t, data.name));
                taskIdsRef.current[data.name] = taskId;
                break;
            }

            case 'tool_done': {
                setToolsUsed((prev) =>
                    prev.map((item) =>
                        item.name === data.name ? { ...item, status: data.success ? 'done' : 'error' } : item,
                    ),
                );
                setStatusMessage(
                    data.success
                        ? `✓ ${getToolLabel(t, data.name)} – ${t('taskQueue.done_suffix')}`
                        : `✗ ${getToolLabel(t, data.name)} – ${t('taskQueue.error_suffix')}`,
                );
                // Update global task queue
                const taskId = taskIdsRef.current[data.name];
                if (taskId) {
                    completeTask(taskId, data.success, data.error);
                    delete taskIdsRef.current[data.name];
                }
                break;
            }

            case 'data_changed':
                // Dispatch custom event for other components to refresh
                window.dispatchEvent(new CustomEvent('ai-data-changed', { detail: { tool: data.tool } }));
                break;

            case 'response':
                setMessages((prev) => [...prev, { role: 'model', text: data.text || t('aitutor.errors.no_answer') }]);
                if (data.dataChanged) {
                    window.dispatchEvent(new CustomEvent('ai-data-changed', { detail: { finished: true } }));
                }
                break;

            case 'error':
                setMessages((prev) => [...prev, { role: 'model', text: `⚠️ ${data.message}` }]);
                break;

            case 'done':
                // Stream finished
                break;
        }
    }, []);

    const sendMessage = useCallback(async () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        const userMsg: ChatMessage = { role: 'user', text: trimmed };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInput('');

        // Reset height content
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }

        startLoading();
        await streamChat(newHistory);
    }, [input, loading, messages, startLoading, streamChat]);

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
            {/* ─── FAB (shown when panel is closed) ──────── */}
            {!open && (
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
                    <span className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping pointer-events-none" />
                </button>
            )}

            {/* ─── Inline Panel ──────────────────────────── */}
            <div
                className={cn(
                    'h-full border-l border-border bg-card flex flex-col overflow-hidden transition-all duration-300 ease-in-out shrink-0',
                    open ? 'w-[384px]' : 'w-0',
                )}
            >
                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b bg-gradient-to-r from-violet-600/5 to-indigo-600/5 space-y-3 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shrink-0">
                                <Sparkles className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-sm font-semibold">{t('aitutor.title')}</h2>
                                <p className="text-xs text-muted-foreground truncate">{t('aitutor.description')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {messages.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearChat}
                                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setOpen(false)}
                                className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                            >
                                <PanelRightClose className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Select
                            value={selectedProvider}
                            onValueChange={setSelectedProvider}
                            disabled={providers.length === 0}
                        >
                            <SelectTrigger className="w-full h-8 text-xs bg-background/50 border-input/50">
                                <SelectValue placeholder={t('aitutor.loading_models')} />
                            </SelectTrigger>
                            <SelectContent>
                                {providersLoading ? (
                                    <div className="flex items-center justify-center p-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-3 w-3 animate-spin mr-2" /> {t('aitutor.loading_models')}
                                    </div>
                                ) : providers.length > 0 ? (
                                    providers.map((p) => (
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
                </div>

                {/* Messages area */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {messages.length === 0 && !loading && (
                        <EmptyState
                            onSuggestionClick={(text) => {
                                const userMsg: ChatMessage = { role: 'user', text };
                                const newHistory = [...messages, userMsg];
                                setMessages(newHistory);
                                setInput('');
                                startLoading();
                                streamChat(newHistory);
                            }}
                        />
                    )}

                    {messages.map((msg, i) => (
                        <MessageBubble key={i} message={msg} />
                    ))}

                    {loading && (
                        <TypingIndicator seconds={loadingSeconds} statusMessage={statusMessage} toolsUsed={toolsUsed} />
                    )}
                </div>

                {/* Input area */}
                <div className="border-t bg-muted/30 p-4 shrink-0">
                    <div className="flex gap-2 items-end">
                        <Textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                providers.length > 0 ? t('aitutor.placeholder') : t('aitutor.disabled_placeholder')
                            }
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
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 text-center">{t('aitutor.footer_note')}</p>
                </div>
            </div>
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
                    isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm',
                )}
            >
                {isUser ? (
                    <p className="whitespace-pre-wrap">{message.text}</p>
                ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2 prose-headings:my-2 prose-code:text-xs prose-pre:text-xs prose-pre:bg-background/50 prose-pre:rounded-lg">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════════════

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
    const { t } = useTranslation();

    const suggestions = [
        { emoji: '🏫', text: 'Zobraz mi detaily vybrané školy' },
        { emoji: '📚', text: 'Naplň školu strukturou pro ZŠ (1.–9. třída)' },
        { emoji: '👩‍🏫', text: 'Vytvoř ukázkový učitelský sbor' },
        { emoji: '📋', text: 'Kolik uživatelů je v systému?' },
        { emoji: '🎓', text: 'Naplň školu jako osmileté gymnázium' },
        { emoji: '👥', text: 'Vypiš seznam učitelů ve škole' },
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-600/10 to-indigo-600/10 mb-4">
                <Sparkles className="h-8 w-8 text-violet-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('aitutor.empty_state.title')}</h3>
            <p className="text-sm text-muted-foreground max-w-[260px] mb-4">{t('aitutor.empty_state.description')}</p>
            <p className="text-xs text-muted-foreground/70 mb-3">Vyzkoušejte:</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-[320px]">
                {suggestions.map((s, i) => (
                    <SuggestionPill key={i} emoji={s.emoji} text={s.text} onClick={() => onSuggestionClick(s.text)} />
                ))}
            </div>
        </div>
    );
}

function SuggestionPill({ emoji, text, onClick }: { emoji: string; text: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground text-xs transition-colors cursor-pointer hover:text-foreground hover:shadow-sm"
        >
            <span>{emoji}</span>
            <span>{text}</span>
        </button>
    );
}

// ═══════════════════════════════════════════════════════════════
// Typing Indicator with Tool Monitoring
// ═══════════════════════════════════════════════════════════════

function TypingIndicator({
    seconds,
    statusMessage,
    toolsUsed,
}: {
    seconds: number;
    statusMessage: string;
    toolsUsed: ToolProgress[];
}) {
    const { t } = useTranslation();
    return (
        <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
                <Bot className="h-4 w-4" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 min-w-[180px]">
                {/* Bouncing dots + timer */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-violet-500/60 animate-bounce [animation-delay:0ms]" />
                        <span className="w-2 h-2 rounded-full bg-violet-500/60 animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 rounded-full bg-violet-500/60 animate-bounce [animation-delay:300ms]" />
                    </div>
                    {seconds >= 2 && <span className="text-xs text-muted-foreground ml-1">{seconds}s</span>}
                </div>

                {/* Status message */}
                <p className="text-xs text-muted-foreground mt-1.5 animate-pulse">{statusMessage || 'Přemýšlím...'}</p>

                {/* Tool call log */}
                {toolsUsed.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
                        {toolsUsed.map((tool, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px]">
                                {tool.status === 'running' && (
                                    <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
                                )}
                                {tool.status === 'done' && <span className="text-green-500 font-bold">✓</span>}
                                {tool.status === 'error' && <span className="text-red-500 font-bold">✗</span>}
                                <span
                                    className={cn(
                                        'text-muted-foreground',
                                        tool.status === 'done' && 'line-through opacity-60',
                                        tool.status === 'error' && 'text-red-400',
                                    )}
                                >
                                    {getToolLabel(t, tool.name)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
