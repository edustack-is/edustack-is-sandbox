import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '@/context/SchoolContext';
import { api, createSystemSchool } from '@/api';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SchoolMembership {
    schoolId: string;
    role: string;
    school: {
        id: string;
        name: string;
        address?: string;
    };
}

export function SelectSchool() {
    const navigate = useNavigate();
    const { selectSchool, isSystemAdmin, userId } = useSchool();
    const [schools, setSchools] = useState<SchoolMembership[]>([]);
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState<string | null>(null);

    // Create School State
    const [isCreating, setIsCreating] = useState(false);
    const [newSchoolName, setNewSchoolName] = useState('');
    const [newSchoolAddress, setNewSchoolAddress] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadSchools();
    }, []);

    const loadSchools = () => {
        setLoading(true);
        api.get('/api/auth/schools')
            .then((res) => {
                const list = res.data;
                setSchools(list);

                // Auto-select if user has exactly 1 school and is NOT system admin
                // And is NOT currently trying to create a school
                if (list.length === 1 && !isSystemAdmin && !isCreating) {
                    handleSelect(list[0].schoolId || list[0].school.id);
                }
            })
            .catch((err) => console.error('Failed to load schools', err))
            .finally(() => setLoading(false));
    };

    const handleSelect = async (schoolId: string, role?: string) => {
        setSelecting(schoolId);
        try {
            await selectSchool(schoolId, role);
            navigate('/dashboard');
        } catch (err: any) {
            toast.error('Failed to select school: ' + (err.response?.data?.message || err.message));
        } finally {
            setSelecting(null);
        }
    };

    const handleCreateSchool = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSchoolName.trim() || !userId) return;

        setCreating(true);
        try {
            const res = await createSystemSchool({
                schoolName: newSchoolName,
                address: newSchoolAddress,
                admin: {
                    type: 'EXISTING',
                    userId: userId,
                },
            });

            // Refresh list and select the new school
            // The API returns the created school, but we need the membership record.
            // Simplest is to reload schools, find the new one, and select it.

            // Reload schools manually to ensure we get the fresh list with the new membership
            const schoolsRes = await api.get('/api/auth/schools');
            const list = schoolsRes.data;
            setSchools(list);

            const newSchoolId = res.id; // Assuming response is the school object
            const membership = list.find((m: any) => (m.schoolId === newSchoolId || m.school.id === newSchoolId));

            if (membership) {
                await handleSelect(membership.schoolId || membership.school.id);
            } else {
                // Fallback if not found (unexpected)
                setIsCreating(false);
                setNewSchoolName('');
                setNewSchoolAddress('');
            }

        } catch (err: any) {
            toast.error('Failed to create school: ' + (err.response?.data?.message || err.message));
        } finally {
            setCreating(false);
        }
    };

    if (loading && schools.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-muted-foreground">Načítání škol...</p>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
            <div className="w-full max-w-lg space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight">
                        {isCreating ? 'Vytvořit novou školu' : 'Vyberte školu'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isCreating
                            ? 'Zadejte údaje pro novou školu v systému'
                            : 'Vyberte školu, se kterou chcete pracovat'}
                    </p>
                </div>

                {isCreating ? (
                    <Card>
                        <form onSubmit={handleCreateSchool}>
                            <CardContent className="pt-6 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="schoolName">Název školy</Label>
                                    <Input
                                        id="schoolName"
                                        value={newSchoolName}
                                        onChange={e => setNewSchoolName(e.target.value)}
                                        placeholder="Např. Gymnázium Jana Keplera"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address">Adresa (nepovinné)</Label>
                                    <Input
                                        id="address"
                                        value={newSchoolAddress}
                                        onChange={e => setNewSchoolAddress(e.target.value)}
                                        placeholder="Ulice, Město"
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between">
                                <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>
                                    Zrušit
                                </Button>
                                <Button type="submit" disabled={creating || !newSchoolName.trim()}>
                                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Vytvořit školu
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                ) : (
                    <>
                        {schools.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                                <p>Nemáte přiřazenou žádnou školu.</p>
                                {isSystemAdmin && (
                                    <Button className="mt-4" onClick={() => setIsCreating(true)}>
                                        <Plus className="mr-2 h-4 w-4" /> Vytvořit první školu
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {schools.map((membership) => (
                                    <Card
                                        key={membership.schoolId || membership.school.id}
                                        className="transition-colors border-border hover:border-primary/30"
                                    >
                                        <CardHeader className="flex flex-row items-center space-x-4 p-4 pb-2">
                                            <div className="bg-primary/10 p-3 rounded-lg">
                                                <Building2 className="h-6 w-6 text-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <CardTitle className="text-base">{membership.school.name}</CardTitle>
                                                {membership.school.address && (
                                                    <CardDescription>{membership.school.address}</CardDescription>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground uppercase font-medium">
                                                {membership.role}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0 flex flex-wrap gap-2">
                                            {isSystemAdmin ? (
                                                <>
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        className="flex-1"
                                                        disabled={selecting === (membership.schoolId || membership.school.id)}
                                                        onClick={() => handleSelect(membership.schoolId || membership.school.id, 'PRINCIPAL')}
                                                    >
                                                        Vstoupit jako Ředitel
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1"
                                                        disabled={selecting === (membership.schoolId || membership.school.id)}
                                                        onClick={() => handleSelect(membership.schoolId || membership.school.id, 'DEPUTY')}
                                                    >
                                                        Vstoupit jako Zástupce
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="w-full text-xs"
                                                        disabled={selecting === (membership.schoolId || membership.school.id)}
                                                        onClick={() => handleSelect(membership.schoolId || membership.school.id, 'ADMIN')}
                                                    >
                                                        Vstoupit jako Správce
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button
                                                    variant="secondary"
                                                    className="w-full"
                                                    disabled={selecting === (membership.schoolId || membership.school.id)}
                                                    onClick={() => handleSelect(membership.schoolId || membership.school.id)}
                                                >
                                                    {selecting === (membership.schoolId || membership.school.id) ? 'Vstupuji...' : 'Vstoupit'}
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {isSystemAdmin && !isCreating && schools.length > 0 && (
                            <div className="text-center pt-4 flex flex-col gap-2">
                                <Button variant="outline" className="w-full border-dashed" onClick={() => setIsCreating(true)}>
                                    <Plus className="mr-2 h-4 w-4" /> Vytvořit další školu
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => navigate('/system/schools')}>
                                    Přejít do správy systému
                                </Button>
                            </div>
                        )}

                        {isSystemAdmin && !isCreating && schools.length === 0 && (
                            <div className="text-center pt-2">
                                <Button variant="ghost" size="sm" onClick={() => navigate('/system/schools')}>
                                    Přejít do správy systému
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
