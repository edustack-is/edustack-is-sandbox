import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Key, Save, Check, Loader2, AlertCircle, Zap, TrendingUp, BarChart3, Shield,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getAiSettings, updateAiSettings, getAiUsage } from '@/api/system-ai';

// ─── Color palette for chart bars ───────────────────────────────

const CHART_COLORS = [
    'hsl(221, 83%, 53%)', // blue
    'hsl(262, 83%, 58%)', // purple
    'hsl(173, 58%, 39%)', // teal
    'hsl(43, 96%, 56%)',  // amber
    'hsl(346, 77%, 50%)', // rose
    'hsl(142, 71%, 45%)', // green
    'hsl(24, 95%, 53%)',  // orange
];

// ─── Types ──────────────────────────────────────────────────────

interface AiSettings {
    isConfigured: boolean;
    keyHint: string | null;
    updatedAt: string | null;
}

interface UsageData {
    month: string;
    totals: {
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        requestCount: number;
    };
    perSchool: Array<{
        schoolId: string | null;
        schoolName: string;
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        requestCount: number;
    }>;
    daily: Array<{
        date: string;
        totalTokens: number;
        requestCount: number;
    }>;
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export function SystemAdminAi() {
    const [settings, setSettings] = useState<AiSettings | null>(null);
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [s, u] = await Promise.all([
                getAiSettings().catch(() => null),
                getAiUsage().catch(() => null),
            ]);
            setSettings(s);
            setUsage(u);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Zap className="h-6 w-6 text-amber-500" />
                    AI Management
                </h1>
                <p className="text-muted-foreground mt-1">
                    Konfigurace API klíče a monitoring spotřeby tokenů
                </p>
            </div>

            {/* KPI Cards Row */}
            <div className="grid gap-4 md:grid-cols-4">
                <KpiCard
                    title="Tokeny celkem"
                    value={formatNumber(usage?.totals.totalTokens ?? 0)}
                    subtitle="tento měsíc"
                    icon={<Zap className="h-5 w-5" />}
                    color="text-amber-500"
                    bg="bg-amber-500/10"
                />
                <KpiCard
                    title="Input tokeny"
                    value={formatNumber(usage?.totals.inputTokens ?? 0)}
                    subtitle="prompty"
                    icon={<TrendingUp className="h-5 w-5" />}
                    color="text-blue-500"
                    bg="bg-blue-500/10"
                />
                <KpiCard
                    title="Output tokeny"
                    value={formatNumber(usage?.totals.outputTokens ?? 0)}
                    subtitle="odpovědi"
                    icon={<BarChart3 className="h-5 w-5" />}
                    color="text-purple-500"
                    bg="bg-purple-500/10"
                />
                <KpiCard
                    title="Počet požadavků"
                    value={formatNumber(usage?.totals.requestCount ?? 0)}
                    subtitle="API calls"
                    icon={<Shield className="h-5 w-5" />}
                    color="text-emerald-500"
                    bg="bg-emerald-500/10"
                />
            </div>

            {/* Settings + Chart */}
            <div className="grid gap-6 lg:grid-cols-3">
                <ApiKeySettings settings={settings} onSaved={fetchData} />
                <div className="lg:col-span-2">
                    <SchoolUsageChart perSchool={usage?.perSchool ?? []} />
                </div>
            </div>

            {/* Daily Chart */}
            <DailyChart daily={usage?.daily ?? []} month={usage?.month ?? ''} />

            {/* Per-school table */}
            <SchoolUsageTable perSchool={usage?.perSchool ?? []} />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// KPI Card
// ═══════════════════════════════════════════════════════════════

function KpiCard({ title, value, subtitle, icon, color, bg }: {
    title: string; value: string; subtitle: string;
    icon: React.ReactNode; color: string; bg: string;
}) {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <p className="text-2xl font-bold mt-1">{value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${bg} ${color}`}>
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════════
// API Key Settings Card
// ═══════════════════════════════════════════════════════════════

function ApiKeySettings({ settings, onSaved }: { settings: AiSettings | null; onSaved: () => void }) {
    const [apiKey, setApiKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!apiKey.trim() || apiKey.length < 10) {
            setError('API klíč musí mít alespoň 10 znaků.');
            return;
        }
        try {
            setSaving(true);
            setError('');
            await updateAiSettings(apiKey.trim());
            setApiKey('');
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            onSaved();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Chyba při ukládání.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    Gemini API klíč
                </CardTitle>
                <CardDescription>
                    Klíč je šifrován AES-256 v databázi
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Current status */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className={`w-2.5 h-2.5 rounded-full ${settings?.isConfigured ? 'bg-emerald-500' : 'bg-destructive'}`} />
                    <div className="flex-1">
                        <p className="text-sm font-medium">
                            {settings?.isConfigured ? 'Nakonfigurováno' : 'Nenakonfigurováno'}
                        </p>
                        {settings?.keyHint && (
                            <p className="text-xs text-muted-foreground font-mono">{settings.keyHint}</p>
                        )}
                    </div>
                    <Badge variant={settings?.isConfigured ? 'default' : 'destructive'} className="text-xs">
                        {settings?.isConfigured ? 'Active' : 'Inactive'}
                    </Badge>
                </div>

                {settings?.updatedAt && (
                    <p className="text-xs text-muted-foreground">
                        Poslední aktualizace: {new Date(settings.updatedAt).toLocaleString('cs')}
                    </p>
                )}

                {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
                    </div>
                )}

                {/* Input form */}
                <div className="space-y-3">
                    <Input
                        type="password"
                        placeholder="Vložte nový Gemini API klíč..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="font-mono text-sm"
                    />
                    <Button onClick={handleSave} disabled={saving || !apiKey.trim()} className="w-full">
                        {saving ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Ukládám...</>
                        ) : saved ? (
                            <><Check className="h-4 w-4 mr-2" /> Uloženo!</>
                        ) : (
                            <><Save className="h-4 w-4 mr-2" /> Uložit klíč</>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════════
// School Usage Bar Chart
// ═══════════════════════════════════════════════════════════════

function SchoolUsageChart({ perSchool }: {
    perSchool: Array<{ schoolName: string; totalTokens: number; requestCount: number }>;
}) {
    const data = perSchool
        .sort((a, b) => b.totalTokens - a.totalTokens)
        .map((s) => ({
            name: s.schoolName.length > 20 ? s.schoolName.slice(0, 18) + '…' : s.schoolName,
            tokens: s.totalTokens,
            requests: s.requestCount,
        }));

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-lg">Spotřeba per škola</CardTitle>
                <CardDescription>Celkové tokeny za aktuální měsíc</CardDescription>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm">Zatím žádná data o spotřebě.</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis type="number" tickFormatter={(v) => formatNumber(v)} fontSize={12} />
                            <YAxis type="category" dataKey="name" width={130} fontSize={12} />
                            <Tooltip
                                formatter={(value: any) => [formatNumber(value ?? 0) + ' tokenů', 'Tokeny']}
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                }}
                            />
                            <Bar dataKey="tokens" radius={[0, 6, 6, 0]}>
                                {data.map((_, i) => (
                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════════
// Daily Usage Chart
// ═══════════════════════════════════════════════════════════════

function DailyChart({ daily, month }: {
    daily: Array<{ date: string; totalTokens: number; requestCount: number }>;
    month: string;
}) {
    const data = daily.map((d) => ({
        date: new Date(d.date).toLocaleDateString('cs', { day: 'numeric', month: 'short' }),
        tokens: d.totalTokens,
        requests: d.requestCount,
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Denní spotřeba</CardTitle>
                <CardDescription>Měsíc: {month || '—'}</CardDescription>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <TrendingUp className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm">Zatím žádná denní data.</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis dataKey="date" fontSize={11} />
                            <YAxis tickFormatter={(v) => formatNumber(v)} fontSize={11} />
                            <Tooltip
                                formatter={(value: any, name: any) => [
                                    formatNumber(value ?? 0),
                                    name === 'tokens' ? 'Tokeny' : 'Požadavky',
                                ]}
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                }}
                            />
                            <Bar dataKey="tokens" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════════
// School Usage Table
// ═══════════════════════════════════════════════════════════════

function SchoolUsageTable({ perSchool }: {
    perSchool: Array<{
        schoolName: string; totalTokens: number;
        inputTokens: number; outputTokens: number; requestCount: number;
    }>;
}) {
    if (perSchool.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Detail per škola</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Škola</TableHead>
                            <TableHead className="text-right">Input</TableHead>
                            <TableHead className="text-right">Output</TableHead>
                            <TableHead className="text-right">Celkem</TableHead>
                            <TableHead className="text-right">Požadavky</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {perSchool
                            .sort((a, b) => b.totalTokens - a.totalTokens)
                            .map((s, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{s.schoolName}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">{formatNumber(s.inputTokens)}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">{formatNumber(s.outputTokens)}</TableCell>
                                    <TableCell className="text-right font-mono text-sm font-bold">{formatNumber(s.totalTokens)}</TableCell>
                                    <TableCell className="text-right">{s.requestCount}</TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

// ─── Helpers ────────────────────────────────────────────────────

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return n.toString();
}
