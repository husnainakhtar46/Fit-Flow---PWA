import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { cacheCustomers, getCachedCustomers } from '../lib/db';

// Ensure consistent API_URL definition
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000';

export function useCustomers() {
    return useQuery({
        queryKey: ['customers'],
        queryFn: async () => {
            try {
                const token = localStorage.getItem('access_token');
                console.log('[useCustomers] Fetching via AXIOS from:', `${API_URL}/customers/`);

                const response = await axios.get(`${API_URL}/customers/`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const data = Array.isArray(response.data) ? response.data : response.data?.results || [];
                console.log('[useCustomers] Success, count:', data.length);

                try {
                    await cacheCustomers(data);
                } catch (cacheError) {
                    console.warn('[useCustomers] Caching failed:', cacheError);
                }
                return data;
            } catch (error) {
                console.error('[useCustomers] Fetch failed:', error);
                const cached = await getCachedCustomers();
                return cached || [];
            }
        },
        // Stability settings
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,
        refetchOnWindowFocus: false,
        placeholderData: (previousData: any) => previousData,
    });
}
