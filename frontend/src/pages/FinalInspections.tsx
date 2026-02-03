import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Card, CardContent } from '../components/ui/card';
import { Download, Plus, Search, Pencil, Trash2, FileText } from 'lucide-react';
import { useToast } from '../components/ui/use-toast';
import FinalInspectionForm from '../components/FinalInspectionForm';
import Pagination from '../components/Pagination';
import { useAuth } from '../lib/useAuth';
import SyncManager from '../components/SyncManager';


interface FinalInspection {
  id: string;
  order_no: string;
  style_no: string;
  color?: string;
  factory?: string;
  inspection_attempt: string;
  customer: string | null;
  customer_name?: string;
  inspection_date: string;
  result: 'Pass' | 'Fail' | 'Pending';
  total_order_qty: number;
  sample_size: number;
  created_at: string;
  created_by_username?: string;
}

interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

export default function FinalInspections() {
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<string | null>(null);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreateInspections, canEditFinalInspection, isReadOnly } = useAuth();

  const handleCloseAttempt = (open: boolean) => {
    if (!open && isFormOpen) {
      // User is trying to close the dialog
      setShowCloseConfirmation(true);
    } else {
      setIsFormOpen(open);
    }
  };

  const handleConfirmClose = () => {
    setShowCloseConfirmation(false);
    setIsFormOpen(false);
    setSelectedInspection(null);
  };

  const handleCancelClose = () => {
    setShowCloseConfirmation(false);
  };


  // Fetch final inspections with pagination
  const { data: inspectionData, isLoading, isPlaceholderData } = useQuery<PaginatedResponse<FinalInspection>>({
    queryKey: ['finalInspections', resultFilter, page, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      if (resultFilter) params.append('result', resultFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await api.get(`/final-inspections/?${params}`);
      return response.data;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    placeholderData: (previousData) => previousData,
  });

  // Extract inspections from paginated response
  const inspections = inspectionData?.results || [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/final-inspections/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finalInspections'] });
      toast({ title: 'Final Inspection deleted successfully' });
    },
  });

  // Download PDF
  const handleDownloadPDF = async (inspection: FinalInspection) => {
    try {
      const response = await api.get(
        `/final-inspections/${inspection.id}/pdf/`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `FIR_${inspection.order_no}_${inspection.style_no}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast({ title: 'PDF downloaded successfully' });
    } catch (error) {
      toast({ title: 'Failed to download PDF', variant: 'destructive' });
    }
  };

  // Use backend filtered results directly
  const filteredInspections = inspections;

  // Debug logging
  console.log('=== FinalInspections Debug ===');
  console.log('inspections:', inspections);
  console.log('inspections length:', inspections?.length);
  console.log('filteredInspections:', filteredInspections);
  console.log('filteredInspections length:', filteredInspections?.length);
  console.log('searchTerm:', searchTerm);
  console.log('isLoading:', isLoading);
  console.log('resultFilter:', resultFilter);

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'Pass':
        return <Badge className="bg-green-500">Pass</Badge>;
      case 'Fail':
        return <Badge variant="destructive">Fail</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };


  return (
    <div className="space-y-4 md:space-y-6 pb-10">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Final Inspection Reports</h1>
        <div className="flex items-center gap-4">
          <SyncManager type="final_inspection" />
          {canCreateInspections && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create New FIR
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by order no, style, or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="border rounded-md px-3 py-2"
            >
              <option value="">All Results</option>
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card><CardContent className="pt-6">Loading...</CardContent></Card>
        ) : filteredInspections && filteredInspections.length > 0 ? (
          filteredInspections.map((inspection) => (
            <Card key={inspection.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{inspection.order_no}</h3>
                      {getResultBadge(inspection.result)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                      <div><span className="font-medium">Style:</span> {inspection.style_no}</div>
                      <div><span className="font-medium">Customer:</span> {inspection.customer_name || 'N/A'}</div>
                      <div><span className="font-medium">Date:</span> {new Date(inspection.inspection_date).toLocaleDateString()}</div>
                      <div><span className="font-medium">Order Qty:</span> {inspection.total_order_qty}</div>
                      <div><span className="font-medium">Sample Size:</span> {inspection.sample_size}</div>
                      <div><span className="font-medium">Created:</span> {new Date(inspection.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPDF(inspection)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canEditFinalInspection(inspection.created_by_username) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedInspection(inspection.id);
                          setIsFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {!isReadOnly && canEditFinalInspection(inspection.created_by_username) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this Final Inspection?')) {
                            deleteMutation.mutate(inspection.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No final inspections found</p>
              <p className="text-sm">Create your first FIR to get started</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && inspections.length > 0 && (
        <Pagination
          page={page}
          hasNext={!!inspectionData?.next}
          hasPrevious={!!inspectionData?.previous}
          onPageChange={(newPage) => setPage(newPage)}
          isLoading={isPlaceholderData}
          totalCount={inspectionData?.count}
          pageSize={10}
        />
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={handleCloseAttempt}>
        <DialogContent className="max-w-full w-screen h-screen overflow-y-auto rounded-none p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Final Inspection Form</DialogTitle>
            <DialogDescription>
              Create or edit a final inspection report. Fill out all required fields and submit.
            </DialogDescription>
          </DialogHeader>
          <FinalInspectionForm
            inspectionId={selectedInspection || undefined}
            onClose={() => {
              setIsFormOpen(false);
              setSelectedInspection(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Close Confirmation Dialog */}
      <Dialog open={showCloseConfirmation} onOpenChange={setShowCloseConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close Final Inspection?</DialogTitle>
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
    </div>
  );
}
