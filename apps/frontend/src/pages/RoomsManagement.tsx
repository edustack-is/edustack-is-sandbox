import { useEffect, useState, KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { getRooms, createRoom, updateRoom, deleteRoom } from '../api/deputy';

import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';

// ─── Types ──────────────────────────────────────────────────────

interface Room {
    id: string;
    name: string;
    capacity: number;
    isComputerLab: boolean;
    specialEquipment: string[] | null;
    schoolId: string;
}

interface RoomFormData {
    name: string;
    capacity: string;
    isComputerLab: boolean;
}

// ─── Component ──────────────────────────────────────────────────

export default function RoomsManagement() {
    const { t } = useTranslation();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [equipmentTags, setEquipmentTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');

    const form = useForm<RoomFormData>({
        defaultValues: { name: '', capacity: '30', isComputerLab: false },
    });

    // ── Load rooms ─────────────────────────────────────────
    const loadRooms = async () => {
        setLoading(true);
        try {
            const result = await getRooms();
            setRooms(result);
        } catch (error) {
            console.error(error);
            toast.error(t('rooms.load_failed'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadRooms(); }, []);

    // ── Open sheet for create/edit ─────────────────────────
    const openCreate = () => {
        setEditingRoom(null);
        form.reset({ name: '', capacity: '30', isComputerLab: false });
        setEquipmentTags([]);
        setTagInput('');
        setSheetOpen(true);
    };

    const openEdit = (room: Room) => {
        setEditingRoom(room);
        form.reset({
            name: room.name,
            capacity: String(room.capacity),
            isComputerLab: room.isComputerLab,
        });
        setEquipmentTags(room.specialEquipment || []);
        setTagInput('');
        setSheetOpen(true);
    };

    // ── Equipment tag handling ──────────────────────────────
    const addTag = () => {
        const tag = tagInput.trim();
        if (tag && !equipmentTags.includes(tag)) {
            setEquipmentTags([...equipmentTags, tag]);
        }
        setTagInput('');
    };

    const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
        }
    };

    const removeTag = (index: number) => {
        setEquipmentTags(equipmentTags.filter((_, i) => i !== index));
    };

    // ── Submit ──────────────────────────────────────────────
    const handleSubmit = form.handleSubmit(async (data) => {
        if (!data.name.trim()) {
            toast.error(t('rooms.name_required'));
            return;
        }

        // Client-side uniqueness check
        const duplicate = rooms.find(
            (r) => r.name.toLowerCase() === data.name.trim().toLowerCase() && r.id !== editingRoom?.id
        );
        if (duplicate) {
            toast.error(t('rooms.name_duplicate'));
            return;
        }

        const capacity = parseInt(data.capacity, 10);
        if (isNaN(capacity) || capacity < 1) {
            toast.error(t('rooms.capacity_invalid'));
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                name: data.name.trim(),
                capacity,
                isComputerLab: data.isComputerLab,
                specialEquipment: equipmentTags,
            };

            if (editingRoom) {
                await updateRoom(editingRoom.id, payload);
            } else {
                await createRoom(payload);
            }

            setSheetOpen(false);
            loadRooms();
        } catch (error: any) {
            toast.error(t('common.error') + ': ' + (error.response?.data?.message || error.message));
        } finally {
            setSubmitting(false);
        }
    });

    // ── Delete ──────────────────────────────────────────────
    const handleDelete = async (room: Room) => {
        if (!confirm(t('rooms.delete_confirm', { name: room.name }))) return;
        try {
            await deleteRoom(room.id);
            loadRooms();
        } catch (error: any) {
            toast.error(t('rooms.delete_failed') + ': ' + (error.response?.data?.message || error.message));
        }
    };

    // ── Column definitions ─────────────────────────────────
    const columns: ColumnDef<Room>[] = [
        {
            accessorKey: 'name',
            header: t('rooms.name_column'),
            cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
        },
        {
            accessorKey: 'capacity',
            header: t('rooms.capacity_column'),
            cell: ({ row }) => <span>{row.original.capacity} {t('rooms.seats')}</span>,
        },
        {
            accessorKey: 'isComputerLab',
            header: t('rooms.computer_lab_column'),
            cell: ({ row }) => (
                <Badge variant={row.original.isComputerLab ? 'default' : 'secondary'}>
                    {row.original.isComputerLab ? t('common.yes') : t('common.no')}
                </Badge>
            ),
        },
        {
            accessorKey: 'specialEquipment',
            header: t('rooms.equipment_column'),
            cell: ({ row }) => {
                const equipment = row.original.specialEquipment;
                if (!equipment || equipment.length === 0) {
                    return <span className="text-muted-foreground italic">—</span>;
                }
                return (
                    <div className="flex flex-wrap gap-1">
                        {equipment.map((item, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{item}</Badge>
                        ))}
                    </div>
                );
            },
        },
        {
            id: 'actions',
            header: t('common.actions'),
            cell: ({ row }) => (
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title={t('common.edit')}
                        onClick={() => openEdit(row.original)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title={t('common.delete')}
                        onClick={() => handleDelete(row.original)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            ),
        },
    ];

    // ── Render ──────────────────────────────────────────────
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t('rooms.title')}</h1>
                    <p className="text-muted-foreground">{t('rooms.subtitle')}</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('rooms.add_room')}
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">{t('common.loading')}</div>
            ) : (
                <DataTable columns={columns} data={rooms} />
            )}

            {/* ─── Sheet for Create/Edit ──────────────────── */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="overflow-y-auto">
                    <SheetHeader className="px-6 pt-6">
                        <SheetTitle>{editingRoom ? t('rooms.edit_room') : t('rooms.new_room')}</SheetTitle>
                        <SheetDescription>
                            {editingRoom ? t('rooms.edit_description') : t('rooms.new_description')}
                        </SheetDescription>
                    </SheetHeader>

                    <form onSubmit={handleSubmit} className="space-y-6 px-6 py-4">
                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="room-name">{t('rooms.name_label')}</Label>
                            <Input id="room-name" placeholder="e.g. A101"
                                {...form.register('name')} />
                        </div>

                        {/* Capacity */}
                        <div className="space-y-2">
                            <Label htmlFor="room-capacity">{t('rooms.capacity_label')}</Label>
                            <Input id="room-capacity" type="number" min="1" placeholder="30"
                                {...form.register('capacity')} />
                        </div>

                        {/* Computer lab checkbox */}
                        <div className="flex items-center gap-3">
                            <input
                                id="room-computerLab"
                                type="checkbox"
                                className="h-4 w-4 rounded border-input"
                                {...form.register('isComputerLab')}
                            />
                            <Label htmlFor="room-computerLab" className="cursor-pointer">{t('rooms.computer_lab')}</Label>
                        </div>

                        {/* Special equipment tags */}
                        <div className="space-y-2">
                            <Label>{t('rooms.special_equipment')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    placeholder="e.g. Projector"
                                    className="flex-1"
                                />
                                <Button type="button" variant="outline" size="sm" onClick={addTag}
                                    disabled={!tagInput.trim()}>
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>
                            {equipmentTags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {equipmentTags.map((tag, index) => (
                                        <Badge key={index} variant="secondary" className="gap-1 pr-1">
                                            {tag}
                                            <button type="button" onClick={() => removeTag(index)}
                                                className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-4">
                            <Button type="button" variant="outline" className="flex-1"
                                onClick={() => setSheetOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" className="flex-1" disabled={submitting}>
                                {submitting ? t('common.saving') : (editingRoom ? t('common.save') : t('common.create'))}
                            </Button>
                        </div>
                    </form>
                </SheetContent>
            </Sheet>
        </div>
    );
}
