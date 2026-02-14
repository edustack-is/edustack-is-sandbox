import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Key, Save, Check, Loader2, AlertCircle, Zap, TrendingUp, BarChart3, Shield, Settings,
    Globe, Github, Apple, Mail
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getAiSettings, updateAiSettings, getAiUsage } from '@/api/system-ai';
import { getSsoSettings, updateSsoProvider } from '@/api/system-sso';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────

interface ProviderConfig {
    isConfigured: boolean;
    keyHint: string | null;
}

interface AiSettings {
    gemini: ProviderConfig;
    openai: ProviderConfig;
    anthropic: ProviderConfig;
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
    perProvider: Array<{
        provider: string;
        totalTokens: number;
        requestCount: number;
    }>;
    daily: Array<{
        date: string;
        totalTokens: number;
        requestCount: number;
    }>;
}

interface SsoProviderSettings {
    clientId: string;
    isActive: boolean;
    isConfigured: boolean;
    teamId?: string;
    keyId?: string;
}

interface SsoSettings {
    google: SsoProviderSettings;
    github: SsoProviderSettings;
    microsoft: SsoProviderSettings;
    apple: SsoProviderSettings;
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export function SystemAdminSettings() {
    const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [ssoSettings, setSsoSettings] = useState<SsoSettings | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [ai, u, sso] = await Promise.all([
                getAiSettings().catch(() => null),
                getAiUsage().catch(() => null),
                getSsoSettings().catch(() => null),
            ]);
            setAiSettings(ai);
            setUsage(u);
            setSsoSettings(sso);
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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Settings className="h-6 w-6 text-primary" />
                        System Settings
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Global configuration for AI, SSO, and system-wide features.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="ai" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="ai" className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        AI Management
                    </TabsTrigger>
                    <TabsTrigger value="sso" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        SSO Integrations
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="ai" className="space-y-8 animate-in fade-in-50 duration-300">
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
                        <ApiKeySettings settings={aiSettings} onSaved={fetchData} />
                        <div className="lg:col-span-2">
                            <SchoolUsageChart
                                perSchool={usage?.perSchool ?? []}
                                perProvider={usage?.perProvider ?? []}
                            />
                        </div>
                    </div>

                    {/* Daily Chart */}
                    <DailyChart daily={usage?.daily ?? []} month={usage?.month ?? ''} />

                    {/* Per-school table */}
                    <SchoolUsageTable perSchool={usage?.perSchool ?? []} />
                </TabsContent>

                <TabsContent value="sso" className="space-y-6 animate-in fade-in-50 duration-300">
                    <SsoIntegrations settings={ssoSettings} onSaved={fetchData} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// SSO Integrations Component
// ═══════════════════════════════════════════════════════════════

function SsoIntegrations({ settings, onSaved }: { settings: SsoSettings | null; onSaved: () => void }) {
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

    const providers = [
        { id: 'google', name: 'Google', icon: Globe, color: 'bg-blue-500' },
        { id: 'github', name: 'GitHub', icon: Github, color: 'bg-slate-900' },
        { id: 'microsoft', name: 'Microsoft', icon: Mail, color: 'bg-blue-600' },
        { id: 'apple', name: 'Apple', icon: Apple, color: 'bg-black' },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {providers.map((p) => {
                    const config = settings?.[p.id as keyof SsoSettings];
                    return (
                        <Card key={p.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelectedProvider(p.id)}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium">{p.name}</CardTitle>
                                <div className={`p-2 rounded-lg ${p.color} text-white`}>
                                    <p.icon className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between mt-2">
                                    <Badge variant={config?.isActive ? "default" : "secondary"} className={config?.isActive ? "bg-emerald-500" : ""}>
                                        {config?.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                    {!config?.isConfigured && <span className="text-[10px] text-muted-foreground italic">Not configured</span>}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">SSO Configuration Guide</CardTitle>
                    <CardDescription>
                        Konfigurované strategie jsou okamžitě dostupné na přihlašovací stránce po aktivaci.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-relaxed">
                    Ujistěte se, že Callback URL ve vaší aplikaci u providera je nastavena na:
                    <code className="block mt-2 p-2 bg-muted rounded font-mono text-xs">
                        https://your-domain.com/api/auth/callback/[provider]
                    </code>
                </CardContent>
            </Card>

            {selectedProvider && (
                <SsoConfigDialog
                    provider={selectedProvider}
                    config={settings?.[selectedProvider as keyof SsoSettings]}
                    onClose={() => setSelectedProvider(null)}
                    onSaved={onSaved}
                />
            )}
        </div>
    );
}

function SsoConfigDialog({ provider, config, onClose, onSaved }: {
    provider: string;
    config: SsoProviderSettings | undefined;
    onClose: () => void;
    onSaved: () => void
}) {
    const [formData, setFormData] = useState({
        clientId: config?.clientId || '',
        clientSecret: '',
        isActive: config?.isActive ?? false,
        teamId: config?.teamId || '',
        keyId: config?.keyId || '',
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        try {
            setSaving(true);
            await updateSsoProvider(provider, formData);
            toast.success(`${provider} configuration updated successfully.`);
            onSaved();
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save configuration.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="capitalize">{provider} Integration</DialogTitle>
                    <DialogDescription>
                        Configure OAuth credentials for {provider}. Sensitive client secrets are encrypted.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="clientId">Client ID / App ID</Label>
                        <Input
                            id="clientId"
                            value={formData.clientId}
                            onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="clientSecret">
                            {provider === 'apple' ? 'Private Key (.p8 content)' : 'Client Secret'}
                        </Label>
                        {provider === 'apple' ? (
                            <Textarea
                                id="clientSecret"
                                placeholder="-----BEGIN PRIVATE KEY-----..."
                                value={formData.clientSecret}
                                onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                                className="font-mono text-xs h-32"
                            />
                        ) : (
                            <Input
                                id="clientSecret"
                                type="password"
                                placeholder={config?.isConfigured ? "Leave empty to keep current secret" : "Enter new client secret"}
                                value={formData.clientSecret}
                                onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                            />
                        )}
                    </div>

                    {provider === 'apple' && (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="teamId">Team ID</Label>
                                <Input
                                    id="teamId"
                                    value={formData.teamId}
                                    onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="keyId">Key ID</Label>
                                <Input
                                    id="keyId"
                                    value={formData.keyId}
                                    onChange={(e) => setFormData({ ...formData, keyId: e.target.value })}
                                />
                            </div>
                        </>
                    )}

                    <div className="flex items-center justify-between space-x-2 pt-4">
                        <Label htmlFor="isActive" className="flex flex-col space-y-1">
                            <span>Enable Integration</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Providery can be disabled without losing credentials.
                            </span>
                        </Label>
                        <Switch
                            id="isActive"
                            checked={formData.isActive}
                            onCheckedChange={(checked: boolean) => setFormData({ ...formData, isActive: checked })}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ═══════════════════════════════════════════════════════════════
// AI Charts & Tables (kept from old implementation)
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

function ApiKeySettings({ settings, onSaved }: { settings: AiSettings | null; onSaved: () => void }) {
    const [keys, setKeys] = useState({ gemini: '', openai: '', anthropic: '' });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!keys.gemini && !keys.openai && !keys.anthropic) {
            setError('Vyplňte alespoň jeden klíč.');
            return;
        }
        try {
            setSaving(true);
            setError('');
            await updateAiSettings({
                geminiApiKey: keys.gemini || undefined,
                openAiApiKey: keys.openai || undefined,
                anthropicApiKey: keys.anthropic || undefined,
            });
            setKeys({ gemini: '', openai: '', anthropic: '' });
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
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    Konfigurace AI Providerů
                </CardTitle>
                <CardDescription>
                    Klíče jsou šifrovány (AES-256).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {settings?.updatedAt && (
                    <p className="text-xs text-muted-foreground -mt-4 mb-4">
                        Poslední aktualizace: {new Date(settings.updatedAt).toLocaleString('cs')}
                    </p>
                )}

                {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
                    </div>
                )}

                <div className="space-y-4">
                    <ProviderInput
                        label="Google Gemini"
                        placeholder="Vložte Gemini API Key..."
                        config={settings?.gemini}
                        value={keys.gemini}
                        onChange={(v: string) => setKeys(p => ({ ...p, gemini: v }))}
                        link="https://aistudio.google.com/app/apikey"
                    />
                    <ProviderInput
                        label="OpenAI"
                        placeholder="sk-..."
                        config={settings?.openai}
                        value={keys.openai}
                        onChange={(v: string) => setKeys(p => ({ ...p, openai: v }))}
                        link="https://platform.openai.com/api-keys"
                    />
                    <ProviderInput
                        label="Anthropic Claude"
                        placeholder="sk-ant-..."
                        config={settings?.anthropic}
                        value={keys.anthropic}
                        onChange={(v: string) => setKeys(p => ({ ...p, anthropic: v }))}
                        link="https://console.anthropic.com/settings/keys"
                    />
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Ukládám...</>
                    ) : saved ? (
                        <><Check className="h-4 w-4 mr-2" /> Uloženo!</>
                    ) : (
                        <><Save className="h-4 w-4 mr-2" /> Uložit klíče</>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}

function ProviderInput({ label, placeholder, config, value, onChange, link }: any) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium flex items-center gap-2">
                    {label}
                    {config?.isConfigured && <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200">Active</Badge>}
                </label>
                <a href={link} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">Získat klíč ↗</a>
            </div>
            <div className="relative">
                <Input
                    type="password"
                    placeholder={config?.isConfigured ? `Nakonfigurováno (${config.keyHint})` : placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="font-mono text-sm pr-20"
                />
            </div>
        </div>
    );
}

function SchoolUsageChart({ perSchool, perProvider }: {
    perSchool: any[];
    perProvider: any[];
}) {
    const schoolData = perSchool
        .sort((a, b) => b.totalTokens - a.totalTokens)
        .slice(0, 10) // Top 10 schools
        .map((s) => ({
            name: s.schoolName.length > 15 ? s.schoolName.slice(0, 13) + '…' : s.schoolName,
            tokens: s.totalTokens,
        }));

    const providerData = perProvider.map((p: any) => ({
        name: p.provider,
        value: p.totalTokens,
    }));

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    return (
        <div className="grid gap-4 md:grid-cols-2 h-full">
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-base">Top Školy</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={schoolData} layout="vertical" margin={{ left: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={100} fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="tokens" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-base">Podle Providera</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                    {providerData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={providerData} margin={{ top: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickFormatter={formatNumber} tickLine={false} axisLine={false} />
                                <Tooltip
                                    formatter={(val: any) => formatNumber(val)}
                                    cursor={{ fill: 'transparent' }}
                                />
                                <Bar dataKey="value" fill="#82ca9d" radius={[4, 4, 0, 0]} barSize={30}>
                                    {providerData.map((_entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                            Žádná data
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

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
