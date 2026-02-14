import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Mail, Shield, Link as LinkIcon, Globe, Github, Apple } from 'lucide-react';
import { getMe, getUserIdentities, linkIdentity } from '@/api';
import { toast } from 'sonner';

interface Identity {
    provider: string;
    createdAt: string;
}

export function UserProfile() {
    const [user, setUser] = useState<any>(null);
    const [identities, setIdentities] = useState<Identity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [userData, userIdentities] = await Promise.all([
                    getMe(),
                    getUserIdentities(),
                ]);
                setUser(userData);
                setIdentities(userIdentities);
            } catch (err) {
                toast.error('Failed to load profile data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        // Check for redirect params
        const params = new URLSearchParams(window.location.search);
        if (params.get('linked') === 'success') {
            toast.success('Account linked successfully');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const providers = [
        { id: 'google', name: 'Google', icon: Globe, color: 'text-blue-500' },
        { id: 'github', name: 'GitHub', icon: Github, color: 'text-slate-900' },
        { id: 'microsoft', name: 'Microsoft', icon: Mail, color: 'text-blue-600' },
        { id: 'apple', name: 'Apple', icon: Apple, color: 'text-black' },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-6 py-8">
            <h1 className="text-3xl font-bold tracking-tight">Osobní profil</h1>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <User className="w-12 h-12 text-primary" />
                        </div>
                        <CardTitle>{user?.firstName} {user?.lastName}</CardTitle>
                        <CardDescription>{user?.email}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-2 text-sm">
                            <Shield className="w-4 h-4 text-muted-foreground" />
                            <span>Role: {user?.isSystemAdmin ? 'System Admin' : 'Uživatel'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span>{user?.email}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <LinkIcon className="w-5 h-5 text-primary" />
                            Propojené účty (SSO)
                        </CardTitle>
                        <CardDescription>
                            Propojte svůj školní účet s externími poskytovateli pro snadnější přihlašování.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {providers.map((p) => {
                            const linked = identities.find(id => id.provider.toLowerCase() === p.id);
                            return (
                                <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <p.icon className={`w-5 h-5 ${p.color}`} />
                                        <div>
                                            <p className="font-medium">{p.name}</p>
                                            {linked ? (
                                                <p className="text-xs text-muted-foreground">
                                                    Propojeno {new Date(linked.createdAt).toLocaleDateString()}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic">Nepropojeno</p>
                                            )}
                                        </div>
                                    </div>
                                    {linked ? (
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                            Aktivní
                                        </Badge>
                                    ) : (
                                        <Button variant="outline" size="sm" onClick={() => linkIdentity(p.id)}>
                                            Propojit
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
