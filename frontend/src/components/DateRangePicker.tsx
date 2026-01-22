import React from 'react';

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onClear: () => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClear,
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">Date Range</label>
      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="From"
        />
        <span className="text-gray-500">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          min={dateFrom || undefined}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="To"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={onClear}
            className="px-2 py-2 text-gray-500 hover:text-gray-700"
            title="Clear dates"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default DateRangePicker;
