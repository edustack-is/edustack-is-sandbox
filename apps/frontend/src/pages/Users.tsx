import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { ColumnDef } from '@tanstack/react-table';
import { UserCog, Send, Plus, Trash2, GraduationCap, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { getUsers } from '../api';
import {
    getDeputyUsers, createStudentFamily, createStaff, resendInvitation,
    removeSchoolUser, setUserAlumni, impersonateSchoolUser,
} from '../api/deputy';

import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ─── Types ──────────────────────────────────────────────────────

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

const roleBadgeVariant = (role: string) => {
    switch (role) {
        case 'STUDENT': return 'default';
        case 'TEACHER': return 'secondary';
        case 'DEPUTY': return 'outline';
        case 'PRINCIPAL': return 'outline';
        case 'PARENT': return 'secondary';
        default: return 'default';
    }
};

const statusBadgeVariant = (status: string) => {
    switch (status) {
        case 'ACTIVE': return 'default';
        case 'PENDING': return 'secondary';
        case 'ALUMNI': return 'outline';
        default: return 'secondary';
    }
};

// ─── Component ──────────────────────────────────────────────────

export default function Users() {
    const { t } = useTranslation();
    const [users, setUsers] = useState<SchoolUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('student');
    const [submitting, setSubmitting] = useState(false);

    // Confirm dialogs
    const [removeTarget, setRemoveTarget] = useState<SchoolUser | null>(null);
    const [alumniTarget, setAlumniTarget] = useState<SchoolUser | null>(null);
    const [removing, setRemoving] = useState(false);
    const [settingAlumni, setSettingAlumni] = useState(false);

    // ── Student + Family form ──────────────────────────────
    const studentForm = useForm<StudentFamilyFormData>({
        defaultValues: {
            student: { firstName: '', lastName: '', email: '' },
            parents: [],
        },
    });

    const { fields: parentFields, append: addParent, remove: removeParent } = useFieldArray({
        control: studentForm.control,
        name: 'parents',
    });

    // ── Staff form ─────────────────────────────────────────
    const staffForm = useForm<StaffFormData>({
        defaultValues: {
            firstName: '', lastName: '', email: '',
            role: 'TEACHER', workloadPercentage: '1.0',
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
                    setUsers(fallback.data.map((u: any) => ({
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
                    })));
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

    useEffect(() => { loadUsers(); }, []);

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
            window.location.reload();
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
            id: 'actions',
            header: t('common.actions'),
            cell: ({ row }) => (
                <div className="flex gap-1">
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

                    {/* Impersonate — only active students/teachers/parents */}
                    {row.original.status === 'ACTIVE' &&
                        !['PRINCIPAL', 'DEPUTY'].includes(row.original.role) && (
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
                    {row.original.role === 'STUDENT' &&
                        row.original.status === 'ACTIVE' && (
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
                    {row.original.role !== 'PRINCIPAL' &&
                        row.original.status !== 'ARCHIVED' && (
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
                <Button onClick={() => { setDialogOpen(true); setActiveTab('student'); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('users_page.add_user')}
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">{t('common.loading')}</div>
            ) : (
                <DataTable columns={columns} data={users} />
            )}

            {/* ─── Add User Dialog ──────────────────────────── */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t('users_page.add_dialog_title')}</DialogTitle>
                        <DialogDescription>
                            {t('users_page.add_dialog_description')}
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="student">{t('users_page.tab_student')}</TabsTrigger>
                            <TabsTrigger value="staff">{t('users_page.tab_staff')}</TabsTrigger>
                        </TabsList>

                        {/* ── Tab: Student + Parents ──────────── */}
                        <TabsContent value="student" className="space-y-6 mt-4">
                            <form onSubmit={handleStudentSubmit}>
                                {/* Student section */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('users_page.student_section')}</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="student-firstName">{t('users_page.first_name_required')}</Label>
                                            <Input id="student-firstName" placeholder="Jan"
                                                {...studentForm.register('student.firstName')} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="student-lastName">{t('users_page.last_name_required')}</Label>
                                            <Input id="student-lastName" placeholder="Novák"
                                                {...studentForm.register('student.lastName')} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="student-email">{t('users_page.email_optional')}</Label>
                                        <Input id="student-email" type="email" placeholder="jan.novak@skola.cz"
                                            {...studentForm.register('student.email')} />
                                    </div>
                                </div>

                                {/* Parents section */}
                                <div className="space-y-4 mt-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                            {t('users_page.legal_guardians')}
                                        </h3>
                                        <Button type="button" variant="outline" size="sm"
                                            onClick={() => addParent({ firstName: '', lastName: '', email: '', phone: '' })}>
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
                                                <span className="text-sm font-medium">{t('users_page.parent_number', { number: index + 1 })}</span>
                                                <Button type="button" variant="ghost" size="icon"
                                                    onClick={() => removeParent(index)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label>{t('users_page.first_name_required')}</Label>
                                                    <Input placeholder="Jana"
                                                        {...studentForm.register(`parents.${index}.firstName`)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>{t('users_page.last_name_required')}</Label>
                                                    <Input placeholder="Nováková"
                                                        {...studentForm.register(`parents.${index}.lastName`)} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label>{t('users_page.email_required')}</Label>
                                                    <Input type="email" placeholder="jana@email.cz"
                                                        {...studentForm.register(`parents.${index}.email`)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>{t('common.phone')}</Label>
                                                    <Input type="tel" placeholder="+420 ..."
                                                        {...studentForm.register(`parents.${index}.phone`)} />
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
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('users_page.employee_section')}</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="staff-firstName">{t('users_page.first_name_required')}</Label>
                                            <Input id="staff-firstName" placeholder="Petr"
                                                {...staffForm.register('firstName')} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="staff-lastName">{t('users_page.last_name_required')}</Label>
                                            <Input id="staff-lastName" placeholder="Svoboda"
                                                {...staffForm.register('lastName')} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="staff-email">{t('users_page.email_required')}</Label>
                                        <Input id="staff-email" type="email" placeholder="petr.svoboda@skola.cz"
                                            {...staffForm.register('email')} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>{t('users_page.role_required')}</Label>
                                            <Select
                                                value={staffForm.watch('role')}
                                                onValueChange={(val) => staffForm.setValue('role', val as 'TEACHER' | 'DEPUTY')}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="TEACHER">{t('users_page.role_teacher')}</SelectItem>
                                                    <SelectItem value="DEPUTY">{t('users_page.role_deputy')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="staff-workload">{t('users_page.workload')}</Label>
                                            <Input id="staff-workload" type="number" step="0.1" min="0.1" max="1.0"
                                                placeholder="1.0"
                                                {...staffForm.register('workloadPercentage')} />
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
                        <AlertDialogAction
                            onClick={handleSetAlumni}
                            disabled={settingAlumni}
                        >
                            {settingAlumni ? t('common.saving') : t('users_page.confirm_alumni')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
