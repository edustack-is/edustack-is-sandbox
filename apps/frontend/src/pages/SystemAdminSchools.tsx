import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSystemSchools, createSystemSchool, getUsers } from '../api';

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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';

// ---- Types ----
interface School {
    id: string;
    name: string;
    address: string | null;
    createdAt: string;
    members?: { user: { id: string; email: string; firstName: string; lastName: string } }[];
}

interface UserOption {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
}

// ---- Zod Schema ----
const createSchoolSchema = z.discriminatedUnion('adminType', [
    z.object({
        schoolName: z.string().min(1, 'School name is required'),
        address: z.string().optional(),
        adminType: z.literal('EXISTING'),
        userId: z.string().min(1, 'Please select a user'),
        // Unused but needed for type safety
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().optional(),
    }),
    z.object({
        schoolName: z.string().min(1, 'School name is required'),
        address: z.string().optional(),
        adminType: z.literal('NEW'),
        userId: z.string().optional(),
        firstName: z.string().min(1, 'First name is required'),
        lastName: z.string().min(1, 'Last name is required'),
        email: z.string().email('Invalid email'),
    }),
]);

type CreateSchoolFormValues = z.infer<typeof createSchoolSchema>;

// ---- Component ----
export function SystemAdminSchools() {
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // User search state
    const [users, setUsers] = useState<UserOption[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);

    const form = useForm<CreateSchoolFormValues>({
        resolver: zodResolver(createSchoolSchema),
        defaultValues: {
            schoolName: '',
            address: '',
            adminType: 'EXISTING',
            userId: '',
            firstName: '',
            lastName: '',
            email: '',
        },
    });

    const adminType = form.watch('adminType');

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

    const fetchUsers = async (search: string) => {
        try {
            const data = await getUsers({ limit: 20 });
            // data may be { data: UserOption[] } or UserOption[]
            const list = Array.isArray(data) ? data : data.data || [];
            setUsers(
                list.filter(
                    (u: UserOption) =>
                        u.email.toLowerCase().includes(search.toLowerCase()) ||
                        `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase())
                )
            );
        } catch (err) {
            console.error('Failed to load users', err);
        }
    };

    useEffect(() => {
        fetchSchools();
    }, []);

    useEffect(() => {
        fetchUsers(userSearch);
    }, [userSearch]);

    const onSubmit = async (values: CreateSchoolFormValues) => {
        setSubmitting(true);
        try {
            const payload =
                values.adminType === 'EXISTING'
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
        } catch (err: any) {
            console.error('Failed to create school', err);
            alert(err?.response?.data?.message || 'Failed to create school');
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Schools Management</h1>
                    <p className="text-muted-foreground">Manage all schools in the system</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M5 12h14" />
                                <path d="M12 5v14" />
                            </svg>
                            Create New School
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[520px]">
                        <DialogHeader>
                            <DialogTitle>Create New School</DialogTitle>
                            <DialogDescription>
                                Create a new school and assign an initial administrator.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                                {/* School Info */}
                                <FormField
                                    control={form.control}
                                    name="schoolName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>School Name</FormLabel>
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
                                            <FormLabel>Address</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Ulice 123, Praha" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Admin Section */}
                                <div className="space-y-3 rounded-lg border p-4">
                                    <Label className="text-sm font-semibold">Initial School Administrator</Label>
                                    <FormField
                                        control={form.control}
                                        name="adminType"
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
                                                            <RadioGroupItem value="EXISTING" id="admin-existing" />
                                                            <Label htmlFor="admin-existing" className="cursor-pointer">
                                                                Select Existing User
                                                            </Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="NEW" id="admin-new" />
                                                            <Label htmlFor="admin-new" className="cursor-pointer">
                                                                Create New User
                                                            </Label>
                                                        </div>
                                                    </RadioGroup>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {adminType === 'EXISTING' && (
                                        <div className="space-y-2">
                                            <FormField
                                                control={form.control}
                                                name="userId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Search User</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Input
                                                                    placeholder="Type to search by name or email..."
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

                                    {adminType === 'NEW' && (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <FormField
                                                    control={form.control}
                                                    name="firstName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>First Name</FormLabel>
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
                                                            <FormLabel>Last Name</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Novák" {...field} />
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
                                                        <FormLabel>Email</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="email"
                                                                placeholder="jan@skola.cz"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}
                                </div>

                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => handleOpenChange(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? 'Creating...' : 'Create School'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Schools Table */}
            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>School Name</TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>Admin(s)</TableHead>
                            <TableHead>Created At</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : schools.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    No schools yet. Create your first one.
                                </TableCell>
                            </TableRow>
                        ) : (
                            schools.map((school) => (
                                <TableRow key={school.id}>
                                    <TableCell className="font-medium">{school.name}</TableCell>
                                    <TableCell>{school.address || '—'}</TableCell>
                                    <TableCell>
                                        {school.members && school.members.length > 0
                                            ? school.members
                                                .map(
                                                    (m) =>
                                                        `${m.user.firstName} ${m.user.lastName}`
                                                )
                                                .join(', ')
                                            : '—'}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(school.createdAt).toLocaleDateString('cs-CZ')}
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
