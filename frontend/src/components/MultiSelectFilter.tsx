import React from 'react';

interface MultiSelectFilterProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select...',
}) => {
  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = () => onChange([]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="block text-sm font-semibold text-gray-700">{label}</label>
        {selected.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Clear
          </button>
        )}
      </div>
      <div className="border border-gray-300 rounded-md p-2 max-h-40 overflow-y-auto bg-white">
        {options.length === 0 ? (
          <p className="text-sm text-gray-500 p-2">{placeholder}</p>
        ) : (
          options.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggleOption(option.value)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))
        )}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-gray-600">{selected.length} selected</p>
      )}
    </div>
  );
};

export default MultiSelectFilter;
