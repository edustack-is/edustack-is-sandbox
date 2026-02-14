import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, Search, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import {
    getSubjectTemplates, createSubject, updateSubject, deleteSubject,
} from '../api/deputy';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// ─── Types ──────────────────────────────────────────────────────

interface SubjectTemplate {
    id: string;
    name: string;
    code: string;
    svpDescription: string | null;
    schoolId: string;
}

interface SubjectFormData {
    name: string;
    code: string;
    svpDescription: string;
}

// ─── Component ──────────────────────────────────────────────────

export default function CurriculumManagement() {
    const { t } = useTranslation();
    const [subjects, setSubjects] = useState<SubjectTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<SubjectFormData>({
        defaultValues: { name: '', code: '', svpDescription: '' },
    });

    // ── Load subjects ──────────────────────────────────────
    const loadSubjects = async () => {
        setLoading(true);
        try {
            const result = await getSubjectTemplates();
            setSubjects(result);
        } catch (error) {
            console.error(error);
            toast.error(t('curriculum.load_failed'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadSubjects(); }, []);

    // ── Select subject ─────────────────────────────────────
    const selectSubject = (subject: SubjectTemplate) => {
        setSelectedId(subject.id);
        setIsCreating(false);
        form.reset({
            name: subject.name,
            code: subject.code,
            svpDescription: subject.svpDescription || '',
        });
    };

    const startCreate = () => {
        setSelectedId(null);
        setIsCreating(true);
        form.reset({ name: '', code: '', svpDescription: '' });
    };

    // ── Submit ──────────────────────────────────────────────
    const handleSubmit = form.handleSubmit(async (data) => {
        if (!data.name.trim() || !data.code.trim()) {
            toast.error(t('curriculum.name_code_required'));
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                name: data.name.trim(),
                code: data.code.trim().toUpperCase(),
                svpDescription: data.svpDescription.trim() || undefined,
            };

            if (selectedId) {
                await updateSubject(selectedId, payload);
            } else {
                const created = await createSubject(payload);
                setSelectedId(created.id);
                setIsCreating(false);
            }
            loadSubjects();
        } catch (error: any) {
            toast.error(t('common.error') + ': ' + (error.response?.data?.message || error.message));
        } finally {
            setSubmitting(false);
        }
    });

    // ── Delete ──────────────────────────────────────────────
    const handleDelete = async () => {
        if (!selectedId) return;
        const subject = subjects.find((s) => s.id === selectedId);
        if (!confirm(t('curriculum.delete_confirm', { name: subject?.name }))) return;
        try {
            await deleteSubject(selectedId);
            setSelectedId(null);
            setIsCreating(false);
            form.reset({ name: '', code: '', svpDescription: '' });
            loadSubjects();
        } catch (error: any) {
            toast.error(t('curriculum.delete_failed') + ': ' + (error.response?.data?.message || error.message));
        }
    };

    // ── Filtered subjects ──────────────────────────────────
    const filtered = subjects.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedSubject = subjects.find((s) => s.id === selectedId);

    // ── Render ──────────────────────────────────────────────
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t('curriculum.title')}</h1>
                    <p className="text-muted-foreground">{t('curriculum.subtitle')}</p>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 min-h-[600px]">
                {/* ─── Left: Subject List ─────────────────── */}
                <div className="col-span-4 border rounded-lg flex flex-col">
                    {/* Search + Add */}
                    <div className="p-3 border-b space-y-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={t('curriculum.search_placeholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <Button variant="outline" size="sm" className="w-full" onClick={startCreate}>
                            <Plus className="h-3 w-3 mr-1" /> {t('curriculum.new_subject')}
                        </Button>
                    </div>

                    {/* List */}
                    <ScrollArea className="flex-1">
                        {loading ? (
                            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                                {t('common.loading')}
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
                                <BookOpen className="h-8 w-8 mb-2 opacity-40" />
                                {searchQuery ? t('curriculum.no_results') : t('curriculum.no_subjects')}
                            </div>
                        ) : (
                            <div className="p-1">
                                {filtered.map((subject) => (
                                    <button
                                        key={subject.id}
                                        onClick={() => selectSubject(subject)}
                                        className={`w-full text-left px-3 py-2.5 rounded-md transition-colors hover:bg-muted/60 ${selectedId === subject.id
                                            ? 'bg-muted font-medium'
                                            : ''
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm truncate">{subject.name}</span>
                                            <Badge variant="outline" className="ml-2 text-xs shrink-0">
                                                {subject.code}
                                            </Badge>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                {/* ─── Right: Detail / Form ───────────────── */}
                <div className="col-span-8 border rounded-lg p-6">
                    {!selectedId && !isCreating ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <BookOpen className="h-12 w-12 mb-3 opacity-30" />
                            <p className="text-sm">{t('curriculum.select_or_create')}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">
                                    {isCreating ? t('curriculum.new_subject') : t('curriculum.editing', { name: selectedSubject?.name })}
                                </h2>
                                {selectedId && (
                                    <Button type="button" variant="ghost" size="sm"
                                        onClick={handleDelete}
                                        className="text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4 mr-1" /> {t('common.delete')}
                                    </Button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="subject-name">{t('curriculum.subject_name')}</Label>
                                    <Input id="subject-name" placeholder="e.g. Informatika"
                                        {...form.register('name')} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="subject-code">{t('curriculum.subject_code')}</Label>
                                    <Input id="subject-code" placeholder="e.g. INF"
                                        {...form.register('code')} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="subject-svp">{t('curriculum.svp_description')}</Label>
                                <Textarea
                                    id="subject-svp"
                                    placeholder={t('curriculum.svp_placeholder')}
                                    rows={6}
                                    {...form.register('svpDescription')}
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button type="button" variant="outline"
                                    onClick={() => { setSelectedId(null); setIsCreating(false); form.reset(); }}>
                                    {t('common.cancel')}
                                </Button>
                                <Button type="submit" disabled={submitting}>
                                    {submitting ? t('common.saving') : (selectedId ? t('curriculum.save_changes') : t('curriculum.create_subject'))}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
