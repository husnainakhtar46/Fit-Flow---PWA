/**
 * dateFormatter.ts
 * 
 * Reusable date formatting utilities for the Fit Flow application.
 * Uses native Intl.DateTimeFormat — zero external dependencies.
 * All functions gracefully handle null/undefined inputs.
 */

/**
 * Format an ISO date string to a short date (DD/MM/YYYY).
 * Used for comment card headers, link dates, etc.
 * 
 * @example formatDate("2026-02-28T05:00:00Z") → "28/02/2026"
 */
export function formatDate(dateString?: string | null): string {
    if (!dateString) return '';
    try {
        return new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(new Date(dateString));
    } catch {
        return '';
    }
}

/**
 * Format an ISO date string to date + time (DD/MM/YYYY, HH:mm).
 * Used for per-section "last edited" timestamps.
 * 
 * @example formatDateTime("2026-02-28T14:30:00Z") → "28/02/2026, 14:30"
 */
export function formatDateTime(dateString?: string | null): string {
    if (!dateString) return '';
    try {
        return new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(new Date(dateString));
    } catch {
        return '';
    }
}

/**
 * Format an ISO date string to a relative time string.
 * Falls back to formatDate() if the date is older than 7 days.
 * 
 * @example formatRelative("2026-02-28T14:30:00Z") → "2 hours ago"
 * @example formatRelative("2026-01-15T10:00:00Z") → "15/01/2026"
 */
export function formatRelative(dateString?: string | null): string {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return formatDate(dateString);
    } catch {
        return '';
    }
}
