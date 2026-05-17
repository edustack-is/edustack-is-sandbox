import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSystemSchools, createSystemSchool, updateSystemSchool, deleteSystemSchool, getUsers } from '../api';
import { toast } from 'sonner';
import { useSchool } from '@/context/SchoolContext';
import { LogIn, Settings, Trash2, ChevronDown, Crown, Shield, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

// ---- Types ----
interface SchoolMember {
    role: string;
    user: { id: string; email: string; firstName: string; lastName: string };
}

interface School {
    id: string;
    name: string;
    address: string | null;
    requireSsoEmailMatch?: boolean;
    createdAt: string;
    members?: SchoolMember[];
}

interface UserOption {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
}

interface UsersResponse {
    data: UserOption[];
    total: number;
}

// ---- Zod Schemas ----
const createSchoolSchema = z.discriminatedUnion('principalType', [
    z.object({
        schoolName: z.string().min(1, 'School name is required'),
        address: z.string().optional(),
        principalType: z.literal('EXISTING'),
        userId: z.string().min(1, 'Please select a user'),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().optional(),
    }),
    z.object({
        schoolName: z.string().min(1, 'School name is required'),
        address: z.string().optional(),
        principalType: z.literal('NEW'),
        userId: z.string().optional(),
        firstName: z.string().min(1, 'First name is required'),
        lastName: z.string().min(1, 'Last name is required'),
        email: z.string().email('Invalid email'),
    }),
]);

const editSchoolSchema = z
    .object({
        name: z.string().min(1, 'School name is required'),
        address: z.string().optional(),
        requireSsoEmailMatch: z.boolean(),
        hasPrincipalChange: z.boolean(),
        principalType: z.enum(['EXISTING', 'NEW']).optional(),
        userId: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.hasPrincipalChange) {
            if (data.principalType === 'EXISTING' && (!data.userId || data.userId.length === 0)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please select a user', path: ['userId'] });
            }
            if (data.principalType === 'NEW') {
                if (!data.firstName || data.firstName.length === 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'First name is required',
                        path: ['firstName'],
                    });
                }
                if (!data.lastName || data.lastName.length === 0) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Last name is required', path: ['lastName'] });
                }
                if (!data.email || !z.string().email().safeParse(data.email).success) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid email is required', path: ['email'] });
                }
            }
        }
    });

type CreateSchoolFormValues = z.infer<typeof createSchoolSchema>;
type EditSchoolFormValues = z.infer<typeof editSchoolSchema>;

