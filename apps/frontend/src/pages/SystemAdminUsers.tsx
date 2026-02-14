import { useEffect, useState } from 'react';
import { getUsers } from '../api';
import { api } from '../api';
import { toast } from 'sonner';
import { UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTranslation } from 'react-i18next';

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: string;
    status?: string;
    isSystemAdmin?: boolean;
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
    const [loading, setLoading] = useState(true);
    const [impersonating, setImpersonating] = useState<string | null>(null);

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

    useEffect(() => {
        loadUsers();
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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('system_users.title')}</h1>
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
    );
}
