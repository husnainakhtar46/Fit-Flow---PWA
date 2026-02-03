import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import Pagination from '../components/Pagination';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
import { useAuth } from '../lib/useAuth';

type FactoryForm = {
    name: string;
    address: string;
};

interface PaginatedResponse<T> {
    results: T[];
    count: number;
    next: string | null;
    previous: string | null;
}

const Factories = () => {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [editingFactory, setEditingFactory] = useState<any | null>(null);
    const [page, setPage] = useState(1);

    // Permissions (same as Customers for now - checking if user can view customers usually implies management access or read access)
    // Assuming we want similar permissions: Superuser or Quality Head can edit
    const { isSuperUser, userType } = useAuth();
    const canEdit = isSuperUser || userType === 'quality_head';

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FactoryForm>({
        defaultValues: {
            name: '',
            address: ''
        }
    });

    const { data: factoriesData, isLoading, isPlaceholderData } = useQuery<PaginatedResponse<any>>({
        queryKey: ['factories', page],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            const res = await api.get(`/factories/?${params.toString()}`);
            return res.data;
        },
        placeholderData: (previousData) => previousData,
    });

    const factories = factoriesData?.results || [];

    const createMutation = useMutation({
        mutationFn: async (data: FactoryForm) => {
            const res = await api.post('/factories/', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['factories'] });
            setIsOpen(false);
            reset();
            toast.success('Factory created');
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to create factory');
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (data: FactoryForm & { id: string }) => {
            const { id, ...updateData } = data;
            const res = await api.patch(`/factories/${id}/`, updateData);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['factories'] });
            setIsOpen(false);
            setEditingFactory(null);
            reset({ name: '', address: '' });
            toast.success('Factory updated');
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to update factory');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/factories/${id}/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['factories'] });
            toast.success('Factory deleted');
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to delete factory');
        }
    });

    const handleEdit = (factory: any) => {
        setEditingFactory(factory);
        reset({
            name: factory.name,
            address: factory.address
        });
        setIsOpen(true);
    };

    const handleClose = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setEditingFactory(null);
            reset({ name: '', address: '' });
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Factories</h1>
                <Dialog open={isOpen} onOpenChange={handleClose}>
                    {canEdit && (
                        <DialogTrigger asChild>
                            <Button onClick={() => setEditingFactory(null)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Factory
                            </Button>
                        </DialogTrigger>
                    )}
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>{editingFactory ? 'Edit Factory' : 'Add New Factory'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit((data) => {
                            if (editingFactory) {
                                updateMutation.mutate({ ...data, id: editingFactory.id });
                            } else {
                                createMutation.mutate(data);
                            }
                        })} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Factory Name</Label>
                                <Input {...register("name", { required: true })} placeholder="Enter factory name" />
                                {errors.name && <p className="text-sm text-red-600">Factory name is required</p>}
                            </div>

                            <div className="space-y-2">
                                <Label>Address (Optional)</Label>
                                <Textarea {...register("address")} placeholder="Factory address..." />
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={createMutation.isPending || updateMutation.isPending}
                            >
                                {createMutation.isPending || updateMutation.isPending
                                    ? 'Saving...'
                                    : (editingFactory ? 'Update Factory' : 'Create Factory')}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-lg bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {factories.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                                    No factories found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            factories.map((factory: any) => (
                                <TableRow key={factory.id}>
                                    <TableCell className="font-medium">{factory.name}</TableCell>
                                    <TableCell className="max-w-xs truncate" title={factory.address}>{factory.address || '-'}</TableCell>
                                    <TableCell>{new Date(factory.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {canEdit && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEdit(factory)}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-500 hover:text-red-700"
                                                        onClick={() => {
                                                            if (confirm('Are you sure you want to delete this factory?')) {
                                                                deleteMutation.mutate(factory.id);
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
                            ))
                        )}
                    </TableBody>
                </Table>

                {/* Pagination */}
                {!isLoading && factories.length > 0 && (
                    <Pagination
                        page={page}
                        hasNext={!!factoriesData?.next}
                        hasPrevious={!!factoriesData?.previous}
                        onPageChange={(newPage) => setPage(newPage)}
                        isLoading={isPlaceholderData}
                        totalCount={factoriesData?.count}
                        pageSize={10}
                    />
                )}
            </div>
        </div>
    );
};

export default Factories;