// ---- Component ----
export function SystemAdminSchools() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { selectSchool } = useSchool();
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingSchool, setEditingSchool] = useState<School | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [selecting, setSelecting] = useState<string | null>(null);

    // User search state
    const [users, setUsers] = useState<UserOption[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [editUserSearch, setEditUserSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
    const [selectedEditUser, setSelectedEditUser] = useState<UserOption | null>(null);

    // Delete state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingSchool, setDeletingSchool] = useState<School | null>(null);
    const [deleteConfirmName, setDeleteConfirmName] = useState('');
    const [deleting, setDeleting] = useState(false);

    const form = useForm<CreateSchoolFormValues>({
        resolver: zodResolver(createSchoolSchema),
        defaultValues: {
            schoolName: '',
            address: '',
            principalType: 'NEW',
            userId: '',
            firstName: '',
            lastName: '',
            email: '',
        },
    });

    const editForm = useForm<EditSchoolFormValues>({
        resolver: zodResolver(editSchoolSchema),
        defaultValues: {
            name: '',
            address: '',
            hasPrincipalChange: false,
            principalType: 'EXISTING',
            userId: '',
            firstName: '',
            lastName: '',
            email: '',
        },
    });

    const principalType = form.watch('principalType');
    const editHasPrincipalChange = editForm.watch('hasPrincipalChange');
    const editPrincipalType = editForm.watch('principalType');

    const fetchSchools = async () => {
        setLoading(true);
        try {
            const data = await getSystemSchools();
            setSchools(data);
        } catch (err) {
            console.error('Failed to load schools', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async (search: string, setTarget: (users: UserOption[]) => void) => {
        try {
            const data = (await getUsers({ limit: 20 })) as unknown as UsersResponse;
            const list = data.data || [];
            setTarget(
                list.filter(
                    (u: UserOption) =>
                        u.email.toLowerCase().includes(search.toLowerCase()) ||
                        `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()),
                ),
            );
        } catch (err) {
            console.error('Failed to load users', err);
        }
    };

    useEffect(() => {
        fetchSchools();
    }, []);

    useEffect(() => {
        if (principalType === 'EXISTING') {
            fetchUsers(userSearch, setUsers);
        }
    }, [userSearch, principalType]);

    useEffect(() => {
        if (editHasPrincipalChange && editPrincipalType === 'EXISTING') {
            fetchUsers(editUserSearch, setUsers);
        }
    }, [editUserSearch, editHasPrincipalChange, editPrincipalType]);

    const onSubmit = async (values: CreateSchoolFormValues) => {
        setSubmitting(true);
        try {
            const payload =
                values.principalType === 'EXISTING'
                    ? {
                          schoolName: values.schoolName,
                          address: values.address,
                          admin: { type: 'EXISTING' as const, userId: values.userId! },
                      }
                    : {
                          schoolName: values.schoolName,
                          address: values.address,
                          admin: {
                              type: 'NEW' as const,
                              firstName: values.firstName!,
                              lastName: values.lastName!,
                              email: values.email!,
                          },
                      };
            await createSystemSchool(payload);
            setDialogOpen(false);
            form.reset();
            setSelectedUser(null);
            await fetchSchools();
        } catch (err) {
            const error = err as { response?: { data?: { message?: string } } };
            console.error('Failed to create school', error);
            toast.error(error.response?.data?.message || t('system_schools.failed_create'));
        } finally {
            setSubmitting(false);
        }
    };

    const onUpdate = async (values: EditSchoolFormValues) => {
        if (!editingSchool) return;
        setSubmitting(true);
        try {
            const payload: {
                name: string;
                address?: string;
                requireSsoEmailMatch: boolean;
                admin?:
                    | { type: 'EXISTING'; userId: string }
                    | { type: 'NEW'; firstName: string; lastName: string; email: string };
            } = {
                name: values.name,
                address: values.address,
                requireSsoEmailMatch: values.requireSsoEmailMatch,
            };

            if (values.hasPrincipalChange) {
                payload.admin =
                    values.principalType === 'EXISTING'
                        ? { type: 'EXISTING', userId: values.userId! }
                        : {
                              type: 'NEW',
                              firstName: values.firstName!,
                              lastName: values.lastName!,
                              email: values.email!,
                          };
            }

            await updateSystemSchool(editingSchool.id, payload);
            setEditDialogOpen(false);
            setEditingSchool(null);
            setSelectedEditUser(null);
            toast.success(t('system_schools.updated_success'));
            await fetchSchools();
        } catch (err) {
            const error = err as { response?: { data?: { message?: string } }; message: string };
            console.error('Failed to update school', error);
            toast.error(t('system_schools.failed_update') + ': ' + (error.response?.data?.message || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        setDialogOpen(open);
        if (!open) {
            form.reset();
            setSelectedUser(null);
        }
    };

    const handleEditOpenChange = (open: boolean) => {
        setEditDialogOpen(open);
        if (!open) {
            setEditingSchool(null);
            setSelectedEditUser(null);
            editForm.reset();
        }
    };

    const startEditing = (school: School) => {
        setEditingSchool(school);
        editForm.reset({
            name: school.name,
            address: school.address || '',
            requireSsoEmailMatch: school.requireSsoEmailMatch ?? false,
            hasPrincipalChange: false,
        });
        setEditDialogOpen(true);
    };

    const handleSelectSchool = async (schoolId: string, role: string) => {
        setSelecting(schoolId);
        try {
            navigate('/dashboard');
            await selectSchool(schoolId, role);
        } catch (err) {
            const error = err as { response?: { data?: { message?: string } }; message: string };
            toast.error(t('system_schools.failed_select') + ': ' + (error.response?.data?.message || error.message));
        } finally {
            setSelecting(null);
        }
    };

    const handleDeleteSchool = async () => {
        if (!deletingSchool) return;
        setDeleting(true);
        try {
            await deleteSystemSchool(deletingSchool.id);
            toast.success(t('system_schools.deleted_success', { name: deletingSchool.name }));
            setDeleteDialogOpen(false);
            setDeletingSchool(null);
            setDeleteConfirmName('');
            await fetchSchools();
        } catch (err) {
            const error = err as { response?: { data?: { message?: string } }; message: string };
            toast.error(
                t('system_schools.failed_delete', 'Smazání školy selhalo') +
                    ': ' +
                    (error.response?.data?.message || error.message),
            );
        } finally {
            setDeleting(false);
        }
    };

    // Helper to render member names grouped by role
    const renderMembers = (members?: SchoolMember[]) => {
        if (!members || members.length === 0) return <span className="text-muted-foreground">—</span>;

        const principals = members.filter((m) => m.role === 'PRINCIPAL');
        const deputies = members.filter((m) => m.role === 'DEPUTY');

        return (
            <div className="space-y-1">
                {principals.map((m) => (
                    <div key={m.user.id} className="flex items-center gap-1.5">
                        <Crown size={14} className="text-amber-500 shrink-0" />
                        <span className="text-sm font-medium">
                            {m.user.firstName} {m.user.lastName}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {t('system_schools.role_principal', 'Ředitel')}
                        </Badge>
                    </div>
                ))}
                {deputies.map((m) => (
                    <div key={m.user.id} className="flex items-center gap-1.5">
                        <Shield size={14} className="text-primary shrink-0" />
                        <span className="text-sm">
                            {m.user.firstName} {m.user.lastName}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {t('roles.DEPUTY')}
                        </Badge>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t('system_schools.title')}</h1>
                    <p className="text-muted-foreground">{t('system_schools.subtitle')}</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
                    <DialogTrigger asChild>
                        <Button className="gap-2" data-testid="create-school-btn">
                            <Plus size={16} />
                            {t('system_schools.create_new')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[520px]">
                        <DialogHeader>
                            <DialogTitle>{t('system_schools.create_new')}</DialogTitle>
                            <DialogDescription>{t('system_schools.create_description')}</DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                                {/* School Info */}
                                <FormField
                                    control={form.control}
                                    name="schoolName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('system_schools.school_name')}</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Základní škola" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="address"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('system_schools.address')}</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Ulice 123, Praha" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Principal Section */}
                                <div className="space-y-3 rounded-lg border p-4">
                                    <Label className="text-sm font-semibold flex items-center gap-2">
                                        <Crown size={14} className="text-amber-500" />
                                        {t('system_schools.initial_principal')}
                                    </Label>
                                    <FormField
                                        control={form.control}
                                        name="principalType"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <RadioGroup
                                                        value={field.value}
                                                        onValueChange={(val: string) => {
                                                            field.onChange(val);
                                                            setSelectedUser(null);
                                                            form.setValue('userId', '');
                                                        }}
                                                        className="flex gap-4"
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="NEW" id="principal-new" />
                                                            <Label htmlFor="principal-new" className="cursor-pointer">
                                                                {t('system_schools.create_new_user')}
                                                            </Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="EXISTING" id="principal-existing" />
                                                            <Label
                                                                htmlFor="principal-existing"
                                                                className="cursor-pointer"
                                                            >
                                                                {t('system_schools.select_existing')}
                                                            </Label>
                                                        </div>
                                                    </RadioGroup>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {principalType === 'EXISTING' && (
                                        <div className="space-y-2">
                                            <FormField
                                                control={form.control}
                                                name="userId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{t('system_schools.search_user')}</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Input
                                                                    placeholder={t('system_schools.search_placeholder')}
                                                                    value={
                                                                        selectedUser
                                                                            ? `${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email})`
                                                                            : userSearch
                                                                    }
                                                                    onChange={(e) => {
                                                                        setUserSearch(e.target.value);
                                                                        setSelectedUser(null);
                                                                        field.onChange('');
                                                                    }}
                                                                    onFocus={() => {
                                                                        if (selectedUser) {
                                                                            setUserSearch('');
                                                                            setSelectedUser(null);
                                                                            field.onChange('');
                                                                        }
                                                                    }}
                                                                />
                                                                {!selectedUser && userSearch && users.length > 0 && (
                                                                    <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-md">
                                                                        {users.map((user) => (
                                                                            <button
                                                                                key={user.id}
                                                                                type="button"
                                                                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                                                                                onClick={() => {
                                                                                    setSelectedUser(user);
                                                                                    field.onChange(user.id);
                                                                                    setUserSearch('');
                                                                                }}
                                                                            >
                                                                                <span className="font-medium">
                                                                                    {user.firstName} {user.lastName}
                                                                                </span>
                                                                                <span className="text-muted-foreground">
                                                                                    {user.email}
                                                                                </span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    {principalType === 'NEW' && (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <FormField
                                                    control={form.control}
                                                    name="firstName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t('system_schools.first_name')}</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Jan" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="lastName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t('system_schools.last_name')}</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder={t(
                                                                        'common.last_name_placeholder',
                                                                        'Novák',
                                                                    )}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="email"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{t('common.email')}</FormLabel>
                                                        <FormControl>
                                                            <Input type="email" placeholder="jan@skola.cz" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                                        {t('common.cancel')}
                                    </Button>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? t('system_schools.creating') : t('system_schools.create_school')}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Edit School Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={handleEditOpenChange}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>{t('system_schools.edit_title')}</DialogTitle>
                        <DialogDescription>{t('system_schools.edit_description')}</DialogDescription>
                    </DialogHeader>
                    <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit(onUpdate)} className="space-y-4">
                            <FormField
                                control={editForm.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('system_schools.school_name')}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={editForm.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('system_schools.address')}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* SSO Email Match Toggle */}
                            <FormField
                                control={editForm.control}
                                name="requireSsoEmailMatch"
                                render={({ field }) => (
                                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-sm font-medium">
                                                {t('system_schools.require_sso_email_match')}
                                            </FormLabel>
                                            <p className="text-xs text-muted-foreground">
                                                {t('system_schools.require_sso_email_match_desc')}
                                            </p>
                                        </div>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            {/* Principal Change Section */}
                            <div className="space-y-3 rounded-lg border p-4">
                                <FormField
                                    control={editForm.control}
                                    name="hasPrincipalChange"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-2">
                                            <FormControl>
                                                <RadioGroup
                                                    value={field.value ? 'YES' : 'NO'}
                                                    onValueChange={(val) => {
                                                        const changing = val === 'YES';
                                                        field.onChange(changing);
                                                        if (changing) {
                                                            editForm.setValue('principalType', 'EXISTING');
                                                        }
                                                    }}
                                                    className="flex gap-4"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="NO" id="edit-principal-no" />
                                                        <Label htmlFor="edit-principal-no" className="cursor-pointer">
                                                            {t('system_schools.keep_principal')}
                                                        </Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="YES" id="edit-principal-yes" />
                                                        <Label htmlFor="edit-principal-yes" className="cursor-pointer">
                                                            {t('system_schools.change_principal')}
                                                        </Label>
                                                    </div>
                                                </RadioGroup>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                {editHasPrincipalChange && (
                                    <>
                                        <div className="pt-2">
                                            <FormField
                                                control={editForm.control}
                                                name="principalType"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <RadioGroup
                                                                value={field.value}
                                                                onValueChange={(val: string) => {
                                                                    field.onChange(val);
                                                                    setSelectedEditUser(null);
                                                                    editForm.setValue('userId', '');
                                                                }}
                                                                className="flex gap-4"
                                                            >
                                                                <div className="flex items-center space-x-2">
                                                                    <RadioGroupItem
                                                                        value="EXISTING"
                                                                        id="edit-principal-existing"
                                                                    />
                                                                    <Label
                                                                        htmlFor="edit-principal-existing"
                                                                        className="text-xs cursor-pointer"
                                                                    >
                                                                        {t('system_schools.ex_user')}
                                                                    </Label>
                                                                </div>
                                                                <div className="flex items-center space-x-2">
                                                                    <RadioGroupItem
                                                                        value="NEW"
                                                                        id="edit-principal-new"
                                                                    />
                                                                    <Label
                                                                        htmlFor="edit-principal-new"
                                                                        className="text-xs cursor-pointer"
                                                                    >
                                                                        {t('system_schools.new_user')}
                                                                    </Label>
                                                                </div>
                                                            </RadioGroup>
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        {editPrincipalType === 'EXISTING' && (
                                            <FormField
                                                control={editForm.control}
                                                name="userId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">
                                                            {t('system_schools.search_user')}
                                                        </FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Input
                                                                    className="h-8"
                                                                    placeholder={t('system_schools.search_placeholder')}
                                                                    value={
                                                                        selectedEditUser
                                                                            ? `${selectedEditUser.firstName} ${selectedEditUser.lastName}`
                                                                            : editUserSearch
                                                                    }
                                                                    onChange={(e) => {
                                                                        setEditUserSearch(e.target.value);
                                                                        setSelectedEditUser(null);
                                                                        field.onChange('');
                                                                    }}
                                                                />
                                                                {!selectedEditUser &&
                                                                    editUserSearch &&
                                                                    users.length > 0 && (
                                                                        <div className="absolute z-10 mt-1 max-h-32 w-full overflow-auto rounded-md border bg-popover shadow-md">
                                                                            {users.map((user) => (
                                                                                <button
                                                                                    key={user.id}
                                                                                    type="button"
                                                                                    className="flex w-full items-center gap-2 px-2 py-1 text-xs hover:bg-accent"
                                                                                    onClick={() => {
                                                                                        setSelectedEditUser(user);
                                                                                        field.onChange(user.id);
                                                                                        setEditUserSearch('');
                                                                                    }}
                                                                                >
                                                                                    {user.firstName} {user.lastName} (
                                                                                    {user.email})
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                            </div>
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        )}

                                        {editPrincipalType === 'NEW' && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <FormField
                                                    control={editForm.control}
                                                    name="firstName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-xs">
                                                                {t('system_schools.first_name')}
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input className="h-8" {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={editForm.control}
                                                    name="lastName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-xs">
                                                                {t('system_schools.last_name')}
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input className="h-8" {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <div className="col-span-2">
                                                    <FormField
                                                        control={editForm.control}
                                                        name="email"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs">
                                                                    {t('common.email')}
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input className="h-8" type="email" {...field} />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => handleEditOpenChange(false)}>
                                    {t('common.cancel')}
                                </Button>
                                <Button type="submit" disabled={submitting}>
                                    {submitting ? t('system_schools.updating') : t('system_schools.save_changes')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Schools Table */}
            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('system_schools.school_name_column')}</TableHead>
                            <TableHead>{t('system_schools.address_column')}</TableHead>
                            <TableHead>{t('system_schools.leadership_column')}</TableHead>
                            <TableHead>{t('system_schools.created_at_column')}</TableHead>
                            <TableHead className="text-right">{t('system_schools.actions_column')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    {t('common.loading')}
                                </TableCell>
                            </TableRow>
                        ) : schools.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    {t('system_schools.no_schools')}
                                </TableCell>
                            </TableRow>
                        ) : (
                            schools.map((school) => (
                                <TableRow key={school.id}>
                                    <TableCell className="font-medium">{school.name}</TableCell>
                                    <TableCell>{school.address || '—'}</TableCell>
                                    <TableCell>{renderMembers(school.members)}</TableCell>
                                    <TableCell>{new Date(school.createdAt).toLocaleDateString('cs-CZ')}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => startEditing(school)}
                                                className="h-8 w-8 p-0"
                                            >
                                                <Settings className="h-4 w-4" />
                                                <span className="sr-only">{t('system_schools.edit_settings')}</span>
                                            </Button>

                                            {/* Role-based school entry dropdown */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 gap-1"
                                                        disabled={selecting === school.id}
                                                    >
                                                        <LogIn className="h-3.5 w-3.5" />
                                                        {selecting === school.id
                                                            ? t('select_school.entering')
                                                            : t('system_schools.enter_school')}
                                                        <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel className="text-xs">
                                                        {t('system_schools.enter_as')}
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => handleSelectSchool(school.id, 'ADMIN')}
                                                    >
                                                        <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                                                        {t('select_school.enter_as_admin')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleSelectSchool(school.id, 'PRINCIPAL')}
                                                    >
                                                        <Crown className="mr-2 h-4 w-4 text-amber-500" />
                                                        {t('select_school.enter_as_principal')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleSelectSchool(school.id, 'DEPUTY')}
                                                    >
                                                        <Shield className="mr-2 h-4 w-4 text-blue-500" />
                                                        {t('select_school.enter_as_deputy')}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setDeletingSchool(school);
                                                    setDeleteConfirmName('');
                                                    setDeleteDialogOpen(true);
                                                }}
                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">{t('common.delete')}</span>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={(open: boolean) => {
                    setDeleteDialogOpen(open);
                    if (!open) {
                        setDeletingSchool(null);
                        setDeleteConfirmName('');
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('system_schools.delete_title')}</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                            <span className="block">
                                {t(
                                    'system_schools.delete_warning',
                                    t(
                                        'system_schools.delete_irreversible_warning',
                                        'Tato akce je nevratná. Budou smazána VŠECHNA data školy včetně uživatelů, tříd, známek, rozvrhů a docházky.',
                                    ),
                                )}
                            </span>
                            <span className="block font-medium text-foreground">
                                {t('system_schools.delete_confirm_prompt', 'Pro potvrzení napište název školy:')}{' '}
                                <span className="font-bold">{deletingSchool?.name}</span>
                            </span>
                            <Input
                                value={deleteConfirmName}
                                onChange={(e) => setDeleteConfirmName(e.target.value)}
                                placeholder={deletingSchool?.name || ''}
                                className="mt-2"
                            />
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteSchool}
                            disabled={deleting || deleteConfirmName !== deletingSchool?.name}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? t('common.deleting', 'Mazání...') : t('system_schools.delete_title')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
