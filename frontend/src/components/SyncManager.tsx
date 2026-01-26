import { useState } from 'react';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from './ui/button';
import { CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from './ui/use-toast';
import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000';

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
        const token = localStorage.getItem('access_token');
        const endpoint = getEndpoint();

        try {
            for (const inspection of pendingInspections!) {
                try {
                    // Check if we already have a server ID (Partial Sync Case)
                    let newId = inspection.server_id;

                    if (!newId) {
                        // 1. Upload main record
                        const payload = { ...inspection.formData };
                        const response = await axios.post(`${API_URL}${endpoint}`, payload, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        newId = response.data.id;

                        // Save server_id locally immediately to prevent duplicates on crash
                        if (inspection.id) {
                            await db.inspections.update(inspection.id, { server_id: newId });
                        }
                    }

                    // 2. Upload images
                    for (const img of inspection.images) {
                        const formData = new FormData();
                        formData.append('image', img.file); // file is now compressed (processed in ImageUploader)
                        formData.append('caption', img.caption);
                        formData.append('category', img.category);

                        await axios.post(`${API_URL}${endpoint}${newId}/upload_image/`, formData, {
                            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
                        });
                    }

                    // 3. SUCCESS: Delete from local DB
                    if (inspection.id) {
                        await db.inspections.delete(inspection.id);
                    }
                } catch (itemError) {
                    console.error("Failed to sync item", itemError);
                    // Continue to next item even if one fails
                }
            }

            toast({
                title: "Sync Process Finished",
                description: `Sync attempt complete. Check pending items if any remain.`,
            });
            // Force refresh of list
            window.location.reload();
        } catch (error) {
            console.error("Sync critical failure:", error);
            toast({
                title: "Sync Failed",
                description: "Critical error during sync.",
                variant: "destructive",
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
