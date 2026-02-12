import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '@/context/SchoolContext';
import { api } from '@/api';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

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
    const { selectSchool, isSystemAdmin } = useSchool();
    const [schools, setSchools] = useState<SchoolMembership[]>([]);
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState<string | null>(null);

    useEffect(() => {
        api.get('/api/auth/schools')
            .then((res) => {
                const list = res.data;
                setSchools(list);

                // Auto-select if user has exactly 1 school and is NOT system admin
                if (list.length === 1 && !isSystemAdmin) {
                    handleSelect(list[0].schoolId || list[0].school.id);
                }
            })
            .catch((err) => console.error('Failed to load schools', err))
            .finally(() => setLoading(false));
    }, []);

    const handleSelect = async (schoolId: string) => {
        setSelecting(schoolId);
        try {
            await selectSchool(schoolId);
            navigate('/dashboard');
        } catch (err: any) {
            alert('Failed to select school: ' + (err.response?.data?.message || err.message));
        } finally {
            setSelecting(null);
        }
    };

    if (loading) {
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
                    <h1 className="text-2xl font-bold tracking-tight">Vyberte školu</h1>
                    <p className="text-muted-foreground">
                        Vyberte školu, se kterou chcete pracovat
                    </p>
                </div>

                {schools.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>Nemáte přiřazenou žádnou školu.</p>
                        {isSystemAdmin && (
                            <Button className="mt-4" onClick={() => navigate('/system/schools')}>
                                Spravovat školy
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {schools.map((membership) => (
                            <Card
                                key={membership.schoolId || membership.school.id}
                                className="cursor-pointer transition-colors hover:bg-accent/50 hover:border-primary/30"
                                onClick={() => handleSelect(membership.schoolId || membership.school.id)}
                            >
                                <CardHeader className="flex flex-row items-center space-x-4 p-4">
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
                                    {selecting === (membership.schoolId || membership.school.id) && (
                                        <span className="text-sm text-muted-foreground">Přepínání...</span>
                                    )}
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                )}

                {isSystemAdmin && (
                    <div className="text-center pt-4">
                        <Button variant="outline" onClick={() => navigate('/system/schools')}>
                            Přejít do administrace
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
