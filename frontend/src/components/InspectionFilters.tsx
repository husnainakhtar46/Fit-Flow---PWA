import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import DateRangePicker from './DateRangePicker';
import MultiSelectFilter from './MultiSelectFilter';
import FilterPresets from './FilterPresets';

interface InspectionFiltersProps {
  filters: {
    dateFrom: string;
    dateTo: string;
    decisions: string[];
    stages: string[];
    customer: string;
    search: string;
    ordering: string;
  };
  onFiltersChange: (filters: any) => void;
  onClearAll: () => void;
}

const DECISION_OPTIONS = [
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Represent', label: 'Represent' },
];

const STAGE_OPTIONS = [
  { value: 'Dev', label: 'Dev' },
  { value: 'Proto', label: 'Proto' },
  { value: 'Fit', label: 'Fit' },
  { value: 'SMS', label: 'SMS' },
  { value: 'Size Set', label: 'Size Set' },
  { value: 'PPS', label: 'PPS' },
  { value: 'Shipment Sample', label: 'Shipment Sample' },
];

const SORTING_OPTIONS = [
  { value: '-created_at', label: 'Newest First' },
  { value: 'created_at', label: 'Oldest First' },
  { value: 'style', label: 'Style (A-Z)' },
  { value: '-style', label: 'Style (Z-A)' },
  { value: 'decision', label: 'Decision' },
];

const InspectionFilters: React.FC<InspectionFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearAll,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch customers for filter dropdown
  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => (await api.get('/customers/')).data,
  });

  // Handle both paginated and non-paginated responses
  const customers = Array.isArray(customersData) ? customersData : customersData?.results || [];

  const updateFilter = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const activeFilterCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.decisions.length > 0,
    filters.stages.length > 0,
    filters.customer,
    filters.search,
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-lg shadow-md mb-6">
      {/* Header */}
      <div
        className="flex justify-between items-center p-4 cursor-pointer border-b"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800">🔍 Filters</h2>
          {activeFilterCount > 0 && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">              {activeFilterCount} active
            </span>
          )}
        </div>
        <button className="text-gray-500 hover:text-gray-700">
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Filter Panel */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="Style, PO Number, Customer, or Creator..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Date Range */}
          <DateRangePicker
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onDateFromChange={(date) => updateFilter('dateFrom', date)}
            onDateToChange={(date) => updateFilter('dateTo', date)}
            onClear={() => {
              updateFilter('dateFrom', '');
              updateFilter('dateTo', '');
            }}
          />

          {/* Decision Filter */}
          <MultiSelectFilter
            label="Decision"
            options={DECISION_OPTIONS}
            selected={filters.decisions}
            onChange={(selected) => updateFilter('decisions', selected)}
          />

          {/* Stage Filter */}
          <MultiSelectFilter
            label="Stage"
            options={STAGE_OPTIONS}
            selected={filters.stages}
            onChange={(selected) => updateFilter('stages', selected)}
          />

          {/* Customer Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer
            </label>
            <select
              value={filters.customer}
              onChange={(e) => updateFilter('customer', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Customers</option>
              {customers?.map((customer: any) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sorting */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={filters.ordering}
              onChange={(e) => updateFilter('ordering', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              {SORTING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <hr className="my-4" />

          {/* Filter Presets */}
          <FilterPresets
            currentFilters={filters}
            onLoadPreset={(presetFilters) => onFiltersChange(presetFilters)}
          />

          {/* Clear All Button */}
          {activeFilterCount > 0 && (
            <button
              onClick={onClearAll}
              className="w-full px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-medium transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default InspectionFilters;
