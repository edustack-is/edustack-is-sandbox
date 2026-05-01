import { useEffect, useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { ColumnDef } from '@tanstack/react-table';
import {
    UserCog,
    Send,
    Plus,
    Trash2,
    GraduationCap,
    UserMinus,
    Filter,
    Users2,
    Link2,
    Pencil,
    Ban,
    ShieldCheck,
    Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { getUsers, api } from '../api';
import {
    getDeputyUsers,
    createStudentFamily,
    createStaff,
    resendInvitation,
    removeSchoolUser,
    setUserAlumni,
    impersonateSchoolUser,
    updateSchoolUser,
    suspendUser,
    reactivateUser,
    changeUserRole,
    exportUsersCSV,
} from '../api/deputy';

import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

// ─── Types ──────────────────────────────────────────────────────

interface RelatedPerson {
    id: string;
    name: string;
}

interface SchoolUser {
    id: string;
    membershipId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
    workloadPercentage: number | null;
    lastLogin: string | null;
    createdAt: string;
    classroomName?: string | null;
    classroomId?: string | null;
    homeroomClassName?: string | null;
    teacherProfileId?: string | null;
    parents?: RelatedPerson[];
    children?: RelatedPerson[];
}

interface StudentFamilyFormData {
    student: { firstName: string; lastName: string; email: string };
    parents: Array<{ firstName: string; lastName: string; email: string; phone: string }>;
}

interface StaffFormData {
    firstName: string;
    lastName: string;
    email: string;
    role: 'TEACHER' | 'DEPUTY';
    workloadPercentage: string;
}

// ─── Role & Status Badge helpers ────────────────────────────────

function roleBadgeVariant(role: string) {
    switch (role) {
        case 'PRINCIPAL':
            return 'default';
        case 'DEPUTY':
            return 'default';
        case 'TEACHER':
            return 'secondary';
        case 'STUDENT':
            return 'outline';
        case 'PARENT':
            return 'outline';
        default:
            return 'outline';
    }
}

function statusBadgeVariant(status: string) {
    switch (status) {
        case 'ACTIVE':
            return 'default';
        case 'PENDING':
            return 'secondary';
        case 'SUSPENDED':
            return 'secondary';
        case 'ARCHIVED':
            return 'destructive';
        default:
            return 'outline';
    }
}

// ─── Component ──────────────────────────────────────────────────

export default function Users() {
    const { t } = useTranslation();
    const [users, setUsers] = useState<SchoolUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);

    // ─── Tab Persistence ────────────────────────────────────
    const [activeTab, setActiveTab] = useState(() => {
        const hash = window.location.hash.replace('#', '');
        return ['student', 'staff'].includes(hash) ? hash : 'student';
    });

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        window.location.hash = value;
    };

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '');
            if (['student', 'staff'].includes(hash)) {
                setActiveTab(hash);
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);
    // ────────────────────────────────────────────────────────

    const [submitting, setSubmitting] = useState(false);

    // Filters
    const [filterRole, setFilterRole] = useState<string>('ALL');
    const [filterClassroom, setFilterClassroom] = useState<string>('ALL');
    const [searchText, setSearchText] = useState('');

    // Confirm dialogs
    const [removeTarget, setRemoveTarget] = useState<SchoolUser | null>(null);
    const [alumniTarget, setAlumniTarget] = useState<SchoolUser | null>(null);
    const [removing, setRemoving] = useState(false);
    const [settingAlumni, setSettingAlumni] = useState(false);

    // Edit dialog
    const [editTarget, setEditTarget] = useState<SchoolUser | null>(null);
    const [editForm, setEditForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        workloadPercentage: '',
        role: '',
    });
    const [editSaving, setEditSaving] = useState(false);

    // Classrooms for filter
    const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);

    // ── Student + Family form ──────────────────────────────
    const studentForm = useForm<StudentFamilyFormData>({
        defaultValues: {
            student: { firstName: '', lastName: '', email: '' },
            parents: [],
        },
    });

    const {
        fields: parentFields,
        append: addParent,
        remove: removeParent,
    } = useFieldArray({
        control: studentForm.control,
        name: 'parents',
    });

    // ── Staff form ─────────────────────────────────────────
    const staffForm = useForm<StaffFormData>({
        defaultValues: {
            firstName: '',
            lastName: '',
            email: '',
            role: 'TEACHER',
            workloadPercentage: '1.0',
        },
    });

    // ── Load users ─────────────────────────────────────────
    const loadUsers = async () => {
        setLoading(true);
        try {
            const result = await getDeputyUsers();
            setUsers(result);
        } catch (error: any) {
            // Fall back to general /api/users if deputy endpoint returns 403
            if (error.response?.status === 403) {
                try {
                    const fallback = await getUsers({ limit: 100 });
                    setUsers(
                        fallback.data.map((u: any) => ({
                            id: u.id,
                            membershipId: '',
                            email: u.email,
                            firstName: u.firstName,
                            lastName: u.lastName,
                            role: u.role || '—',
                            status: u.status || '—',
                            workloadPercentage: null,
                            lastLogin: u.lastLogin,
                            createdAt: u.createdAt,
                        })),
                    );
                } catch (fallbackError) {
                    console.error(fallbackError);
                    toast.error(t('users_page.load_failed'));
                }
            } else {
                console.error(error);
                toast.error(t('users_page.load_failed'));
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
        api.get('/api/deputy/classrooms')
            .then((res) => setClassrooms(Array.isArray(res.data) ? res.data : []))
            .catch(() => setClassrooms([]));
    }, []);

    // ── Filtered data ──────────────────────────────────────
    const filteredUsers = useMemo(() => {
        let filtered = users;

        if (filterRole !== 'ALL') {
            filtered = filtered.filter((u) => u.role === filterRole);
        }

        if (filterClassroom !== 'ALL') {
            filtered = filtered.filter((u) => u.classroomId === filterClassroom);
        }

        if (searchText.trim()) {
            const q = searchText.trim().toLowerCase();
            filtered = filtered.filter(
                (u) =>
                    u.firstName.toLowerCase().includes(q) ||
                    u.lastName.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q),
            );
        }

        return filtered;
    }, [users, filterRole, filterClassroom, searchText]);

    // ── Impersonate (school-scoped) ────────────────────────
    const handleImpersonate = async (targetId: string) => {
        try {
            const currentToken = localStorage.getItem('access_token');
            if (!currentToken) {
                toast.error(t('users_page.impersonation_failed'));
                return;
            }
            const { access_token } = await impersonateSchoolUser(targetId);
            localStorage.setItem('original_admin_token', currentToken);
            localStorage.setItem('access_token', access_token);
            toast.success(t('users_page.impersonation_started'));
            // Navigate to dashboard after impersonation
            window.location.href = '/dashboard';
        } catch (error: any) {
            toast.error(t('users_page.impersonation_failed') + ': ' + (error.response?.data?.message || error.message));
        }
    };

    // ── Remove user ────────────────────────────────────────
    const handleRemoveUser = async () => {
        if (!removeTarget) return;
        setRemoving(true);
        try {
            await removeSchoolUser(removeTarget.id);
            toast.success(t('users_page.user_removed'));
            setRemoveTarget(null);
            loadUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setRemoving(false);
        }
    };

    // ── Set alumni ─────────────────────────────────────────
    const handleSetAlumni = async () => {
        if (!alumniTarget) return;
        setSettingAlumni(true);
        try {
            await setUserAlumni(alumniTarget.id);
            toast.success(t('users_page.alumni_set'));
            setAlumniTarget(null);
            loadUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setSettingAlumni(false);
        }
    };

    // ── Edit user ───────────────────────────────────────
    const openEditDialog = (user: SchoolUser) => {
        setEditTarget(user);
        setEditForm({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email.endsWith('@noemail.local') ? '' : user.email,
            workloadPercentage: user.workloadPercentage != null ? String(user.workloadPercentage) : '',
            role: user.role,
        });
    };

    const handleEditSave = async () => {
        if (!editTarget) return;
        setEditSaving(true);
        try {
            const data: any = {};
            if (editForm.firstName !== editTarget.firstName) data.firstName = editForm.firstName;
            if (editForm.lastName !== editTarget.lastName) data.lastName = editForm.lastName;
            const origEmail = editTarget.email.endsWith('@noemail.local') ? '' : editTarget.email;
            if (editForm.email && editForm.email !== origEmail) data.email = editForm.email;
            if (editForm.workloadPercentage) {
                const wp = parseFloat(editForm.workloadPercentage);
                if (!isNaN(wp) && wp !== editTarget.workloadPercentage) data.workloadPercentage = wp;
            }

            if (Object.keys(data).length > 0) {
                await updateSchoolUser(editTarget.id, data);
            }

            // Change role if different
            if (editForm.role !== editTarget.role && editForm.role !== 'PRINCIPAL') {
                await changeUserRole(editTarget.id, editForm.role);
            }

            toast.success(t('users_page.user_updated', 'Uživatel aktualizován'));
            setEditTarget(null);
            loadUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setEditSaving(false);
        }
    };

    // ── Suspend / Reactivate ─────────────────────────────
    const handleSuspend = async (userId: string) => {
        try {
            await suspendUser(userId);
            toast.success(t('users_page.user_suspended', 'Uživatel pozastaven'));
            loadUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const handleReactivate = async (userId: string) => {
        try {
            await reactivateUser(userId);
            toast.success(t('users_page.user_reactivated', 'Uživatel reaktivován'));
            loadUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    // ── CSV Export ───────────────────────────────────────
    const handleExport = async () => {
        try {
            const blob = await exportUsersCSV();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'uzivatele.csv';
            a.click();
            URL.revokeObjectURL(url);
            toast.success(t('users_page.export_done', 'Export stažen'));
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Export selhal');
        }
    };

    // ── Submit Student + Family ────────────────────────────
    const handleStudentSubmit = studentForm.handleSubmit(async (data) => {
        if (!data.student.firstName.trim() || !data.student.lastName.trim()) {
            toast.error(t('users_page.student_name_required'));
            return;
        }
        for (let i = 0; i < data.parents.length; i++) {
            const p = data.parents[i];
            if (!p.firstName.trim() || !p.lastName.trim() || !p.email.trim()) {
                toast.error(t('users_page.parent_fields_required', { number: i + 1 }));
                return;
            }
        }
        setSubmitting(true);
        try {
            await createStudentFamily({
                student: {
                    firstName: data.student.firstName,
                    lastName: data.student.lastName,
                    email: data.student.email || undefined,
                },
                parents: data.parents.map((p) => ({
                    firstName: p.firstName,
                    lastName: p.lastName,
                    email: p.email,
                    phone: p.phone || undefined,
                })),
            });
            setDialogOpen(false);
            studentForm.reset();
            loadUsers();
            toast.success(t('users_page.student_created'));
        } catch (error: any) {
            toast.error(t('common.error') + ': ' + (error.response?.data?.message || error.message));
        } finally {
            setSubmitting(false);
        }
    });

    // ── Submit Staff ──────────────────────────────────────
    const handleStaffSubmit = staffForm.handleSubmit(async (data) => {
        if (!data.firstName.trim() || !data.lastName.trim() || !data.email.trim()) {
            toast.error(t('users_page.staff_fields_required'));
            return;
        }
        const workload = parseFloat(data.workloadPercentage);
        if (isNaN(workload) || workload < 0.1 || workload > 1.0) {
            toast.error(t('users_page.workload_invalid'));
            return;
        }
        setSubmitting(true);
        try {
            await createStaff({
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                role: data.role,
                workloadPercentage: workload,
            });
            setDialogOpen(false);
            staffForm.reset();
            loadUsers();
            toast.success(t('users_page.employee_created'));
        } catch (error: any) {
            toast.error(t('common.error') + ': ' + (error.response?.data?.message || error.message));
        } finally {
            setSubmitting(false);
        }
    });

    // ── Resend Invitation ────────────────────────────────
    const handleResendInvitation = async (userId: string) => {
        try {
            await resendInvitation(userId);
            toast.success(t('users_page.invitation_resent'));
        } catch (error: any) {
            toast.error(t('users_page.invitation_failed') + ': ' + (error.response?.data?.message || error.message));
        }
    };

    // ── Unique roles in data ──────────────────────────────
    const uniqueRoles = useMemo(() => {
        const roles = new Set(users.map((u) => u.role));
        return Array.from(roles).sort();
    }, [users]);

    // ── Column definitions ─────────────────────────────────
    const columns: ColumnDef<SchoolUser>[] = [
        {
            accessorKey: 'lastName',
            header: t('common.name'),
            cell: ({ row }) => (
                <span className="font-medium">
                    {row.original.lastName} {row.original.firstName}
                </span>
            ),
        },
        {
            accessorKey: 'email',
            header: t('common.email'),
            cell: ({ row }) => (
                <span className={row.original.email.endsWith('@noemail.local') ? 'text-muted-foreground italic' : ''}>
                    {row.original.email.endsWith('@noemail.local') ? '—' : row.original.email}
                </span>
            ),
        },
        {
            accessorKey: 'role',
            header: t('common.role'),
            cell: ({ row }) => (
                <Badge variant={roleBadgeVariant(row.original.role) as any}>
                    {t(`roles.${row.original.role}`, row.original.role)}
                </Badge>
            ),
        },
        {
            accessorKey: 'status',
            header: t('common.status'),
            cell: ({ row }) => (
                <Badge variant={statusBadgeVariant(row.original.status) as any}>
                    {t(`statuses.${row.original.status}`, row.original.status)}
                </Badge>
            ),
        },
        {
            id: 'relations',
            header: 'Vazby',
            cell: ({ row }) => {
                const u = row.original;
                const parts: React.ReactNode[] = [];

                // Classroom for students
                if (u.role === 'STUDENT' && u.classroomName) {
                    parts.push(
                        <Badge key="cls" variant="outline" className="text-[10px] mr-1">
                            🏫 {u.classroomName}
                        </Badge>,
                    );
                }

                // Homeroom for teachers
                if (u.role === 'TEACHER' && u.homeroomClassName) {
                    parts.push(
                        <Badge key="hr" variant="outline" className="text-[10px] mr-1">
                            🏠 TÚ: {u.homeroomClassName}
                        </Badge>,
                    );
                }

                // Parents of student
                if (u.parents && u.parents.length > 0) {
                    parts.push(
                        <span key="parents" className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                            <Link2 className="h-3 w-3" />
                            {u.parents.map((p) => p.name).join(', ')}
                        </span>,
                    );
                }

                // Children of parent
                if (u.children && u.children.length > 0) {
                    parts.push(
                        <span key="children" className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                            <Users2 className="h-3 w-3" />
                            {u.children.map((c) => c.name).join(', ')}
                        </span>,
                    );
                }

                if (parts.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
                return <div className="flex flex-col gap-0.5">{parts}</div>;
            },
        },
        {
            id: 'actions',
            header: t('common.actions'),
            cell: ({ row }) => (
                <div className="flex gap-1">
                    {/* Edit */}
                    {row.original.role !== 'PRINCIPAL' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            title={t('users_page.edit_user', 'Upravit')}
                            onClick={() => openEditDialog(row.original)}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                    )}

                    {/* Resend invitation */}
                    {row.original.status === 'PENDING' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            title={t('users_page.resend_invitation')}
                            onClick={() => handleResendInvitation(row.original.id)}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    )}

                    {/* Suspend / Reactivate */}
                    {row.original.status === 'ACTIVE' && row.original.role !== 'PRINCIPAL' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            title={t('users_page.suspend', 'Pozastavit')}
                            onClick={() => handleSuspend(row.original.id)}
                        >
                            <Ban className="h-4 w-4 text-amber-600" />
                        </Button>
                    )}
                    {row.original.status === 'SUSPENDED' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            title={t('users_page.reactivate', 'Reaktivovat')}
                            onClick={() => handleReactivate(row.original.id)}
                        >
                            <ShieldCheck className="h-4 w-4 text-green-600" />
                        </Button>
                    )}

                    {/* Impersonate — only active students/teachers/parents */}
                    {row.original.status === 'ACTIVE' && !['PRINCIPAL', 'DEPUTY'].includes(row.original.role) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            title={t('users_page.impersonate')}
                            onClick={() => handleImpersonate(row.original.id)}
                        >
                            <UserCog className="h-4 w-4 text-amber-600" />
                        </Button>
                    )}

                    {/* Set as alumni — only active students */}
                    {row.original.role === 'STUDENT' && row.original.status === 'ACTIVE' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            title={t('users_page.set_alumni')}
                            onClick={() => setAlumniTarget(row.original)}
                        >
                            <GraduationCap className="h-4 w-4 text-blue-600" />
                        </Button>
                    )}

                    {/* Remove from school — anyone except PRINCIPAL */}
                    {row.original.role !== 'PRINCIPAL' && row.original.status !== 'ARCHIVED' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            title={t('users_page.remove_user')}
                            onClick={() => setRemoveTarget(row.original)}
                        >
                            <UserMinus className="h-4 w-4 text-destructive" />
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    // ── Render ──────────────────────────────────────────────
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t('users_page.title')}</h1>
                    <p className="text-muted-foreground">{t('users_page.subtitle')}</p>
                </div>
                <Button
                    onClick={() => {
                        setDialogOpen(true);
                    }}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('users_page.add_user')}
                </Button>
                <Button variant="outline" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    {t('users_page.export', 'Export CSV')}
                </Button>
            </div>

            {/* ─── Filters ─────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Hledat jméno / email…"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-52 h-8"
                    />
                </div>
                <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="w-40 h-8">
                        <SelectValue placeholder="Role…" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Všechny role</SelectItem>
                        {uniqueRoles.map((r) => (
                            <SelectItem key={r} value={r}>
                                {t(`roles.${r}`, r)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {(filterRole === 'STUDENT' || filterRole === 'ALL') && classrooms.length > 0 && (
                    <Select value={filterClassroom} onValueChange={setFilterClassroom}>
                        <SelectTrigger className="w-40 h-8">
                            <SelectValue placeholder="Třída…" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Všechny třídy</SelectItem>
                            {classrooms.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                {(filterRole !== 'ALL' || filterClassroom !== 'ALL' || searchText) && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                            setFilterRole('ALL');
                            setFilterClassroom('ALL');
                            setSearchText('');
                        }}
                    >
                        Vyčistit filtry
                    </Button>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                    {filteredUsers.length} / {users.length} uživatelů
                </span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                    {t('common.loading')}
                </div>
            ) : (
                <DataTable columns={columns} data={filteredUsers} pageSize={20} />
            )}

            {/* ─── Add User Dialog ──────────────────────────── */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t('users_page.add_dialog_title')}</DialogTitle>
                        <DialogDescription>{t('users_page.add_dialog_description')}</DialogDescription>
                    </DialogHeader>

                    <Tabs value={activeTab} onValueChange={handleTabChange}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="student">{t('users_page.tab_student')}</TabsTrigger>
                            <TabsTrigger value="staff">{t('users_page.tab_staff')}</TabsTrigger>
                        </TabsList>

                        {/* ── Tab: Student + Parents ──────────── */}
                        <TabsContent value="student" className="space-y-6 mt-4">
                            <form onSubmit={handleStudentSubmit}>
                                {/* Student section */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                        {t('users_page.student_section')}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="student-firstName">
                                                {t('users_page.first_name_required')}
                                            </Label>
                                            <Input
                                                id="student-firstName"
                                                placeholder="Jan"
                                                {...studentForm.register('student.firstName')}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="student-lastName">
                                                {t('users_page.last_name_required')}
                                            </Label>
                                            <Input
                                                id="student-lastName"
                                                placeholder="Novák"
                                                {...studentForm.register('student.lastName')}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="student-email">{t('users_page.email_optional')}</Label>
                                        <Input
                                            id="student-email"
                                            type="email"
                                            placeholder="jan.novak@skola.cz"
                                            {...studentForm.register('student.email')}
                                        />
                                    </div>
                                </div>

                                {/* Parents section */}
                                <div className="space-y-4 mt-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                            {t('users_page.legal_guardians')}
                                        </h3>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                addParent({ firstName: '', lastName: '', email: '', phone: '' })
                                            }
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> {t('users_page.add_parent')}
                                        </Button>
                                    </div>

                                    {parentFields.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic">
                                            {t('users_page.no_parents_added')}
                                        </p>
                                    )}

                                    {parentFields.map((field, index) => (
                                        <div key={field.id} className="rounded-lg border p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">
                                                    {t('users_page.parent_number', { number: index + 1 })}
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeParent(index)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label>{t('users_page.first_name_required')}</Label>
                                                    <Input
                                                        placeholder="Jana"
                                                        {...studentForm.register(`parents.${index}.firstName`)}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>{t('users_page.last_name_required')}</Label>
                                                    <Input
                                                        placeholder="Nováková"
                                                        {...studentForm.register(`parents.${index}.lastName`)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label>{t('users_page.email_required')}</Label>
                                                    <Input
                                                        type="email"
                                                        placeholder="jana@email.cz"
                                                        {...studentForm.register(`parents.${index}.email`)}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>{t('common.phone')}</Label>
                                                    <Input
                                                        type="tel"
                                                        placeholder="+420 ..."
                                                        {...studentForm.register(`parents.${index}.phone`)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <DialogFooter className="mt-6">
                                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                        {t('common.cancel')}
                                    </Button>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? t('common.saving') : t('users_page.create_student')}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </TabsContent>

                        {/* ── Tab: Staff ─────────────────────── */}
                        <TabsContent value="staff" className="space-y-6 mt-4">
                            <form onSubmit={handleStaffSubmit}>
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                        {t('users_page.employee_section')}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="staff-firstName">
                                                {t('users_page.first_name_required')}
                                            </Label>
                                            <Input
                                                id="staff-firstName"
                                                placeholder="Petr"
                                                {...staffForm.register('firstName')}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="staff-lastName">{t('users_page.last_name_required')}</Label>
                                            <Input
                                                id="staff-lastName"
                                                placeholder="Svoboda"
                                                {...staffForm.register('lastName')}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="staff-email">{t('users_page.email_required')}</Label>
                                        <Input
                                            id="staff-email"
                                            type="email"
                                            placeholder="petr.svoboda@skola.cz"
                                            {...staffForm.register('email')}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>{t('users_page.role_required')}</Label>
                                            <Select
                                                value={staffForm.watch('role')}
                                                onValueChange={(val) =>
                                                    staffForm.setValue('role', val as 'TEACHER' | 'DEPUTY')
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="TEACHER">
                                                        {t('users_page.role_teacher')}
                                                    </SelectItem>
                                                    <SelectItem value="DEPUTY">
                                                        {t('users_page.role_deputy')}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="staff-workload">{t('users_page.workload')}</Label>
                                            <Input
                                                id="staff-workload"
                                                type="number"
                                                step="0.1"
                                                min="0.1"
                                                max="1.0"
                                                placeholder="1.0"
                                                {...staffForm.register('workloadPercentage')}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter className="mt-6">
                                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                        {t('common.cancel')}
                                    </Button>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? t('common.saving') : t('users_page.create_employee')}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* ─── Remove User Confirm ───────────────────────── */}
            <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('users_page.remove_title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('users_page.remove_description', {
                                name: removeTarget ? `${removeTarget.firstName} ${removeTarget.lastName}` : '',
                                role: removeTarget ? t(`roles.${removeTarget.role}`, removeTarget.role) : '',
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveUser}
                            disabled={removing}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {removing ? t('common.saving') : t('users_page.confirm_remove')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── Alumni Confirm ────────────────────────────── */}
            <AlertDialog open={!!alumniTarget} onOpenChange={(open) => !open && setAlumniTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('users_page.alumni_title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('users_page.alumni_description', {
                                name: alumniTarget ? `${alumniTarget.firstName} ${alumniTarget.lastName}` : '',
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSetAlumni} disabled={settingAlumni}>
                            {settingAlumni ? t('common.saving') : t('users_page.confirm_alumni')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── Edit User Dialog ───────────────────────────── */}
            <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('users_page.edit_title', 'Upravit uživatele')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>{t('users_page.first_name_required')}</Label>
                                <Input
                                    value={editForm.firstName}
                                    onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>{t('users_page.last_name_required')}</Label>
                                <Input
                                    value={editForm.lastName}
                                    onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>{t('common.email')}</Label>
                            <Input
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>{t('common.role')}</Label>
                                <Select
                                    value={editForm.role}
                                    onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['TEACHER', 'STUDENT', 'DEPUTY', 'PARENT'].map((r) => (
                                            <SelectItem key={r} value={r}>
                                                {t(`roles.${r}`, r)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {['TEACHER', 'DEPUTY'].includes(editForm.role) && (
                                <div className="space-y-1">
                                    <Label>{t('users_page.workload')}</Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="1.0"
                                        value={editForm.workloadPercentage}
                                        onChange={(e) =>
                                            setEditForm((f) => ({ ...f, workloadPercentage: e.target.value }))
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditTarget(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            onClick={handleEditSave}
                            disabled={editSaving || !editForm.firstName || !editForm.lastName}
                        >
                            {editSaving ? t('common.saving') : t('common.save', 'Uložit')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
