import { useState } from 'react';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from './ui/button';
import { CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from './ui/use-toast';
import api from '../lib/api';

interface SyncManagerProps {
    /** Which type of offline inspections to sync: 'evaluation' or 'final_inspection' */
    type: 'evaluation' | 'final_inspection';
}

export default function SyncManager({ type }: SyncManagerProps) {
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);

    // Filter by type
    const pendingInspections = useLiveQuery(
        () => db.inspections
            .where('status').equals('pending_sync')
            .filter(item => item.type === type)
            .toArray(),
        [type]
    );

    const pendingCount = pendingInspections?.length || 0;

    // Determine the correct API endpoint based on type
    const getEndpoint = () => {
        return type === 'evaluation' ? '/inspections/' : '/final-inspections/';
    };

    const handleSync = async () => {
        if (pendingCount === 0 || isSyncing) return;

        setIsSyncing(true);
        const endpoint = getEndpoint();
        let successCount = 0;
        let failCount = 0;

        try {
            for (const inspection of pendingInspections!) {
                try {
                    // Check if we already have a server ID (Partial Sync Case)
                    let newId = inspection.server_id;

                    if (!newId) {
                        // 1. Upload main record using authenticated api instance
                        const payload = { ...inspection.formData };
                        const response = await api.post(endpoint, payload);
                        newId = response.data.id;

                        // Save server_id locally immediately to prevent duplicates on crash
                        if (inspection.id) {
                            await db.inspections.update(inspection.id, { server_id: newId });
                        }
                    }

                    // 2. Upload images
                    for (const img of inspection.images) {
                        const formData = new FormData();
                        formData.append('image', img.file);
                        formData.append('caption', img.caption);
                        formData.append('category', img.category);

                        await api.post(`${endpoint}${newId}/upload_image/`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                        });
                    }

                    // 3. SUCCESS: Delete from local DB
                    if (inspection.id) {
                        await db.inspections.delete(inspection.id);
                    }
                    successCount++;
                } catch (itemError: any) {
                    failCount++;
                    const status = itemError?.response?.status;
                    const detail = itemError?.response?.data?.detail || itemError?.message || 'Unknown error';
                    console.error(`Failed to sync item (HTTP ${status}):`, detail, itemError);

                    toast({
                        title: `Sync failed for 1 item`,
                        description: status === 401
                            ? 'Session expired. Please log in again.'
                            : `Error: ${detail}`,
                        variant: 'destructive',
                    });
                }
            }

            if (successCount > 0) {
                toast({
                    title: 'Sync Complete',
                    description: `${successCount} item(s) synced successfully.${failCount > 0 ? ` ${failCount} failed.` : ''}`,
                });
                // Refresh list to show newly synced items
                window.location.reload();
            }
        } catch (error: any) {
            console.error('Sync critical failure:', error);
            toast({
                title: 'Sync Failed',
                description: 'A critical error occurred during sync. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSyncing(false);
        }
    };

    if (pendingCount === 0) return (
        <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            <span>All Synced</span>
        </div>
    );

    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-amber-600 text-sm font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>{pendingCount} Pending Uploads</span>
            </div>
            <Button
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
                className="bg-blue-600 hover:bg-blue-700 h-8 gap-2"
            >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
        </div>
    );
}
