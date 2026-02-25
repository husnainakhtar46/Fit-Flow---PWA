import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: Record<string, any>;
  created_at: string;
}

interface FilterPresetsProps {
  currentFilters: Record<string, any>;
  onLoadPreset: (filters: Record<string, any>) => void;
}

const FilterPresets: React.FC<FilterPresetsProps> = ({
  currentFilters,
  onLoadPreset,
}) => {
  const queryClient = useQueryClient();
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [presetName, setPresetName] = React.useState('');
  const [presetDescription, setPresetDescription] = React.useState('');

  // Fetch user's filter presets
  const { data: presetsData } = useQuery({
    queryKey: ['filter-presets'],
    queryFn: async () => (await api.get('/filter-presets/')).data,
  });

  // Handle paginated response
  const presets: FilterPreset[] = Array.isArray(presetsData) ? presetsData : presetsData?.results || [];

  // Save new preset
  const savePresetMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; filters: Record<string, any> }) =>
      api.post('/filter-presets/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      setShowSaveDialog(false);
      setPresetName('');
      setPresetDescription('');
    },
  });

  // Delete preset
  const deletePresetMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/filter-presets/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
    },
  });

  const handleSave = () => {
    if (presetName.trim()) {
      savePresetMutation.mutate({
        name: presetName,
        description: presetDescription,
        filters: currentFilters,
      });
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">Filter Presets</label>

      {/* Load Preset */}
      {presets && presets.length > 0 && (
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          onChange={(e) => {
            const preset = presets.find((p: FilterPreset) => p.id === e.target.value);
            if (preset) onLoadPreset(preset.filters);
          }}
          defaultValue=""
        >
          <option value="">Load a saved preset...</option>
          {presets.map((preset: FilterPreset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      )}

      {/* Save/Delete Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowSaveDialog(true)}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          💾 Save Current Filters
        </button>

        {presets && presets.length > 0 && (
          <select
            className="px-3 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 text-sm"
            onChange={(e) => {
              if (e.target.value && confirm('Delete this preset?')) {
                deletePresetMutation.mutate(e.target.value);
                e.target.value = '';
              }
            }}
            defaultValue=""
          >
            <option value="">Delete...</option>
            {presets.map((preset: FilterPreset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Save Filter Preset</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preset Name *
                </label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Pending Proto Reviews"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={presetDescription}
                  onChange={(e) => setPresetDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief description of this filter preset"
                  rows={2}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setPresetName('');
                    setPresetDescription('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!presetName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Preset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPresets;
