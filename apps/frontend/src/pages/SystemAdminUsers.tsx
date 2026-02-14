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
            // Get current admin ID from JWT token
            const currentToken = localStorage.getItem('access_token');
            if (!currentToken) {
                toast.error('No access token found');
                return;
            }
            const payload = decodeJwtPayload(currentToken);
            const adminId = payload.sub;

            // Call impersonate endpoint
            const response = await api.post(`/api/auth/impersonate/${targetUser.id}`, { adminId });
            const { access_token } = response.data;

            // Store original admin token for restoration
            localStorage.setItem('original_admin_token', currentToken);
            // Set impersonated token
            localStorage.setItem('access_token', access_token);
            // Full reload to switch context
            window.location.reload();
        } catch (error: any) {
            toast.error('Impersonation failed: ' + (error.response?.data?.message || error.message));
        } finally {
            setImpersonating(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Global Users</h1>
                <p className="text-muted-foreground">View all users across all schools</p>
            </div>

            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        {user.firstName} {user.lastName}
                                        {user.isSystemAdmin && (
                                            <Badge variant="outline" className="ml-2 text-xs">
                                                System Admin
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
                                            {user.status || '—'}
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
                                                {impersonating === user.id ? 'Switching...' : 'Login on behalf of'}
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
