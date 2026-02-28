import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Search, ExternalLink, Edit2, ChevronLeft, X, Save, Link as LinkIcon, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/api';
import { compressImages } from '../lib/imageUtils';
import { formatDate, formatDateTime } from '../utils/dateFormatter';
import CommentImageTiles, { type CommentImage } from '../components/CommentImageTiles';
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
import { SearchableSelect } from '../components/SearchableSelect';
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
import Pagination from '../components/Pagination';

// ==========================================
// TypeScript Interfaces & Types
// ==========================================

interface StyleLink {
    id?: string;
    label: string;
    url: string;
    created_at?: string;
}

interface SampleComment {
    id?: string;
    sample_type: string;
    sample_number: number;
    sample_number_display?: string;
    comments_general: string;
    comments_fit: string;
    comments_workmanship: string;
    comments_wash: string;
    comments_fabric: string;
    comments_accessories: string;
    general_edited_at?: string;
    fit_edited_at?: string;
    workmanship_edited_at?: string;
    wash_edited_at?: string;
    fabric_edited_at?: string;
    accessories_edited_at?: string;
    images?: CommentImage[];
    created_at?: string;
    updated_at?: string;
}

/** Category keys matching backend choices */
type ImageCategory = 'general' | 'fit' | 'workmanship' | 'wash' | 'fabric' | 'accessories';

/** Map of pending files per category (not yet uploaded) */
type PendingImagesMap = Record<ImageCategory, File[]>;

const EMPTY_PENDING: PendingImagesMap = {
    general: [], fit: [], workmanship: [], wash: [], fabric: [], accessories: [],
};

interface StyleMaster {
    id: string;
    po_number: string;
    style_name: string;
    color: string;
    season: string;
    customer: string;
    customer_name?: string;
    factory?: string;
    factory_name?: string;
    comments: SampleComment[];
    links: StyleLink[];
    created_at: string;
    comments_count?: number;
}

// ==========================================
// Constants
// ==========================================
const SAMPLE_TYPES = [
    'Fit Sample',
    'PP Sample',
    'Size Set',
    'SMS',
    'Shipment Sample',
];

const SAMPLE_NUMBERS = [
    { value: 1, label: '1st Sample' },
    { value: 2, label: '2nd Sample' },
    { value: 3, label: '3rd Sample' },
    { value: 4, label: '4th Sample' },
    { value: 5, label: '5th Sample' },
];

