import { useEffect, useState } from 'react';
import { getUsers, getSystemAdmins, promoteToSysAdmin, demoteFromSysAdmin } from '../api';
import { api } from '../api';
import { toast } from 'sonner';
import { UserCog, ShieldPlus, ShieldMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: string;
    status?: string;
    isSystemAdmin?: boolean;
    lastLogin?: string;
    createdAt?: string;
}

function decodeJwtPayload(token: string): any {
    try {
        const base64 = token.split('.')[1];
        return JSON.parse(atob(base64));
    } catch {
        return {};
    }
}

export function SystemAdminUsers() {
    const { t } = useTranslation();
    const [users, setUsers] = useState<User[]>([]);
    const [admins, setAdmins] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [adminsLoading, setAdminsLoading] = useState(true);
    const [impersonating, setImpersonating] = useState<string | null>(null);

    // Add admin dialog
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminFirstName, setNewAdminFirstName] = useState('');
    const [newAdminLastName, setNewAdminLastName] = useState('');
    const [addingAdmin, setAddingAdmin] = useState(false);

    // Demote confirm dialog
    const [demoteTarget, setDemoteTarget] = useState<User | null>(null);
    const [demoting, setDemoting] = useState(false);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const result = await getUsers({ limit: 200 });
            const list = Array.isArray(result) ? result : result.data || [];
            setUsers(list);
        } catch (error) {
            console.error('Failed to load users', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAdmins = async () => {
        setAdminsLoading(true);
        try {
            const result = await getSystemAdmins();
            setAdmins(result);
        } catch (error) {
            console.error('Failed to load admins', error);
        } finally {
            setAdminsLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
        loadAdmins();
    }, []);

    const handleImpersonate = async (targetUser: User) => {
        setImpersonating(targetUser.id);
        try {
            const currentToken = localStorage.getItem('access_token');
            if (!currentToken) {
                toast.error(t('system_users.no_token'));
                return;
            }
            const payload = decodeJwtPayload(currentToken);
            const adminId = payload.sub;

            const response = await api.post(`/api/auth/impersonate/${targetUser.id}`, { adminId });
            const { access_token } = response.data;

            localStorage.setItem('original_admin_token', currentToken);
            localStorage.setItem('access_token', access_token);
            window.location.reload();
        } catch (error: any) {
            toast.error(t('system_users.impersonation_failed') + ': ' + (error.response?.data?.message || error.message));
        } finally {
            setImpersonating(null);
        }
    };

    const handleAddAdmin = async () => {
        if (!newAdminEmail.trim()) {
            toast.error(t('system_users.email_required'));
            return;
        }
        setAddingAdmin(true);
        try {
            await promoteToSysAdmin({
                email: newAdminEmail,
                firstName: newAdminFirstName || undefined,
                lastName: newAdminLastName || undefined,
            });
            toast.success(t('system_users.admin_added'));
            setAddDialogOpen(false);
            setNewAdminEmail('');
            setNewAdminFirstName('');
            setNewAdminLastName('');
            loadAdmins();
            loadUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setAddingAdmin(false);
        }
    };

    const handleDemoteAdmin = async () => {
        if (!demoteTarget) return;
        setDemoting(true);
        try {
            await demoteFromSysAdmin(demoteTarget.id);
            toast.success(t('system_users.admin_removed'));
            setDemoteTarget(null);
            loadAdmins();
            loadUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setDemoting(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* ─── System Admins Section ──────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{t('system_users.admins_title')}</h1>
                        <p className="text-muted-foreground">{t('system_users.admins_subtitle')}</p>
                    </div>
                    <Button onClick={() => setAddDialogOpen(true)}>
                        <ShieldPlus className="h-4 w-4 mr-2" />
                        {t('system_users.add_admin')}
                    </Button>
                </div>

                <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('system_users.name_column')}</TableHead>
                                <TableHead>{t('system_users.email_column')}</TableHead>
                                <TableHead>{t('system_users.last_login')}</TableHead>
                                <TableHead className="text-right">{t('system_users.actions_column')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {adminsLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                        {t('common.loading')}
                                    </TableCell>
                                </TableRow>
                            ) : admins.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                        {t('system_users.no_admins')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                admins.map((admin) => (
                                    <TableRow key={admin.id}>
                                        <TableCell className="font-medium">
                                            {admin.firstName} {admin.lastName}
                                        </TableCell>
                                        <TableCell>{admin.email}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {admin.lastLogin
                                                ? new Date(admin.lastLogin).toLocaleDateString('cs-CZ')
                                                : '—'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => setDemoteTarget(admin)}
                                            >
                                                <ShieldMinus size={16} />
                                                {t('system_users.remove_admin')}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* ─── All Users Section ─────────────────────────── */}
            <div>
                <div className="mb-4">
                    <h2 className="text-xl font-bold tracking-tight">{t('system_users.title')}</h2>
                    <p className="text-muted-foreground">{t('system_users.subtitle')}</p>
                </div>

                <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('system_users.name_column')}</TableHead>
                                <TableHead>{t('system_users.email_column')}</TableHead>
                                <TableHead>{t('system_users.status_column')}</TableHead>
                                <TableHead className="text-right">{t('system_users.actions_column')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        {t('common.loading')}
                                    </TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        {t('system_users.no_users')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">
                                            {user.firstName} {user.lastName}
                                            {user.isSystemAdmin && (
                                                <Badge variant="outline" className="ml-2 text-xs">
                                                    {t('system_users.system_admin_badge')}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    user.status === 'ACTIVE'
                                                        ? 'default'
                                                        : user.status === 'PENDING'
                                                            ? 'secondary'
                                                            : 'outline'
                                                }
                                            >
                                                {user.status ? t(`statuses.${user.status}`, user.status) : '—'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {!user.isSystemAdmin && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                    disabled={impersonating === user.id}
                                                    onClick={() => handleImpersonate(user)}
                                                >
                                                    <UserCog size={16} />
                                                    {impersonating === user.id ? t('system_users.switching') : t('system_users.login_on_behalf')}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
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
                                <Label>{t('system_users.first_name')}</Label>
                                <Input
                                    placeholder={t('system_users.first_name_placeholder')}
                                    value={newAdminFirstName}
                                    onChange={(e) => setNewAdminFirstName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('system_users.last_name')}</Label>
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

            {/* ─── Demote Confirm Dialog ─────────────────────── */}
            <AlertDialog open={!!demoteTarget} onOpenChange={(open) => !open && setDemoteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('system_users.demote_title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('system_users.demote_description', {
                                name: demoteTarget ? `${demoteTarget.firstName} ${demoteTarget.lastName}` : '',
                                email: demoteTarget?.email || '',
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDemoteAdmin}
                            disabled={demoting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {demoting ? t('common.saving') : t('system_users.confirm_demote')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
