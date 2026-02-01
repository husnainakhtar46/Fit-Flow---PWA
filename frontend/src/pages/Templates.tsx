import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import Pagination from '../components/Pagination';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
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

type POM = {
    name: string;
    default_tol: number;
};

type TemplateForm = {
    name: string;
    description: string;
    customer: string;
    poms: POM[];
};

interface PaginatedResponse<T> {
    results: T[];
    count: number;
    next: string | null;
    previous: string | null;
}

const Templates = () => {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<any>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
    const [page, setPage] = useState(1);

    const { register, control, handleSubmit, reset, getValues, setValue } = useForm<TemplateForm>({
        defaultValues: {
            poms: [{ name: '', default_tol: 0 }],
            customer: ''
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "poms"
    });

    // Excel-style paste handler
    const handlePaste = (rowIndex: number, startColumn: 'name' | 'default_tol') => (event: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedData = event.clipboardData.getData('text');
        const lines = pastedData.split('\n').filter(line => line.trim());

        if (lines.length > 0) {
            event.preventDefault();
            const currentPoms = getValues('poms');
            const columnOrder = ['name', 'default_tol'];
            const startColIndex = columnOrder.indexOf(startColumn);

            // Auto-detect header
            const hasHeader = /pom|name|tolerance|tol/i.test(lines[0]);
            const dataRows = hasHeader ? lines.slice(1) : lines;

            const newItems: POM[] = [];

            dataRows.forEach((line, rowOffset) => {
                const targetRow = rowIndex + rowOffset;
                const columns = line.split('\t');

                // If updating existing row
                if (targetRow < currentPoms.length) {
                    columns.forEach((value, colOffset) => {
                        const targetColIndex = startColIndex + colOffset;
                        if (targetColIndex === 0) setValue(`poms.${targetRow}.name`, value.trim());
                        if (targetColIndex === 1) setValue(`poms.${targetRow}.default_tol`, parseFloat(value.trim()) || 0);
                    });
                } else {
                    // If new row
                    const newIndex = targetRow - currentPoms.length;
                    if (!newItems[newIndex]) newItems[newIndex] = { name: '', default_tol: 0 };

                    columns.forEach((value, colOffset) => {
                        const targetColIndex = startColIndex + colOffset;
                        if (targetColIndex === 0) newItems[newIndex].name = value.trim();
                        if (targetColIndex === 1) newItems[newIndex].default_tol = parseFloat(value.trim()) || 0;
                    });
                }
            });

            if (newItems.length > 0) {
                append(newItems);
            }

            toast.success(`Pasted ${dataRows.length} rows!`);
        }
    };

    const { data: templatesData, isLoading, isPlaceholderData } = useQuery<PaginatedResponse<any>>({
        queryKey: ['templates', selectedCustomer, page],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            if (selectedCustomer && selectedCustomer !== 'all') {
                params.append('customer', selectedCustomer);
            }
            const res = await api.get(`/templates/?${params.toString()}`);
            return res.data;
        },
        placeholderData: (previousData) => previousData,
    });

    const { data: customersData } = useQuery({
        queryKey: ['customers'],
        queryFn: async () => (await api.get('/customers/')).data,
    });

    const templates = Array.isArray(templatesData) ? templatesData : templatesData?.results || [];
    const customers = Array.isArray(customersData) ? customersData : customersData?.results || [];

    const createMutation = useMutation({
        mutationFn: async (data: TemplateForm) => {
            const payload = {
                ...data,
                customer: data.customer || null
            };
            const res = await api.post('/templates/', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
            setIsOpen(false);
            setEditingTemplate(null);
            // Reset form to empty defaults
            reset({
                name: '',
                description: '',
                customer: '',
                poms: [{ name: '', default_tol: 0 }],
            });
            toast.success('Template created');
        },
        onError: (error: any) => {
            if (error?.response?.data?.name) {
                toast.error('Style name already exists. Please use a different name.');
            } else {
                toast.error('Failed to create template. Please try again.');
            }
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/templates/${id}/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
            toast.success('Template deleted');
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: TemplateForm }) => {
            const payload = {
                ...data,
                customer: data.customer || null
            };
            const res = await api.put(`/templates/${id}/`, payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
            setIsOpen(false);
            setEditingTemplate(null);
            reset();
            toast.success('Template updated');
        },
        onError: (error: any) => {
            if (error?.response?.data?.name) {
                toast.error('Style name already exists. Please use a different name.');
            } else {
                toast.error('Failed to update template. Please try again.');
            }
        },
    });

    const handleEdit = (template: any) => {
        setEditingTemplate(template);
        reset({
            name: template.name,
            description: template.description || '',
            customer: template.customer || '',
            poms: template.poms || [{ name: '', default_tol: 0 }],
        });
        setIsOpen(true);
    };

    const onSubmit = (data: TemplateForm) => {
        if (editingTemplate) {
            updateMutation.mutate({ id: editingTemplate.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Templates</h1>

                    {/* Customer Filter */}
                    <div className="w-[200px]">
                        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by Customer" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Customers</SelectItem>
                                {customers?.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Dialog open={isOpen} onOpenChange={(open) => {
                    setIsOpen(open);
                    if (!open) {
                        setEditingTemplate(null);
                        // Reset to empty defaults when closing
                        reset({
                            name: '',
                            description: '',
                            customer: '',
                            poms: [{ name: '', default_tol: 0 }],
                        });
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Template
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
                            <div className="space-y-2">
                                <Label>Style Name</Label>
                                <Input {...register("name", { required: true })} placeholder="e.g. ST-12345" />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="customer">
                                    Customer {editingTemplate ? '(Cannot be changed)' : '(Optional)'}
                                </Label>
                                <select
                                    id="customer"
                                    {...register("customer")}
                                    disabled={!!editingTemplate}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">None (Global)</option>
                                    {customers?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea {...register("description")} placeholder="Optional description" />
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <Label>Points of Measure (POM)</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', default_tol: 0 })}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add POM
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="flex gap-2 items-end">
                                            <div className="flex-1">
                                                <Label className="text-xs">POM Name</Label>
                                                <Input {...register(`poms.${index}.name` as const, { required: true })} placeholder="Chest Width" onPaste={handlePaste(index, 'name')} />
                                            </div>
                                            <div className="w-32">
                                                <Label className="text-xs">Tolerance (+/-)</Label>
                                                <Input type="number" step="0.1" {...register(`poms.${index}.default_tol` as const)} onPaste={handlePaste(index, 'default_tol')} />
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                                Save Template
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Style Name</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>POM Count</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {templates?.map((template: any) => (
                            <TableRow key={template.id}>
                                <TableCell className="font-medium">{template.name}</TableCell>
                                <TableCell>{customers?.find((c: any) => c.id === template.customer)?.name || 'Global'}</TableCell>
                                <TableCell>{template.description}</TableCell>
                                <TableCell>{template.poms?.length || 0}</TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEdit(template)}
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-700"
                                            onClick={() => {
                                                if (confirm('Are you sure?')) {
                                                    deleteMutation.mutate(template.id);
                                                }
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {/* Pagination */}
                {!isLoading && templates.length > 0 && (
                    <Pagination
                        page={page}
                        hasNext={!!templatesData?.next}
                        hasPrevious={!!templatesData?.previous}
                        onPageChange={(newPage) => setPage(newPage)}
                        isLoading={isPlaceholderData}
                        totalCount={templatesData?.count}
                        pageSize={10}
                    />
                )}
            </div>
        </div>
    );
};

export default Templates;