const StyleCycle = () => {
    const queryClient = useQueryClient();

    // UI State Management
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [selectedStyle, setSelectedStyle] = useState<StyleMaster | null>(null);
    const [activeTab, setActiveTab] = useState('Fit Sample');

    // Modal & Dialog States
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false); // New state for edit dialog
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);

    // Form & Comment States
    const [newLink, setNewLink] = useState({ label: '', url: '' });
    const [editingComment, setEditingComment] = useState<SampleComment | null>(null);
    const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
    const [pendingImages, setPendingImages] = useState<PendingImagesMap>({ ...EMPTY_PENDING });
    const [isCompressing, setIsCompressing] = useState(false);

    // Role-Based Access Control (RBAC) Check Validate
    // QA roles are restricted from editing directly unless they are superusers.
    const userType = localStorage.getItem('user_type');
    const isSuperUser = localStorage.getItem('is_superuser') === 'true';
    const canEdit = userType !== 'qa' || isSuperUser;

    // Form state for new style
    const [newStyle, setNewStyle] = useState({
        po_number: '',
        style_name: '',
        color: '',
        season: '',
        customer: '',
        factory: '',
    });

    // ==========================================
    // API Data Fetching (Queries)
    // ==========================================

    // Fetch dropdown options for factories
    const { data: factoriesData } = useQuery({
        queryKey: ['factories'],
        queryFn: async () => {
            const res = await api.get('/factories/');
            return res.data.results || res.data || [];
        },
    });
    const factories = Array.isArray(factoriesData) ? factoriesData : [];

    // Fetch dropdown options for customers
    const { data: customersData } = useQuery({
        queryKey: ['customers'],
        queryFn: async () => {
            const res = await api.get('/customers/');
            return res.data.results || res.data || [];
        },
    });
    const customers = Array.isArray(customersData) ? customersData : [];

    // Main Styles Grid Data - List API Call with Pagination & Search
    const { data: stylesData, isLoading, isPlaceholderData } = useQuery({
        queryKey: ['styles', search, page],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            params.append('page', page.toString());
            params.append('page_size', '20'); // Force 20 items per page max
            const res = await api.get(`/styles/?${params.toString()}`);
            return res.data;
        },
        placeholderData: (previousData) => previousData, // Keeps previous list UI visible while fetching new page
    });

    // Extract pagination metadata from backend response
    const styles = stylesData?.results || (Array.isArray(stylesData) ? stylesData : []);
    const totalCount = stylesData?.count;
    const hasNext = !!stylesData?.next;
    const hasPrevious = !!stylesData?.previous;

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

    // ==========================================
    // Data Mutation Functions (Create/Edit/Delete)
    // ==========================================

    // Update existing style's data headers
    const updateStyleMutation = useMutation({
        mutationFn: async (data: typeof newStyle & { id: string }) => {
            const { id, ...updateData } = data;
            return api.patch(`/styles/${id}/`, updateData);
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['styles'] }); // Refresh list view
            queryClient.invalidateQueries({ queryKey: ['style', res.data.id] }); // Refresh detail view
            setSelectedStyle(res.data);
            setIsEditOpen(false);
            toast.success('Style updated successfully');
        },
        onError: () => {
            toast.error('Failed to update style');
        },
    });

    // Create a new style record
    const createStyleMutation = useMutation({
        mutationFn: async (data: typeof newStyle) => {
            return api.post('/styles/', data);
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['styles'] });
            setIsCreateOpen(false);
            setSelectedStyle(res.data);
            // Reset form
            setNewStyle({ po_number: '', style_name: '', color: '', season: '', customer: '', factory: '' });
            toast.success('Style created successfully');
        },
        onError: () => {
            toast.error('Failed to create style');
        },
    });

    const deleteStyleMutation = useMutation({
        mutationFn: async (id: string) => {
            return api.delete(`/styles/${id}/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['styles'] });
            setSelectedStyle(null); // Return to list view
            toast.success('Style deleted');
        },
        onError: () => {
            toast.error('Failed to delete style');
        },
    });

    // Submits new or edited feedback comments for a specific sample dropdown
    const saveCommentMutation = useMutation({
        mutationFn: async (data: { styleId: string; comment: SampleComment }) => {
            if (data.comment.id) {
                // If it exists, patch it
                return api.patch(`/sample-comments/${data.comment.id}/`, data.comment);
            } else {
                // Otherwise attach to the specified Style ID via child POST url
                return api.post(`/styles/${data.styleId}/add_comment/`, data.comment);
            }
        },
        onSuccess: async (res) => {
            // Upload any pending images for the saved comment
            const savedCommentId = res.data?.id;
            if (savedCommentId) {
                const hasPending = Object.values(pendingImages).some(f => f.length > 0);
                if (hasPending) {
                    await uploadPendingImages(savedCommentId);
                }
            }
            setPendingImages({ ...EMPTY_PENDING });
            refetchDetails();
            setEditingComment(null); // Return out of edit mode
            toast.success('Comment saved');
        },
        onError: () => {
            toast.error('Failed to save comment');
        },
    });

    const deleteCommentMutation = useMutation({
        mutationFn: async (id: string) => {
            return api.delete(`/sample-comments/${id}/`);
        },
        onSuccess: () => {
            refetchDetails();
            toast.success('Comment deleted');
        },
    });

    // Adding hyperlinks (e.g. PDF documents, emails) tied to the style record
    const addLinkMutation = useMutation({
        mutationFn: async (data: { styleId: string; link: StyleLink }) => {
            return api.post(`/styles/${data.styleId}/add_link/`, data.link);
        },
        onSuccess: () => {
            refetchDetails();
            setIsLinkDialogOpen(false);
            setNewLink({ label: '', url: '' }); // Clear field
            toast.success('Link added');
        },
        onError: () => {
            toast.error('Failed to add link');
        },
    });

    const deleteLinkMutation = useMutation({
        mutationFn: async (id: string) => {
            return api.delete(`/style-links/${id}/`);
        },
        onSuccess: () => {
            refetchDetails();
            toast.success('Link deleted');
        },
    });

    // ==========================================
    // Helper Methods & Event Handlers
    // ==========================================

    // Get comments assigned strictly to the currently visible horizontal "Sample Type" tab
    const getCommentsForTab = (): SampleComment[] => {
        if (!styleDetails?.comments) return [];
        return styleDetails.comments
            .filter((c: SampleComment) => c.sample_type === activeTab)
            .sort((a: SampleComment, b: SampleComment) => b.sample_number - a.sample_number);
    };

    // Get used sample numbers for current tab
    const getUsedSampleNumbers = (): number[] => {
        if (!styleDetails?.comments) return [];
        return styleDetails.comments
            .filter((c: SampleComment) => c.sample_type === activeTab)
            .map((c: SampleComment) => c.sample_number);
    };

    const handleSelectStyle = (style: StyleMaster) => {
        setSelectedStyle(style);
        setActiveTab('Fit Sample');
        setExpandedComments(new Set());
    };

    const handleCreateComment = () => {
        const usedNumbers = getUsedSampleNumbers();
        // Dynamically find the next available sample number (from 1 to 5)
        let nextNumber = 1;
        for (let i = 1; i <= 5; i++) {
            if (!usedNumbers.includes(i)) {
                nextNumber = i;
                break;
            }
        }

        const newComment: SampleComment = {
            sample_type: activeTab,
            sample_number: nextNumber,
            comments_general: '',
            comments_fit: '',
            comments_workmanship: '',
            comments_wash: '',
            comments_fabric: '',
            comments_accessories: '',
        };
        setEditingComment(newComment);
        setPendingImages({ ...EMPTY_PENDING });
    };

    const handleEditComment = (comment: SampleComment) => {
        setEditingComment({ ...comment });
        setPendingImages({ ...EMPTY_PENDING });
    };

    /** Upload pending images for a specific comment after it has been saved */
    const uploadPendingImages = async (commentId: string) => {
        for (const category of Object.keys(pendingImages) as ImageCategory[]) {
            const files = pendingImages[category];
            if (files.length === 0) continue;

            const formData = new FormData();
            files.forEach(f => formData.append('images', f));
            formData.append('category', category);

            try {
                await api.post(`/sample-comments/${commentId}/upload_images/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } catch {
                toast.error(`Failed to upload ${category} images`);
            }
        }
    };

    /** Add files to the pending map for a given category (compresses first) */
    const handlePendingAdd = async (category: ImageCategory, files: File[]) => {
        setIsCompressing(true);
        try {
            const compressed = await compressImages(files);
            setPendingImages(prev => ({
                ...prev,
                [category]: [...prev[category], ...compressed],
            }));
        } finally {
            setIsCompressing(false);
        }
    };

    /** Remove a pending file by index for a given category */
    const handlePendingRemove = (category: ImageCategory, index: number) => {
        setPendingImages(prev => ({
            ...prev,
            [category]: prev[category].filter((_, i) => i !== index),
        }));
    };

    /** Delete an existing image from the backend */
    const handleExistingImageRemove = async (imageId: string) => {
        // Confirmation dialog to prevent accidental deletion
        if (!confirm('Are you sure you want to permanently delete this image?')) return;

        try {
            await api.delete(`/sample-comment-images/${imageId}/`);
            refetchDetails();
            // Also remove from local editing state so UI updates immediately
            if (editingComment) {
                setEditingComment(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        images: prev.images?.filter(img => img.id !== imageId)
                    };
                });
            }
            toast.success('Image deleted');
        } catch {
            toast.error('Failed to delete image');
        }
    };

    const handleSaveComment = () => {
        if (!selectedStyle || !editingComment) return;
        saveCommentMutation.mutate({
            styleId: selectedStyle.id,
            comment: editingComment,
        });
    };

    const toggleCommentExpanded = (id: string) => {
        setExpandedComments(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // ==========================================
    // VIEW 1: Main Data Grid (List of Styles)
    // ==========================================
    if (!selectedStyle) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold text-gray-900">Style Cycle</h1>
                    {canEdit && (
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            New Style
                        </Button>
                    )}
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Search by PO, Style, Customer..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1); // Reset page on new search
                        }}
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
                                <TableHead>Factory</TableHead>
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
                                        <TableCell>{style.factory_name || '-'}</TableCell>
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

                {/* Pagination */}
                {!isLoading && styles.length > 0 && (
                    <Pagination
                        page={page}
                        hasNext={hasNext}
                        hasPrevious={hasPrevious}
                        onPageChange={setPage}
                        isLoading={isPlaceholderData}
                        totalCount={totalCount}
                        pageSize={20}
                    />
                )}

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
                                <SearchableSelect
                                    value={newStyle.customer}
                                    onChange={(v) => setNewStyle({ ...newStyle, customer: v })}
                                    options={customers.map((c: any) => ({ value: c.id, label: c.name }))}
                                    placeholder="Select customer..."
                                />
                            </div>
                            <div>
                                <Label>Factory</Label>
                                <SearchableSelect
                                    value={newStyle.factory || ''}
                                    onChange={(v) => setNewStyle({ ...newStyle, factory: v })}
                                    options={factories.map((f: any) => ({ value: f.id, label: f.name }))}
                                    placeholder="Select factory..."
                                />
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

    // ==========================================
    // VIEW 2: Detail Overlay (Drill-Down per Style)
    // ==========================================
    const tabComments = getCommentsForTab();
    const usedSampleNumbers = getUsedSampleNumbers();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedStyle(null)}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900">
                            Style: {styleDetails?.po_number || selectedStyle.po_number} - {styleDetails?.style_name || selectedStyle.style_name}
                        </h1>
                        {canEdit && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setNewStyle({
                                        po_number: styleDetails?.po_number || selectedStyle.po_number,
                                        style_name: styleDetails?.style_name || selectedStyle.style_name,
                                        color: styleDetails?.color || selectedStyle.color,
                                        season: styleDetails?.season || selectedStyle.season,
                                        customer: styleDetails?.customer || selectedStyle.customer,
                                        factory: styleDetails?.factory || selectedStyle.factory,
                                    });
                                    setIsEditOpen(true);
                                }}
                            >
                                <Edit2 className="w-4 h-4 text-gray-500 hover:text-gray-900" />
                            </Button>
                        )}
                    </div>
                    <p className="text-gray-500">
                        {styleDetails?.color && `${styleDetails.color} • `}
                        {styleDetails?.season && `${styleDetails.season} • `}
                        {styleDetails?.customer_name || 'No customer'}
                        {styleDetails?.factory_name && ` • ${styleDetails.factory_name}`}
                    </p>
                </div>
                <Button
                    variant="destructive"
                    size="sm"
                    disabled={!canEdit}
                    className={!canEdit ? 'hidden' : ''}
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
                    const commentCount = styleDetails?.comments?.filter((c: SampleComment) => c.sample_type === type).length || 0;
                    return (
                        <button
                            key={type}
                            onClick={() => {
                                setActiveTab(type);
                                setEditingComment(null);
                            }}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${activeTab === type
                                ? 'bg-primary text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {type}
                            {commentCount > 0 && (
                                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-green-500 text-white">
                                    {commentCount}
                                </span>
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
                            Sample Feedback ({activeTab})
                        </h2>
                        {canEdit && !editingComment && usedSampleNumbers.length < 5 && (
                            <Button size="sm" onClick={handleCreateComment}>
                                <Plus className="w-4 h-4 mr-1" /> Add New Sample Comment
                            </Button>
                        )}
                    </div>

                    {editingComment ? (
                        /* Edit Mode */
                        <Card className="p-6 space-y-4 border-2 border-blue-200">
                            <div className="flex items-center justify-between pb-2 border-b">
                                <h3 className="font-semibold text-blue-800">
                                    {editingComment.id ? 'Edit Comment' : 'New Comment'}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm">Sample #</Label>
                                    <Select
                                        value={String(editingComment.sample_number)}
                                        onValueChange={(v) =>
                                            setEditingComment({ ...editingComment, sample_number: parseInt(v) })
                                        }
                                    >
                                        <SelectTrigger className="w-36">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SAMPLE_NUMBERS.map((sn) => (
                                                <SelectItem
                                                    key={sn.value}
                                                    value={String(sn.value)}
                                                    disabled={usedSampleNumbers.includes(sn.value) && editingComment.sample_number !== sn.value}
                                                >
                                                    {sn.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
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
                                <CommentImageTiles
                                    images={(editingComment.images || []).filter(i => i.category === 'general')}
                                    pendingFiles={pendingImages.general}
                                    onFilesSelected={(f) => handlePendingAdd('general', f)}
                                    onRemovePending={(i) => handlePendingRemove('general', i)}
                                    onRemoveExisting={handleExistingImageRemove}
                                    editable={true}
                                    isCompressing={isCompressing}
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
                                <CommentImageTiles
                                    images={(editingComment.images || []).filter(i => i.category === 'fit')}
                                    pendingFiles={pendingImages.fit}
                                    onFilesSelected={(f) => handlePendingAdd('fit', f)}
                                    onRemovePending={(i) => handlePendingRemove('fit', i)}
                                    onRemoveExisting={handleExistingImageRemove}
                                    editable={true}
                                    isCompressing={isCompressing}
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
                                <CommentImageTiles
                                    images={(editingComment.images || []).filter(i => i.category === 'workmanship')}
                                    pendingFiles={pendingImages.workmanship}
                                    onFilesSelected={(f) => handlePendingAdd('workmanship', f)}
                                    onRemovePending={(i) => handlePendingRemove('workmanship', i)}
                                    onRemoveExisting={handleExistingImageRemove}
                                    editable={true}
                                    isCompressing={isCompressing}
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
                                <CommentImageTiles
                                    images={(editingComment.images || []).filter(i => i.category === 'wash')}
                                    pendingFiles={pendingImages.wash}
                                    onFilesSelected={(f) => handlePendingAdd('wash', f)}
                                    onRemovePending={(i) => handlePendingRemove('wash', i)}
                                    onRemoveExisting={handleExistingImageRemove}
                                    editable={true}
                                    isCompressing={isCompressing}
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
                                <CommentImageTiles
                                    images={(editingComment.images || []).filter(i => i.category === 'fabric')}
                                    pendingFiles={pendingImages.fabric}
                                    onFilesSelected={(f) => handlePendingAdd('fabric', f)}
                                    onRemovePending={(i) => handlePendingRemove('fabric', i)}
                                    onRemoveExisting={handleExistingImageRemove}
                                    editable={true}
                                    isCompressing={isCompressing}
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
                                <CommentImageTiles
                                    images={(editingComment.images || []).filter(i => i.category === 'accessories')}
                                    pendingFiles={pendingImages.accessories}
                                    onFilesSelected={(f) => handlePendingAdd('accessories', f)}
                                    onRemovePending={(i) => handlePendingRemove('accessories', i)}
                                    onRemoveExisting={handleExistingImageRemove}
                                    editable={true}
                                    isCompressing={isCompressing}
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
                    ) : tabComments.length > 0 ? (
                        /* Multiple Comments View - Collapsible */
                        <div className="space-y-3">
                            {tabComments.map((comment, index) => {
                                const isExpanded = expandedComments.has(comment.id || '') || index === 0;
                                const sampleLabel = comment.sample_number_display || `${comment.sample_number}${['st', 'nd', 'rd', 'th', 'th'][comment.sample_number - 1]} Sample`;

                                return (
                                    <Card key={comment.id} className="overflow-hidden">
                                        {/* Collapsible Header */}
                                        <button
                                            onClick={() => comment.id && toggleCommentExpanded(comment.id)}
                                            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${index === 0
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-200 text-gray-700'
                                                    }`}>
                                                    {sampleLabel}
                                                </span>
                                                {index === 0 && (
                                                    <span className="text-xs text-blue-600 font-medium">LATEST</span>
                                                )}
                                                <span className="text-sm text-gray-500">
                                                    {comment.created_at && formatDate(comment.created_at)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {canEdit && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditComment(comment);
                                                        }}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                {isExpanded ? (
                                                    <ChevronUp className="w-5 h-5 text-gray-400" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                                )}
                                            </div>
                                        </button>

                                        {/* Collapsible Content */}
                                        {isExpanded && (
                                            <div className="p-4 space-y-4 border-t bg-gray-50/50">
                                                <div className="grid gap-4">
                                                    {[
                                                        {
                                                            label: 'General Feedback',
                                                            value: comment.comments_general,
                                                            category: 'general' as ImageCategory,
                                                            editedAt: comment.general_edited_at,
                                                            color: 'text-blue-600',
                                                            bg: 'bg-blue-50',
                                                            border: 'border-blue-100'
                                                        },
                                                        {
                                                            label: 'Fit Comments',
                                                            value: comment.comments_fit,
                                                            category: 'fit' as ImageCategory,
                                                            editedAt: comment.fit_edited_at,
                                                            color: 'text-indigo-600',
                                                            bg: 'bg-indigo-50',
                                                            border: 'border-indigo-100'
                                                        },
                                                        {
                                                            label: 'Workmanship',
                                                            value: comment.comments_workmanship,
                                                            category: 'workmanship' as ImageCategory,
                                                            editedAt: comment.workmanship_edited_at,
                                                            color: 'text-amber-600',
                                                            bg: 'bg-amber-50',
                                                            border: 'border-amber-100'
                                                        },
                                                        {
                                                            label: 'Wash Comments',
                                                            value: comment.comments_wash,
                                                            category: 'wash' as ImageCategory,
                                                            editedAt: comment.wash_edited_at,
                                                            color: 'text-cyan-600',
                                                            bg: 'bg-cyan-50',
                                                            border: 'border-cyan-100'
                                                        },
                                                        {
                                                            label: 'Fabric Comments',
                                                            value: comment.comments_fabric,
                                                            category: 'fabric' as ImageCategory,
                                                            editedAt: comment.fabric_edited_at,
                                                            color: 'text-purple-600',
                                                            bg: 'bg-purple-50',
                                                            border: 'border-purple-100'
                                                        },
                                                        {
                                                            label: 'Accessories',
                                                            value: comment.comments_accessories,
                                                            category: 'accessories' as ImageCategory,
                                                            editedAt: comment.accessories_edited_at,
                                                            color: 'text-rose-600',
                                                            bg: 'bg-rose-50',
                                                            border: 'border-rose-100'
                                                        },
                                                    ].map((item) => {
                                                        const categoryImages = (comment.images || []).filter(i => i.category === item.category);
                                                        // Show category if it has text OR images
                                                        if (!item.value && categoryImages.length === 0) return null;
                                                        return (
                                                            <div key={item.label} className={`rounded-xl border ${item.border} ${item.bg} overflow-hidden`}>
                                                                <div className="px-4 py-2 border-b border-black/5 flex items-center justify-between gap-2">
                                                                    <h4 className={`font-semibold text-sm ${item.color}`}>
                                                                        {item.label}
                                                                    </h4>
                                                                    {item.editedAt && (
                                                                        <span className="text-xs text-gray-400 italic">
                                                                            Edited: {formatDateTime(item.editedAt)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="p-4 bg-white/50">
                                                                    {item.value && (
                                                                        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-[15px]">
                                                                            {item.value}
                                                                        </p>
                                                                    )}
                                                                    {categoryImages.length > 0 && (
                                                                        <CommentImageTiles
                                                                            images={categoryImages}
                                                                            pendingFiles={[]}
                                                                            onFilesSelected={() => { }}
                                                                            onRemovePending={() => { }}
                                                                            onRemoveExisting={() => { }}
                                                                            editable={false}
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {canEdit && (
                                                    <div className="flex justify-end pt-2 border-t">
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => {
                                                                if (comment.id && confirm('Delete this comment?')) {
                                                                    deleteCommentMutation.mutate(comment.id);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        /* Empty State */
                        <Card className="p-12 text-center text-gray-500">
                            <p>No comments for {activeTab} yet.</p>
                            <p className="text-sm mt-1">Click "Add New Sample Comment" to add customer feedback.</p>
                        </Card>
                    )}
                </div>

                {/* Right: Related Links Panel */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Related Links & Documents</h2>
                        {canEdit && (
                            <Button size="sm" onClick={() => setIsLinkDialogOpen(true)}>
                                <Plus className="w-4 h-4 mr-1" />
                                Add Link
                            </Button>
                        )}
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
                                        {link.created_at && (
                                            <p className="text-xs text-gray-400 mt-0.5">Added: {formatDate(link.created_at)}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => window.open(link.url, '_blank')}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </Button>
                                        {canEdit && (
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
                                        )}
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
            {/* Edit Style Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Style Details</DialogTitle>
                        <DialogDescription>
                            Update the style information.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedStyle && (
                        <div className="space-y-4 py-4">
                            <div>
                                <Label>PO Number *</Label>
                                <Input
                                    value={newStyle.po_number}
                                    onChange={(e) => setNewStyle({ ...newStyle, po_number: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Style Name *</Label>
                                <Input
                                    value={newStyle.style_name}
                                    onChange={(e) => setNewStyle({ ...newStyle, style_name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Color/Wash</Label>
                                    <Input
                                        value={newStyle.color}
                                        onChange={(e) => setNewStyle({ ...newStyle, color: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Season</Label>
                                    <Input
                                        value={newStyle.season}
                                        onChange={(e) => setNewStyle({ ...newStyle, season: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Customer</Label>
                                <SearchableSelect
                                    value={newStyle.customer}
                                    onChange={(v) => setNewStyle({ ...newStyle, customer: v })}
                                    options={customers.map((c: any) => ({ value: c.id, label: c.name }))}
                                    placeholder="Select customer..."
                                />
                            </div>
                            <div>
                                <Label>Factory</Label>
                                <SearchableSelect
                                    value={newStyle.factory || ''}
                                    onChange={(v) => setNewStyle({ ...newStyle, factory: v })}
                                    options={factories.map((f: any) => ({ value: f.id, label: f.name }))}
                                    placeholder="Select factory..."
                                />
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => selectedStyle && updateStyleMutation.mutate({ ...newStyle, id: selectedStyle.id })}
                            disabled={!newStyle.po_number || !newStyle.style_name}
                        >
                            Save Changes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StyleCycle;
