import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { FileText, Mail, Trash2, Search, Copy, Loader2, ChevronLeft, ChevronRight, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAuth } from '../lib/useAuth';
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
import InspectionFilters from '../components/InspectionFilters';

// --- TYPE DEFINITIONS ---
type ImageSlot = {
    file: File | null;
    caption: string;
};

type Measurement = {
    pom_name: string;
    tol: number | string;
    std: number | string;
    s1: number | string;
    s2: number | string;
    s3: number | string;
    s4: number | string;
    s5: number | string;
};

type AccessoryItem = {
    name: string;
    status: 'OK' | 'Not OK' | 'N/A';
    comment: string;
};

// Common accessory presets
const ACCESSORY_PRESETS = [
    'Zipper', 'Thread', 'Button', 'Care Label', 'Tags', 'Hangtag',
    'Drawstring', 'Elastic', 'Velcro', 'Snap', 'Hook & Eye', 'Rivet'
];

const Inspections = () => {
    const queryClient = useQueryClient();
    const { canCreateInspections, isReadOnly, canEditEvaluation } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    const [isManualTemplateChange, setIsManualTemplateChange] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [listSearch] = useState('');
    const [, setDebouncedListSearch] = useState('');

    // Filter state for advanced filtering
    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        decisions: [] as string[],
        stages: [] as string[],
        customer: '',
        search: '',
        ordering: '-created_at',
    });

    const [modalSearchTerm, setModalSearchTerm] = useState('');
    const [debouncedModalSearchTerm, setDebouncedModalSearchTerm] = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);

    const [imageSlots, setImageSlots] = useState<ImageSlot[]>([
        { file: null, caption: '' }, { file: null, caption: '' },
        { file: null, caption: '' }, { file: null, caption: '' },
    ]);

    const { register, control, handleSubmit, reset, setValue, watch, getValues } = useForm({
        defaultValues: {
            style: '', color: '', po_number: '', stage: 'Proto',
            customer: '', template: '',

            // Customer Comments by Category (Previous Feedback)
            customer_remarks: '',
            customer_fit_comments: '',
            customer_workmanship_comments: '',
            customer_wash_comments: '',
            customer_fabric_comments: '',
            customer_accessories_comments: '',
            customer_comments_addressed: false,

            // QA Comments by Category
            qa_fit_comments: '', qa_workmanship_comments: '', qa_wash_comments: '', qa_fabric_comments: '', qa_accessories_comments: '',

            // Fabric Checks
            fabric_handfeel: 'OK',
            fabric_pilling: 'None',

            // Dynamic Accessories
            accessories_data: [] as AccessoryItem[],

            remarks: '',
            decision: '',
            measurements: [] as Measurement[],
        }
    });

    const { fields, replace } = useFieldArray({ control, name: "measurements" });
    const { fields: accFields, append: appendAcc, remove: removeAcc } = useFieldArray({ control, name: "accessories_data" });

    // --- Selection & Bulk Delete Logic ---
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const [dragStart, setDragStart] = useState<{ r: number, c: number } | null>(null);
    const columnKeys = ['std', 's1', 's2', 's3', 's4', 's5', 's6'];

    const getCellId = (r: number, k: string) => `${r}-${k}`;

    // Handle Delete/Backspace
    // Handle KeyDown (Enter for Navigation, Backspace/Delete for Bulk Clear)
    const handleCellKeyDown = (e: React.KeyboardEvent, index: number, key: string) => {
        // Handle Enter for Navigation
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission

            const currentColIdx = columnKeys.indexOf(key);
            if (currentColIdx === -1) return;

            // Try moving down (same column, next row)
            const nextRowIdx = index + 1;
            if (nextRowIdx < fields.length) {
                const nextInput = document.querySelector(`input[name="measurements.${nextRowIdx}.${key}"]`) as HTMLInputElement;
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select(); // Optional: select content
                }
            } else {
                // If at bottom, move to top of next column
                const nextColIdx = currentColIdx + 1;
                if (nextColIdx < columnKeys.length) {
                    const nextColKey = columnKeys[nextColIdx];
                    const nextInput = document.querySelector(`input[name="measurements.0.${nextColKey}"]`) as HTMLInputElement;
                    if (nextInput) {
                        nextInput.focus();
                        nextInput.select(); // Optional: select content
                    }
                }
            }
            return;
        }

        // If Backspace/Delete is pressed
        if (e.key === 'Backspace' || e.key === 'Delete') {
            // If we have a selection and the current cell is part of it (or just any selection exists)
            if (selectedCells.size > 0) {
                // Only prevent default if we are actually clearing multiple cells or the cell is in selection
                // But for safety to avoid navigating back, we prevent default if selection exists
                if (selectedCells.has(getCellId(index, key)) || selectedCells.size > 0) {
                    // If it's just a single cursor in a cell without range selection, we might want to allow normal backspace?
                    // But the user asked for "bulk delete". 
                    // Let's keep existing logic: if selection > 0, clear all.
                    e.preventDefault();

                    let count = 0;
                    selectedCells.forEach(cellId => {
                        const [rStr, k] = cellId.split('-');
                        const r = parseInt(rStr);
                        setValue(`measurements.${r}.${k}` as any, '');
                        count++;
                    });

                    if (count > 0) {
                        toast.success(`Cleared ${count} cells`);
                    }
                }
            }
        }
    };

    // PC: Mouse Down (Start Drag)
    const handleCellMouseDown = (index: number, key: string) => {
        const cIndex = columnKeys.indexOf(key);
        if (cIndex === -1) return;

        setIsDragSelecting(true);
        setDragStart({ r: index, c: cIndex });

        // If Ctrl is not held, start new selection
        // For simplicity, always start new selection on drag start
        setSelectedCells(new Set([getCellId(index, key)]));
    };

    // PC: Mouse Enter (Drag Over)
    const handleCellMouseEnter = (index: number, key: string) => {
        if (isDragSelecting && dragStart) {
            const cIndex = columnKeys.indexOf(key);
            if (cIndex === -1) return;

            const rMin = Math.min(dragStart.r, index);
            const rMax = Math.max(dragStart.r, index);
            const cMin = Math.min(dragStart.c, cIndex);
            const cMax = Math.max(dragStart.c, cIndex);

            const newSet = new Set<string>();
            for (let r = rMin; r <= rMax; r++) {
                for (let c = cMin; c <= cMax; c++) {
                    newSet.add(getCellId(r, columnKeys[c]));
                }
            }
            setSelectedCells(newSet);
        }
    };

    // Global Mouse Up (End Drag) - Attached to window/document ideally, but here we can add to container
    useEffect(() => {
        const handleUp = () => {
            setIsDragSelecting(false);
            setDragStart(null);
        };
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchend', handleUp);
        return () => {
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchend', handleUp);
        };
    }, []);

    // Mobile: Long Press Logic
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    const handleTouchStart = (index: number, key: string) => {
        longPressTimer.current = setTimeout(() => {
            // Trigger selection
            const id = getCellId(index, key);
            setSelectedCells(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) newSet.delete(id); // Toggle if already selected
                else newSet.add(id);
                return newSet;
            });
            if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
        }, 500); // 500ms long press
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    const isSelected = (index: number, key: string) => selectedCells.has(getCellId(index, key));


    // Debounce
    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedListSearch(listSearch); setPage(1); }, 500);
        return () => clearTimeout(timer);
    }, [listSearch]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedModalSearchTerm(modalSearchTerm), 500);
        return () => clearTimeout(timer);
    }, [modalSearchTerm]);

    // Fetching
    const { data: inspectionData, isLoading, isPlaceholderData } = useQuery({
        queryKey: ['inspections', page, filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page', page.toString());

            // Add filter parameters
            if (filters.dateFrom) params.append('created_at_after', filters.dateFrom);
            if (filters.dateTo) params.append('created_at_before', filters.dateTo);
            if (filters.decisions.length > 0) {
                filters.decisions.forEach(d => params.append('decision', d));
            }
            if (filters.stages.length > 0) {
                filters.stages.forEach(s => params.append('stage', s));
            }
            if (filters.customer) params.append('customer', filters.customer);
            if (filters.search) params.append('search', filters.search);
            if (filters.ordering) params.append('ordering', filters.ordering);
            return (await api.get(`/inspections/?${params.toString()}`)).data;
        },
        placeholderData: (previousData) => previousData,
    });

    const { data: customersData } = useQuery({
        queryKey: ['customers'],
        queryFn: async () => (await api.get('/customers/')).data,
    });

    const { data: templatesData } = useQuery({
        queryKey: ['templates'],
        queryFn: async () => (await api.get('/templates/')).data,
    });

    const customers = Array.isArray(customersData) ? customersData : customersData?.results || [];
    const templates = Array.isArray(templatesData) ? templatesData : templatesData?.results || [];

    const { data: modalSearchResults, isLoading: isSearchingModal } = useQuery({
        queryKey: ['inspectionSearch', debouncedModalSearchTerm],
        queryFn: async () => {
            if (!debouncedModalSearchTerm) return [];
            const res = await api.get(`/inspections/?search=${debouncedModalSearchTerm}`);
            return res.data.results || res.data;
        },
        enabled: debouncedModalSearchTerm.length > 0,
    });

    // Load Data Handler
    const handleLoadInspection = async (id: string) => {
        try {
            toast.info("Loading previous data...");
            const { data } = await api.get(`/inspections/${id}/`);

            setIsManualTemplateChange(false);
            setSelectedTemplate(data.template);

            reset({
                style: data.style || '',
                color: data.color || '',
                po_number: data.po_number || '',
                stage: data.stage || 'Proto',
                customer: data.customer || '',
                template: data.template || '',

                // Customer Comments by Category
                customer_remarks: data.customer_remarks || '',
                customer_fit_comments: data.customer_fit_comments || '',
                customer_workmanship_comments: data.customer_workmanship_comments || '',
                customer_wash_comments: data.customer_wash_comments || '',
                customer_fabric_comments: data.customer_fabric_comments || '',
                customer_accessories_comments: data.customer_accessories_comments || '',
                customer_comments_addressed: data.customer_comments_addressed || false,

                // QA Comments
                qa_fit_comments: data.qa_fit_comments || '',
                qa_workmanship_comments: data.qa_workmanship_comments || '',
                qa_wash_comments: data.qa_wash_comments || '',
                qa_fabric_comments: data.qa_fabric_comments || '',
                qa_accessories_comments: data.qa_accessories_comments || '',

                // Fabric Checks
                fabric_handfeel: data.fabric_handfeel || 'OK',
                fabric_pilling: data.fabric_pilling || 'None',

                // Accessories
                accessories_data: data.accessories_data || [],

                remarks: data.remarks || '',

                decision: '',
                measurements: (data.measurements || []).map((m: any) => ({
                    pom_name: m.pom_name,
                    tol: m.tol,
                    std: m.std ?? '',
                    s1: m.s1 ?? '', s2: m.s2 ?? '', s3: m.s3 ?? '',
                    s4: m.s4 ?? '', s5: m.s5 ?? '', s6: m.s6 ?? '',
                    status: 'OK'
                }))
            });

            setImageSlots([{ file: null, caption: '' }, { file: null, caption: '' }, { file: null, caption: '' }, { file: null, caption: '' }]);
            setShowSearchResults(false);
            setModalSearchTerm('');
            toast.success("Loaded successfully!");
        } catch (e) {
            toast.error("Failed to load details");
        }
    };

    // Template Change
    useEffect(() => {
        if (isManualTemplateChange && selectedTemplate && templates) {
            const template = templates.find((t: any) => t.id === selectedTemplate);
            if (template) {
                replace(template.poms.map((pom: any) => ({
                    pom_name: pom.name,
                    tol: pom.default_tol,
                    std: '',
                    s1: '', s2: '', s3: '', s4: '', s5: '', s6: '',
                    status: 'OK'
                })));
            }
        }
    }, [selectedTemplate, templates, replace, isManualTemplateChange]);

    // Paste handler for Excel/Sheets data - works like Excel paste
    const handleMeasurementPaste = (rowIndex: number, startColumn: string) => (event: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedData = event.clipboardData.getData('text');

        // Check if it's multi-line or multi-column data
        const lines = pastedData.split('\n').filter(line => line.trim());
        const firstLineColumns = lines[0]?.split('\t') || [];

        // Only intercept if pasting multiple rows OR multiple columns
        if (lines.length > 1 || firstLineColumns.length > 1) {
            event.preventDefault();

            // Get current measurements
            const currentMeasurements = getValues('measurements');

            // Define column order for measurements
            const columnOrder = ['std', 's1', 's2', 's3', 's4', 's5', 's6'];
            const startColIndex = columnOrder.indexOf(startColumn);

            if (startColIndex === -1) return; // Invalid column

            // Auto-detect header row
            const hasHeader = /pom|name|std|s1|s2|s3|s4|s5|s6/i.test(lines[0]);
            const dataRows = hasHeader ? lines.slice(1) : lines;

            const affectedRows = Math.min(dataRows.length, currentMeasurements.length - rowIndex);

            // Ask for confirmation
            if (!confirm(`Paste ${dataRows.length} row(s) × ${firstLineColumns.length} column(s) starting from ${startColumn.toUpperCase()} at row ${rowIndex + 1}?`)) {
                return;
            }

            // Paste data starting from the exact cell
            dataRows.forEach((line, rowOffset) => {
                const targetRow = rowIndex + rowOffset;
                if (targetRow < currentMeasurements.length) {
                    const columns = line.split('\t');

                    // Paste each column starting from startColumn
                    columns.forEach((value, colOffset) => {
                        const targetColIndex = startColIndex + colOffset;
                        if (targetColIndex < columnOrder.length) {
                            const fieldName = columnOrder[targetColIndex];
                            setValue(`measurements.${targetRow}.${fieldName}` as any, value?.trim() || '');
                        }
                    });
                }
            });

            toast.success(`Pasted ${affectedRows} row(s) starting from ${startColumn.toUpperCase()} at row ${rowIndex + 1}!`);
        }
    };

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const jsonPayload = {
                ...data,
                measurements: data.measurements.map((m: any) => ({
                    ...m,
                    s1: m.s1 === '' ? null : m.s1, s2: m.s2 === '' ? null : m.s2, s3: m.s3 === '' ? null : m.s3,
                    s4: m.s4 === '' ? null : m.s4, s5: m.s5 === '' ? null : m.s5, s6: m.s6 === '' ? null : m.s6,
                    std: m.std === '' ? null : m.std,
                }))
            };

            const res = await api.post('/inspections/', jsonPayload);
            const inspectionId = res.data.id;

            for (const slot of imageSlots) {
                if (slot.file) {
                    const formData = new FormData();
                    formData.append('image', slot.file);
                    formData.append('caption', slot.caption || 'Inspection Image');
                    await api.post(`/inspections/${inspectionId}/upload_image/`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }
            }
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
            setIsOpen(false);
            reset();
            setImageSlots([{ file: null, caption: '' }, { file: null, caption: '' }, { file: null, caption: '' }, { file: null, caption: '' }]);
            setSelectedTemplate(null);
            setIsManualTemplateChange(false);
            toast.success('Evaluation created');
        },
        onError: (err) => {
            console.error(err);
            toast.error('Failed to save');
        }
    });

    // Filter handlers
    const handleFiltersChange = (newFilters: typeof filters) => {
        setFilters(newFilters);
        setPage(1); // Reset to first page when filters change
    };

    const handleClearFilters = () => {
        setFilters({
            dateFrom: '',
            dateTo: '',
            decisions: [],
            stages: [],
            customer: '',
            search: '',
            ordering: '-created_at',
        });
        setPage(1);
    };

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => api.delete(`/inspections/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
            toast.success('Deleted');
        }
    });

    const emailMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.post(`/inspections/${id}/send_email/`, { recipients: [] });
        },
        onSuccess: () => toast.success('Email sent to customer')
    });

    // Validation Logic
    const measurements = watch('measurements');
    const checkTol = (val: any, std: any, tol: any) => {
        if (!val || val === '' || !std || std === '') return false;
        const numVal = parseFloat(val);
        const numStd = parseFloat(std);
        const numTol = parseFloat(tol);
        if (isNaN(numVal) || isNaN(numStd) || isNaN(numTol)) return false;
        return Math.abs(numVal - numStd) > (numTol + 0.0001);
    };

    const handleImageChange = (index: number, file: File | null) => {
        const newSlots = [...imageSlots];
        newSlots[index].file = file;
        if (file && !newSlots[index].caption) {
            if (index === 0) newSlots[index].caption = "Front View";
            if (index === 1) newSlots[index].caption = "Back View";
        }
        setImageSlots(newSlots);
    };

    const handleCaptionChange = (index: number, text: string) => {
        const newSlots = [...imageSlots];
        newSlots[index].caption = text;
        setImageSlots(newSlots);
    };

    const handleDownloadPdf = async (id: string, style: string) => {
        try {
            const res = await api.get(`/inspections/${id}/pdf/`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${style}_Evaluation.pdf`);
            document.body.appendChild(link);
            link.click();
        } catch (e) { toast.error('Download failed'); }
    };

    if (isLoading) return <div>Loading...</div>;
    const inspectionsList = Array.isArray(inspectionData) ? inspectionData : inspectionData?.results || [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-900">Evaluation</h1>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    {canCreateInspections && (
                        <DialogTrigger asChild>
                            <Button><Plus className="w-4 h-4 mr-2" />New Evaluation</Button>
                        </DialogTrigger>
                    )}
                    <DialogContent className="!left-0 !top-0 !right-0 !bottom-0 !translate-x-0 !translate-y-0 max-w-none !rounded-none overflow-y-auto p-0 m-0">
                        <DialogHeader><DialogTitle>Evaluation</DialogTitle></DialogHeader>

                        <div className="space-y-6 py-4 px-6 overflow-x-hidden">
                            {/* Search Bar */}
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <Label className="text-blue-700 mb-2 flex items-center gap-2">
                                    <Copy className="w-4 h-4" /> Load previous evaluation data?
                                </Label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Search by Style, PO or Customer..."
                                        className="pl-8 bg-white"
                                        value={modalSearchTerm}
                                        onChange={(e) => { setModalSearchTerm(e.target.value); setShowSearchResults(true); }}
                                    />
                                    {isSearchingModal && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-gray-400" />}

                                    {showSearchResults && debouncedModalSearchTerm && (
                                        <div className="absolute z-50 w-full bg-white border rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                                            {modalSearchResults?.map((item: any) => (
                                                <div key={item.id} className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 text-sm" onClick={() => handleLoadInspection(item.id)}>
                                                    <span className="font-bold">{item.style}</span>
                                                    <span className="mx-2 text-gray-400">|</span>
                                                    <span>{item.po_number}</span>
                                                    <span className="mx-2 text-gray-400">|</span>
                                                    <span>{item.color}</span>
                                                    <span className="mx-2 text-gray-400">|</span>
                                                    <span className="text-blue-600 font-medium">{item.stage}</span>
                                                    <span className="mx-2 text-gray-400">|</span>
                                                    <span className="text-gray-500">{new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="space-y-2"><Label>Style</Label><Input {...register("style", { required: true })} /></div>
                                    <div className="space-y-2"><Label>Color</Label><Input {...register("color")} /></div>
                                    <div className="space-y-2"><Label>PO Number</Label><Input {...register("po_number")} /></div>
                                    <div className="space-y-2">
                                        <Label>Stage</Label>
                                        <Select onValueChange={(v) => setValue("stage", v)} defaultValue={watch('stage')}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {['Dev', 'Proto', 'Fit', 'SMS', 'Size Set', 'PPS', 'Shipment Sample'].map(s => (
                                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Customer</Label>
                                        <Select value={watch("customer")} onValueChange={(v) => {
                                            setValue("customer", v);
                                            setValue("template", "");
                                            setSelectedTemplate(null);
                                        }}>
                                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                            <SelectContent>
                                                {customers?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Template</Label>
                                        <Select
                                            value={watch("template")}
                                            onValueChange={(v) => { setIsManualTemplateChange(true); setValue("template", v); setSelectedTemplate(v); }}
                                            disabled={!watch("customer")}
                                        >
                                            <SelectTrigger><SelectValue placeholder={watch("customer") ? "Select Template..." : "Select Customer First"} /></SelectTrigger>
                                            <SelectContent>
                                                {templates?.filter((t: any) => t.customer === watch("customer") || !t.customer).map((t: any) => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>


                                {/* Measurements Grid (6 Samples) */}
                                <div className="space-y-2">
                                    <Label>Measurements (Hold & Drag to Select Multiple • Delete/Backspace to Clear)</Label>
                                    <div className="border rounded-md p-4 bg-white overflow-x-auto max-w-full">
                                        <div className="min-w-[800px] grid grid-cols-10 gap-2 mb-2 font-medium text-xs text-gray-500 uppercase text-center">
                                            <div className="col-span-2 text-left">POM</div>
                                            <div className="col-span-1">Tol</div>
                                            <div className="col-span-1">Std</div>
                                            <div className="col-span-1">S1</div>
                                            <div className="col-span-1">S2</div>
                                            <div className="col-span-1">S3</div>
                                            <div className="col-span-1">S4</div>
                                            <div className="col-span-1">S5</div>
                                            <div className="col-span-1">S6</div>
                                        </div>
                                        {fields.map((field, index) => {
                                            const m = measurements[index] || {};
                                            const isRed = (val: any) => checkTol(val, m.std, m.tol);
                                            return (
                                                <div key={field.id} className="min-w-[800px] grid grid-cols-10 gap-2 mb-2 items-center">
                                                    <div className="col-span-2"><Input {...register(`measurements.${index}.pom_name`)} readOnly className="bg-gray-50 h-8 text-xs" /></div>
                                                    <div className="col-span-1"><Input {...register(`measurements.${index}.tol`)} readOnly className="bg-gray-50 h-8 text-xs text-center" /></div>

                                                    {/* Editable STD Field */}
                                                    <div className="col-span-1">
                                                        <Input
                                                            {...register(`measurements.${index}.std`)}
                                                            className={`h-8 text-xs text-center ${isSelected(index, 'std') ? 'bg-blue-200 ring-2 ring-blue-500' : 'bg-blue-50'}`}
                                                            placeholder="-"
                                                            onPaste={handleMeasurementPaste(index, 'std')}
                                                            onKeyDown={(e) => handleCellKeyDown(e, index, 'std')}
                                                            onMouseDown={() => handleCellMouseDown(index, 'std')}
                                                            onMouseEnter={() => handleCellMouseEnter(index, 'std')}
                                                            onTouchStart={() => handleTouchStart(index, 'std')}
                                                            onTouchEnd={handleTouchEnd}
                                                            autoComplete="off"
                                                        />
                                                    </div>

                                                    {[1, 2, 3, 4, 5, 6].map(num => {
                                                        const key = `s${num}` as keyof Measurement;
                                                        const selected = isSelected(index, key);
                                                        return (
                                                            <div key={num} className="col-span-1">
                                                                <Input
                                                                    type="number" step="0.1"
                                                                    {...register(`measurements.${index}.${key}`)}
                                                                    className={`h-8 text-center transition-colors 
                                                                        ${selected ? 'bg-blue-200 ring-2 ring-blue-500 z-10 relative' : ''} 
                                                                        ${!selected && isRed((m as any)[key]) ? 'text-red-600 font-bold bg-red-50' : ''}
                                                                    `}
                                                                    onPaste={handleMeasurementPaste(index, key)}
                                                                    onKeyDown={(e) => handleCellKeyDown(e, index, key)}
                                                                    onMouseDown={() => handleCellMouseDown(index, key)}
                                                                    onMouseEnter={() => handleCellMouseEnter(index, key)}
                                                                    onTouchStart={() => handleTouchStart(index, key)}
                                                                    onTouchEnd={handleTouchEnd}
                                                                    autoComplete="off"
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>


                                {/* ===== QUALITY EVALUATION SECTION ===== */}
                                <div className="space-y-6 border p-6 rounded-lg bg-white shadow-sm">
                                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Quality Evaluation</h3>

                                    {/* Legacy Customer Remarks (keep for old data) */}
                                    <div className="space-y-2">
                                        <Label className="text-sm text-gray-500">Customer Feedback Summary (General)</Label>
                                        <Textarea {...register("customer_remarks")} className="h-16 bg-yellow-50 text-sm" placeholder="General customer feedback..." />
                                    </div>

                                    {/* FIT Section - Side by Side */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                                        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100">
                                            <Label className="text-yellow-800 font-semibold text-sm mb-1 block">Customer Fit Comments</Label>
                                            <Textarea {...register("customer_fit_comments")} className="bg-white border-yellow-200 h-14 text-sm" placeholder="Previous customer feedback..." />
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                                            <Label className="text-blue-800 font-semibold text-sm mb-1 block">QA Fit Findings</Label>
                                            <Textarea {...register("qa_fit_comments")} className="bg-white border-blue-200 h-14 text-sm" placeholder="Enter QA findings..." />
                                        </div>
                                    </div>

                                    {/* WORKMANSHIP Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100">
                                            <Label className="text-yellow-800 font-semibold text-sm mb-1 block">Customer Workmanship Comments</Label>
                                            <Textarea {...register("customer_workmanship_comments")} className="bg-white border-yellow-200 h-14 text-sm" />
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                                            <Label className="text-blue-800 font-semibold text-sm mb-1 block">QA Workmanship Findings</Label>
                                            <Textarea {...register("qa_workmanship_comments")} className="bg-white border-blue-200 h-14 text-sm" />
                                        </div>
                                    </div>

                                    {/* WASH Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100">
                                            <Label className="text-yellow-800 font-semibold text-sm mb-1 block">Customer Wash Comments</Label>
                                            <Textarea {...register("customer_wash_comments")} className="bg-white border-yellow-200 h-14 text-sm" />
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                                            <Label className="text-blue-800 font-semibold text-sm mb-1 block">QA Wash Findings</Label>
                                            <Textarea {...register("qa_wash_comments")} className="bg-white border-blue-200 h-14 text-sm" />
                                        </div>
                                    </div>

                                    {/* FABRIC Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100">
                                            <Label className="text-yellow-800 font-semibold text-sm mb-1 block">Customer Fabric Comments</Label>
                                            <Textarea {...register("customer_fabric_comments")} className="bg-white border-yellow-200 h-14 text-sm" />
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                                            <Label className="text-blue-800 font-semibold text-sm mb-1 block">QA Fabric Findings</Label>
                                            <Textarea {...register("qa_fabric_comments")} className="bg-white border-blue-200 h-14 text-sm" />
                                        </div>
                                    </div>

                                    {/* ACCESSORIES Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100">
                                            <Label className="text-yellow-800 font-semibold text-sm mb-1 block">Customer Accessories Comments</Label>
                                            <Textarea {...register("customer_accessories_comments")} className="bg-white border-yellow-200 h-14 text-sm" />
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                                            <Label className="text-blue-800 font-semibold text-sm mb-1 block">QA Accessories Findings</Label>
                                            <Textarea {...register("qa_accessories_comments")} className="bg-white border-blue-200 h-14 text-sm" />
                                        </div>
                                    </div>

                                    {/* Customer Comments Addressed Checkbox */}
                                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-md border border-green-200">
                                        <input
                                            type="checkbox"
                                            {...register("customer_comments_addressed")}
                                            className="w-5 h-5 accent-green-600"
                                        />
                                        <Label className="text-green-800 font-medium cursor-pointer">
                                            ✓ All previous customer comments have been addressed
                                        </Label>
                                    </div>
                                </div>

                                {/* ===== ACCESSORIES & FABRIC SECTION ===== */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                                    {/* Dynamic Accessories Checklist (2 columns) */}
                                    <div className="lg:col-span-2 border p-4 rounded-lg bg-gray-50">
                                        <div className="flex justify-between items-center mb-4">
                                            <Label className="text-base font-bold">Accessories Checklist</Label>
                                            <div className="flex gap-2">
                                                <Select onValueChange={(val) => appendAcc({ name: val, status: 'OK', comment: '' })}>
                                                    <SelectTrigger className="w-[140px] h-8 text-xs bg-white">
                                                        <SelectValue placeholder="+ Add Preset" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ACCESSORY_PRESETS.map(preset => (
                                                            <SelectItem key={preset} value={preset}>{preset}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => appendAcc({ name: '', status: 'OK', comment: '' })}
                                                    className="bg-white hover:bg-gray-100 h-8"
                                                >
                                                    <Plus className="w-3 h-3 mr-1" /> Custom
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {accFields.map((field, index) => (
                                                <div key={field.id} className="flex gap-2 items-start bg-white p-2 rounded border">
                                                    <Input
                                                        {...register(`accessories_data.${index}.name`)}
                                                        placeholder="Item name"
                                                        className="w-1/4 h-8 text-sm"
                                                    />
                                                    <Select
                                                        value={watch(`accessories_data.${index}.status`)}
                                                        onValueChange={(val) => setValue(`accessories_data.${index}.status`, val as any)}
                                                    >
                                                        <SelectTrigger className={`w-24 h-8 text-xs font-medium ${watch(`accessories_data.${index}.status`) === 'Not OK' ? 'text-red-600 bg-red-50' :
                                                            watch(`accessories_data.${index}.status`) === 'N/A' ? 'text-gray-400' : 'text-green-600 bg-green-50'
                                                            }`}>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="OK">OK</SelectItem>
                                                            <SelectItem value="Not OK">Not OK</SelectItem>
                                                            <SelectItem value="N/A">N/A</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Input
                                                        {...register(`accessories_data.${index}.comment`)}
                                                        placeholder="Remarks..."
                                                        className="flex-1 h-8 text-sm"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeAcc(index)}
                                                        className="text-red-500 hover:bg-red-50 h-8 w-8"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}

                                            {accFields.length === 0 && (
                                                <div className="text-center py-6 text-gray-400 border-2 border-dashed rounded-md text-sm">
                                                    No accessories added. Use presets or click "Custom" to add items.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Fabric Check Panel (1 column) */}
                                    <div className="border p-4 rounded-lg bg-white h-fit">
                                        <Label className="text-base font-bold mb-4 block">Fabric Check</Label>

                                        <div className="space-y-5">
                                            {/* Handfeel Radio */}
                                            <div className="space-y-2">
                                                <Label className="text-sm text-gray-600">Handfeel</Label>
                                                <div className="flex gap-3">
                                                    <label className={`flex items-center gap-2 cursor-pointer border p-2 rounded-md flex-1 transition-all ${watch('fabric_handfeel') === 'OK' ? 'bg-green-50 border-green-300' : 'hover:bg-gray-50'
                                                        }`}>
                                                        <input
                                                            type="radio"
                                                            value="OK"
                                                            {...register('fabric_handfeel')}
                                                            className="accent-green-600 w-4 h-4"
                                                        />
                                                        <span className="text-sm font-medium">OK</span>
                                                    </label>
                                                    <label className={`flex items-center gap-2 cursor-pointer border p-2 rounded-md flex-1 transition-all ${watch('fabric_handfeel') === 'Not OK' ? 'bg-red-50 border-red-300' : 'hover:bg-gray-50'
                                                        }`}>
                                                        <input
                                                            type="radio"
                                                            value="Not OK"
                                                            {...register('fabric_handfeel')}
                                                            className="accent-red-600 w-4 h-4"
                                                        />
                                                        <span className="text-sm font-medium">Not OK</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Pilling Select */}
                                            <div className="space-y-2">
                                                <Label className="text-sm text-gray-600">Pilling</Label>
                                                <Select
                                                    value={watch('fabric_pilling')}
                                                    onValueChange={(val) => setValue('fabric_pilling', val)}
                                                >
                                                    <SelectTrigger className={`w-full ${watch('fabric_pilling') === 'High' ? 'text-red-600 bg-red-50' :
                                                        watch('fabric_pilling') === 'Low' ? 'text-orange-600 bg-orange-50' : 'text-green-600 bg-green-50'
                                                        }`}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="None">None (Good)</SelectItem>
                                                        <SelectItem value="Low">Low (Acceptable)</SelectItem>
                                                        <SelectItem value="High">High (Reject)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Final Remarks */}
                                <div className="space-y-2">
                                    <Label>QA Final Remarks</Label>
                                    <Textarea {...register("remarks")} className="h-20" placeholder="General remarks..." />
                                </div>

                                {/* Images */}
                                <div className="space-y-2">
                                    <Label>Images (Max 4)</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {imageSlots.map((slot, idx) => (
                                            <div key={idx} className="border p-3 rounded-md space-y-2 bg-gray-50">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold bg-white border px-2 py-1 rounded">#{idx + 1}</span>
                                                    <Input type="file" accept="image/*" capture="environment" className="text-xs bg-white" onChange={(e) => handleImageChange(idx, e.target.files ? e.target.files[0] : null)} />
                                                </div>
                                                <Input placeholder="Caption" value={slot.caption} onChange={(e) => handleCaptionChange(idx, e.target.value)} className="h-8 text-sm bg-white" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Decision */}
                                <div className="space-y-2">
                                    <Label>Overall Decision</Label>
                                    <div className="flex gap-4">
                                        {['Accepted', 'Rejected', 'Represent'].map((status) => (
                                            <div
                                                key={status}
                                                className={`cursor-pointer px-4 py-2 rounded-md border font-bold text-sm transition-all
                                                    ${watch('decision') === status
                                                        ? (status === 'Accepted' ? 'bg-green-600 text-white border-green-700' : status === 'Rejected' ? 'bg-red-600 text-white border-red-700' : 'bg-orange-500 text-white border-orange-700')
                                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                                    }`}
                                                onClick={() => setValue('decision', status)}
                                            >
                                                {status}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Button type="submit" className="w-full h-12 text-lg" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Saving...' : 'Save Evaluation'}
                                </Button>
                            </form>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Main List */}
            <InspectionFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onClearAll={handleClearFilters}
            />


            <div className="border rounded-lg bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Style</TableHead>
                            <TableHead>PO #</TableHead>
                            <TableHead>Stage</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Decision</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inspectionsList.map((inspection: any) => (
                            <TableRow key={inspection.id}>
                                <TableCell className="font-medium">{inspection.style}</TableCell>
                                <TableCell>{inspection.po_number}</TableCell>
                                <TableCell>{inspection.stage}</TableCell>
                                <TableCell className="text-xs text-gray-600">
                                    {new Date(inspection.created_at).toLocaleString('en-GB', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false
                                    }).replace(',', '')}
                                </TableCell>
                                <TableCell className="text-xs text-gray-500">{inspection.created_by_username || 'Unknown'}</TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${inspection.decision === 'Accepted' ? 'bg-green-100 text-green-800' :
                                        inspection.decision === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                                        }`}>
                                        {inspection.decision || 'Pending'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(inspection.id, inspection.style)}>
                                        <FileText className="w-4 h-4" />
                                    </Button>
                                    {!isReadOnly && (
                                        <>
                                            <Button variant="outline" size="sm" onClick={() => {
                                                if (confirm(`Send report to customer for ${inspection.style}?`)) emailMutation.mutate(inspection.id)
                                            }}>
                                                <Mail className="w-4 h-4" />
                                            </Button>
                                            {canEditEvaluation && (
                                                <Button variant="ghost" size="icon" className="text-red-500" onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(inspection.id) }}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <div className="flex items-center justify-between px-4 py-4 border-t">
                    <div className="text-sm text-gray-500">Page {page}</div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage(old => Math.max(old - 1, 1))} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
                        <Button variant="outline" size="sm" onClick={() => setPage(old => old + 1)} disabled={!inspectionData?.next || isPlaceholderData}><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Inspections;