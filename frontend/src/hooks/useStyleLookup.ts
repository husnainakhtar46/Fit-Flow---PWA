import { useQuery } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import axios from 'axios';
import { useMemo } from 'react';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000';

interface StyleMaster {
    id: string;
    po_number: string;
    style_name: string;
    color: string;
    customer: string | null;
    customer_name: string | null;
    season?: string;
}

export interface StyleSuggestion extends StyleMaster {
    score?: number;
}

/**
 * Custom hook for looking up Style/Color based on PO number
 * Returns search functions that filter by PO number
 */
export const useStyleLookup = () => {
    // Fetch all StyleMaster data
    const { data: stylesData, isLoading } = useQuery({
        queryKey: ['style-masters-lookup'],
        queryFn: async () => {
            const token = localStorage.getItem('access_token');
            const response = await axios.get(`${API_URL}/styles/`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page_size: 1000 } // Get all for fuzzy search
            });
            return Array.isArray(response.data) ? response.data : response.data?.results || [];
        },
        staleTime: 1000 * 60 * 10, // 10 minutes
        refetchOnWindowFocus: false,
    });

    // Initialize Fuse.js for PO fuzzy searching
    const fusePO = useMemo(() => {
        if (!stylesData || stylesData.length === 0) return null;

        return new Fuse(stylesData, {
            keys: [
                { name: 'po_number', weight: 1.0 },
            ],
            threshold: 0.3,
            includeScore: true,
            includeMatches: true,
            minMatchCharLength: 2,
        });
    }, [stylesData]);

    /**
     * Search for styles that match the given PO number
     * Returns all style entries that have a similar PO number
     */
    const searchByPO = (poNumber: string, maxResults = 8): StyleSuggestion[] => {
        if (!poNumber || poNumber.trim().length < 2) return [];
        if (!stylesData || stylesData.length === 0) return [];

        const trimmedQuery = poNumber.trim();

        // 1. First try exact match on PO
        const exactMatches = stylesData.filter(
            (style: StyleMaster) => style.po_number.toLowerCase() === trimmedQuery.toLowerCase()
        );

        if (exactMatches.length > 0) {
            return exactMatches.slice(0, maxResults).map((item: StyleMaster) => ({
                id: item.id,
                po_number: item.po_number,
                style_name: item.style_name,
                color: item.color,
                customer: item.customer,
                customer_name: item.customer_name,
                score: 0
            }));
        }

        // 2. Fuzzy search by PO
        if (!fusePO) return [];

        const results = fusePO.search(trimmedQuery, { limit: maxResults });

        return results.map(result => {
            const item = result.item as StyleMaster;
            return {
                id: item.id,
                po_number: item.po_number,
                style_name: item.style_name,
                color: item.color,
                customer: item.customer,
                customer_name: item.customer_name,
                score: result.score,
            };
        });
    };

    /**
     * Get unique styles for a given PO number
     */
    const getStylesForPO = (poNumber: string): string[] => {
        const matches = searchByPO(poNumber, 50);
        const uniqueStyles = [...new Set(matches.map(m => m.style_name))];
        return uniqueStyles;
    };

    /**
     * Get unique colors for a given PO number
     */
    const getColorsForPO = (poNumber: string): string[] => {
        const matches = searchByPO(poNumber, 50);
        const uniqueColors = [...new Set(matches.map(m => m.color).filter(Boolean))];
        return uniqueColors;
    };

    /**
     * Get full suggestion data for a given PO
     */
    const getSuggestionsForPO = (poNumber: string): StyleSuggestion[] => {
        return searchByPO(poNumber, 20);
    };

    return {
        searchByPO,
        getStylesForPO,
        getColorsForPO,
        getSuggestionsForPO,
        isLoading,
        stylesData,
    };
};
