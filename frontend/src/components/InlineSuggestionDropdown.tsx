import { useEffect, useRef, useState } from 'react';

interface StyleSuggestion {
    id: string;
    po_number: string;
    style_name: string;
    color: string;
    customer: string | null;
    customer_name: string | null;
    score?: number;
}

interface InlineSuggestionDropdownProps {
    suggestions: string[];
    onSelect: (value: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Simple inline suggestion dropdown - like browser autocomplete
 * Shows a list of suggestions that the user can select or ignore
 */
export const InlineSuggestionDropdown = ({
    suggestions,
    onSelect,
    isOpen,
    onClose,
}: InlineSuggestionDropdownProps) => {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev =>
                        prev < suggestions.length - 1 ? prev + 1 : prev
                    );
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                        onSelect(suggestions[selectedIndex]);
                    }
                    break;
                case 'Escape':
                    onClose();
                    break;
                case 'Tab':
                    // Allow tab to close and move to next field
                    onClose();
                    break;
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, selectedIndex, suggestions, onSelect, onClose]);

    // Reset selected index when suggestions change
    useEffect(() => {
        setSelectedIndex(-1);
    }, [suggestions]);

    if (!isOpen || suggestions.length === 0) return null;

    return (
        <div
            ref={dropdownRef}
            className="absolute z-[120] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
            <ul className="py-1">
                {suggestions.slice(0, 6).map((suggestion, index) => (
                    <li
                        key={index}
                        onClick={() => onSelect(suggestion)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`px-3 py-2 cursor-pointer text-sm transition-colors ${index === selectedIndex
                            ? 'bg-blue-50 text-blue-700'
                            : 'hover:bg-gray-50 text-gray-700'
                            }`}
                    >
                        {suggestion}
                    </li>
                ))}
            </ul>
        </div>
    );
};

// Export StyleSuggestion type for use in other components
export type { StyleSuggestion };
