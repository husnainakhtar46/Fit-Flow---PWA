import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, X } from 'lucide-react';
import api from '../lib/api';
import DateRangePicker from './DateRangePicker';
import MultiSelectFilter from './MultiSelectFilter';
import FilterPresets from './FilterPresets';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface InspectionFiltersProps {
  filters: {
    dateFrom: string;
    dateTo: string;
    decisions: string[];
    stages: string[];
    customer: string;
    factory: string;
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

  // Fetch factories for filter dropdown
  const { data: factoriesData } = useQuery({
    queryKey: ['factories-filter'],
    queryFn: async () => (await api.get('/factories/')).data,
  });

  // Handle both paginated and non-paginated responses
  const customers = Array.isArray(customersData) ? customersData : customersData?.results || [];
  const factories = Array.isArray(factoriesData) ? factoriesData : factoriesData?.results || [];

  const updateFilter = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const activeFilterCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.decisions.length > 0,
    filters.stages.length > 0,
    filters.customer,
    filters.factory,
    // Search is now separate, so maybe don't count it as a "hidden filter" if it's visible?
    // User logic: "search bar appear for quick search... if QA require detailed filter he can click".
    // So activeFilterCount should probably reflect the *hidden* filters to alert user.
  ].filter(Boolean).length;

  return (
    <div className="mb-6 space-y-2">
      <div className="flex gap-2 items-center">
        {/* Quick Search Bar (Always Visible) */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Quick Search (Style, PO, Customer)..."
            className="pl-10 bg-white border-gray-300 h-10 shadow-sm"
          />
        </div>

        {/* Filter Toggle Button */}
        <Button
          variant={activeFilterCount > 0 ? "default" : "outline"}
          onClick={() => setIsExpanded(!isExpanded)}
          className={`shrink-0 h-10 gap-2 ${activeFilterCount > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 ml-1 text-xs font-bold bg-white/20 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {/* Clear Search Button (Optional, purely convenience) */}
        {filters.search && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => updateFilter('search', '')}
            className="h-10 w-10 text-gray-500 hover:text-red-500"
            title="Clear Search"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Expanded Filter Panel */}
      {isExpanded && (
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 animate-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-700">Detailed Filters</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)} className="h-6 w-6 p-0 text-gray-400">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">

            {/* Logic for Detailed Filters: Single Grid for better alignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">

              {/* Date Range (Wider to fit two inputs) */}
              <div className="col-span-12 md:col-span-6 lg:col-span-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date Range</label>
                <DateRangePicker
                  showLabel={false}
                  dateFrom={filters.dateFrom}
                  dateTo={filters.dateTo}
                  onDateFromChange={(date) => updateFilter('dateFrom', date)}
                  onDateToChange={(date) => updateFilter('dateTo', date)}
                  onClear={() => {
                    updateFilter('dateFrom', '');
                    updateFilter('dateTo', '');
                  }}
                />
              </div>

              {/* Customer Filter */}
              <div className="col-span-12 md:col-span-6 lg:col-span-3">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Customer</label>
                <select
                  value={filters.customer}
                  onChange={(e) => updateFilter('customer', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm h-10"
                >
                  <option value="">All Customers</option>
                  {customers?.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Factory Filter */}
              <div className="col-span-12 md:col-span-6 lg:col-span-3">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Factory</label>
                <select
                  value={filters.factory}
                  onChange={(e) => updateFilter('factory', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm h-10"
                >
                  <option value="">All Factories</option>
                  {factories?.map((factory: any) => (
                    <option key={factory.id} value={factory.name}>
                      {factory.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sorting (Narrower) */}
              <div className="col-span-12 md:col-span-6 lg:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Sort By</label>
                <select
                  value={filters.ordering}
                  onChange={(e) => updateFilter('ordering', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm h-10"
                >
                  {SORTING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Decision Filter (Half Width) */}
              <div className="col-span-12 lg:col-span-6">
                <MultiSelectFilter
                  label="Decision"
                  options={DECISION_OPTIONS}
                  selected={filters.decisions}
                  onChange={(selected) => updateFilter('decisions', selected)}
                />
              </div>

              {/* Stage Filter (Half Width) */}
              <div className="col-span-12 lg:col-span-6">
                <MultiSelectFilter
                  label="Stage"
                  options={STAGE_OPTIONS}
                  selected={filters.stages}
                  onChange={(selected) => updateFilter('stages', selected)}
                />
              </div>

            </div>

            <hr className="my-2" />

            {/* Filter Presets */}
            <FilterPresets
              currentFilters={filters}
              onLoadPreset={(presetFilters) => onFiltersChange(presetFilters)}
            />

            {/* Clear All Button */}
            {activeFilterCount > 0 && (
              <Button
                variant="destructive"
                onClick={onClearAll}
                className="w-full bg-red-50 text-red-700 hover:bg-red-100 border-red-200 mt-2"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionFilters;
