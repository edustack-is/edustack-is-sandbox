import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, ExternalLink, BookOpen, FileText, Presentation, Video, File } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
    getTeachingMaterials,
    createTeachingMaterial,
    updateTeachingMaterial,
    deleteTeachingMaterial,
    getSubjectTemplates,
} from '../api/deputy';
import { api } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TYPES = [
    { value: 'TEXTBOOK', label: 'Učebnice', icon: BookOpen, color: 'text-blue-600' },
    { value: 'WORKSHEET', label: 'Pracovní list', icon: FileText, color: 'text-green-600' },
    { value: 'PRESENTATION', label: 'Prezentace', icon: Presentation, color: 'text-orange-600' },
    { value: 'VIDEO', label: 'Video', icon: Video, color: 'text-red-600' },
    { value: 'OTHER', label: 'Jiné', icon: File, color: 'text-gray-600' },
];

export default function TeachingMaterials() {
    const { t } = useTranslation();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [grades, setGrades] = useState<any[]>([]);
    const [editing, setEditing] = useState<any>(null);
    const [filterType, setFilterType] = useState('ALL');

    const emptyForm = { title: '', description: '', url: '', type: 'OTHER', subjectTemplateId: '', gradeLevelId: '' };
    const [form, setForm] = useState(emptyForm);

    const load = async () => {
        setLoading(true);
        try {
            setItems(await getTeachingMaterials());
        } catch {
            toast.error('Nepodařilo se načíst materiály');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        getSubjectTemplates()
            .then(setSubjects)
            .catch(() => {});
        api.get('/api/deputy/grade-levels')
            .then((r) => setGrades(r.data))
            .catch(() => {});
    }, []);

    const openEdit = (item: any) => {
        setEditing(item);
        setForm({
            title: item.title,
            description: item.description || '',
            url: item.url,
            type: item.type,
            subjectTemplateId: item.subjectTemplateId || '',
            gradeLevelId: item.gradeLevelId || '',
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.title || !form.url) {
            toast.error('Vyplňte název a URL');
            return;
        }
        try {
            if (editing) {
                await updateTeachingMaterial(editing.id, form);
                toast.success('Materiál aktualizován');
            } else {
                await createTeachingMaterial(form);
                toast.success('Materiál přidán');
            }
            setDialogOpen(false);
            setEditing(null);
            setForm(emptyForm);
            load();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Chyba');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteTeachingMaterial(id);
            toast.success('Smazáno');
            load();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Chyba');
        }
    };

    const filteredItems = filterType === 'ALL' ? items : items.filter((i) => i.type === filterType);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Elektronické materiály</h1>
                    <p className="text-muted-foreground">Učebnice, pracovní listy, prezentace a videa</p>
                </div>
                <Button
                    onClick={() => {
                        setEditing(null);
                        setForm(emptyForm);
                        setDialogOpen(true);
                    }}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Přidat materiál
                </Button>
            </div>

            <div className="flex gap-2">
                <Badge
                    variant={filterType === 'ALL' ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setFilterType('ALL')}
                >
                    Vše
                </Badge>
                {TYPES.map((t) => (
                    <Badge
                        key={t.value}
                        variant={filterType === t.value ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setFilterType(t.value)}
                    >
                        {t.label}
                    </Badge>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                    {t('common.loading')}
                </div>
            ) : filteredItems.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Žádné materiály
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredItems.map((item) => {
                        const typeInfo = TYPES.find((t) => t.value === item.type) || TYPES[4];
                        const Icon = typeInfo.icon;
                        return (
                            <Card key={item.id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <Icon className={`h-5 w-5 ${typeInfo.color}`} />
                                            <CardTitle className="text-base">{item.title}</CardTitle>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {item.description && (
                                        <p className="text-sm text-muted-foreground">{item.description}</p>
                                    )}
                                    <div className="flex gap-2 flex-wrap">
                                        {item.subjectTemplate && (
                                            <Badge variant="outline">{item.subjectTemplate.name}</Badge>
                                        )}
                                        {item.gradeLevel && <Badge variant="secondary">{item.gradeLevel.name}</Badge>}
                                    </div>
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary flex items-center gap-1 hover:underline"
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        Otevřít materiál
                                    </a>
                                    <p className="text-xs text-muted-foreground">
                                        {item.uploadedBy?.firstName} {item.uploadedBy?.lastName}
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog
                open={dialogOpen}
                onOpenChange={(o) => {
                    setDialogOpen(o);
                    if (!o) setEditing(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Upravit materiál' : 'Nový materiál'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Název *</Label>
                            <Input
                                value={form.title}
                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>URL odkaz *</Label>
                            <Input
                                value={form.url}
                                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                                placeholder="https://..."
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
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label>Typ</Label>
                                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TYPES.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Předmět</Label>
                                <Select
                                    value={form.subjectTemplateId || 'none'}
                                    onValueChange={(v) =>
                                        setForm((f) => ({ ...f, subjectTemplateId: v === 'none' ? '' : v }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">—</SelectItem>
                                        {subjects.map((s: any) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Ročník</Label>
                                <Select
                                    value={form.gradeLevelId || 'none'}
                                    onValueChange={(v) =>
                                        setForm((f) => ({ ...f, gradeLevelId: v === 'none' ? '' : v }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">—</SelectItem>
                                        {grades.map((g: any) => (
                                            <SelectItem key={g.id} value={g.id}>
                                                {g.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
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
