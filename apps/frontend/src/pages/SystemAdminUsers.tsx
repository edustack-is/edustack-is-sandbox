import { useEffect, useState } from 'react';
import { getSystemAdmins, promoteToSysAdmin, removeSystemAdmin } from '../api';
import { toast } from 'sonner';
import { ShieldPlus, Trash2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';
import { useSchool } from '@/context/SchoolContext';

interface Admin {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    lastLogin?: string;
    createdAt?: string;
}

export function SystemAdminUsers() {
    const { t } = useTranslation();
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);

    // Current user ID (to prevent self-removal)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Add admin dialog
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminFirstName, setNewAdminFirstName] = useState('');
    const [newAdminLastName, setNewAdminLastName] = useState('');
    const [addingAdmin, setAddingAdmin] = useState(false);

    // Remove confirm dialog
    const [removeTarget, setRemoveTarget] = useState<Admin | null>(null);
    const [removing, setRemoving] = useState(false);

    // Pulled from SchoolContext (which reads /api/auth/session) rather
    // than decoding the JWT from localStorage — the JWT now lives in an
    // httpOnly cookie.
    const { userId } = useSchool();
    useEffect(() => {
        setCurrentUserId(userId);
    }, [userId]);

    const loadAdmins = async () => {
        setLoading(true);
        try {
            const result = await getSystemAdmins();
            setAdmins(result);
        } catch (error) {
            console.error('Failed to load admins', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAdmins();
    }, []);

    const handleAddAdmin = async () => {
        if (!newAdminEmail.trim()) {
            toast.error(t('system_users.email_required'));
            return;
        }
        if (!newAdminFirstName.trim() || !newAdminLastName.trim()) {
            toast.error(t('system_users.name_required'));
            return;
        }
        setAddingAdmin(true);
        try {
            await promoteToSysAdmin({
                email: newAdminEmail.trim(),
                firstName: newAdminFirstName.trim(),
                lastName: newAdminLastName.trim(),
            });
            toast.success(t('system_users.admin_added'));
            setAddDialogOpen(false);
            setNewAdminEmail('');
            setNewAdminFirstName('');
            setNewAdminLastName('');
            loadAdmins();
        } catch (error: any) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setAddingAdmin(false);
        }
    };

    const handleRemoveAdmin = async () => {
        if (!removeTarget) return;
        setRemoving(true);
        try {
            await removeSystemAdmin(removeTarget.id);
            toast.success(t('system_users.admin_removed'));
            setRemoveTarget(null);
            loadAdmins();
        } catch (error: any) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setRemoving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* ─── Header ──────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t('system_users.title')}</h1>
                    <p className="text-muted-foreground">{t('system_users.subtitle')}</p>
                </div>
                <Button onClick={() => setAddDialogOpen(true)}>
                    <ShieldPlus className="h-4 w-4 mr-2" />
                    {t('system_users.add_admin')}
                </Button>
            </div>

            {/* ─── Admins Table ─────────────────────────────── */}
            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('system_users.name_column')}</TableHead>
                            <TableHead>{t('system_users.email_column')}</TableHead>
                            <TableHead>{t('system_users.last_login')}</TableHead>
                            <TableHead>{t('system_users.created_at')}</TableHead>
                            <TableHead className="text-right">{t('system_users.actions_column')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    {t('common.loading')}
                                </TableCell>
                            </TableRow>
                        ) : admins.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                    {t('system_users.no_admins')}
                                </TableCell>
                            </TableRow>
                        ) : (
                            admins.map((admin) => {
                                const isSelf = admin.id === currentUserId;
                                return (
                                    <TableRow key={admin.id}>
                                        <TableCell className="font-medium">
                                            {admin.firstName} {admin.lastName}
                                            {isSelf && (
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    ({t('system_users.you')})
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>{admin.email}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {admin.lastLogin
                                                ? new Date(admin.lastLogin).toLocaleDateString('cs-CZ')
                                                : '—'}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {admin.createdAt
                                                ? new Date(admin.createdAt).toLocaleDateString('cs-CZ')
                                                : '—'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {!isSelf && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => setRemoveTarget(admin)}
                                                >
                                                    <Trash2 size={16} />
                                                    {t('system_users.remove_admin')}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* ─── Add Admin Dialog ──────────────────────────── */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('system_users.add_admin_title')}</DialogTitle>
                        <DialogDescription>{t('system_users.add_admin_description')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>{t('system_users.email_column')} *</Label>
                            <Input
                                type="email"
                                placeholder="admin@example.com"
                                value={newAdminEmail}
                                onChange={(e) => setNewAdminEmail(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t('system_users.first_name')} *</Label>
                                <Input
                                    placeholder={t('system_users.first_name_placeholder')}
                                    value={newAdminFirstName}
                                    onChange={(e) => setNewAdminFirstName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('system_users.last_name')} *</Label>
                                <Input
                                    placeholder={t('system_users.last_name_placeholder')}
                                    value={newAdminLastName}
                                    onChange={(e) => setNewAdminLastName(e.target.value)}
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{t('system_users.add_admin_hint')}</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleAddAdmin} disabled={addingAdmin}>
                            {addingAdmin ? t('common.saving') : t('system_users.add_admin')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Remove Confirm Dialog ─────────────────────── */}
            <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('system_users.remove_title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('system_users.remove_description', {
                                name: removeTarget ? `${removeTarget.firstName} ${removeTarget.lastName}` : '',
                                email: removeTarget?.email || '',
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveAdmin}
                            disabled={removing}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {removing ? t('common.saving') : t('system_users.confirm_remove')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
