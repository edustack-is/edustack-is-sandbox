import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Terminal, Copy, Search, Loader2 } from 'lucide-react';
import { getSystemPrompts } from '@/api';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface SystemPrompt {
    id: string;
    name: string;
    description: string;
    prompt: string;
    service: string;
}

export default function SystemAdminPrompts() {
    const { t } = useTranslation();
    const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        getSystemPrompts()
            .then(setPrompts)
            .catch(() => toast.error(t('common.error')))
            .finally(() => setLoading(false));
    }, [t]);

    const filteredPrompts = prompts.filter((p) => {
        const q = searchQuery.toLowerCase();
        return (
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.prompt.toLowerCase().includes(q) ||
            p.service.toLowerCase().includes(q)
        );
    });

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success(t('common.copied', 'Copied to clipboard'));
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Terminal className="h-6 w-6 text-primary" />
                    {t('system_prompts.title', 'Systémové prompty')}
                </h1>
                <p className="text-muted-foreground">
                    {t('system_prompts.subtitle', 'Přehled všech AI instrukcí používaných v aplikaci.')}
                </p>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={t('common.search')}
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : filteredPrompts.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground italic">
                        {t('common.no_results')}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {filteredPrompts.map((p) => (
                        <Card key={p.id} className="overflow-hidden">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg">{p.name}</CardTitle>
                                            <Badge variant="secondary" className="font-mono text-[10px]">
                                                {p.id}
                                            </Badge>
                                        </div>
                                        <CardDescription>{p.description}</CardDescription>
                                    </div>
                                    <Badge variant="outline" className="shrink-0">
                                        {p.service}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="relative group">
                                    <div className="bg-slate-950 text-slate-200 p-4 rounded-lg font-mono text-xs whitespace-pre-wrap leading-relaxed border border-slate-800">
                                        {p.prompt}
                                    </div>
                                    <button
                                        onClick={() => handleCopy(p.prompt)}
                                        className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors opacity-0 group-hover:opacity-100"
                                        title={t('common.copy')}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
