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
                // Prepare payload
                const payload = { ...inspection.formData };

                // 1. Upload main record to correct endpoint
                const response = await axios.post(`${API_URL}${endpoint}`, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const newId = response.data.id;

                // 2. Upload images
                for (const img of inspection.images) {
                    const formData = new FormData();
                    formData.append('image', img.file);
                    formData.append('caption', img.caption);
                    formData.append('category', img.category);

                    await axios.post(`${API_URL}${endpoint}${newId}/upload_image/`, formData, {
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
                    });
                }

                // 3. SUCCESS: Delete from local DB to save storage
                await db.inspections.delete(inspection.id!);
            }

            toast({
                title: "Sync Complete",
                description: `Successfully uploaded ${pendingCount} ${type === 'evaluation' ? 'evaluations' : 'final inspections'}. Local storage cleared.`,
            });
        } catch (error) {
            console.error("Sync failed:", error);
            toast({
                title: "Sync Failed",
                description: "Some items could not be uploaded. Please check your connection.",
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
