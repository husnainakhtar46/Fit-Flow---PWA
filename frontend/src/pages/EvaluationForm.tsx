import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';

import { Plus, FileText, ChevronLeft, ChevronRight, Trash2, Save, Loader2, Clock, Layers, Pencil, FileEdit, Mail } from 'lucide-react';
import { SearchableSelect } from '../components/SearchableSelect';
import { InlineSuggestionDropdown } from '../components/InlineSuggestionDropdown';
import { useStyleLookup } from '../hooks/useStyleLookup';
import { useAutosave } from '../hooks/useAutosave';
import { toast } from 'sonner';

import api from '../lib/api';


import { useAuth } from '../lib/useAuth';
import { db, cacheCustomers, cacheTemplates, cacheFactories, getCachedCustomers, getCachedTemplates, getCachedFactories, saveDraftLocally } from '../lib/db';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import EvaluationPDFReport from '../components/EvaluationPDFReport';
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
    DialogDescription,
} from '../components/ui/dialog';
import InspectionFilters from '../components/InspectionFilters';
import SyncManager from '../components/SyncManager';

// --- TYPE DEFINITIONS ---
type ImageSlot = {
    file: File | string | null;
    caption: string;
};

type MeasurementSample = {
    index: number;
    value: number | string | null;
};

type Measurement = {
    pom_name: string;
    tol: number | string;
    std: number | string;
    samples: MeasurementSample[];
};

type AccessoryItem = {
    name: string;
    comment: string;
};

// Common accessory presets
const ACCESSORY_PRESETS = [
    'Heat Transfer Label', 'Embroidery', 'PC Lining', 'Fusing',
    'Elastic', 'Button', 'Rivet', 'Zipper',
    'Main Label', 'Size Label', 'PU Patch', 'Hang Tag',
    'Over Rider Tag', 'Tab Label', 'Price Ticket', 'Hook & Eye', 'Care Label'
];

// Define initial clean state for resets
const INITIAL_FORM_STATE = {
    style: '', color: '', po_number: '', factory: '', stage: 'Proto',
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
};

