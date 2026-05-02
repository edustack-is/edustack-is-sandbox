import { useEffect, useState } from 'react';
import { Clock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getTimeSlots, upsertTimeSlots } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function BellSchedule() {
    const { t } = useTranslation();
    const [slots, setSlots] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const data = await getTimeSlots();
            if (data.length === 0) {
                // Create default 8 slots
                const defaults = Array.from({ length: 8 }, (_, i) => ({
                    lessonNumber: i + 1,
                    startTime: `${String(8 + Math.floor((i * 55) / 60)).padStart(2, '0')}:${String((i * 55) % 60).padStart(2, '0')}`,
                    endTime: `${String(8 + Math.floor((i * 55 + 45) / 60)).padStart(2, '0')}:${String((i * 55 + 45) % 60).padStart(2, '0')}`,
                    label: `${i + 1}. hodina`,
                    breakAfter: i === 1 ? 20 : 10,
                }));
                setSlots(defaults);
            } else {
                setSlots(data);
            }
        } catch {
            toast.error('Nepodařilo se načíst zvonění');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const updateSlot = (index: number, field: string, value: string | number) => {
        setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await upsertTimeSlots(
                slots.map((s) => ({
                    lessonNumber: s.lessonNumber,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    label: s.label || undefined,
                    breakAfter: s.breakAfter ?? 10,
                })),
            );
            toast.success('Zvonění uloženo');
            load();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Chyba při ukládání');
        } finally {
            setSaving(false);
        }
    };

    const addSlot = () => {
        const next = slots.length + 1;
        setSlots((prev) => [
            ...prev,
            {
                lessonNumber: next,
                startTime: '14:00',
                endTime: '14:45',
                label: `${next}. hodina`,
                breakAfter: 10,
            },
        ]);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {t('sidebar.bell_schedule', 'Zvonění (Bell Schedule)')}
                    </h1>
                    <p className="text-muted-foreground">
                        {t('schedule.bell_desc', 'Nastavení časů vyučovacích hodin a přestávek')}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={addSlot}>
                        + Hodina
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? t('common.saving') : t('common.save')}
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                    {t('common.loading')}
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            {t('schedule.bell_overview', 'Přehled zvonění')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">#</TableHead>
                                    <TableHead>{t('common.label', 'Označení')}</TableHead>
                                    <TableHead>{t('common.start')}</TableHead>
                                    <TableHead>{t('common.end')}</TableHead>
                                    <TableHead>{t('schedule.break', 'Přestávka')} (min)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {slots.map((slot, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium">{slot.lessonNumber}.</TableCell>
                                        <TableCell>
                                            <Input
                                                value={slot.label || ''}
                                                onChange={(e) => updateSlot(i, 'label', e.target.value)}
                                                placeholder={`${slot.lessonNumber}. hodina`}
                                                className="w-40"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="time"
                                                value={slot.startTime}
                                                onChange={(e) => updateSlot(i, 'startTime', e.target.value)}
                                                className="w-28"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="time"
                                                value={slot.endTime}
                                                onChange={(e) => updateSlot(i, 'endTime', e.target.value)}
                                                className="w-28"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={slot.breakAfter ?? 10}
                                                onChange={(e) =>
                                                    updateSlot(i, 'breakAfter', parseInt(e.target.value) || 0)
                                                }
                                                className="w-20"
                                                min={0}
                                                max={60}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {/* Visual timeline */}
                        <div className="mt-6 space-y-1">
                            <Label className="text-sm font-medium">
                                {t('schedule.visual_overview', 'Vizuální přehled')}
                            </Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {slots.map((slot, i) => (
                                    <div key={i} className="flex items-center gap-1">
                                        <div className="bg-primary/10 border border-primary/30 rounded px-3 py-2 text-xs text-center">
                                            <div className="font-semibold">
                                                {slot.label || `${slot.lessonNumber}. hod`}
                                            </div>
                                            <div className="text-muted-foreground">
                                                {slot.startTime}–{slot.endTime}
                                            </div>
                                        </div>
                                        {i < slots.length - 1 && (
                                            <div className="text-xs text-muted-foreground px-1">
                                                {slot.breakAfter || 10}′
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
