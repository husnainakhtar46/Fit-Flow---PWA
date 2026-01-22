import { Button } from './ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    page: number;
    hasNext: boolean;
    hasPrevious: boolean;
    onPageChange: (page: number) => void;
    isLoading?: boolean;
    totalCount?: number;
    pageSize?: number;
}

export function Pagination({
    page,
    hasNext,
    hasPrevious,
    onPageChange,
    isLoading = false,
    totalCount,
    pageSize = 10
}: PaginationProps) {
    const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : undefined;

    return (
        <div className="flex items-center justify-between px-4 py-4 border-t">
            <div className="text-sm text-gray-500">
                Page {page}{totalPages ? ` of ${totalPages}` : ''}
                {totalCount !== undefined && (
                    <span className="ml-2 text-gray-400">({totalCount} total)</span>
                )}
            </div>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(Math.max(page - 1, 1))}
                    disabled={!hasPrevious || isLoading}
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={!hasNext || isLoading}
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

export default Pagination;
