import type { FieldMapping } from '../types/mapping-schema.types';

interface FieldMappingEditorProps {
    value: FieldMapping[];
    onChange: (mappings: FieldMapping[]) => void;
}

const DATA_TYPES = ['string', 'number', 'date', 'boolean'] as const;

const emptyMapping: FieldMapping = {
    sourceField: '',
    targetField: '',
    dataType: 'string',
    defaultValue: '',
    transform: '',
};

export function FieldMappingEditor({ value, onChange }: FieldMappingEditorProps) {
    const addRow = () => {
        onChange([...value, { ...emptyMapping }]);
    };

    const removeRow = (index: number) => {
        if (value.length <= 1) return;
        onChange(value.filter((_, i) => i !== index));
    };

    const updateRow = (index: number, field: keyof FieldMapping, newValue: string) => {
        const updated = value.map((row, i) => (i === index ? { ...row, [field]: newValue } : row));
        onChange(updated);
    };

    const moveRow = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= value.length) return;
        const updated = [...value];
        [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
        onChange(updated);
    };

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Field Mappings</h3>
                <button
                    type="button"
                    onClick={addRow}
                    className="bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-md text-sm font-medium"
                >
                    + Add Field
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source Field</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Target Field</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data Type</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Default Value</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transform</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {value.map((mapping, index) => (
                            <tr key={index}>
                                <td className="px-3 py-2">
                                    <input
                                        type="text"
                                        value={mapping.sourceField}
                                        onChange={(e) => updateRow(index, 'sourceField', e.target.value)}
                                        placeholder="locationId"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-2 py-1"
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <input
                                        type="text"
                                        value={mapping.targetField}
                                        onChange={(e) => updateRow(index, 'targetField', e.target.value)}
                                        placeholder="location_id"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-2 py-1"
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <select
                                        value={mapping.dataType ?? 'string'}
                                        onChange={(e) => updateRow(index, 'dataType', e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-2 py-1"
                                    >
                                        {DATA_TYPES.map((dt) => (
                                            <option key={dt} value={dt}>
                                                {dt}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-3 py-2">
                                    <input
                                        type="text"
                                        value={mapping.defaultValue ?? ''}
                                        onChange={(e) => updateRow(index, 'defaultValue', e.target.value)}
                                        placeholder="N/A"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-2 py-1"
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <input
                                        type="text"
                                        value={mapping.transform ?? ''}
                                        onChange={(e) => updateRow(index, 'transform', e.target.value)}
                                        placeholder="lowercase"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-2 py-1"
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center space-x-1">
                                        <button
                                            type="button"
                                            onClick={() => moveRow(index, 'up')}
                                            disabled={index === 0}
                                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 p-1"
                                            title="Move up"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveRow(index, 'down')}
                                            disabled={index === value.length - 1}
                                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 p-1"
                                            title="Move down"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeRow(index)}
                                            disabled={value.length <= 1}
                                            className="text-red-400 hover:text-red-600 disabled:opacity-30 p-1"
                                            title="Remove"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
