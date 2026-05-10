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

export default function TeachingMaterials() {
    const { t } = useTranslation();

    const TYPES = [
        { value: 'TEXTBOOK', label: t('materials.types.textbook'), icon: BookOpen, color: 'text-blue-600' },
        { value: 'WORKSHEET', label: t('materials.types.worksheet'), icon: FileText, color: 'text-green-600' },
        {
            value: 'PRESENTATION',
            label: t('materials.types.presentation'),
            icon: Presentation,
            color: 'text-orange-600',
        },
        { value: 'VIDEO', label: t('materials.types.video'), icon: Video, color: 'text-red-600' },
        { value: 'OTHER', label: t('materials.types.other'), icon: File, color: 'text-gray-600' },
    ];

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
            toast.error(t('materials.load_error'));
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
            toast.error(t('materials.fill_required'));
            return;
        }
        try {
            if (editing) {
                await updateTeachingMaterial(editing.id, form);
                toast.success(t('materials.update_success'));
            } else {
                await createTeachingMaterial(form);
                toast.success(t('materials.create_success'));
            }
            setDialogOpen(false);
            setEditing(null);
            setForm(emptyForm);
            load();
        } catch (e: any) {
            toast.error(e.response?.data?.message || t('common.error'));
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteTeachingMaterial(id);
            toast.success(t('common.success'));
            load();
        } catch (e: any) {
            toast.error(e.response?.data?.message || t('common.error'));
        }
    };

    const filteredItems = filterType === 'ALL' ? items : items.filter((i) => i.type === filterType);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t('materials.title')}</h1>
                    <p className="text-muted-foreground">{t('materials.subtitle')}</p>
                </div>
                <Button
                    onClick={() => {
                        setEditing(null);
                        setForm(emptyForm);
                        setDialogOpen(true);
                    }}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('materials.add')}
                </Button>
            </div>

            <div className="flex gap-2">
                <Badge
                    variant={filterType === 'ALL' ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setFilterType('ALL')}
                >
                    {t('common.all')}
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
                        {t('materials.no_materials')}
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
                                        {t('materials.open')}
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
                        <DialogTitle>{editing ? t('materials.edit') : t('materials.new')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>{t('common.name')} *</Label>
                            <Input
                                value={form.title}
                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>{t('materials.url')} *</Label>
                            <Input
                                value={form.url}
                                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                                placeholder="https://..."
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>{t('common.description')}</Label>
                            <Textarea
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                rows={2}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label>{t('common.type')}</Label>
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
                                <Label>{t('grading.subject')}</Label>
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
                                <Label>{t('common.grade_level')}</Label>
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
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleSave}>{editing ? t('common.save') : t('common.create')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
