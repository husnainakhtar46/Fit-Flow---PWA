import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Search, ExternalLink, Edit2, ChevronLeft, X, Save, Link as LinkIcon, RefreshCw } from 'lucide-react';
import api from '../lib/api';
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
    DialogDescription,
} from '../components/ui/dialog';
import { Card } from '../components/ui/card';

// Types
interface StyleLink {
    id?: string;
    label: string;
    url: string;
}

interface SampleComment {
    id?: string;
    sample_type: string;
    comments_general: string;
    comments_fit: string;
    comments_workmanship: string;
    comments_wash: string;
    comments_fabric: string;
    comments_accessories: string;
    created_at?: string;
    updated_at?: string;
}

interface StyleMaster {
    id: string;
    po_number: string;
    style_name: string;
    color: string;
    season: string;
    customer: string;
    customer_name?: string;
    comments: SampleComment[];
    links: StyleLink[];
    created_at: string;
    comments_count?: number;
}

const SAMPLE_TYPES = [
    'Fit Sample',
    'PP Sample',
    'Size Set',
    'Top of Production',
];

const StyleCycle = () => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [selectedStyle, setSelectedStyle] = useState<StyleMaster | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('Fit Sample');
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
    const [newLink, setNewLink] = useState({ label: '', url: '' });
    const [editingComment, setEditingComment] = useState<SampleComment | null>(null);

    // Form state for new style
    const [newStyle, setNewStyle] = useState({
        po_number: '',
        style_name: '',
        color: '',
        season: '',
        customer: '',
    });

    // Fetch customers
    const { data: customersData } = useQuery({
        queryKey: ['customers'],
        queryFn: async () => {
            const res = await api.get('/customers/');
            return res.data.results || res.data || [];
        },
    });
    const customers = Array.isArray(customersData) ? customersData : [];

    // Fetch styles list
    const { data: stylesData, isLoading } = useQuery({
        queryKey: ['styles', search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            const res = await api.get(`/styles/?${params.toString()}`);
            return res.data.results || res.data || [];
        },
    });
    const styles = Array.isArray(stylesData) ? stylesData : [];

    // Fetch single style details
    const { data: styleDetails, refetch: refetchDetails } = useQuery({
        queryKey: ['style', selectedStyle?.id],
        queryFn: async () => {
            if (!selectedStyle?.id) return null;
            const res = await api.get(`/styles/${selectedStyle.id}/`);
            return res.data;
        },
        enabled: !!selectedStyle?.id,
    });

    // Create style mutation
    const createStyleMutation = useMutation({
        mutationFn: async (data: typeof newStyle) => {
            return api.post('/styles/', data);
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['styles'] });
            setIsCreateOpen(false);
            setSelectedStyle(res.data);
            setNewStyle({ po_number: '', style_name: '', color: '', season: '', customer: '' });
            toast.success('Style created successfully');
        },
        onError: () => {
            toast.error('Failed to create style');
        },
    });

    // Delete style mutation
    const deleteStyleMutation = useMutation({
        mutationFn: async (id: string) => {
            return api.delete(`/styles/${id}/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['styles'] });
            setSelectedStyle(null);
            toast.success('Style deleted');
        },
        onError: () => {
            toast.error('Failed to delete style');
        },
    });

    // Add/Update comment mutation
    const saveCommentMutation = useMutation({
        mutationFn: async (data: { styleId: string; comment: SampleComment }) => {
            if (data.comment.id) {
                return api.patch(`/sample-comments/${data.comment.id}/`, data.comment);
            } else {
                return api.post(`/styles/${data.styleId}/add_comment/`, data.comment);
            }
        },
        onSuccess: () => {
            refetchDetails();
            setEditingComment(null);
            toast.success('Comment saved');
        },
        onError: () => {
            toast.error('Failed to save comment');
        },
    });

    // Delete comment mutation
    const deleteCommentMutation = useMutation({
        mutationFn: async (id: string) => {
            return api.delete(`/sample-comments/${id}/`);
        },
        onSuccess: () => {
            refetchDetails();
            toast.success('Comment deleted');
        },
    });

    // Add link mutation
    const addLinkMutation = useMutation({
        mutationFn: async (data: { styleId: string; link: StyleLink }) => {
            return api.post(`/styles/${data.styleId}/add_link/`, data.link);
        },
        onSuccess: () => {
            refetchDetails();
            setIsLinkDialogOpen(false);
            setNewLink({ label: '', url: '' });
            toast.success('Link added');
        },
        onError: () => {
            toast.error('Failed to add link');
        },
    });

    // Delete link mutation
    const deleteLinkMutation = useMutation({
        mutationFn: async (id: string) => {
            return api.delete(`/style-links/${id}/`);
        },
        onSuccess: () => {
            refetchDetails();
            toast.success('Link deleted');
        },
    });

    // Get current comment for active tab
    const getCurrentComment = (): SampleComment | undefined => {
        if (!styleDetails?.comments) return undefined;
        return styleDetails.comments.find((c: SampleComment) => c.sample_type === activeTab);
    };

    const handleSelectStyle = (style: StyleMaster) => {
        setSelectedStyle(style);
        setActiveTab('Fit Sample');
    };

    const handleCreateComment = () => {
        const newComment: SampleComment = {
            sample_type: activeTab,
            comments_general: '',
            comments_fit: '',
            comments_workmanship: '',
            comments_wash: '',
            comments_fabric: '',
            comments_accessories: '',
        };
        setEditingComment(newComment);
    };

    const handleEditComment = (comment: SampleComment) => {
        setEditingComment({ ...comment });
    };

    const handleSaveComment = () => {
        if (!selectedStyle || !editingComment) return;
        saveCommentMutation.mutate({
            styleId: selectedStyle.id,
            comment: editingComment,
        });
    };

    // List View
    if (!selectedStyle) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold text-gray-900">Style Cycle</h1>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Style
                    </Button>
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Search by PO, Style, Customer..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Styles Table */}
                <Card className="overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>PO Number</TableHead>
                                <TableHead>Style Name</TableHead>
                                <TableHead>Color</TableHead>
                                <TableHead>Season</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Comments</TableHead>
                                <TableHead>Created</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                                    </TableCell>
                                </TableRow>
                            ) : styles.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                        No styles found. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                styles.map((style: StyleMaster) => (
                                    <TableRow
                                        key={style.id}
                                        className="cursor-pointer hover:bg-gray-50"
                                        onClick={() => handleSelectStyle(style)}
                                    >
                                        <TableCell className="font-medium">{style.po_number}</TableCell>
                                        <TableCell>{style.style_name}</TableCell>
                                        <TableCell>{style.color || '-'}</TableCell>
                                        <TableCell>{style.season || '-'}</TableCell>
                                        <TableCell>{style.customer_name || '-'}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {style.comments_count || 0}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-gray-500 text-sm">
                                            {new Date(style.created_at).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>

                {/* Create Style Dialog */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Create New Style</DialogTitle>
                            <DialogDescription>
                                Add a new style file to manage customer sample comments.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <Label>PO Number *</Label>
                                <Input
                                    value={newStyle.po_number}
                                    onChange={(e) => setNewStyle({ ...newStyle, po_number: e.target.value })}
                                    placeholder="e.g., PO-2024-001"
                                />
                            </div>
                            <div>
                                <Label>Style Name *</Label>
                                <Input
                                    value={newStyle.style_name}
                                    onChange={(e) => setNewStyle({ ...newStyle, style_name: e.target.value })}
                                    placeholder="e.g., Blue Denim Jacket"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Color/Wash</Label>
                                    <Input
                                        value={newStyle.color}
                                        onChange={(e) => setNewStyle({ ...newStyle, color: e.target.value })}
                                        placeholder="e.g., Indigo"
                                    />
                                </div>
                                <div>
                                    <Label>Season</Label>
                                    <Input
                                        value={newStyle.season}
                                        onChange={(e) => setNewStyle({ ...newStyle, season: e.target.value })}
                                        placeholder="e.g., Fall 2026"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Customer</Label>
                                <Select
                                    value={newStyle.customer}
                                    onValueChange={(v) => setNewStyle({ ...newStyle, customer: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select customer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customers.map((c: { id: string; name: string }) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => createStyleMutation.mutate(newStyle)}
                                disabled={!newStyle.po_number || !newStyle.style_name}
                            >
                                Create Style
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // Detail View
    const currentComment = getCurrentComment();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedStyle(null)}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">
                        Style: {styleDetails?.po_number || selectedStyle.po_number} - {styleDetails?.style_name || selectedStyle.style_name}
                    </h1>
                    <p className="text-gray-500">
                        {styleDetails?.color && `${styleDetails.color} • `}
                        {styleDetails?.season && `${styleDetails.season} • `}
                        {styleDetails?.customer_name || 'No customer'}
                    </p>
                </div>
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                        if (confirm('Are you sure you want to delete this style?')) {
                            deleteStyleMutation.mutate(selectedStyle.id);
                        }
                    }}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>

            {/* Sample Type Tabs */}
            <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
                {SAMPLE_TYPES.map((type) => {
                    const hasComment = styleDetails?.comments?.some((c: SampleComment) => c.sample_type === type);
                    return (
                        <button
                            key={type}
                            onClick={() => setActiveTab(type)}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${activeTab === type
                                    ? 'bg-primary text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {type}
                            {hasComment && (
                                <span className="ml-2 w-2 h-2 inline-block rounded-full bg-green-500" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Comments Panel */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">
                            Last Sample Feedback ({activeTab})
                        </h2>
                        {!editingComment && (
                            <Button
                                size="sm"
                                onClick={currentComment ? () => handleEditComment(currentComment) : handleCreateComment}
                            >
                                {currentComment ? (
                                    <>
                                        <Edit2 className="w-4 h-4 mr-1" /> Edit
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 mr-1" /> Add Comments
                                    </>
                                )}
                            </Button>
                        )}
                    </div>

                    {editingComment ? (
                        /* Edit Mode */
                        <Card className="p-6 space-y-4">
                            <div>
                                <Label>Customer Feedback Summary (General)</Label>
                                <Textarea
                                    value={editingComment.comments_general}
                                    onChange={(e) =>
                                        setEditingComment({ ...editingComment, comments_general: e.target.value })
                                    }
                                    placeholder="General customer feedback..."
                                    rows={3}
                                />
                            </div>
                            <div>
                                <Label>Customer Fit Comments</Label>
                                <Textarea
                                    value={editingComment.comments_fit}
                                    onChange={(e) =>
                                        setEditingComment({ ...editingComment, comments_fit: e.target.value })
                                    }
                                    placeholder="Fit-related feedback..."
                                    rows={3}
                                />
                            </div>
                            <div>
                                <Label>Customer Workmanship Comments</Label>
                                <Textarea
                                    value={editingComment.comments_workmanship}
                                    onChange={(e) =>
                                        setEditingComment({ ...editingComment, comments_workmanship: e.target.value })
                                    }
                                    placeholder="Workmanship feedback..."
                                    rows={3}
                                />
                            </div>
                            <div>
                                <Label>Customer Wash Comments</Label>
                                <Textarea
                                    value={editingComment.comments_wash}
                                    onChange={(e) =>
                                        setEditingComment({ ...editingComment, comments_wash: e.target.value })
                                    }
                                    placeholder="Wash-related feedback..."
                                    rows={3}
                                />
                            </div>
                            <div>
                                <Label>Customer Fabric Comments</Label>
                                <Textarea
                                    value={editingComment.comments_fabric}
                                    onChange={(e) =>
                                        setEditingComment({ ...editingComment, comments_fabric: e.target.value })
                                    }
                                    placeholder="Fabric feedback..."
                                    rows={3}
                                />
                            </div>
                            <div>
                                <Label>Customer Accessories Comments</Label>
                                <Textarea
                                    value={editingComment.comments_accessories}
                                    onChange={(e) =>
                                        setEditingComment({ ...editingComment, comments_accessories: e.target.value })
                                    }
                                    placeholder="Accessories feedback..."
                                    rows={3}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <Button variant="outline" onClick={() => setEditingComment(null)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveComment}>
                                    <Save className="w-4 h-4 mr-1" />
                                    Save Comments
                                </Button>
                            </div>
                        </Card>
                    ) : currentComment ? (
                        /* View Mode */
                        <Card className="p-6 space-y-4">
                            {[
                                { label: 'Customer Feedback Summary (General)', value: currentComment.comments_general },
                                { label: 'Customer Fit Comments', value: currentComment.comments_fit },
                                { label: 'Customer Workmanship Comments', value: currentComment.comments_workmanship },
                                { label: 'Customer Wash Comments', value: currentComment.comments_wash },
                                { label: 'Customer Fabric Comments', value: currentComment.comments_fabric },
                                { label: 'Customer Accessories Comments', value: currentComment.comments_accessories },
                            ].map((item) => (
                                <div key={item.label}>
                                    <Label className="text-gray-500">{item.label}</Label>
                                    <p className="mt-1 text-gray-900 whitespace-pre-wrap">
                                        {item.value || <span className="text-gray-400 italic">No comments</span>}
                                    </p>
                                </div>
                            ))}
                            <div className="flex justify-between items-center pt-4 border-t text-sm text-gray-500">
                                <span>
                                    Last updated: {currentComment.updated_at
                                        ? new Date(currentComment.updated_at).toLocaleString()
                                        : 'N/A'}
                                </span>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                        if (currentComment.id && confirm('Delete this comment?')) {
                                            deleteCommentMutation.mutate(currentComment.id);
                                        }
                                    }}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </Card>
                    ) : (
                        /* Empty State */
                        <Card className="p-12 text-center text-gray-500">
                            <p>No comments for {activeTab} yet.</p>
                            <p className="text-sm mt-1">Click "Add Comments" to add customer feedback.</p>
                        </Card>
                    )}
                </div>

                {/* Right: Related Links Panel */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Related Links & Documents</h2>
                        <Button size="sm" onClick={() => setIsLinkDialogOpen(true)}>
                            <Plus className="w-4 h-4 mr-1" />
                            Add Link
                        </Button>
                    </div>

                    <Card className="divide-y">
                        {styleDetails?.links?.length > 0 ? (
                            styleDetails.links.map((link: StyleLink) => (
                                <div key={link.id} className="p-4 flex items-center gap-3 hover:bg-gray-50">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <LinkIcon className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{link.label}</p>
                                        <p className="text-sm text-gray-500 truncate">{link.url}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => window.open(link.url, '_blank')}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                if (link.id && confirm('Delete this link?')) {
                                                    deleteLinkMutation.mutate(link.id);
                                                }
                                            }}
                                        >
                                            <X className="w-4 h-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                <LinkIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p>No links added yet</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Add Link Dialog */}
            <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New Link</DialogTitle>
                        <DialogDescription>
                            Add a related document or link for this style.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Label *</Label>
                            <Input
                                value={newLink.label}
                                onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
                                placeholder="e.g., Spec Sheet, Approval Email"
                            />
                        </div>
                        <div>
                            <Label>URL *</Label>
                            <Input
                                value={newLink.url}
                                onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                                placeholder="https://..."
                                type="url"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() =>
                                addLinkMutation.mutate({
                                    styleId: selectedStyle.id,
                                    link: newLink,
                                })
                            }
                            disabled={!newLink.label || !newLink.url}
                        >
                            Add Link
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StyleCycle;