const EvaluationForm = () => {
    const queryClient = useQueryClient();
    const { canCreateInspections, isReadOnly, canEditEvaluation, userType, isSuperUser } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
    const [showDecisionError, setShowDecisionError] = useState(false);
    const [isLoadingStyleComments, setIsLoadingStyleComments] = useState(false);
    const [showStyleSuggestions, setShowStyleSuggestions] = useState(false);
    const [showColorSuggestions, setShowColorSuggestions] = useState(false);
    const { getStylesForPO, getColorsForPO } = useStyleLookup();

    const [isManualTemplateChange, setIsManualTemplateChange] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showResumeDraftDialog, setShowResumeDraftDialog] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);

    // State for Similar PO Suggestions Dialog
    const [showSimilarPOsDialog, setShowSimilarPOsDialog] = useState(false);
    const [similarPOs, setSimilarPOs] = useState<any[]>([]);

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
        factory: '',
        search: '',
        ordering: '-created_at',
    });



    // Fetch Factories
    const { data: factoriesData } = useQuery({
        queryKey: ['factories-all'],
        queryFn: async () => {
            try {
                const res = await api.get('/factories/');
                const data = res.data.results || [];

                // Cache for offline use
                try { await cacheFactories(data); } catch (e) { console.warn('Factory cache fail', e); }

                return data;
            } catch (error) {
                console.error('Factory fetch failed:', error);
                const cached = await getCachedFactories();
                return cached || [];
            }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,
    });

    const factories = factoriesData || [];

    const [imageSlots, setImageSlots] = useState<ImageSlot[]>([
        { file: null, caption: 'Front View' }, { file: null, caption: 'Back View' },
        { file: null, caption: '' }, { file: null, caption: '' },
        { file: null, caption: '' }, { file: null, caption: '' },
    ]);

    const { register, control, handleSubmit, reset, setValue, watch, getValues } = useForm({
        defaultValues: INITIAL_FORM_STATE
    });

    const { fields, replace } = useFieldArray({ control, name: "measurements" });
    const { fields: accFields, append: appendAcc, remove: removeAcc } = useFieldArray({ control, name: "accessories_data" });

    // --- Selection & Bulk Delete Logic ---
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const [dragStart, setDragStart] = useState<{ r: number, c: number } | null>(null);

    // Dynamic sample count (default 3 for evaluations)
    const [sampleCount, setSampleCount] = useState(3);
    const columnKeys = ['std', ...Array.from({ length: sampleCount }, (_, i) => `s${i + 1}`)];

    // ==================== Auto-Save Drafts ====================
    const draftKey = useMemo(() => {
        if (editingId) return `eval_${editingId}`;
        return `eval_new`;
    }, [editingId]);

    const getFormDataForDraft = useCallback(() => {
        const data = getValues();
        // Transform measurements to match backend expectations for draft saving
        return {
            ...data,
            measurements: data.measurements.map((m: any) => ({
                pom_name: m.pom_name,
                tol: m.tol,
                std: m.std === '' ? null : parseFloat(m.std) || null,
                samples: (m.samples || []).map((s: any) => ({
                    index: s.index,
                    value: s.value === '' ? null : parseFloat(s.value) || null
                }))
            }))
        };
    }, [getValues]);
    const getImageSlotsForDraft = useCallback(() => {
        // Serialize image slots (store captions only, not File blobs, for local draft)
        return imageSlots.map(s => ({
            hasFile: !!s.file,
            isUrl: typeof s.file === 'string',
            caption: s.caption,
        }));
    }, [imageSlots]);

    const {
        draftStatus,
        lastSavedAt,
        existingDraft,
        resumeDraft,
        clearDraft,
        saveDraftNow,
        dismissDraft,
        triggerLocalSave,
    } = useAutosave({
        formType: 'evaluation',
        draftKey,
        getFormData: getFormDataForDraft,
        getImageSlots: getImageSlotsForDraft,
        serverId: editingId,
        enabled: isOpen, // only auto-save when the form dialog is open
    }) as ReturnType<typeof useAutosave> & { triggerLocalSave: () => void };

    // Handle resume draft — restore form data from draft
    const handleResumeDraft = useCallback(() => {
        const draft = resumeDraft();
        if (draft?.formData) {
            reset(draft.formData);
            // Restore template
            if (draft.formData.template) {
                setSelectedTemplate(draft.formData.template);
            }
            // Restore sample count from measurements  
            const maxSampleIndex = Math.max(3, ...(draft.formData.measurements || []).flatMap((m: any) =>
                (m.samples || []).map((s: any) => s.index)
            ) || [3]);
            setSampleCount(maxSampleIndex);
            toast.success('Draft restored!');
        }
    }, [resumeDraft, reset, setSampleCount, setSelectedTemplate]);

    // Show resume dialog only for local-only auto-saved drafts (not explicitly saved ones)
    // If the user clicked "Save as Draft", the draft has a serverId and is already in "Your Drafts" list
    useEffect(() => {
        if (existingDraft && isOpen && !editingId && !existingDraft.serverId) {
            const d = existingDraft.formData;
            if (d) {
                const hasContent = [
                    d.style, d.color, d.po_number, d.factory,
                    d.customer_remarks, d.customer_fit_comments,
                    d.customer_workmanship_comments, d.customer_wash_comments,
                    d.customer_fabric_comments, d.customer_accessories_comments,
                    d.qa_fit_comments, d.qa_workmanship_comments,
                    d.qa_wash_comments, d.qa_fabric_comments, d.qa_accessories_comments,
                    d.remarks, d.decision
                ].some(f => f && String(f).trim() !== '');
                if (hasContent) {
                    setShowResumeDraftDialog(true);
                } else {
                    dismissDraft();
                }
            }
        }
    }, [existingDraft, isOpen, editingId, dismissDraft]);

    // Check if the form has any meaningful data entered
    const formHasData = useCallback(() => {
        const data = getValues();
        // Check if any text field has content
        const textFields = [
            data.style, data.color, data.po_number, data.factory,
            data.customer_remarks, data.customer_fit_comments,
            data.customer_workmanship_comments, data.customer_wash_comments,
            data.customer_fabric_comments, data.customer_accessories_comments,
            data.qa_fit_comments, data.qa_workmanship_comments,
            data.qa_wash_comments, data.qa_fabric_comments, data.qa_accessories_comments,
            data.remarks, data.decision
        ];
        return textFields.some(f => f && String(f).trim() !== '');
    }, [getValues]);

    // Trigger local save on field blur (not on every keystroke)
    const handleFormBlur = useCallback(() => {
        if (isOpen && formHasData()) {
            triggerLocalSave();
        }
    }, [isOpen, formHasData, triggerLocalSave]);

    // handleSaveDraft — manual server save without validation
    const handleSaveDraft = async () => {
        setIsSavingDraft(true);
        try {
            await saveDraftNow();
            await clearDraft(); // Remove the local draft so no resume dialog appears
            queryClient.invalidateQueries({ queryKey: ['evaluation-drafts'] });
            toast.success('Draft saved!');
            // Close the form and reset state
            setIsOpen(false);
            reset(INITIAL_FORM_STATE);
            setEditingId(null);
            setImageSlots([
                { file: null, caption: 'Front View' }, { file: null, caption: 'Back View' },
                { file: null, caption: '' }, { file: null, caption: '' },
                { file: null, caption: '' }, { file: null, caption: '' },
            ]);
            setSelectedTemplate(null);
            setIsManualTemplateChange(false);
        } catch (err) {
            console.error('Draft save failed', err);
            toast.error('Failed to save draft');
        } finally {
            setIsSavingDraft(false);
        }
    };

    // Helper to get sample value from measurement
    const getSampleValue = (m: Measurement, sampleIndex: number): number | string | null => {
        const sample = m.samples?.find(s => s.index === sampleIndex);
        return sample?.value ?? '';
    };

    const getCellId = (r: number, k: string) => `${r}-${k}`;

    // Handle Delete/Backspace
    // Handle KeyDown (Enter for Navigation, Backspace/Delete for Bulk Clear)
    // Handle KeyDown (Enter/Arrows for Navigation, Backspace/Delete for Clear)
    const handleCellKeyDown = (e: React.KeyboardEvent, index: number, key: string) => {
        // Navigation: Enter or ArrowDown -> Down
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            const nextRowIdx = index + 1;
            if (nextRowIdx < fields.length) {
                const nextInput = document.querySelector(`input[name="measurements.${nextRowIdx}.${key}"]`) as HTMLInputElement;
                nextInput?.focus();
            }
            return;
        }

        // Navigation: ArrowUp -> Up
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (index > 0) {
                const prevInput = document.querySelector(`input[name="measurements.${index - 1}.${key}"]`) as HTMLInputElement;
                prevInput?.focus();
            }
            return;
        }

        // Deletion: Delete (Always clear) or Backspace (Clear if multi-select)
        if (e.key === 'Delete' || (e.key === 'Backspace' && selectedCells.size > 1)) {
            if (selectedCells.size > 0) {
                e.preventDefault();

                // Confirmation for bulk delete
                if (selectedCells.size > 1) {
                    if (!confirm(`Are you sure you want to clear ${selectedCells.size} cells?`)) {
                        return;
                    }
                }

                // Group deletions by row to handle sample arrays correctly
                const rowsToUpdate = new Map<number, Set<string>>();
                selectedCells.forEach(cellId => {
                    const [rStr, k] = cellId.split('-');
                    const r = parseInt(rStr);
                    if (!rowsToUpdate.has(r)) rowsToUpdate.set(r, new Set());
                    rowsToUpdate.get(r)!.add(k);
                });

                const currentMeasurements = getValues('measurements');
                let count = 0;

                rowsToUpdate.forEach((keys, r) => {
                    if (r >= currentMeasurements.length) return;

                    // We need to clone the samples array to avoid direct mutation issues
                    let rowSamples = [...(currentMeasurements[r].samples || [])];
                    let samplesChanged = false;

                    keys.forEach(k => {
                        if (k === 'std' || k === 'tol' || k === 'spec') {
                            setValue(`measurements.${r}.${k}` as any, '');
                            count++;
                        } else if (k.startsWith('s')) {
                            // Handle sample deletion
                            const sampleNum = parseInt(k.replace('s', ''));
                            const existingIdx = rowSamples.findIndex(s => s.index === sampleNum);

                            if (existingIdx >= 0) {
                                // Update existing sample to empty string (or null if preferred, but empty string for input)
                                rowSamples[existingIdx] = { ...rowSamples[existingIdx], value: '' };
                                samplesChanged = true;
                                count++;
                            }
                        }
                    });

                    // Only update samples array if changes were made
                    if (samplesChanged) {
                        setValue(`measurements.${r}.samples` as any, rowSamples);
                    }
                });

                if (count > 0) {
                    toast.success(`Cleared ${count} cells`);
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



    // Watch PO number to filter Style/Color suggestions
    const poValue = watch('po_number');

    // Get Style suggestions based on entered PO number
    const styleSuggestions = poValue && poValue.length >= 2 ? getStylesForPO(poValue) : [];

    // Get Color suggestions based on entered PO number
    const colorSuggestions = poValue && poValue.length >= 2 ? getColorsForPO(poValue) : [];

    // Fetching
    const { data: inspectionData, isPlaceholderData } = useQuery({
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
            if (filters.factory) params.append('factory', filters.factory);
            if (filters.search) params.append('search', filters.search);
            if (filters.ordering) params.append('ordering', filters.ordering);
            return (await api.get(`/inspections/?${params.toString()}`)).data;
        },
        placeholderData: (previousData) => previousData,
    });

    const { data: customersData } = useQuery({
        queryKey: ['customers_v2'],
        queryFn: async () => {
            try {
                const response = await api.get('/customers/');

                const data = Array.isArray(response.data) ? response.data : response.data?.results || [];

                // Try caching but don't fail
                try { await cacheCustomers(data); } catch (e) { console.warn('Cache fail', e); }

                return data;
            } catch (error) {
                console.error('Fetch failed:', error);
                const cached = await getCachedCustomers();
                return cached || [];
            }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnMount: 'always',
        retry: 1,
    });

    const { data: templatesData } = useQuery({
        queryKey: ['templates'],
        queryFn: async () => {
            try {
                const res = await api.get('/templates/');
                const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
                await cacheTemplates(data);
                return data;
            } catch (error) {
                console.warn('API failed, using cached templates');
                return await getCachedTemplates() || [];
            }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,
        refetchOnWindowFocus: false,
    });

    const customers = Array.isArray(customersData) ? customersData : [];
    const templates = Array.isArray(templatesData) ? templatesData : [];



    // Template Change
    useEffect(() => {
        if (isManualTemplateChange && selectedTemplate && templates) {
            const template = templates.find((t: any) => t.id === selectedTemplate);
            if (template) {
                replace(template.poms.map((pom: any) => ({
                    pom_name: pom.name,
                    tol: pom.default_tol,
                    std: '',
                    samples: Array.from({ length: sampleCount }, (_, i) => ({
                        index: i + 1,
                        value: ''
                    }))
                })));
            }
        }
    }, [selectedTemplate, templates, replace, isManualTemplateChange, sampleCount]);

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

            // Use dynamic column order based on sampleCount
            const columnOrder = columnKeys; // Already includes 'std' and 's1' through 's{sampleCount}'
            const startColIndex = columnOrder.indexOf(startColumn);

            if (startColIndex === -1) return; // Invalid column

            // Auto-detect header row (flexible pattern)
            const hasHeader = /pom|name|std|s\d+/i.test(lines[0]);
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

                    // We need to fetch the LATEST 'samples' for this row because we might be updating multiple columns in the same row loop
                    // But getValues() returns the state at the start.
                    // Actually, setValue updates the internal store.
                    // However, constructing the samples array requires care if we update multiple samples in one row.
                    // Better approach: Compute the new samples array fully for this row, then set it once?
                    // Or read-modify-write per column?
                    // Since setValue is synchronous in RHF for state updates (mostly), but we act in a loop...
                    // Let's get the current object from the array we grabbed at start, modify it if needed?
                    // No, getValues('measurements') returns a snapshot.
                    // We should probably rely on the existing measurement object from snapshot, modify it in place, then setValue?
                    // Be careful with object references.

                    let rowSamples = [...(currentMeasurements[targetRow].samples || [])];

                    columns.forEach((value, colOffset) => {
                        const targetColIndex = startColIndex + colOffset;
                        if (targetColIndex < columnOrder.length) {
                            const fieldName = columnOrder[targetColIndex];
                            const cleanValue = value?.trim() || '';

                            // Check if it's a sample column (s1, s2...)
                            const sampleMatch = fieldName.match(/^s(\d+)$/);
                            if (sampleMatch) {
                                const sampleIndex = parseInt(sampleMatch[1]);
                                const existingIdx = rowSamples.findIndex(s => s.index === sampleIndex);
                                if (existingIdx >= 0) {
                                    rowSamples[existingIdx] = { ...rowSamples[existingIdx], value: cleanValue };
                                } else {
                                    rowSamples.push({ index: sampleIndex, value: cleanValue });
                                }
                            } else {
                                // Standard field (std, tol, etc)
                                setValue(`measurements.${targetRow}.${fieldName}` as any, cleanValue);
                            }
                        }
                    });

                    // After processing all columns for this row, update the samples array if changed
                    setValue(`measurements.${targetRow}.samples` as any, rowSamples);
                }
            });

            toast.success(`Pasted ${affectedRows} row(s) starting from ${startColumn.toUpperCase()} at row ${rowIndex + 1}!`);
        }
    };

    // Multi-cell Copy Handler
    const handleCopy = (event: React.ClipboardEvent<HTMLInputElement>) => {
        // Only override if we have a multi-cell selection
        if (selectedCells.size === 0) return;

        event.preventDefault();

        // 1. Gather all selected data
        const cellsToCopy: { r: number, c: number, val: string }[] = [];
        const currentMeasurements = getValues('measurements');

        selectedCells.forEach(cellId => {
            const [rStr, key] = cellId.split('-');
            const r = parseInt(rStr);
            const c = columnKeys.indexOf(key);

            if (r >= 0 && r < currentMeasurements.length && c !== -1) {
                let val = '';
                if (key === 'std') {
                    val = String(currentMeasurements[r]?.std ?? '');
                } else if (key.startsWith('s')) {
                    const sampleNum = parseInt(key.replace('s', ''));
                    const sample = currentMeasurements[r]?.samples?.find((s: any) => s.index === sampleNum);
                    val = String(sample?.value ?? '');
                }
                cellsToCopy.push({ r, c, val });
            }
        });

        if (cellsToCopy.length === 0) return;

        // 2. Sort by Row then Column to order them correctly
        cellsToCopy.sort((a, b) => {
            if (a.r !== b.r) return a.r - b.r; // Top to bottom
            return a.c - b.c; // Left to right
        });

        // 3. Construct Grid String (TSV)
        // We identify unique rows and columns to reconstruct the 2D grid structure
        const uniqueRows = [...new Set(cellsToCopy.map(x => x.r))].sort((a, b) => a - b);
        const uniqueCols = [...new Set(cellsToCopy.map(x => x.c))].sort((a, b) => a - b);

        let clipboardString = "";

        uniqueRows.forEach((rowIndex, i) => {
            const rowCells = cellsToCopy.filter(c => c.r === rowIndex);
            // We map across uniqueCols to preserve empty gaps if selection was non-contiguous?
            // Or just collapse? Excel collapses non-contiguous selections usually if dragged, 
            // but if Ctrl-selected, sometimes it errors.
            // Let's iterate uniqueCols to be safe and structured.

            const rowStr = uniqueCols.map(colIndex => {
                const cell = rowCells.find(c => c.c === colIndex);
                return cell ? cell.val : '';
            }).join('\t');

            clipboardString += rowStr;
            if (i < uniqueRows.length - 1) clipboardString += '\n';
        });

        // 4. Write to clipboard
        event.clipboardData.setData('text/plain', clipboardString);
        toast.success(`Copied ${cellsToCopy.length} cells!`);
    };

    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Offline-aware submission handler
    const handleFormSubmit = async (data: any) => {
        // Validate Mandatory Images (Front & Back View)
        if (!imageSlots[0].file || !imageSlots[1].file) {
            toast.error("Please add Front and Back View pictures", { duration: 4000 });
            return;
        }

        // Validate Mandatory QA Findings
        const qaFields = [
            { key: 'qa_fit_comments', label: 'QA Fit Findings' },
            { key: 'qa_workmanship_comments', label: 'QA Workmanship Findings' },
            { key: 'qa_wash_comments', label: 'QA Wash Findings' },
            { key: 'qa_fabric_comments', label: 'QA Fabric Findings' },
            { key: 'qa_accessories_comments', label: 'QA Accessories Findings' },
        ];

        for (const field of qaFields) {
            if (!data[field.key] || data[field.key].trim() === '') {
                toast.error(`Please fill ${field.label}`, { duration: 4000 });
                // Scroll to top of comment section roughly? Or just let user find it. 
                // Better to scroll to it if possible, but identifying element ID is tricky dynamically without adding IDs.
                // I will add IDs to them in the next steps or relying on user scroll for now.
                return;
            }
        }

        // Validate accessories have selected options
        if (data.accessories_data && data.accessories_data.length > 0) {
            const accessoriesWithoutOption = data.accessories_data.filter(
                (acc: AccessoryItem) => !acc.comment || acc.comment.trim() === ''
            );
            if (accessoriesWithoutOption.length > 0) {
                const accessoryNames = accessoriesWithoutOption.map((acc: AccessoryItem) => acc.name).join(', ');
                toast.error(`Please select an option for: ${accessoryNames}`, { duration: 5000 });
                // Scroll to accessories section
                document.getElementById('accessories-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
        }

        // Validate decision is selected
        if (!data.decision || data.decision === '') {
            setShowDecisionError(true);
            toast.error('Please choose a decision (Accepted, Rejected, or Represent) before submitting.');
            // Scroll to decision section
            document.getElementById('decision-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Clear error if decision is selected
        setShowDecisionError(false);

        const jsonPayload = {
            ...data,
            customer_name: customers.find((c: any) => c.id === data.customer)?.name || 'Unknown',
            measurements: data.measurements.map((m: any) => ({
                pom_name: m.pom_name,
                tol: m.tol,
                std: m.std === '' ? null : m.std,
                samples: (m.samples || []).map((s: any) => ({
                    index: s.index,
                    value: s.value === '' ? null : parseFloat(s.value) || null
                }))
            }))
        };

        if (!navigator.onLine) {
            // --- OFFLINE FLOW ---
            try {
                setIsGeneratingPdf(true);

                // A. Save to Dexie
                await db.inspections.add({
                    formData: jsonPayload,
                    images: imageSlots.filter(slot => slot.file).map(slot => ({
                        file: slot.file as Blob,
                        caption: slot.caption,
                        category: 'General'
                    })),
                    createdAt: Date.now(),
                    status: 'pending_sync',
                    type: 'evaluation'
                });

                // B. Generate PDF Client-Side (Nested Try/Catch)
                try {
                    // Helper to convert File to Base64
                    const fileToBase64 = (file: File): Promise<string> => {
                        return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.readAsDataURL(file);
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = error => reject(error);
                        });
                    };

                    // Convert images to Base64 asynchronously
                    const imagesForPdf = await Promise.all(imageSlots.map(async (slot) => {
                        if (slot.file) {
                            if (typeof slot.file === 'string') {
                                // Already a URL/Base64, pass it through
                                return { ...slot, file: slot.file };
                            }
                            if (slot.file instanceof File) {
                                try {
                                    const base64 = await fileToBase64(slot.file);
                                    return { ...slot, file: base64 };
                                } catch (e) {
                                    console.error("Failed to convert image to base64", e);
                                    return { ...slot, file: null };
                                }
                            }
                        }
                        return { ...slot, file: null };
                    }));

                    const blob = await pdf(
                        <EvaluationPDFReport data={jsonPayload} images={imagesForPdf} />
                    ).toBlob();

                    saveAs(blob, `Offline_Evaluation_${data.style}_${data.po_number || 'Draft'}.pdf`);

                    toast.success("Saved Offline! PDF generated. Sync when online.");
                } catch (pdfErr: any) {
                    console.error("PDF generation failed", pdfErr);
                    // Include error message for debugging
                    toast.warning(`Saved to Pending Uploads, but PDF failed: ${pdfErr.message || 'Unknown error'}`);
                }

                // C. Success State - Reset Form
                // We reached here, so DB save was definitely successful
                setIsOpen(false);
                reset();
                setImageSlots([
                    { file: null, caption: 'Front View' }, { file: null, caption: 'Back View' },
                    { file: null, caption: '' }, { file: null, caption: '' },
                    { file: null, caption: '' }, { file: null, caption: '' },
                ]);
                setIsManualTemplateChange(false);
                setSelectedTemplate(null);

            } catch (err) {
                // This catch block only hits if Dexie save fails
                console.error("Offline save failed", err);
                toast.error("Failed to save offline data. Please try again.");
            } finally {
                setIsGeneratingPdf(false);
            }
        } else {
            // --- ONLINE FLOW ---
            if (editingId) {
                updateMutation.mutate({ id: editingId, data });
            } else {
                createMutation.mutate(data);
            }
        }
    };

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const jsonPayload = {
                ...data,
                is_draft: false, // Explicitly finalize — not a draft
                measurements: data.measurements.map((m: any) => ({
                    pom_name: m.pom_name,
                    tol: m.tol,
                    std: m.std === '' ? null : m.std,
                    samples: (m.samples || []).map((s: any) => ({
                        index: s.index,
                        value: s.value === '' ? null : parseFloat(s.value) || null
                    }))
                }))
            };

            const res = await api.post('/inspections/', jsonPayload);
            const inspectionId = res.data.id;

            for (const slot of imageSlots) {
                if (slot.file && slot.file instanceof File) {
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
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
            queryClient.invalidateQueries({ queryKey: ['evaluation-drafts'] });
            await clearDraft(); // Remove local draft on successful submit
            setIsOpen(false);
            reset();
            setImageSlots([
                { file: null, caption: 'Front View' }, { file: null, caption: 'Back View' },
                { file: null, caption: '' }, { file: null, caption: '' },
                { file: null, caption: '' }, { file: null, caption: '' },
            ]);
            setSelectedTemplate(null);
            setIsManualTemplateChange(false);
            toast.success('Evaluation created');
        },
        onError: (err: any) => {
            console.error('Create evaluation failed:', err);
            const detail = err?.response?.data?.detail || err?.response?.data?.non_field_errors?.[0] || err?.message || 'Unknown error';
            toast.error(`Failed to save: ${detail}`);
        }
    });

    // Update Mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            const jsonPayload = {
                ...data,
                is_draft: false, // Explicitly finalize — not a draft
                measurements: data.measurements.map((m: any) => ({
                    pom_name: m.pom_name,
                    tol: m.tol,
                    std: m.std === '' ? null : m.std,
                    samples: (m.samples || []).map((s: any) => ({
                        index: s.index,
                        value: s.value === '' ? null : parseFloat(s.value) || null
                    }))
                }))
            };

            const res = await api.patch(`/inspections/${id}/`, jsonPayload);
            const inspectionId = res.data.id;

            for (const slot of imageSlots) {
                if (slot.file) {
                    // Only upload if it's a new file (File object), not if it's already a URL string (existing)
                    // But wait, our API likely expects file uploads. If slot.file is a File, upload it.
                    // If it's null, do nothing.
                    // If slot.file is a URL string, we don't need to re-upload.
                    if (slot.file instanceof File) {
                        const formData = new FormData();
                        formData.append('image', slot.file);
                        formData.append('caption', slot.caption || 'Inspection Image');
                        // Backend handling for "updating" or "adding" images might need clarification
                        // Assuming appending is fine or backend handles replacement logic if caption matches?
                        // For now we just upload new files.
                        await api.post(`/inspections/${inspectionId}/upload_image/`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                    }
                }
            }
            return res.data;
        },
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
            queryClient.invalidateQueries({ queryKey: ['evaluation-drafts'] });
            await clearDraft(); // Remove local draft on successful update
            setIsOpen(false);
            reset();
            setEditingId(null);
            setImageSlots([
                { file: null, caption: 'Front View' }, { file: null, caption: 'Back View' },
                { file: null, caption: '' }, { file: null, caption: '' },
                { file: null, caption: '' }, { file: null, caption: '' },
            ]);
            setSelectedTemplate(null);
            setIsManualTemplateChange(false);
            toast.success('Evaluation updated');
        },
        onError: (err: any) => {
            console.error('Update evaluation failed:', err);
            const detail = err?.response?.data?.detail || err?.response?.data?.non_field_errors?.[0] || err?.message || 'Unknown error';
            toast.error(`Failed to update: ${detail}`);
        }
    });

    // Handle Edit Inspection
    const handleEditInspection = async (inspection: any) => {
        try {
            const { data } = await api.get(`/inspections/${inspection.id}/`);
            setEditingId(inspection.id);
            setIsOpen(true);

            setIsManualTemplateChange(false);
            setSelectedTemplate(data.template);

            reset({
                style: data.style || '',
                color: data.color || '',
                po_number: data.po_number || '',
                stage: data.stage || 'Proto',
                customer: data.customer || '',
                factory: data.factory || '',
                template: data.template || '',
                decision: data.decision || '',

                // Customer Comments by Category
                customer_remarks: data.customer_remarks || '', // Fallback for old data
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

                measurements: (data.measurements || []).map((m: any) => ({
                    pom_name: m.pom_name,
                    tol: m.tol,
                    std: m.std ?? '',
                    samples: (m.samples || []).map((s: any) => ({
                        index: s.index,
                        value: s.value ?? ''
                    }))
                }))
            });

            // Set sample count based on loaded data
            const maxSampleIndex = Math.max(3, ...data.measurements?.flatMap((m: any) =>
                (m.samples || []).map((s: any) => s.index)
            ) || [3]);
            setSampleCount(maxSampleIndex);

            // Populate Image Slots (Handling URLs vs Files)
            const loadedImages: ImageSlot[] = [
                { file: null, caption: 'Front View' }, { file: null, caption: 'Back View' },
                { file: null, caption: '' }, { file: null, caption: '' },
                { file: null, caption: '' }, { file: null, caption: '' },
            ];

            // Debug: Log what images we got from API
            console.log('Loaded inspection data.images:', data.images);

            // Map API images to slots
            if (data.images && Array.isArray(data.images)) {
                data.images.forEach((img: any, index: number) => {
                    if (index < 6) {
                        // Handle both absolute and relative URLs
                        let imageUrl = img.image || null;
                        if (imageUrl && !imageUrl.startsWith('http')) {
                            // Relative URL (local dev) - prepend API base
                            imageUrl = `${api.defaults.baseURL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
                        }
                        console.log(`Image ${index}:`, imageUrl, 'Caption:', img.caption);
                        loadedImages[index] = {
                            file: imageUrl,
                            caption: img.caption || ''
                        };
                    }
                });
            }
            // Ensure Front/Back captions exist
            if (!loadedImages[0].caption) loadedImages[0].caption = 'Front View';
            if (!loadedImages[1].caption) loadedImages[1].caption = 'Back View';

            console.log('Final loadedImages:', loadedImages);
            setImageSlots(loadedImages);

        } catch (e) {
            toast.error("Failed to load details for editing");
        }
    };

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
            factory: '',
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
        onSuccess: () => toast.success('Email sent to customer'),
        onError: (err: any) => {
            const errorMsg = err.response?.data?.error || 'Failed to send email';
            toast.error(errorMsg);
        }
    });

    // Validation Logic
    const measurements = watch('measurements');
    const accessoriesData = watch('accessories_data');
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

        // Auto-set caption for first 2 if not set (or ensure they stay set)
        if (index === 0) newSlots[index].caption = "Front View";
        if (index === 1) newSlots[index].caption = "Back View";

        setImageSlots(newSlots);
    };

    const handleCaptionChange = (index: number, text: string) => {
        if (index === 0 || index === 1) return; // Prevent changing mandatory captions
        const newSlots = [...imageSlots];
        newSlots[index].caption = text;
        setImageSlots(newSlots);
    };

    const handleDownloadPdf = async (id: string, style: string) => {
        const toastId = toast.loading('Generating PDF...');
        try {
            // 1. Try Backend First (Online Mode)
            const response = await api.get(`/inspections/${id}/pdf/`, {
                responseType: 'blob',
                timeout: 30000
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${style}_Evaluation.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.dismiss(toastId);
            toast.success('PDF Downloaded');
        } catch (serverError: any) {
            console.warn("Backend PDF failed, switching to offline mode:", serverError);

            // Show specific reason if available
            const reason = serverError.response
                ? `Status ${serverError.response.status}`
                : serverError.message || 'Unknown';

            console.log(`Backend failed (${reason}). Switching to offline mode...`);
            toast.message(`Backend unreachable (${reason}). Generating locally...`, { id: toastId });

            // 2. Fallback to Frontend (Offline Mode)
            try {
                // Fetch full details - relies on Cache if offline
                let data = queryClient.getQueryData(['inspection', id]);

                if (!data) {
                    const res = await api.get(`/inspections/${id}/`);
                    data = res.data;
                }

                if (!data) throw new Error("No data available for PDF");

                const images = (data as any).images || [];
                const blob = await pdf(
                    <EvaluationPDFReport data={data} images={images} />
                ).toBlob();

                saveAs(blob, `${style}_Evaluation.pdf`);
                toast.dismiss(toastId);
                toast.success('PDF Downloaded (Offline Mode)');
            } catch (clientError) {
                console.error(clientError);
                toast.dismiss(toastId);
                toast.error('Download failed completely. Check connection.');
            }
        }
    };

    const handleCloseAttempt = (open: boolean) => {
        if (!open && isOpen) {
            // User is trying to close the dialog
            setShowCloseConfirmation(true);
        } else {
            setIsOpen(open);
        }
    };

    const handleConfirmClose = async () => {
        setShowCloseConfirmation(false);
        // Auto-save locally before closing if form has data (safety net)
        if (formHasData()) {
            try {
                const formData = getValues();
                await saveDraftLocally({
                    draftKey,
                    formData,
                    imageSlots: imageSlots.map(s => ({
                        hasFile: !!s.file,
                        isUrl: typeof s.file === 'string',
                        caption: s.caption,
                    })),
                    updatedAt: Date.now(),
                    formType: 'evaluation',
                });
            } catch (err) {
                console.error('Failed to save draft on close', err);
            }
        }
        setIsOpen(false);
        reset(INITIAL_FORM_STATE);
        setEditingId(null);
        setImageSlots([
            { file: null, caption: 'Front View' }, { file: null, caption: 'Back View' },
            { file: null, caption: '' }, { file: null, caption: '' },
            { file: null, caption: '' }, { file: null, caption: '' },
        ]);
    };

    const handleCancelClose = () => {
        setShowCloseConfirmation(false);
    };

    const inspectionsList = Array.isArray(inspectionData) ? inspectionData : inspectionData?.results || [];

    // Fetch server drafts
    const { data: serverDrafts = [] } = useQuery({
        queryKey: ['evaluation-drafts'],
        queryFn: async () => {
            const res = await api.get('/inspections/drafts/');
            return res.data;
        }
    });

    // Open a server draft for editing
    const handleOpenDraft = async (draft: any) => {
        try {
            const { data } = await api.get(`/inspections/${draft.id}/`);
            setEditingId(draft.id);
            setIsOpen(true);

            setIsManualTemplateChange(false);
            setSelectedTemplate(data.template);

            reset({
                style: data.style || '',
                color: data.color || '',
                po_number: data.po_number || '',
                stage: data.stage || 'Proto',
                customer: data.customer || '',
                factory: data.factory || '',
                template: data.template || '',
                decision: data.decision || '',

                customer_remarks: data.customer_remarks || '',
                customer_fit_comments: data.customer_fit_comments || '',
                customer_workmanship_comments: data.customer_workmanship_comments || '',
                customer_wash_comments: data.customer_wash_comments || '',
                customer_fabric_comments: data.customer_fabric_comments || '',
                customer_accessories_comments: data.customer_accessories_comments || '',
                customer_comments_addressed: data.customer_comments_addressed || false,

                qa_fit_comments: data.qa_fit_comments || '',
                qa_workmanship_comments: data.qa_workmanship_comments || '',
                qa_wash_comments: data.qa_wash_comments || '',
                qa_fabric_comments: data.qa_fabric_comments || '',
                qa_accessories_comments: data.qa_accessories_comments || '',

                fabric_handfeel: data.fabric_handfeel || 'OK',
                fabric_pilling: data.fabric_pilling || 'None',

                accessories_data: data.accessories_data || [],

                remarks: data.remarks || '',

                measurements: (data.measurements || []).map((m: any) => ({
                    pom_name: m.pom_name,
                    tol: m.tol,
                    std: m.std ?? '',
                    samples: (m.samples || []).map((s: any) => ({
                        index: s.index,
                        value: s.value ?? ''
                    }))
                }))
            });

            const maxSampleIndex = Math.max(3, ...data.measurements?.flatMap((m: any) =>
                (m.samples || []).map((s: any) => s.index)
            ) || [3]);
            setSampleCount(maxSampleIndex);

            // Load images
            const loadedImages: ImageSlot[] = [
                { file: null, caption: 'Front View' }, { file: null, caption: 'Back View' },
                { file: null, caption: '' }, { file: null, caption: '' },
                { file: null, caption: '' }, { file: null, caption: '' },
            ];
            if (data.images && Array.isArray(data.images)) {
                data.images.forEach((img: any, index: number) => {
                    if (index < loadedImages.length) {
                        let draftImageUrl = img.image || null;
                        if (draftImageUrl && !draftImageUrl.startsWith('http')) {
                            draftImageUrl = `${api.defaults.baseURL}${draftImageUrl.startsWith('/') ? '' : '/'}${draftImageUrl}`;
                        }
                        loadedImages[index] = { file: draftImageUrl, caption: img.caption || '' };
                    }
                });
            }
            setImageSlots(loadedImages);
        } catch (err) {
            console.error('Failed to load draft', err);
            toast.error('Failed to load draft');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-900">Evaluation</h1>
                <div className="flex items-center gap-4">
                    <SyncManager type="evaluation" />
                    <Dialog open={isOpen} onOpenChange={handleCloseAttempt}>
                        {canCreateInspections && (
                            <DialogTrigger asChild>
                                <Button><Plus className="w-4 h-4 mr-2" />New Evaluation</Button>
                            </DialogTrigger>
                        )}
                        <DialogContent className="fixed inset-0 z-[110] flex flex-col bg-white max-w-none !rounded-none p-0 m-0 border-none shadow-none !translate-x-0 !translate-y-0">
                            <DialogDescription className="sr-only">
                                Full screen evaluation form
                            </DialogDescription>
                            <DialogHeader className="p-4 pr-14 border-b shrink-0">
                                <div className="flex items-center justify-between">
                                    <DialogTitle>Evaluation</DialogTitle>
                                    {/* Draft Status Indicator */}
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        {draftStatus === 'saving_local' || draftStatus === 'saving_server' ? (
                                            <><Loader2 className="w-3 h-3 animate-spin" /><span>Saving...</span></>
                                        ) : draftStatus === 'saved' && lastSavedAt ? (
                                            <><Clock className="w-3 h-3" /><span>Draft saved {lastSavedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></>
                                        ) : draftStatus === 'error' ? (
                                            <span className="text-red-400">Draft save failed</span>
                                        ) : null}
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto">
                                <div className="space-y-6 py-4 px-6 overflow-x-hidden pb-10">


                                    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" onBlurCapture={handleFormBlur}>



                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label>PO Number</Label>
                                                <Input {...register("po_number")} autoComplete="off" placeholder="Enter PO first..." />
                                            </div>
                                            <div className="space-y-2 relative">
                                                <Label>Style *</Label>
                                                <Input
                                                    {...register("style", { required: true })}
                                                    autoComplete="off"
                                                    placeholder={styleSuggestions.length > 0 ? "Type or select from suggestions..." : "Enter style..."}
                                                    onFocus={() => {
                                                        if (styleSuggestions.length > 0) {
                                                            setShowStyleSuggestions(true);
                                                        }
                                                    }}
                                                />
                                                <InlineSuggestionDropdown
                                                    suggestions={styleSuggestions}
                                                    isOpen={showStyleSuggestions && styleSuggestions.length > 0}
                                                    onClose={() => setShowStyleSuggestions(false)}
                                                    onSelect={(value) => {
                                                        setValue('style', value);
                                                        setShowStyleSuggestions(false);
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-2 relative">
                                                <Label>Color</Label>
                                                <Input
                                                    {...register("color")}
                                                    autoComplete="off"
                                                    placeholder={colorSuggestions.length > 0 ? "Type or select from suggestions..." : "Enter color..."}
                                                    onFocus={() => {
                                                        if (colorSuggestions.length > 0) {
                                                            setShowColorSuggestions(true);
                                                        }
                                                    }}
                                                />
                                                <InlineSuggestionDropdown
                                                    suggestions={colorSuggestions}
                                                    isOpen={showColorSuggestions && colorSuggestions.length > 0}
                                                    onClose={() => setShowColorSuggestions(false)}
                                                    onSelect={(value) => {
                                                        setValue('color', value);
                                                        setShowColorSuggestions(false);
                                                    }}
                                                />
                                            </div>
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
                                                <Label>Factory</Label>
                                                <SearchableSelect
                                                    value={watch("factory")}
                                                    onChange={(v) => setValue("factory", v)}
                                                    options={factories.map((f: any) => ({ value: f.name, label: f.name }))}
                                                    placeholder="Select Factory..."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Customer</Label>
                                                <SearchableSelect
                                                    value={watch("customer")}
                                                    onChange={(v) => {
                                                        setValue("customer", v);
                                                        setValue("template", "");
                                                        setSelectedTemplate(null);
                                                    }}
                                                    options={customers.map((c: any) => ({ value: c.id, label: c.name }))}
                                                    placeholder="Select Customer..."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Style Template</Label>
                                                <SearchableSelect
                                                    value={watch("template")}
                                                    onChange={(v) => { setIsManualTemplateChange(true); setValue("template", v); setSelectedTemplate(v); }}
                                                    options={templates?.filter((t: any) => !watch('customer') || t.customer === watch('customer'))
                                                        .map((t: any) => ({ value: t.id, label: t.name })) || []}
                                                    placeholder={watch("customer") ? "Select Style Template..." : "Select Customer First"}
                                                    disabled={!watch("customer")}
                                                />
                                            </div>
                                        </div>


                                        {/* Measurements Grid (Dynamic Samples) */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label>Measurements </Label>
                                                <div className="flex gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setSampleCount(Math.max(1, sampleCount - 1))}
                                                        disabled={sampleCount <= 1}
                                                    >
                                                        - Sample
                                                    </Button>
                                                    <span className="px-2 py-1 text-sm font-medium">{sampleCount} Samples</span>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setSampleCount(sampleCount + 1)}
                                                        disabled={sampleCount >= 10}
                                                    >
                                                        + Sample
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="border rounded-md p-4 bg-white overflow-x-auto max-w-full">
                                                {/* Dynamic grid columns: 2 (POM) + 1 (Tol) + 1 (Std) + sampleCount */}
                                                <div className={`min-w-[600px] grid gap-2 mb-2 font-medium text-xs text-gray-500 uppercase text-center`}
                                                    style={{ gridTemplateColumns: `2fr 1fr 1fr ${Array(sampleCount).fill('1fr').join(' ')}` }}>
                                                    <div className="text-left">POM</div>
                                                    <div>Tol</div>
                                                    <div>Std</div>
                                                    {Array.from({ length: sampleCount }, (_, i) => (
                                                        <div key={i}>S{i + 1}</div>
                                                    ))}
                                                </div>
                                                {fields.map((field, index) => {
                                                    const m = measurements[index] || { samples: [] };
                                                    const isRed = (val: any) => checkTol(val, m.std, m.tol);
                                                    return (
                                                        <div key={field.id}
                                                            className={`min-w-[600px] grid gap-2 mb-2 items-center`}
                                                            style={{ gridTemplateColumns: `2fr 1fr 1fr ${Array(sampleCount).fill('1fr').join(' ')}` }}>
                                                            <div><Input {...register(`measurements.${index}.pom_name`)} readOnly className="bg-gray-50 h-8 text-xs" /></div>
                                                            <div><Input {...register(`measurements.${index}.tol`)} readOnly className="bg-gray-50 h-8 text-xs text-center" /></div>

                                                            {/* Editable STD Field */}
                                                            <div>
                                                                <Input
                                                                    {...register(`measurements.${index}.std`)}
                                                                    className={`h-8 text-xs text-center ${isSelected(index, 'std') ? 'bg-blue-200 ring-2 ring-blue-500' : 'bg-blue-50'}`}
                                                                    placeholder="-"
                                                                    onPaste={handleMeasurementPaste(index, 'std')}
                                                                    onCopy={handleCopy}
                                                                    onKeyDown={(e) => handleCellKeyDown(e, index, 'std')}
                                                                    onMouseDown={() => handleCellMouseDown(index, 'std')}
                                                                    onMouseEnter={() => handleCellMouseEnter(index, 'std')}
                                                                    onTouchStart={() => handleTouchStart(index, 'std')}
                                                                    onTouchEnd={handleTouchEnd}
                                                                    autoComplete="off"
                                                                />
                                                            </div>

                                                            {/* Dynamic Sample Inputs */}
                                                            {Array.from({ length: sampleCount }, (_, sampleIdx) => {
                                                                const sampleNum = sampleIdx + 1;
                                                                const key = `s${sampleNum}`;
                                                                const selected = isSelected(index, key);
                                                                const sampleValue = getSampleValue(m as Measurement, sampleNum);
                                                                return (
                                                                    <div key={sampleNum}>
                                                                        <Input
                                                                            name={`measurements.${index}.${key}`} // Interaction fix: name required for querySelector navigation
                                                                            type="number" step="0.1"
                                                                            value={sampleValue ?? ''}
                                                                            onChange={(e) => {
                                                                                const newSamples = [...(m.samples || [])];
                                                                                const existingIdx = newSamples.findIndex(s => s.index === sampleNum);
                                                                                if (existingIdx >= 0) {
                                                                                    newSamples[existingIdx] = { index: sampleNum, value: e.target.value };
                                                                                } else {
                                                                                    newSamples.push({ index: sampleNum, value: e.target.value });
                                                                                }
                                                                                setValue(`measurements.${index}.samples` as any, newSamples);
                                                                            }}
                                                                            className={`h-8 text-center transition-colors 
                                                                                ${selected ? 'bg-blue-200 ring-2 ring-blue-500 z-10 relative' : ''} 
                                                                                ${!selected && isRed(sampleValue) ? 'text-red-600 font-bold bg-red-50' : ''}
                                                                            `}
                                                                            onPaste={handleMeasurementPaste(index, key)}
                                                                            onCopy={handleCopy}
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
                                            <div className="flex items-center justify-between border-b pb-2">
                                                <h3 className="text-lg font-bold text-gray-800">Quality Evaluation</h3>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={!watch('po_number') || isLoadingStyleComments}
                                                    onClick={async () => {
                                                        const poNumber = watch('po_number');
                                                        if (!poNumber) {
                                                            toast.error('Please enter a PO Number first');
                                                            return;
                                                        }
                                                        setIsLoadingStyleComments(true);
                                                        try {
                                                            const res = await api.get(`/styles/by_po/?po_number=${encodeURIComponent(poNumber)}`);

                                                            // Handle Exact Match
                                                            if (res.data && !res.data.suggestions) {
                                                                const style = res.data;
                                                                const latestComment = style.comments?.[0];
                                                                if (latestComment) {
                                                                    setValue('customer_remarks', latestComment.comments_general || '');
                                                                    setValue('customer_fit_comments', latestComment.comments_fit || '');
                                                                    setValue('customer_workmanship_comments', latestComment.comments_workmanship || '');
                                                                    setValue('customer_wash_comments', latestComment.comments_wash || '');
                                                                    setValue('customer_fabric_comments', latestComment.comments_fabric || '');
                                                                    setValue('customer_accessories_comments', latestComment.comments_accessories || '');
                                                                    toast.success(`Loaded comments from Style Cycle (${latestComment.sample_type})`);
                                                                } else {
                                                                    toast.info('No comments found for this PO in Style Cycle');
                                                                }
                                                            }
                                                            // Handle Suggestions (Fuzzy Match) - show dialog with options
                                                            else if (res.data && res.data.suggestions) {
                                                                setSimilarPOs(res.data.suggestions);
                                                                setShowSimilarPOsDialog(true);
                                                            }
                                                        } catch (err: any) {
                                                            if (err.response?.status === 404) {
                                                                toast.info('No style found with this PO number in Style Cycle');
                                                            } else {
                                                                toast.error('Failed to load comments from Style Cycle');
                                                            }
                                                        } finally {
                                                            setIsLoadingStyleComments(false);
                                                        }
                                                    }}
                                                >
                                                    {isLoadingStyleComments ? (
                                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                    ) : (
                                                        <Layers className="w-4 h-4 mr-1" />
                                                    )}
                                                    Load from Style Cycle
                                                </Button>
                                            </div>

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
                                                    <Label className="text-blue-800 font-semibold text-sm mb-1 block">QA Fit Findings <span className="text-red-500">*</span></Label>
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
                                                    <Label className="text-blue-800 font-semibold text-sm mb-1 block">QA Workmanship Findings <span className="text-red-500">*</span></Label>
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
                                                    <Label className="text-blue-800 font-semibold text-sm mb-1 block">QA Wash Findings <span className="text-red-500">*</span></Label>
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
                                                    <Label className="text-blue-800 font-semibold text-sm mb-1 block">QA Fabric Findings <span className="text-red-500">*</span></Label>
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
                                                    <Label className="text-blue-800 font-semibold text-sm mb-1 block">QA Accessories Findings <span className="text-red-500">*</span></Label>
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
                                            <div id="accessories-section" className="lg:col-span-2 border p-4 rounded-lg bg-gray-50">
                                                <div className="flex justify-between items-center mb-4">
                                                    <Label className="text-base font-bold">Accessories Checklist</Label>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => appendAcc({ name: '', comment: '' })}
                                                        className="bg-white hover:bg-gray-100 h-8"
                                                    >
                                                        <Plus className="w-3 h-3 mr-1" /> Custom Item
                                                    </Button>
                                                </div>

                                                {/* Presets Checklist */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                                    {ACCESSORY_PRESETS.map((preset) => {
                                                        const existingIndex = accFields.findIndex(f => f.name === preset);
                                                        const isChecked = existingIndex !== -1;
                                                        // Use watched value for reactivity
                                                        const currentVal = isChecked ? (accessoriesData?.[existingIndex]?.comment || '') : '';

                                                        // Helper for styling
                                                        const getStyle = (val: string) => {
                                                            if (val === 'Not Ok') return 'text-red-600 font-bold';
                                                            if (val === 'Available') return 'text-orange-600 font-bold';
                                                            if (val === 'Ok' || val === 'Improved') return 'text-green-600';
                                                            if (val === 'Missing') return 'text-gray-500';
                                                            return 'text-gray-400';
                                                        };

                                                        return (
                                                            <div key={preset} className={`p-3 rounded-lg border transition-all ${isChecked ? 'bg-white border-blue-200 shadow-sm' : 'bg-gray-100/50 border-transparent hover:bg-gray-100'}`}>
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                        checked={isChecked}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                appendAcc({ name: preset, comment: '' }); // Default to empty (Choose Option)
                                                                            } else {
                                                                                if (existingIndex !== -1) removeAcc(existingIndex);
                                                                            }
                                                                        }}
                                                                    />
                                                                    <span className={`font-medium text-sm ${isChecked ? 'text-gray-900' : 'text-gray-500'}`}>{preset}</span>
                                                                </div>

                                                                {isChecked && (
                                                                    <div className="pl-7">
                                                                        <Select
                                                                            value={currentVal}
                                                                            onValueChange={(val) => setValue(`accessories_data.${existingIndex}.comment`, val, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                                                                        >
                                                                            <SelectTrigger className={`h-7 text-xs bg-gray-50 ${getStyle(currentVal)}`}>
                                                                                <SelectValue placeholder="Choose Option" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="Ok" className="text-green-600">Ok</SelectItem>
                                                                                <SelectItem value="Not Ok" className="text-red-600 font-bold">Not Ok</SelectItem>
                                                                                <SelectItem value="Improved" className="text-green-600">Improved</SelectItem>
                                                                                <SelectItem value="Available" className="text-orange-600 font-bold">Available</SelectItem>
                                                                                <SelectItem value="Missing" className="text-gray-500">Missing</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Custom Items List */}
                                                {accFields.some(f => !ACCESSORY_PRESETS.includes(f.name)) && (
                                                    <div className="space-y-2 mt-4 pt-4 border-t">
                                                        <Label className="text-sm font-semibold text-gray-700">Custom Items</Label>
                                                        {accFields.map((field, index) => {
                                                            if (ACCESSORY_PRESETS.includes(field.name)) return null; // Skip presets here
                                                            // Use watched value for reactivity
                                                            const currentVal = accessoriesData?.[index]?.comment || '';

                                                            // Helper for styling (duplicated for scope, or could be shared)
                                                            const getStyle = (val: string) => {
                                                                if (val === 'Not Ok') return 'text-red-600 font-bold';
                                                                if (val === 'Available') return 'text-orange-600 font-bold';
                                                                if (val === 'Ok' || val === 'Improved') return 'text-green-600';
                                                                if (val === 'Missing') return 'text-gray-500';
                                                                return 'text-gray-400';
                                                            };

                                                            return (
                                                                <div key={field.id} className="flex gap-2 items-center bg-orange-50/30 p-2 rounded border border-orange-100">
                                                                    <Input
                                                                        {...register(`accessories_data.${index}.name`)}
                                                                        placeholder="Item name"
                                                                        className="w-1/3 h-8 text-sm"
                                                                    />
                                                                    <div className="flex-1">
                                                                        <Select
                                                                            value={currentVal}
                                                                            onValueChange={(val) => setValue(`accessories_data.${index}.comment`, val, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                                                                        >
                                                                            <SelectTrigger className={`h-8 text-sm bg-white ${getStyle(currentVal)}`}>
                                                                                <SelectValue placeholder="Choose Option" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="Ok" className="text-green-600">Ok</SelectItem>
                                                                                <SelectItem value="Not Ok" className="text-red-600 font-bold">Not Ok</SelectItem>
                                                                                <SelectItem value="Improved" className="text-green-600">Improved</SelectItem>
                                                                                <SelectItem value="Available" className="text-orange-600 font-bold">Available</SelectItem>
                                                                                <SelectItem value="Missing" className="text-gray-500">Missing</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => removeAcc(index)}
                                                                        className="h-8 w-8 text-gray-400 hover:text-red-500"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
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
                                                                <SelectItem value="High">High (Not Acceptable)</SelectItem>
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
                                            <Label>Images (Max 6)</Label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {imageSlots.map((slot, idx) => (
                                                    <div key={idx} className="border p-3 rounded-md space-y-2 bg-gray-50">
                                                        {/* Image Preview */}
                                                        {slot.file && (
                                                            <div className="mb-2 relative h-32 w-full bg-gray-200 rounded-md overflow-hidden">
                                                                <img
                                                                    src={typeof slot.file === 'string' ? slot.file : URL.createObjectURL(slot.file)}
                                                                    alt={slot.caption || 'Preview'}
                                                                    className="h-full w-full object-contain"
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold bg-white border px-2 py-1 rounded">#{idx + 1}</span>
                                                            {(idx === 0 || idx === 1) && <span className="text-xs text-red-500 font-bold">* Required</span>}
                                                            <Input type="file" accept="image/*" capture="environment" className="text-xs bg-white" onChange={(e) => handleImageChange(idx, e.target.files ? e.target.files[0] : null)} />
                                                        </div>
                                                        <Input
                                                            placeholder={idx === 0 ? "Front View" : idx === 1 ? "Back View" : "Caption"}
                                                            value={slot.caption}
                                                            onChange={(e) => handleCaptionChange(idx, e.target.value)}
                                                            className={`h-8 text-sm bg-white ${(idx === 0 || idx === 1) ? 'bg-gray-100 text-gray-600' : ''}`}
                                                            readOnly={idx === 0 || idx === 1}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Decision */}
                                        <div className="space-y-2" id="decision-section">
                                            <Label className="flex items-center gap-1">
                                                Overall Decision
                                                <span className="text-red-500">*</span>
                                                {showDecisionError && (
                                                    <span className="text-red-500 text-sm ml-2 font-normal">Required</span>
                                                )}
                                            </Label>
                                            <div className={`flex gap-4 p-3 rounded-lg transition-all ${showDecisionError ? 'bg-red-50 border-2 border-red-300' : 'border border-transparent'}`}>
                                                {['Accepted', 'Rejected', 'Represent'].map((status) => (
                                                    <div
                                                        key={status}
                                                        className={`cursor-pointer px-4 py-2 rounded-md border font-bold text-sm transition-all
                                                    ${watch('decision') === status
                                                                ? (status === 'Accepted' ? 'bg-green-600 text-white border-green-700' : status === 'Rejected' ? 'bg-red-600 text-white border-red-700' : 'bg-orange-500 text-white border-orange-700')
                                                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                                            }`}
                                                        onClick={() => {
                                                            setValue('decision', status);
                                                            setShowDecisionError(false); // Clear error on selection
                                                        }}
                                                    >
                                                        {status}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-3">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="flex-1 h-12 text-md gap-2"
                                                disabled={isSavingDraft || createMutation.isPending || isGeneratingPdf}
                                                onClick={handleSaveDraft}
                                            >
                                                <Save className="w-4 h-4" />
                                                {isSavingDraft ? 'Saving Draft...' : 'Save as Draft'}
                                            </Button>
                                            <Button type="submit" className="flex-[2] h-12 text-lg" disabled={createMutation.isPending || isGeneratingPdf}>
                                                {createMutation.isPending || isGeneratingPdf ? 'Saving...' : 'Save Evaluation'}
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog >
                </div >
            </div >

            {/* Main List */}
            <InspectionFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onClearAll={handleClearFilters}
            />

            {/* Drafts Section */}
            {serverDrafts.length > 0 && (
                <div className="border rounded-lg bg-amber-50 border-amber-200">
                    <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
                        <FileEdit className="w-4 h-4 text-amber-600" />
                        <span className="font-semibold text-amber-800">Your Drafts</span>
                        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{serverDrafts.length}</span>
                    </div>
                    <Table>
                        <TableBody>
                            {serverDrafts.map((draft: any) => (
                                <TableRow key={draft.id} className="hover:bg-amber-100/50 cursor-pointer" onClick={() => handleOpenDraft(draft)}>
                                    <TableCell className="font-medium">{draft.style || <span className="text-gray-400 italic">No style</span>}</TableCell>
                                    <TableCell className="text-sm text-gray-600">{draft.po_number || '-'}</TableCell>
                                    <TableCell className="text-sm text-gray-600">{draft.stage || '-'}</TableCell>
                                    <TableCell className="text-xs text-gray-500">
                                        {draft.updated_at ? new Date(draft.updated_at).toLocaleString('en-GB', {
                                            day: '2-digit', month: '2-digit', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit', hour12: false
                                        }).replace(',', '') : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <span className="px-2 py-1 rounded text-xs font-bold bg-amber-200 text-amber-800">Draft</span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-100" onClick={(e) => { e.stopPropagation(); handleOpenDraft(draft); }}>
                                            <Pencil className="w-3 h-3 mr-1" /> Continue
                                        </Button>
                                        {canEditEvaluation && (
                                            <Button variant="ghost" size="icon" className="text-red-500 ml-1" onClick={async (e) => {
                                                e.stopPropagation();
                                                if (confirm('Delete this draft?')) {
                                                    try {
                                                        await api.delete(`/inspections/${draft.id}/`);
                                                        queryClient.invalidateQueries({ queryKey: ['evaluation-drafts'] });
                                                        toast.success('Draft deleted');
                                                    } catch (err) {
                                                        console.error('Failed to delete draft', err);
                                                        toast.error('Failed to delete draft');
                                                    }
                                                }
                                            }}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}


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
                                            {(isSuperUser || userType === 'quality_head') && (
                                                <Button variant="ghost" size="icon" onClick={() => handleEditInspection(inspection)}>
                                                    <Pencil className="w-4 h-4 text-blue-500" />
                                                </Button>
                                            )}
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

            {/* Close Confirmation Dialog */}
            <Dialog open={showCloseConfirmation} onOpenChange={setShowCloseConfirmation}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Close Evaluation Form?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to close the form? Unsaved changes will be lost.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={handleCancelClose}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleConfirmClose}>
                            Yes, Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Resume Draft Dialog */}
            <Dialog open={showResumeDraftDialog} onOpenChange={setShowResumeDraftDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Resume Draft?</DialogTitle>
                        <DialogDescription>
                            You have an unsaved draft from {existingDraft ? new Date(existingDraft.updatedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : ''}.
                            Would you like to continue where you left off?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={async () => { await dismissDraft(); setShowResumeDraftDialog(false); }}>
                            Discard
                        </Button>
                        <Button onClick={() => { handleResumeDraft(); setShowResumeDraftDialog(false); }}>
                            Resume Draft
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Similar POs Dialog */}
            <Dialog open={showSimilarPOsDialog} onOpenChange={setShowSimilarPOsDialog}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            PO Number Not Found
                        </DialogTitle>
                        <DialogDescription>
                            We couldn't find an exact match. Did you mean one of these?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-64 overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>PO Number</TableHead>
                                    <TableHead>Style</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {similarPOs.map((po: any, idx: number) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-medium">{po.po_number}</TableCell>
                                        <TableCell>{po.style_name}</TableCell>
                                        <TableCell>{po.customer_name || '-'}</TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                onClick={async () => {
                                                    // Load comments from selected PO
                                                    try {
                                                        const res = await api.get(`/styles/by_po/?po_number=${encodeURIComponent(po.po_number)}`);
                                                        if (res.data && !res.data.suggestions) {
                                                            const style = res.data;
                                                            const latestComment = style.comments?.[0];
                                                            if (latestComment) {
                                                                setValue('po_number', po.po_number);
                                                                setValue('customer_remarks', latestComment.comments_general || '');
                                                                setValue('customer_fit_comments', latestComment.comments_fit || '');
                                                                setValue('customer_workmanship_comments', latestComment.comments_workmanship || '');
                                                                setValue('customer_wash_comments', latestComment.comments_wash || '');
                                                                setValue('customer_fabric_comments', latestComment.comments_fabric || '');
                                                                setValue('customer_accessories_comments', latestComment.comments_accessories || '');
                                                                toast.success(`Loaded comments from Style Cycle (${latestComment.sample_type})`);
                                                            } else {
                                                                setValue('po_number', po.po_number);
                                                                toast.info('No comments found for this PO in Style Cycle');
                                                            }
                                                        }
                                                        setShowSimilarPOsDialog(false);
                                                        setSimilarPOs([]);
                                                    } catch (err) {
                                                        toast.error('Failed to load comments from selected PO');
                                                    }
                                                }}
                                            >
                                                Select
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button variant="ghost" onClick={() => { setShowSimilarPOsDialog(false); setSimilarPOs([]); }}>
                            Cancel
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
};

export default EvaluationForm;