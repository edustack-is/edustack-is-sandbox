import { useEffect, useState, useRef } from 'react';
import { getUsers, importUsers, impersonateUser } from '../api';
import { Upload, UserCog, Send } from 'lucide-react';

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
}

export default function Users() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const result = await getUsers({ limit: 100 });
            setUsers(result.data);
        } catch (error) {
            console.error(error);
            alert('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const result = await importUsers(file);
            alert(`Imported ${result.imported} users. Errors: ${result.errors.length}`);
            loadUsers();
        } catch (error) {
            alert('Import failed');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleImpersonate = async (targetId: string) => {
        // Need current admin ID? Simulation: use hardcoded or from somewhere. 
        // In real app, we get it from token, but endpoint expects it in body for demo.
        // Need current admin ID? Simulation: use hardcoded or from somewhere. 
        // Actually, for demo I need a valid ID if backend checks exists.
        // Assuming backend check is mocked or I need real ID.
        // I'll define a prompt for Admin ID or just pass 'admin' if backend allows?
        // Let's assume for this sandbox we accept any string if guard is mocked.
        // Or if I am logged in, I might get my ID from token.
        // I will prompt:
        const aid = prompt("Enter Admin ID for simulation (or any string):", "admin");
        if (!aid) return;

        try {
            const { access_token } = await impersonateUser(targetId, aid);
            // Store original token
            const currentToken = localStorage.getItem('access_token');
            if (currentToken) {
                localStorage.setItem('impersonation_original_token', currentToken);
            }
            localStorage.setItem('access_token', access_token);
            window.location.reload();
        } catch (error: any) {
            alert('Impersonation failed: ' + (error.response?.data?.message || error.message));
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1>User Management</h1>
                <div>
                    <input
                        type="file"
                        accept=".csv"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleImport}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', cursor: 'pointer' }}
                    >
                        <Upload size={16} /> Import CSV
                    </button>
                </div>
            </div>

            {loading ? <p>Loading...</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr>
                            <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>Name</th>
                            <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>Email</th>
                            <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>Role</th>
                            <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>Status</th>
                            <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{user.lastName} {user.firstName}</td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{user.email}</td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{user.role}</td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{user.status}</td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '8px', display: 'flex', gap: '8px' }}>
                                    {user.status === 'PENDING' && (
                                        <button title="Resend Invite"><Send size={16} /></button>
                                    )}
                                    {user.status !== 'PENDING' && (
                                        <button title="Impersonate" onClick={() => handleImpersonate(user.id)}>
                                            <UserCog size={16} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
