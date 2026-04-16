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
    Globe, Github, Apple, Mail, Database, Activity, HardDrive, Download, Trash2, RotateCcw,
    Plus, ExternalLink, Clock, Server, MemoryStick, Upload
} from 'lucide-react';
import { TestDataGenerator } from './TestDataGenerator';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getAiSettings, updateAiSettings, getAiUsage } from '@/api/system-ai';
import { getSsoSettings, updateSsoProvider } from '@/api/system-sso';
import {
    getSystemSettings, updateSystemSettings,
    getHealth, getSystemAuditLog,
    createBackup, listBackups, downloadBackup, restoreBackup, deleteBackup, uploadBackup,
    type HealthStatus,
} from '@/api/system-admin';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();
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
                        {t('system_settings.title')}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {t('system_settings.description')}
                    </p>
                </div>
            </div>

            <Tabs defaultValue="ai" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 lg:w-[900px]">
                    <TabsTrigger value="ai" className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        {t('system_settings.ai_management')}
                    </TabsTrigger>
                    <TabsTrigger value="sso" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        {t('system_settings.sso_integrations')}
                    </TabsTrigger>
                    <TabsTrigger value="system" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        {t('system_settings.system_tab', 'Systém')}
                    </TabsTrigger>
                    <TabsTrigger value="monitoring" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        {t('system_settings.monitoring_tab', 'Monitoring')}
                    </TabsTrigger>
                    <TabsTrigger value="backups" className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4" />
                        {t('system_settings.backups_tab', 'Zálohy')}
                    </TabsTrigger>
                    <TabsTrigger value="testdata" className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Testovací data
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="ai" className="space-y-8 animate-in fade-in-50 duration-300">
                    {/* KPI Cards Row */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <KpiCard
                            title={t('system_settings.total_tokens')}
                            value={formatNumber(usage?.totals.totalTokens ?? 0)}
                            subtitle={t('system_settings.this_month')}
                            icon={<Zap className="h-5 w-5" />}
                            color="text-amber-500"
                            bg="bg-amber-500/10"
                        />
                        <KpiCard
                            title={t('system_settings.input_tokens')}
                            value={formatNumber(usage?.totals.inputTokens ?? 0)}
                            subtitle={t('system_settings.prompts')}
                            icon={<TrendingUp className="h-5 w-5" />}
                            color="text-blue-500"
                            bg="bg-blue-500/10"
                        />
                        <KpiCard
                            title={t('system_settings.output_tokens')}
                            value={formatNumber(usage?.totals.outputTokens ?? 0)}
                            subtitle={t('system_settings.responses')}
                            icon={<BarChart3 className="h-5 w-5" />}
                            color="text-purple-500"
                            bg="bg-purple-500/10"
                        />
                        <KpiCard
                            title={t('system_settings.request_count')}
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

                <TabsContent value="system" className="space-y-6 animate-in fade-in-50 duration-300">
                    <SystemConfigTab />
                </TabsContent>

                <TabsContent value="monitoring" className="space-y-6 animate-in fade-in-50 duration-300">
                    <MonitoringTab />
                </TabsContent>

                <TabsContent value="backups" className="space-y-6 animate-in fade-in-50 duration-300">
                    <BackupsTab />
                </TabsContent>

                <TabsContent value="testdata" className="space-y-6 animate-in fade-in-50 duration-300">
                    <TestDataGenerator />
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
    const { t } = useTranslation();

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
                                        {config?.isActive ? t('system_settings.active') : t('system_settings.inactive')}
                                    </Badge>
                                    {!config?.isConfigured && <span className="text-[10px] text-muted-foreground italic">{t('system_settings.not_configured')}</span>}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{t('system_settings.sso_config_guide')}</CardTitle>
                    <CardDescription>
                        {t('system_settings.sso_config_guide_description')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-relaxed">
                    {t('system_settings.sso_callback_url_hint')}
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
    const { t } = useTranslation();
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
            toast.success(t('system_settings.provider_config_saved', { provider }));
            onSaved();
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.message || t('system_settings.save_config_failed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="capitalize">{provider} {t('system_settings.integration')}</DialogTitle>
                    <DialogDescription>
                        {t('system_settings.configure_oauth', { provider })}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="clientId">{t('system_settings.client_id')}</Label>
                        <Input
                            id="clientId"
                            value={formData.clientId}
                            onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="clientSecret">
                            {provider === 'apple' ? t('system_settings.private_key') : t('system_settings.client_secret')}
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
                                placeholder={config?.isConfigured ? t('system_settings.keep_current_secret') : t('system_settings.enter_new_secret')}
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
                            <span>{t('system_settings.enable_integration')}</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                {t('system_settings.disable_without_losing')}
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
                    <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('common.save_changes')}
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
    const { t } = useTranslation();
    const data = daily.map((d) => ({
        date: new Date(d.date).toLocaleDateString('cs', { day: 'numeric', month: 'short' }),
        tokens: d.totalTokens,
        requests: d.requestCount,
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t('system_settings.daily_usage')}</CardTitle>
                <CardDescription>{t('system_settings.month')}: {month || '—'}</CardDescription>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <TrendingUp className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm">{t('system_settings.no_daily_data')}</p>
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
                                    name === 'tokens' ? t('system_settings.tokens') : t('system_settings.requests'),
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
    const { t } = useTranslation();
    const [keys, setKeys] = useState({ gemini: '', openai: '', anthropic: '' });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!keys.gemini && !keys.openai && !keys.anthropic) {
            setError(t('system_settings.fill_at_least_one'));
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
            setError(err.response?.data?.message || t('system_settings.save_error'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    {t('system_settings.ai_provider_config')}
                </CardTitle>
                <CardDescription>
                    {t('system_settings.keys_encrypted')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {settings?.updatedAt && (
                    <p className="text-xs text-muted-foreground -mt-4 mb-4">
                        {t('system_settings.last_updated')}: {new Date(settings.updatedAt).toLocaleString()}
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
                        placeholder={t('system_settings.gemini_placeholder')}
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
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('system_settings.saving')}</>
                    ) : saved ? (
                        <><Check className="h-4 w-4 mr-2" /> {t('system_settings.saved')}</>
                    ) : (
                        <><Save className="h-4 w-4 mr-2" /> {t('system_settings.save_keys')}</>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}

function ProviderInput({ label, placeholder, config, value, onChange, link }: any) {
    const { t } = useTranslation();
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium flex items-center gap-2">
                    {label}
                    {config?.isConfigured && <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200">{t('system_settings.active')}</Badge>}
                </label>
                <a href={link} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">{t('system_settings.get_key')} ↗</a>
            </div>
            <div className="relative">
                <Input
                    type="password"
                    placeholder={config?.isConfigured ? `${t('system_settings.configured')} (${config.keyHint})` : placeholder}
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
    const { t } = useTranslation();
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
                    <CardTitle className="text-base">{t('system_settings.top_schools')}</CardTitle>
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
                    <CardTitle className="text-base">{t('system_settings.by_provider')}</CardTitle>
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
                            {t('system_settings.no_data')}
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
    const { t } = useTranslation();
    if (perSchool.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t('system_settings.detail_per_school')}</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('system_settings.school_column')}</TableHead>
                            <TableHead className="text-right">{t('system_settings.input_label')}</TableHead>
                            <TableHead className="text-right">{t('system_settings.output_label')}</TableHead>
                            <TableHead className="text-right">{t('system_settings.total_label')}</TableHead>
                            <TableHead className="text-right">{t('system_settings.requests')}</TableHead>
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

// ═══════════════════════════════════════════════════════════════
// System Config Tab
// ═══════════════════════════════════════════════════════════════

const SETTING_FIELDS = [
    { key: 'security.maxLoginAttempts', label: 'Max neúspěšných pokusů', type: 'number', section: 'Bezpečnost' },
    { key: 'security.lockoutMinutes', label: 'Doba zamčení účtu (min)', type: 'number', section: 'Bezpečnost' },
    { key: 'security.passwordResetExpiry', label: 'Platnost reset tokenu (min)', type: 'number', section: 'Bezpečnost' },
    { key: 'general.systemName', label: 'Název systému', type: 'text', section: 'Obecné' },
] as const;

function SystemConfigTab() {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getSystemSettings()
            .then(setSettings)
            .catch(() => toast.error(t('system_settings.load_error', 'Nepodařilo se načíst nastavení')))
            .finally(() => setLoading(false));
    }, [t]);

    const handleSave = async () => {
        try {
            setSaving(true);
            await updateSystemSettings(settings);
            toast.success(t('system_settings.settings_saved', 'Nastavení uloženo'));
        } catch {
            toast.error(t('system_settings.save_error', 'Chyba při ukládání'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

    const sections = [...new Set(SETTING_FIELDS.map(f => f.section))];

    return (
        <div className="space-y-6">
            {sections.map(section => (
                <Card key={section}>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            {section === 'Bezpečnost' ? <Shield className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
                            {section}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {SETTING_FIELDS.filter(f => f.section === section).map(field => (
                            <div key={field.key} className="grid grid-cols-3 items-center gap-4">
                                <Label className="text-sm">{field.label}</Label>
                                <Input
                                    type={field.type}
                                    value={settings[field.key] ?? ''}
                                    onChange={e => setSettings(s => ({ ...s, [field.key]: e.target.value }))}
                                    className="col-span-2"
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            ))}

            <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Ukládám...</> : <><Save className="h-4 w-4 mr-2" /> Uložit nastavení</>}
            </Button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// Monitoring Tab
// ═══════════════════════════════════════════════════════════════

function MonitoringTab() {
    const { t } = useTranslation();
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [auditLog, setAuditLog] = useState<any>(null);
    const [page, setPage] = useState(1);

    const fetchHealth = useCallback(() => {
        getHealth().then(setHealth).catch(() => setHealth(null));
    }, []);

    const fetchAuditLog = useCallback(() => {
        getSystemAuditLog({ page, limit: 25 }).then(setAuditLog).catch(() => { });
    }, [page]);

    useEffect(() => {
        fetchHealth();
        fetchAuditLog();
        const healthInterval = setInterval(fetchHealth, 30000);
        return () => clearInterval(healthInterval);
    }, [fetchHealth, fetchAuditLog]);

    return (
        <div className="space-y-6">
            {/* Health Status */}
            <div className="grid gap-4 md:grid-cols-4">
                <KpiCard
                    title={t('system_settings.health_status', 'Stav')}
                    value={health?.status === 'healthy' ? '✅ Healthy' : '⚠️ Degraded'}
                    subtitle={health ? `v${health.version}` : '—'}
                    icon={<Server className="h-5 w-5" />}
                    color={health?.status === 'healthy' ? 'text-emerald-500' : 'text-amber-500'}
                    bg={health?.status === 'healthy' ? 'bg-emerald-500/10' : 'bg-amber-500/10'}
                />
                <KpiCard
                    title={t('system_settings.uptime', 'Uptime')}
                    value={health ? formatUptime(health.uptime) : '—'}
                    subtitle={t('system_settings.since_last_restart', 'od posledního restartu')}
                    icon={<Clock className="h-5 w-5" />}
                    color="text-blue-500"
                    bg="bg-blue-500/10"
                />
                <KpiCard
                    title={t('system_settings.database', 'Databáze')}
                    value={health?.database === 'ok' ? '✅ OK' : '❌ Error'}
                    subtitle="PostgreSQL"
                    icon={<Database className="h-5 w-5" />}
                    color={health?.database === 'ok' ? 'text-emerald-500' : 'text-red-500'}
                    bg={health?.database === 'ok' ? 'bg-emerald-500/10' : 'bg-red-500/10'}
                />
                <KpiCard
                    title={t('system_settings.memory', 'Paměť')}
                    value={health ? `${health.memory.heapUsed} MB` : '—'}
                    subtitle={health ? `heap: ${health.memory.heapUsed}/${health.memory.heapTotal} MB` : ''}
                    icon={<MemoryStick className="h-5 w-5" />}
                    color="text-purple-500"
                    bg="bg-purple-500/10"
                />
            </div>

            {/* External links */}
            <div className="flex gap-3">
                <a href="http://localhost:5601" target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-2" />Kibana</Button>
                </a>
                <a href="http://localhost:3100" target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-2" />Grafana</Button>
                </a>
            </div>

            {/* Audit Log */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{t('system_settings.system_audit_log', 'Systémový log')}</CardTitle>
                    <CardDescription>{t('system_settings.system_events', 'Systémové události (bez školy)')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {auditLog?.data?.length > 0 ? (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('system_settings.audit_date', 'Datum')}</TableHead>
                                        <TableHead>{t('system_settings.audit_action', 'Akce')}</TableHead>
                                        <TableHead>{t('system_settings.audit_actor', 'Uživatel')}</TableHead>
                                        <TableHead>{t('system_settings.audit_entity', 'Entita')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {auditLog.data.map((log: any) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-xs">{new Date(log.createdAt).toLocaleString('cs')}</TableCell>
                                            <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                                            <TableCell className="text-sm">{log.actor?.firstName} {log.actor?.lastName}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{log.entity}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="flex justify-between items-center mt-4">
                                <span className="text-sm text-muted-foreground">
                                    {t('system_settings.page', 'Strana')} {page} / {Math.ceil((auditLog.total || 1) / 25)}
                                </span>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</Button>
                                    <Button variant="outline" size="sm" disabled={page * 25 >= (auditLog.total || 0)} onClick={() => setPage(p => p + 1)}>→</Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">{t('system_settings.no_audit_entries', 'Žádné systémové záznamy')}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

// ═══════════════════════════════════════════════════════════════
// Backups Tab
// ═══════════════════════════════════════════════════════════════

function BackupsTab() {
    const { t } = useTranslation();
    const [backups, setBackups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [restoring, setRestoring] = useState<string | null>(null);
    
    // New state for custom name dialog
    const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
    const [customName, setCustomName] = useState('');

    const fetch = useCallback(() => {
        listBackups()
            .then(setBackups)
            .catch(() => toast.error(t('system_settings.backup_load_error', 'Nepodařilo se načíst zálohy')))
            .finally(() => setLoading(false));
    }, [t]);

    useEffect(() => { fetch(); }, [fetch]);

    const handleCreate = async () => {
        try {
            setCreating(true);
            await createBackup(customName || undefined);
            toast.success(t('system_settings.backup_created', 'Záloha vytvořena'));
            setCustomName('');
            setIsNameDialogOpen(false);
            fetch();
        } catch {
            toast.error(t('system_settings.backup_create_error', 'Vytvoření zálohy selhalo'));
        } finally {
            setCreating(false);
        }
    };

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            await uploadBackup(file);
            toast.success(t('system_settings.backup_uploaded', 'Záloha byla úspěšně nahrána'));
            fetch();
        } catch (err: any) {
            toast.error(t('system_settings.backup_upload_error', 'Nahrání zálohy selhalo'));
        } finally {
            setUploading(false);
            event.target.value = ''; // Reset input
        }
    };

    const handleRestore = async (filename: string) => {
        if (!confirm(t('system_settings.restore_confirm', 'Opravdu chcete obnovit databázi z této zálohy? Všechna aktuální data budou přepsána!'))) return;
        try {
            setRestoring(filename);
            await restoreBackup(filename);
            toast.success(t('system_settings.restore_success', 'Databáze obnovena'));
        } catch {
            toast.error(t('system_settings.restore_error', 'Obnova selhala'));
        } finally {
            setRestoring(null);
        }
    };

    const handleDelete = async (filename: string) => {
        if (!confirm(t('system_settings.delete_backup_confirm', 'Smazat tuto zálohu?'))) return;
        try {
            await deleteBackup(filename);
            toast.success(t('system_settings.backup_deleted', 'Záloha smazána'));
            fetch();
        } catch {
            toast.error(t('system_settings.backup_delete_error', 'Smazání selhalo'));
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return bytes + ' B';
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">{t('system_settings.backups_title', 'Zálohy databáze')}</h3>
                    <p className="text-sm text-muted-foreground">{t('system_settings.backups_desc', 'Vytvářejte a spravujte zálohy Cloudflare D1 (SQLite) databáze')}</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Input
                            type="file"
                            className="hidden"
                            id="backup-upload"
                            accept=".sqlite"
                            onChange={handleUpload}
                            disabled={uploading}
                        />
                        <Button variant="outline" onClick={() => document.getElementById('backup-upload')?.click()} disabled={uploading}>
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            {t('system_settings.upload_backup', 'Nahrát zálohu')}
                        </Button>
                    </div>
                    
                    <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
                        <Button onClick={() => setIsNameDialogOpen(true)} disabled={creating}>
                            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            {t('system_settings.create_backup', 'Vytvořit zálohu')}
                        </Button>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{t('system_settings.create_backup_title', 'Vytvořit novou zálohu')}</DialogTitle>
                                <DialogDescription>
                                    {t('system_settings.create_backup_desc_dialog', 'Zadejte název zálohy nebo ponechte prázdné pro automatický název s datem.')}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Label htmlFor="custom-name">{t('system_settings.backup_name_label', 'Název zálohy')}</Label>
                                <Input 
                                    id="custom-name" 
                                    placeholder="moje-zaloha-pred-zmenou" 
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    className="mt-2"
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsNameDialogOpen(false)}>{t('common.cancel', 'Zrušit')}</Button>
                                <Button onClick={handleCreate} disabled={creating}>
                                    {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                    {t('system_settings.confirm_create', 'Vytvořit')}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card>
                <CardContent className="pt-6">
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : backups.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">{t('system_settings.no_backups', 'Žádné zálohy')}</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('system_settings.backup_filename', 'Soubor')}</TableHead>
                                    <TableHead>{t('system_settings.backup_storage', 'Úložiště')}</TableHead>
                                    <TableHead>{t('system_settings.backup_size', 'Velikost')}</TableHead>
                                    <TableHead>{t('system_settings.backup_date', 'Datum')}</TableHead>
                                    <TableHead className="text-right">{t('system_settings.backup_actions', 'Akce')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {backups.map((b: any) => (
                                    <TableRow key={b.filename}>
                                        <TableCell className="font-mono text-sm">{b.filename}</TableCell>
                                        <TableCell>
                                            <Badge variant={b.storage === 'R2' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                                                {b.storage}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{formatSize(b.size)}</TableCell>
                                        <TableCell className="text-sm">{new Date(b.createdAt).toLocaleString('cs')}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => downloadBackup(b.filename)}>
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleRestore(b.filename)} disabled={restoring === b.filename}>
                                                    {restoring === b.filename ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(b.filename)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
