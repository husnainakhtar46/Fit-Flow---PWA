import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import Pagination from '../components/Pagination';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../components/ui/dialog';

type EmailContact = {
    contact_name: string;
    email: string;
    email_type: 'to' | 'cc';
};

type CustomerForm = {
    name: string;
    emails: EmailContact[];
};

interface PaginatedResponse<T> {
    results: T[];
    count: number;
    next: string | null;
    previous: string | null;
}

const Customers = () => {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
    const [page, setPage] = useState(1);

    // Permissions
    const userType = localStorage.getItem('user_type');
    const isSuperUser = localStorage.getItem('is_superuser') === 'true';
    const canEdit = isSuperUser || userType === 'quality_head';

    const { register, control, handleSubmit, reset, formState: { errors } } = useForm<CustomerForm>({
        defaultValues: {
            name: '',
            emails: [{ contact_name: '', email: '', email_type: 'to' }]
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "emails"
    });

    const { data: customersData, isLoading, isPlaceholderData } = useQuery<PaginatedResponse<any>>({
        queryKey: ['customers', page],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            const res = await api.get(`/customers/?${params.toString()}`);
            return res.data;
        },
        placeholderData: (previousData) => previousData,
    });

    // Handle both paginated and non-paginated responses
    const customers = Array.isArray(customersData)
        ? customersData
        : (customersData?.results || []);

    const createMutation = useMutation({
        mutationFn: async (data: CustomerForm) => {
            // Validate at least one "To" email
            const hasToEmail = data.emails.some(e => e.email_type === 'to' && e.email.trim() !== '');
            if (!hasToEmail) {
                throw new Error('At least one "To" email is required');
            }

            // Create customer
            const res = await api.post('/customers/', { name: data.name });
            const customerId = res.data.id;

            // Add all emails
            for (const emailData of data.emails) {
                if (emailData.email.trim()) {
                    await api.post(`/customers/${customerId}/add_email/`, {
                        contact_name: emailData.contact_name,
                        email: emailData.email,
                        email_type: emailData.email_type
                    });
                }
            }

            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            setIsOpen(false);
            reset();
            toast.success('Customer created');
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to create customer');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/customers/${id}/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success('Customer deleted');
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (data: CustomerForm & { id: string }) => {
            const { id, ...updateData } = data;
            // Validate at least one "To" email
            const hasToEmail = updateData.emails.some(e => e.email_type === 'to' && e.email.trim() !== '');
            if (!hasToEmail) {
                throw new Error('At least one "To" email is required');
            }
            // Send everything to PATCH, backend handles sync
            const res = await api.patch(`/customers/${id}/`, updateData);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            setIsOpen(false);
            setEditingCustomer(null);
            reset({ name: '', emails: [{ contact_name: '', email: '', email_type: 'to' }] });
            toast.success('Customer updated');
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to update customer');
        }
    });

    const handleEdit = (customer: any) => {
        setEditingCustomer(customer);
        reset({
            name: customer.name,
            emails: customer.emails.length > 0 ? customer.emails : [{ contact_name: '', email: '', email_type: 'to' }]
        });
        setIsOpen(true);
    };

    const handleClose = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setEditingCustomer(null);
            reset({ name: '', emails: [{ contact_name: '', email: '', email_type: 'to' }] });
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Customers</h1>
                <Dialog open={isOpen} onOpenChange={handleClose}>
                    {canEdit && (
                        <DialogTrigger asChild>
                            <Button onClick={() => setEditingCustomer(null)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Customer
                            </Button>
                        </DialogTrigger>
                    )}
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit((data) => {
                            if (editingCustomer) {
                                updateMutation.mutate({ ...data, id: editingCustomer.id });
                            } else {
                                createMutation.mutate(data);
                            }
                        })} className="space-y-6 py-4">
                            <div className="space-y-2">
                                <Label>Customer Name</Label>
                                <Input {...register("name", { required: true })} placeholder="Enter customer name" />
                                {errors.name && <p className="text-sm text-red-600">Customer name is required</p>}
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <Label className="text-lg font-semibold">Email Contacts</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => append({ contact_name: '', email: '', email_type: 'to' })}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Email
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="border rounded-lg p-4 bg-gray-50 space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Contact Name (Optional)</Label>
                                                    <Input
                                                        {...register(`emails.${index}.contact_name`)}
                                                        placeholder="John Doe"
                                                        className="bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Email Address</Label>
                                                    <Input
                                                        {...register(`emails.${index}.email`, {
                                                            required: index === 0,
                                                            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                                                        })}
                                                        type="email"
                                                        placeholder="john@example.com"
                                                        className="bg-white"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <Label className="text-xs font-medium">Email Type:</Label>
                                                    <Controller
                                                        control={control}
                                                        name={`emails.${index}.email_type`}
                                                        render={({ field }) => (
                                                            <div className="flex items-center gap-4">
                                                                <label className="flex items-center gap-2 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        value="to"
                                                                        checked={field.value === 'to'}
                                                                        onChange={() => field.onChange('to')}
                                                                        className="w-4 h-4"
                                                                    />
                                                                    <span className="text-sm font-medium text-blue-600">To</span>
                                                                </label>
                                                                <label className="flex items-center gap-2 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        value="cc"
                                                                        checked={field.value === 'cc'}
                                                                        onChange={() => field.onChange('cc')}
                                                                        className="w-4 h-4"
                                                                    />
                                                                    <span className="text-sm font-medium text-gray-600">CC</span>
                                                                </label>
                                                            </div>
                                                        )}
                                                    />
                                                </div>
                                                {fields.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => remove(index)}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <p className="text-xs text-gray-500">
                                    * At least one "To" email is required. "To" recipients receive the email directly, while "CC" recipients receive a copy.
                                </p>
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={createMutation.isPending || updateMutation.isPending}
                            >
                                {createMutation.isPending || updateMutation.isPending
                                    ? 'Saving...'
                                    : (editingCustomer ? 'Update Customer' : 'Create Customer')}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead>Email Contacts</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {customers?.map((customer: any) => (
                            <TableRow key={customer.id}>
                                <TableCell className="font-medium">{customer.name}</TableCell>
                                <TableCell>{new Date(customer.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <div className="space-y-1">
                                        {customer.emails?.map((e: any) => (
                                            <div key={e.id} className="text-sm">
                                                {e.contact_name && <span className="font-medium">{e.contact_name} </span>}
                                                <span className="text-gray-600">&lt;{e.email}&gt;</span>
                                                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${e.email_type === 'to' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {e.email_type.toUpperCase()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {canEdit && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(customer)}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-700"
                                                    onClick={() => {
                                                        if (confirm('Are you sure?')) {
                                                            deleteMutation.mutate(customer.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {/* Pagination */}
                {!isLoading && customers.length > 0 && (
                    <Pagination
                        page={page}
                        hasNext={!!customersData?.next}
                        hasPrevious={!!customersData?.previous}
                        onPageChange={(newPage) => setPage(newPage)}
                        isLoading={isPlaceholderData}
                        totalCount={customersData?.count}
                        pageSize={10}
                    />
                )}
            </div>
        </div>
    );
};

export default Customers;
