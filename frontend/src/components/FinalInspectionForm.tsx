import { useState, useEffect, }  from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { COMMON_DEFECTS } from '../lib/aqlCalculations';


import {
  AQLResultCard,
  DefectCounter,
  ImageUploader,
  ShipmentDetails,
  UploadedImage,
  DefectCounts,
} from './inspection';
import { db, cacheCustomers, cacheTemplates, getCachedCustomers, getCachedTemplates } from '../lib/db';
import { pdf } from '@react-pdf/renderer';
import PDFReport from './PDFReport';
import { saveAs } from 'file-saver';
import { SearchableSelect } from './SearchableSelect';
import { InlineSuggestionDropdown } from './InlineSuggestionDropdown';
import { useStyleLookup } from '../hooks/useStyleLookup';
import api from '../lib/api';

import {
  FinalInspectionFormProps,
  Customer,
  Template,
  FormData as InspectionFormData,
  INITIAL_FORM_STATE,
  MeasurementInput
} from '../types/inspection';
import { useAQLCalculations } from '../hooks/useAQLCalculations';
import { useGridInteractions } from '../hooks/useGridInteractions';

export default function FinalInspectionForm({ inspectionId, onClose }: FinalInspectionFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [defectCounts, setDefectCounts] = useState<DefectCounts>(() => {
    const initial: DefectCounts = {};
    COMMON_DEFECTS.forEach(defect => {
      initial[defect] = { critical: 0, major: 0, minor: 0 };
    });
    return initial;
  });

  const [customDefect, setCustomDefect] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  // --- Grid Selection & Paste State ---

  // Dynamic sample count (default 6 for final inspections)
  const [sampleCount, setSampleCount] = useState(6);
  const columnKeys = ['spec', ...Array.from({ length: sampleCount }, (_, i) => `s${i + 1}`)];

  // Style/Color Suggestions State (based on Order No)
  const [showStyleSuggestions, setShowStyleSuggestions] = useState(false);
  const [showColorSuggestions, setShowColorSuggestions] = useState(false);
  const { getStylesForPO, getColorsForPO } = useStyleLookup();

  // Helper to get sample value from measurement
  const getSampleValue = (m: MeasurementInput, sampleIndex: number): number | string | null => {
    const sample = m.samples?.find(s => s.index === sampleIndex);
    return sample?.value ?? '';
  };


  // --- Form Setup ---

  const { register, control, handleSubmit, watch, setValue, getValues, reset } = useForm<InspectionFormData>({
    defaultValues: INITIAL_FORM_STATE,
  });







  // --- Queries with Local Caching ---

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      try {
        const response = await api.get('/customers/');
        const data = Array.isArray(response.data) ? response.data : response.data?.results || [];
        // Cache to IndexedDB for offline use
        await cacheCustomers(data);
        return data;
      } catch (error) {
        // Fallback to cached data if offline
        console.warn('API failed, using cached customers');
        const cached = await getCachedCustomers();
        return cached || [];
      }
    },
  });

  const customers: Customer[] = Array.isArray(customersData) ? customersData : [];

  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      try {
        const response = await api.get('/templates/');
        const data = Array.isArray(response.data) ? response.data : response.data?.results || [];
        // Cache to IndexedDB for offline use
        await cacheTemplates(data);
        return data;
      } catch (error) {
        // Fallback to cached data if offline
        console.warn('API failed, using cached templates');
        const cached = await getCachedTemplates();
        return cached || [];
      }
    },
  });

  const templates: Template[] = Array.isArray(templatesData) ? templatesData : [];

  const { data: inspectionData } = useQuery({
    queryKey: ['finalInspection', inspectionId],
    queryFn: async () => {
      if (!inspectionId) return null;
      const response = await api.get(`/final-inspections/${inspectionId}/`);
      return response.data;
    },
    enabled: !!inspectionId,
  });



  // Field Arrays
  const { fields: sizeFields, append: appendSize, remove: removeSize } = useFieldArray({
    control,
    name: 'size_checks',
  });

  const { fields: measurementFields, replace: replaceMeasurements } = useFieldArray({
    control,
    name: 'measurements',
  });

  // --- Watchers ---
  const presentedQty = watch('presented_qty');
  const aqlStandard = watch('aql_standard');
  const selectedTemplateId = watch('template');
  const measurements = watch('measurements');
  const sizeChecks = watch('size_checks');


  // Watch Order No to filter Style/Color suggestions
  const orderNo = watch('order_no');

  // Get Style suggestions based on entered Order No
  const styleSuggestions = orderNo && orderNo.length >= 2 ? getStylesForPO(orderNo) : [];

  // Get Color suggestions based on entered Order No
  const colorSuggestions = orderNo && orderNo.length >= 2 ? getColorsForPO(orderNo) : [];

  // Fetch Factories
  const { data: factoriesData } = useQuery({
    queryKey: ['factories-all'],
    queryFn: async () => {
      const res = await api.get('/factories/');
      return res.data.results || [];
    }
  });

  const factories = factoriesData || [];

  // --- Effects ---

  // 1. Populate Form Data on Edit
  useEffect(() => {
    if (inspectionData) {
      // 1. Reset Form Fields
      const formData = {
        ...inspectionData,
        // Ensure dates are formatted correctly for input type="date"
        inspection_date: inspectionData.inspection_date.split('T')[0],
        customer: inspectionData.customer?.id || inspectionData.customer, // Handle nested object or ID
        template: inspectionData.template?.id || inspectionData.template,
      };

      // Reset form with valid data
      // We need to carefully handle nested arrays (measurements, size_checks)
      // The serializer returns them, so spreading inspectionData should work mostly,
      // but we might need to ensure they match the FormData interface exactly.
      reset(formData);

      // 2. Set Defect Counts
      if (inspectionData.defects) {
        const newCounts: Record<string, { critical: number; major: number; minor: number }> = {};
        // Initialize with zeros for common defects
        COMMON_DEFECTS.forEach(d => newCounts[d] = { critical: 0, major: 0, minor: 0 });

        inspectionData.defects.forEach((d: any) => {
          if (!newCounts[d.description]) {
            newCounts[d.description] = { critical: 0, major: 0, minor: 0 };
          }
          const sev = d.severity.toLowerCase() as 'critical' | 'major' | 'minor';
          newCounts[d.description][sev] = d.count;
        });
        setDefectCounts(newCounts);
      }

      // 3. Set Images
      if (inspectionData.images) {
        setUploadedImages(inspectionData.images.map((img: { image: string; caption: string; category: string; id: string }) => ({
          file: new File([], "existing_image"), // Placeholder
          previewUrl: img.image.startsWith('http') ? img.image : `${api.defaults.baseURL}${img.image.startsWith('/') ? '' : '/'}${img.image}`, // Fix URL for GCS
          caption: img.caption,
          category: img.category,
          id: img.id,
          isExisting: true
        })));
      }
    }
  }, [inspectionData, reset]);

  // 2. Auto-calculate sample size based on PRESENTED QTY
  // Removed client-side calculation effect as it's now handled by performCalculation

  // 2. Sync Measurement Chart with Size Checks & Template
  useEffect(() => {
    if (!selectedTemplateId || !templates) return;

    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    // Current measurements
    const currentMeasurements = getValues('measurements') || [];
    const newMeasurements: MeasurementInput[] = [];
    let hasChanges = false;

    // We iterate over the STABLE fields from useFieldArray
    sizeFields.forEach((field, idx) => {
      const sizeCheck = (sizeChecks || [])[idx];
      const sizeName = sizeCheck && sizeCheck.size ? sizeCheck.size.trim() : `Size ${idx + 1}`;
      const fieldId = field.id; // Stable ID from RHF

      // 1. Try to find measurements linked by ID
      let linkedMeasurements = currentMeasurements.filter(m => m.size_field_id === fieldId);

      // 2. If none, try to find by Name (legacy/initial load) and "claim" them
      if (linkedMeasurements.length === 0) {
        linkedMeasurements = currentMeasurements.filter(m => !m.size_field_id && m.size_name === sizeName);
        if (linkedMeasurements.length > 0) {
          // We found them by name, now we link them by ID for future stability
          linkedMeasurements = linkedMeasurements.map(m => ({ ...m, size_field_id: fieldId }));
          hasChanges = true;
        }
      }

      // 3. If still none, create new ones
      if (linkedMeasurements.length === 0) {
        template.poms.forEach(pom => {
          newMeasurements.push({
            pom_name: pom.name,
            spec: pom.default_std,
            tol: pom.default_tol,
            size_name: sizeName,
            size_field_id: fieldId, // Link by ID
            samples: Array.from({ length: sampleCount }, (_, i) => ({ index: i + 1, value: '' }))
          });
        });
        hasChanges = true;
      } else {
        // We have existing measurements, ensure they are in the new list
        // Also ensure size_name is up to date (in case of rename)
        linkedMeasurements.forEach(m => {
          if (m.size_name !== sizeName) {
            newMeasurements.push({ ...m, size_name: sizeName });
            hasChanges = true;
          } else {
            newMeasurements.push(m);
          }
        });
      }
    });

    // Check if we have any orphaned measurements (rows deleted)
    // The newMeasurements array only contains measurements for currently active fields.
    // If currentMeasurements has more items than we collected (excluding the ones we just created), it means some were removed.
    // But we can just compare length or content.

    // If we haven't detected changes yet, check if total count matches
    if (!hasChanges) {
      if (currentMeasurements.length !== newMeasurements.length) {
        hasChanges = true;
      }
    }

    if (hasChanges) {
      replaceMeasurements(newMeasurements);
    }
  }, [selectedTemplateId, templates, sizeChecks, sizeFields, replaceMeasurements, getValues]);

  // --- Calculations ---

  const getTotalDefects = () => {
    let critical = 0, major = 0, minor = 0;
    Object.values(defectCounts).forEach(counts => {
      critical += counts.critical;
      major += counts.major;
      minor += counts.minor;
    });
    return { critical, major, minor };
  };

  const { critical, major, minor } = getTotalDefects();

  const { serverCalcs } = useAQLCalculations({
    presentedQty: presentedQty || 0,
    aqlStandard,
    critical,
    major,
    minor,
    setValue,
  });

  // Helper to check tolerance
  const isOutOfTolerance = (value: string, spec: number, tol: number) => {
    if (!value || value === '') return false;
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return false;
    return Math.abs(numVal - spec) > tol;
  };


  // --- Grid Helpers ---
  const {
    isSelected,
    handleCellKeyDown,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleTouchStart,
    handleTouchEnd,
    handleCopy,
    handleMeasurementPaste
  } = useGridInteractions({
    columnKeys,
    measurementFieldsLength: measurementFields.length,
    setValue,
    getValues,
    toast,
  });

  // --- Handlers ---

  const updateDefectCount = (defect: string, severity: 'critical' | 'major' | 'minor', delta: number) => {
    setDefectCounts(prev => ({
      ...prev,
      [defect]: {
        ...prev[defect],
        [severity]: Math.max(0, prev[defect][severity] + delta),
      }
    }));
  };

  const addCustomDefect = () => {
    if (customDefect && !defectCounts[customDefect]) {
      setDefectCounts(prev => ({ ...prev, [customDefect]: { critical: 0, major: 0, minor: 0 } }));
      setCustomDefect('');
    }
  };

  // Submit form
  const createMutation = useMutation({
    mutationFn: async (data: InspectionFormData) => {
      // 1. Prepare defects array
      const defects = Object.entries(defectCounts)
        .flatMap(([description, counts]) => [
          ...(counts.critical > 0 ? [{ description, severity: 'Critical', count: counts.critical }] : []),
          ...(counts.major > 0 ? [{ description, severity: 'Major', count: counts.major }] : []),
          ...(counts.minor > 0 ? [{ description, severity: 'Minor', count: counts.minor }] : []),
        ]);

      // Clean up measurements
      const measurements = data.measurements.map(m => ({
        pom_name: m.pom_name,
        spec: isNaN(Number(m.spec)) ? 0 : Number(m.spec),
        tol: m.tol,
        size_name: m.size_name,
        samples: (m.samples || []).map(s => ({
          index: s.index,
          value: s.value === '' ? null : parseFloat(String(s.value)) || null
        }))
      }));

      const payload = { ...data, defects, measurements };

      // 2. Create Inspection Record
      const response = await api.post('/final-inspections/', payload);

      // 3. Upload images
      for (const img of uploadedImages) {
        if ((img as any).isExisting) continue; // Skip existing images
        const formData = new FormData();
        formData.append('image', img.file);
        formData.append('caption', img.caption);
        formData.append('category', img.category);

        await api.post(`/final-inspections/${response.data.id}/upload_image/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finalInspections'] });
      toast({ title: 'Final Inspection created successfully!' });
      onClose();
    },
    onError: (error: any) => {
      console.error('Create final inspection failed:', error);
      const detail = error?.response?.data?.detail || error?.response?.data?.non_field_errors?.[0] || error?.message || 'Unknown error';
      toast({ title: 'Failed to create report', description: detail, variant: 'destructive' });
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InspectionFormData }) => {
      // 1. Prepare defects array
      const defects = Object.entries(defectCounts)
        .flatMap(([description, counts]) => [
          ...(counts.critical > 0 ? [{ description, severity: 'Critical', count: counts.critical }] : []),
          ...(counts.major > 0 ? [{ description, severity: 'Major', count: counts.major }] : []),
          ...(counts.minor > 0 ? [{ description, severity: 'Minor', count: counts.minor }] : []),
        ]);

      // Clean up measurements
      const measurements = data.measurements.map(m => ({
        pom_name: m.pom_name,
        spec: isNaN(Number(m.spec)) ? 0 : Number(m.spec),
        tol: isNaN(Number(m.tol)) ? 0 : Number(m.tol),
        size_name: m.size_name,
        samples: (m.samples || []).map(s => ({
          index: s.index,
          value: s.value === '' ? null : parseFloat(String(s.value)) || null
        }))
      }));

      const payload = { ...data, defects, measurements };
      if ('images' in payload) delete (payload as any).images; // Prevent overwriting images

      const response = await api.put(`/final-inspections/${id}/`, payload);

      // 3. Upload NEW images only
      for (const img of uploadedImages) {
        if ((img as any).isExisting) continue; // Skip existing images

        const formData = new FormData();
        formData.append('image', img.file);
        formData.append('caption', img.caption);
        formData.append('category', img.category);

        await api.post(`/final-inspections/${id}/upload_image/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finalInspections'] });
      queryClient.invalidateQueries({ queryKey: ['finalInspection', inspectionId] });
      toast({ title: 'Final Inspection updated successfully!' });

      onClose();
    },
    onError: (error: any) => {
      console.error('Update final inspection failed:', error);
      const detail = error?.response?.data?.detail || error?.response?.data?.non_field_errors?.[0] || error?.message || 'Unknown error';
      toast({ title: 'Failed to update report', description: detail, variant: 'destructive' });
    },
  });

  const [submitAction, setSubmitAction] = useState<'create' | 'update' | 'saveAsNew'>('create');

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const onSubmit = async (data: InspectionFormData) => {
    // 1. Prepare defects array
    const defects = Object.entries(defectCounts)
      .flatMap(([description, counts]) => [
        ...(counts.critical > 0 ? [{ description, severity: 'Critical', count: counts.critical }] : []),
        ...(counts.major > 0 ? [{ description, severity: 'Major', count: counts.major }] : []),
        ...(counts.minor > 0 ? [{ description, severity: 'Minor', count: counts.minor }] : []),
      ]);

    // Clean up measurements
    const measurementsPayload = data.measurements.map(m => ({
      pom_name: m.pom_name,
      spec: isNaN(Number(m.spec)) ? 0 : Number(m.spec),
      tol: m.tol,
      size_name: m.size_name,
      samples: (m.samples || []).map(s => ({
        index: s.index,
        value: s.value === '' ? null : parseFloat(String(s.value)) || null
      }))
    }));

    const finalPayload = {
      ...data,
      defects,
      measurements: measurementsPayload,
      customer_name: customers.find(c => c.id === data.customer)?.name || 'Unknown',
      critical_found: critical,
      major_found: major,
      minor_found: minor,
      max_allowed_critical: serverCalcs.maxCritical,
      max_allowed_major: serverCalcs.maxMajor,
      max_allowed_minor: serverCalcs.maxMinor,
      result: serverCalcs.result,
    };

    if (!navigator.onLine) {
      // --- OFFLINE FLOW ---
      try {
        setIsGeneratingPdf(true);

        // A. Save to Dexie
        await db.inspections.add({
          formData: finalPayload,
          images: uploadedImages.map(img => ({
            file: img.file,
            caption: img.caption,
            category: img.category
          })),
          createdAt: Date.now(),
          status: 'pending_sync',
          type: 'final_inspection'
        });

        // B. Generate PDF Client-Side
        const blob = await pdf(
          <PDFReport
            data={finalPayload}
            defects={defects}
            images={uploadedImages}
          />
        ).toBlob();

        saveAs(blob, `Offline_Report_${data.order_no}_${data.style_no}.pdf`);

        toast({
          title: "Saved Offline",
          description: "Report saved locally and PDF generated. Please sync when online.",
        });
        onClose();
      } catch (err) {
        console.error("Offline save failed", err);
        toast({ title: "Error", description: "Failed to save offline", variant: "destructive" });
      } finally {
        setIsGeneratingPdf(false);
      }
    } else {
      // --- ONLINE FLOW (REAL) ---
      try {
        if (inspectionId && submitAction === 'update') {
          // If editing an existing report AND action is update
          updateMutation.mutate({ id: inspectionId, data: finalPayload as any });
        } else {
          // If creating a new report OR 'saveAsNew'
          createMutation.mutate(finalPayload as any);
        }
      } catch (error) {
        console.error("Online submission failed", error);
        toast({ title: "Submission Failed", variant: "destructive" });
      }
    }
  };



  // Prevent Enter key from submitting/closing, except in textareas
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
      e.preventDefault();
    }
  };

  const handleCancel = () => {
    if (confirm('Are you confirmed to cancel?')) {
      onClose();
    }
  };

  return (
    <>
      <form onKeyDown={handleKeyDown} onSubmit={handleSubmit(onSubmit)} className="space-y-6 w-full max-w-6xl mx-auto pb-20 px-4 md:px-6 lg:px-8" >
        {/* Header */}
        <div className="flex justify-between items-center border-b -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-4 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">{inspectionId ? 'Edit Final Inspection' : 'New Final Inspection'}</h2>
          </div>
        </div>

        {/* Section 1: General Information */}
        < Card >
          <CardHeader>
            <CardTitle>1. General Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Customer *</Label>
              <SearchableSelect
                value={watch('customer')}
                onChange={(v) => setValue('customer', v)}
                options={customers?.map((c: Customer) => ({ value: c.id, label: c.name }))}
                placeholder="Select Customer..."
              />
            </div>
            <div>
              <Label>Inspection Date *</Label>
              <Input type="date" {...register('inspection_date', { required: true })} className="mt-1" />
            </div>
            <div>
              <Label>Style Template (For Measurements)</Label>
              <SearchableSelect
                value={watch('template')}
                onChange={(v) => setValue('template', v)}
                options={templates?.filter((t: any) => !watch('customer') || t.customer === watch('customer'))
                  .map((t: any) => ({ value: t.id, label: t.name })) || []}
                placeholder={watch("customer") ? "Select Style Template..." : "Select Customer First"}
                disabled={!watch("customer")}
              />
            </div>
            <div>
              <Label>Order No *</Label>
              <Input
                {...register('order_no', { required: true })}
                placeholder="PO-12345"
                className="mt-1"
                autoComplete="off"
              />
            </div>
            <div className="relative">
              <Label>Style No *</Label>
              <Input
                {...register('style_no', { required: true })}
                placeholder={styleSuggestions.length > 0 ? "Type or select from suggestions..." : "Enter style..."}
                className="mt-1"
                autoComplete="off"
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
                  setValue('style_no', value);
                  setShowStyleSuggestions(false);
                }}
              />
            </div>
            <div className="relative">
              <Label>Color</Label>
              <Input
                {...register('color')}
                placeholder={colorSuggestions.length > 0 ? "Type or select from suggestions..." : "Enter color..."}
                className="mt-1"
                autoComplete="off"
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
            <div>
              <Label>Factory</Label>
              <SearchableSelect
                value={watch('factory')}
                onChange={(v) => setValue('factory', v)}
                options={factories.map((f: any) => ({ value: f.name, label: f.name }))}
                placeholder="Select Factory..."
              />
            </div>
            <div>
              <Label>Inspection Attempt</Label>
              <select {...register('inspection_attempt')} className="w-full border rounded p-2 mt-1">
                <option value="1st">1st Inspection</option>
                <option value="2nd">2nd Inspection</option>
                <option value="3rd">3rd Inspection</option>
              </select>
            </div>

            {/* AQL Setup Block */}
            <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-blue-50 p-4 rounded-md border border-blue-100 mt-2">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> AQL Sampling Setup
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-blue-800">AQL Standard</Label>
                  <select {...register('aql_standard')} className="w-full border border-blue-200 rounded p-2 mt-1 bg-white">
                    <option value="standard">Standard (0 / 2.5 / 4.0)</option>
                    <option value="strict">Strict (0 / 1.5 / 2.5)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-blue-800">Total Order Qty</Label>
                  <Input type="number" {...register('total_order_qty', { valueAsNumber: true })} className="mt-1 bg-white" />
                </div>
                <div>
                  <Label className="text-blue-800">Presented Qty (Lot Size) *</Label>
                  <Input type="number" {...register('presented_qty', { required: true, valueAsNumber: true })} className="mt-1 border-blue-300 bg-white" />
                  <p className="text-xs text-blue-600 mt-1">Sample size calculated on this qty</p>
                </div>
                <div>
                  <Label className="text-blue-800 font-bold">Required Sample Size</Label>
                  <Input
                    type="number"
                    {...register('sample_size', { valueAsNumber: true })}
                    placeholder="Enter manually if offline"
                    className="mt-1 font-bold text-lg border-blue-300"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card >

        {/* Section 2: AQL Status */}
        <AQLResultCard
          serverCalcs={serverCalcs}
          critical={critical}
          major={major}
          minor={minor}
        />

        {/* Section 3: Quantity Breakdown */}
        < Card >
          <CardHeader>
            <CardTitle>3. Quantity Breakdown (Size Check)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 overflow-x-auto">
              <div className="grid grid-cols-12 gap-2 font-semibold text-xs uppercase text-gray-500 mb-1 min-w-[600px]">
                <div className="col-span-3">Size</div>
                <div className="col-span-3">Order Qty</div>
                <div className="col-span-3">Packed Qty</div>
                <div className="col-span-2">Deviation</div>
                <div className="col-span-1"></div>
              </div>

              {sizeFields.map((field, index) => {
                const orderQty = watch(`size_checks.${index}.order_qty`);
                const packedQty = watch(`size_checks.${index}.packed_qty`);
                const diff = packedQty - orderQty;
                const dev = orderQty ? ((diff / orderQty) * 100).toFixed(1) : '0.0';
                const isHighDev = Math.abs(parseFloat(dev)) > 5;

                return (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-center min-w-[600px]">
                    <div className="col-span-3">
                      <Input {...register(`size_checks.${index}.size` as const)} placeholder="e.g. M" className="h-9" />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" {...register(`size_checks.${index}.order_qty` as const, { valueAsNumber: true })} className="h-9" />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" {...register(`size_checks.${index}.packed_qty` as const, { valueAsNumber: true })} className="h-9" />
                    </div>
                    <div className="col-span-2 flex items-center">
                      <span className={`font-mono text-sm font-bold ${isHighDev ? 'text-red-600' : 'text-gray-600'}`}>
                        {dev}%
                      </span>
                    </div>
                    <div className="col-span-1 text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeSize(index)}>
                        <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <Button type="button" variant="outline" size="sm" onClick={() => appendSize({ size: '', order_qty: 0, packed_qty: 0 })} className="mt-2 text-xs">
                <Plus className="h-3 w-3 mr-2" /> Add Size Row
              </Button>
            </div>
          </CardContent>
        </Card >

        {/* Section 4: Measurement Chart (Size-Based) */}
        < Card >
          <CardHeader>
            <CardTitle>4. Measurement Chart</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedTemplateId && (
              <div className="text-center p-6 bg-gray-50 rounded border border-dashed text-gray-500">
                Please select a <strong>Style Template</strong> in General Information to load measurement points.
              </div>
            )}

            {selectedTemplateId && (
              <Accordion type="multiple" className="w-full" defaultValue={sizeFields.map((_, i) => `item-${i}`)}>
                {sizeFields.map((field, sizeIndex) => {
                  const sc = (sizeChecks || [])[sizeIndex];
                  const sizeName = sc && sc.size ? sc.size : `Size ${sizeIndex + 1}`;
                  // Filter measurements for this size
                  // We need to find the indices in the main `measurementFields` array that correspond to this size.
                  // Since we sync them in order, they should be grouped.
                  // But `map` inside `map` is tricky with `register`.
                  // We can filter `measurementFields` but we need the original `index` for `register`.

                  const sizeMeasurements = measurementFields.map((field, index) => ({ field, index }))
                    .filter(({ index }) => measurements[index]?.size_field_id === field.id);

                  if (sizeMeasurements.length === 0) return null;

                  return (
                    <AccordionItem key={sizeIndex} value={`item-${sizeIndex}`}>
                      <AccordionTrigger className="bg-gray-50 px-4 rounded-t-md hover:no-underline hover:bg-gray-100">
                        <span className="font-bold text-lg text-blue-800">{sizeName}</span>
                      </AccordionTrigger>
                      <AccordionContent className="p-2 border rounded-b-md border-t-0">
                        <div className="flex items-center justify-between mb-2 px-2">
                          <span className="text-sm text-gray-500">Measurements (Hold & Drag to Select • Delete to Clear)</span>
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
                              onClick={() => setSampleCount(Math.max(6, Math.min(20, sampleCount + 1)))}
                              disabled={sampleCount >= 20}
                            >
                              + Sample
                            </Button>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <div className={`min-w-[900px] grid gap-2 mb-2 font-bold text-xs text-gray-600 uppercase text-center bg-gray-50 p-2 rounded`}
                            style={{ gridTemplateColumns: `2fr 1fr 1fr ${Array(sampleCount).fill('1fr').join(' ')}` }}>
                            <div className="text-left pl-2">POM</div>
                            <div>Tol</div>
                            <div>Std</div>
                            {Array.from({ length: sampleCount }, (_, i) => (
                              <div key={i}>S{i + 1}</div>
                            ))}
                          </div>

                          {sizeMeasurements.map(({ field, index }) => {
                            const currentPOM = measurements[index] || { samples: [] };
                            // Extract indices for scoped navigation
                            const sizeMeasurementIndices = sizeMeasurements.map(sm => sm.index);

                            return (
                              <div key={field.id}
                                className="min-w-[900px] grid gap-2 mb-2 items-center hover:bg-gray-50 p-1 rounded"
                                style={{ gridTemplateColumns: `2fr 1fr 1fr ${Array(sampleCount).fill('1fr').join(' ')}` }}>
                                {/* Read-only POM Info */}
                                <div>
                                  <Input {...register(`measurements.${index}.pom_name`)} readOnly className="bg-transparent border-none shadow-none h-8 font-medium text-sm" />
                                </div>
                                <div>
                                  <Input {...register(`measurements.${index}.tol`)} readOnly className="bg-transparent border-none shadow-none h-8 text-center text-xs text-gray-500" />
                                </div>
                                <div>
                                  <Input
                                    {...register(`measurements.${index}.spec`)}
                                    className={`h-8 text-center text-sm ${isSelected(index, 'spec') ? 'bg-blue-200 ring-2 ring-blue-500 z-10 relative' : ''}`}
                                    onPaste={handleMeasurementPaste(index, 'spec')}
                                    onCopy={handleCopy}
                                    onKeyDown={(e) => handleCellKeyDown(e, index, 'spec', sizeMeasurementIndices)}
                                    onMouseDown={() => handleCellMouseDown(index, 'spec')}
                                    onMouseEnter={() => handleCellMouseEnter(index, 'spec')}
                                    onTouchStart={() => handleTouchStart(index, 'spec')}
                                    onTouchEnd={handleTouchEnd}
                                    autoComplete="off"
                                  />
                                </div>

                                {/* Dynamic Measurement Inputs */}
                                {Array.from({ length: sampleCount }, (_, sampleIdx) => {
                                  const sampleNum = sampleIdx + 1;
                                  const key = `s${sampleNum}`;
                                  const sampleValue = getSampleValue(currentPOM as MeasurementInput, sampleNum);
                                  const isBad = isOutOfTolerance(String(sampleValue ?? ''), currentPOM.spec, currentPOM.tol);

                                  return (
                                    <div key={sampleNum}>
                                      <Input
                                        name={`measurements.${index}.${key}`} // Interaction fix: name required for querySelector navigation
                                        type="number" step="0.1"
                                        value={sampleValue ?? ''}
                                        onChange={(e) => {
                                          const newSamples = [...(currentPOM.samples || [])];
                                          const existingIdx = newSamples.findIndex(s => s.index === sampleNum);
                                          if (existingIdx >= 0) {
                                            newSamples[existingIdx] = { index: sampleNum, value: e.target.value };
                                          } else {
                                            newSamples.push({ index: sampleNum, value: e.target.value });
                                          }
                                          setValue(`measurements.${index}.samples` as any, newSamples);
                                        }}
                                        className={`h-8 text-center text-sm 
                                        ${isSelected(index, key) ? 'bg-blue-200 ring-2 ring-blue-500 z-10 relative' : ''} 
                                        ${!isSelected(index, key) && isBad ? 'bg-red-50 text-red-600 font-bold border-red-300' : ''}
                                      `}
                                        placeholder="-"
                                        onPaste={handleMeasurementPaste(index, key)}
                                        onCopy={handleCopy}
                                        onKeyDown={(e) => handleCellKeyDown(e, index, key, sizeMeasurementIndices)}
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
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </CardContent>
        </Card >

        {/* Section 5: Defect Breakdown */}
        <DefectCounter
          defectCounts={defectCounts}
          onUpdateCount={updateDefectCount}
          customDefect={customDefect}
          onCustomDefectChange={setCustomDefect}
          onAddCustomDefect={addCustomDefect}
        />

        {/* Section 6: Shipment Details */}
        <ShipmentDetails register={register} />

        {/* Section 7: Photo Evidence */}
        <ImageUploader
          uploadedImages={uploadedImages}
          onImagesChange={setUploadedImages}
        />

        {/* Section 8: Remarks */}
        < Card >
          <CardHeader>
            <CardTitle>8. Final Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea {...register('remarks')} rows={4} placeholder="Overall conclusion, notes for supplier, or specific observations..." />
          </CardContent>
        </Card >

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4 pt-4 border-t">

          <Button type="button" variant="outline" onClick={handleCancel} className="w-32">Cancel</Button>

          {inspectionId ? (
            <>
              <Button
                type="submit"
                disabled={updateMutation.isPending || createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setSubmitAction('update')}
              >
                {updateMutation.isPending ? 'Updating...' : 'Update Report'}
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending || createMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 ml-2"
                onClick={() => setSubmitAction('saveAsNew')}
              >
                {createMutation.isPending ? 'Saving...' : 'Save as New Inspection'}
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              disabled={createMutation.isPending || isGeneratingPdf}
              className="w-48 bg-blue-600 hover:bg-blue-700"
              onClick={() => setSubmitAction('create')}
            >
              {createMutation.isPending || isGeneratingPdf ? 'Processing...' : 'Submit Final Report'}
            </Button>
          )}
        </div>
      </form >


    </>
  );
}