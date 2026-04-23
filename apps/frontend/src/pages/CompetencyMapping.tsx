import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, CheckCircle, Circle, Target } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
    getRvpCompetencies,
    createRvpCompetency,
    updateRvpCompetency,
    deleteRvpCompetency,
    getCompetencyMappings,
    upsertCompetencyMapping,
    deleteCompetencyMapping,
    getSubjectTemplates,
} from '../api/deputy';
import { api } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function CompetencyMapping() {
    const { t } = useTranslation();
    const [competencies, setCompetencies] = useState<any[]>([]);
    const [mappings, setMappings] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [grades, setGrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('competencies');

    // Filters for mapping view
    const [filterSubject, setFilterSubject] = useState('ALL');
    const [filterGrade, setFilterGrade] = useState('ALL');

    const emptyForm = { code: '', name: '', area: '', description: '' };
    const [form, setForm] = useState(emptyForm);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [c, m] = await Promise.all([getRvpCompetencies(), getCompetencyMappings()]);
            setCompetencies(c);
            setMappings(m);
        } catch {
            toast.error('Nepodařilo se načíst data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
        getSubjectTemplates()
            .then(setSubjects)
            .catch(() => {});
        api.get('/api/deputy/grade-levels')
            .then((r) => setGrades(r.data))
            .catch(() => {});
    }, []);

    const openEdit = (item: any) => {
        setEditing(item);
        setForm({ code: item.code, name: item.name, area: item.area, description: item.description || '' });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.code || !form.name || !form.area) {
            toast.error('Vyplňte kód, název a oblast');
            return;
        }
        try {
            if (editing) {
                await updateRvpCompetency(editing.id, form);
                toast.success('Kompetence aktualizována');
            } else {
                await createRvpCompetency(form);
                toast.success('Kompetence přidána');
            }
            setDialogOpen(false);
            setEditing(null);
            setForm(emptyForm);
            loadAll();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Chyba');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteRvpCompetency(id);
            toast.success('Smazáno');
            loadAll();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Chyba');
        }
    };

    const toggleMapping = async (competencyId: string, subjectTemplateId: string, gradeLevelId: string) => {
        const existing = mappings.find(
            (m) =>
                m.competencyId === competencyId &&
                m.subjectTemplateId === subjectTemplateId &&
                m.gradeLevelId === gradeLevelId,
        );
        try {
            if (existing?.fulfilled) {
                await deleteCompetencyMapping(existing.id);
            } else {
                await upsertCompetencyMapping({
                    competencyId,
                    subjectTemplateId,
                    gradeLevelId,
                    fulfilled: true,
                });
            }
            loadAll();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Chyba');
        }
    };

    const isMapped = (competencyId: string, subjectId: string, gradeId: string) =>
        mappings.some(
            (m) =>
                m.competencyId === competencyId &&
                m.subjectTemplateId === subjectId &&
                m.gradeLevelId === gradeId &&
                m.fulfilled,
        );

    const areas = [...new Set(competencies.map((c) => c.area))].sort();

    const filteredSubjects = filterSubject === 'ALL' ? subjects : subjects.filter((s) => s.id === filterSubject);
    const filteredGrades = filterGrade === 'ALL' ? grades : grades.filter((g) => g.id === filterGrade);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Výstupy dle RVP</h1>
                    <p className="text-muted-foreground">Mapování kompetencí na předměty a ročníky</p>
                </div>
                <Button
                    onClick={() => {
                        setEditing(null);
                        setForm(emptyForm);
                        setDialogOpen(true);
                    }}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Přidat kompetenci
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="competencies">Kompetence ({competencies.length})</TabsTrigger>
                    <TabsTrigger value="matrix">Matice mapování</TabsTrigger>
                </TabsList>

                <TabsContent value="competencies" className="space-y-4 mt-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            {t('common.loading')}
                        </div>
                    ) : competencies.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                Žádné kompetence. Přidejte první.
                            </CardContent>
                        </Card>
                    ) : (
                        areas.map((area) => (
                            <div key={area}>
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    {area}
                                </h3>
                                <div className="space-y-2">
                                    {competencies
                                        .filter((c) => c.area === area)
                                        .map((comp) => (
                                            <Card key={comp.id}>
                                                <CardContent className="flex items-center justify-between py-3 px-4">
                                                    <div>
                                                        <span className="font-mono text-xs text-muted-foreground mr-2">
                                                            {comp.code}
                                                        </span>
                                                        <span className="font-medium">{comp.name}</span>
                                                        {comp.description && (
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {comp.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="secondary">
                                                            {comp._count?.mappings ?? 0} mapování
                                                        </Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openEdit(comp)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete(comp.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                </div>
                            </div>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="matrix" className="mt-4">
                    <div className="flex gap-3 mb-4">
                        <Select value={filterSubject} onValueChange={setFilterSubject}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Předmět" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Všechny předměty</SelectItem>
                                {subjects.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterGrade} onValueChange={setFilterGrade}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Ročník" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Všechny ročníky</SelectItem>
                                {grades.map((g) => (
                                    <SelectItem key={g.id} value={g.id}>
                                        {g.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {competencies.length === 0 || filteredSubjects.length === 0 || filteredGrades.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground">
                                Přidejte kompetence, předměty a ročníky pro zobrazení matice
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-48">Kompetence</TableHead>
                                        {filteredSubjects.flatMap((s) =>
                                            filteredGrades.map((g) => (
                                                <TableHead
                                                    key={`${s.id}-${g.id}`}
                                                    className="text-center text-xs whitespace-nowrap p-1"
                                                >
                                                    {s.code}
                                                    <br />
                                                    {g.name}
                                                </TableHead>
                                            )),
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {competencies.map((comp) => (
                                        <TableRow key={comp.id}>
                                            <TableCell className="text-xs">
                                                <span className="font-mono text-muted-foreground">{comp.code}</span>{' '}
                                                {comp.name}
                                            </TableCell>
                                            {filteredSubjects.flatMap((s) =>
                                                filteredGrades.map((g) => (
                                                    <TableCell key={`${s.id}-${g.id}`} className="text-center p-1">
                                                        <button
                                                            onClick={() => toggleMapping(comp.id, s.id, g.id)}
                                                            className="p-1 rounded hover:bg-muted transition-colors"
                                                        >
                                                            {isMapped(comp.id, s.id, g.id) ? (
                                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                                            ) : (
                                                                <Circle className="h-5 w-5 text-muted-foreground/30" />
                                                            )}
                                                        </button>
                                                    </TableCell>
                                                )),
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog
                open={dialogOpen}
                onOpenChange={(o) => {
                    setDialogOpen(o);
                    if (!o) setEditing(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Upravit kompetenci' : 'Nová kompetence'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Kód *</Label>
                                <Input
                                    value={form.code}
                                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                                    placeholder="IC-9-1-01"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Oblast *</Label>
                                <Input
                                    value={form.area}
                                    onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                                    placeholder="Informatika"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Název *</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="Využívá digitální technologie"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Popis</Label>
                            <Textarea
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Zrušit
                        </Button>
                        <Button onClick={handleSave}>{editing ? 'Uložit' : 'Přidat'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
