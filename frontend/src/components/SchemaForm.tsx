import { useForm } from 'react-hook-form';
import type { InputFormat, OutputFormat, FieldMapping, CsvOptions } from '../types/mapping-schema.types';
import { FieldMappingEditor } from './FieldMappingEditor';
import { CsvOptionsPanel } from './CsvOptionsPanel';

export interface SchemaFormData {
    directoryPath: string;
    name: string;
    inputFormat: InputFormat;
    outputFormat: OutputFormat;
    fieldMappings: FieldMapping[];
    csvOptions?: CsvOptions;
}

interface SchemaFormProps {
    defaultValues?: Partial<SchemaFormData>;
    onSubmit: (data: SchemaFormData) => void;
    isSubmitting?: boolean;
    submitLabel?: string;
}

const INPUT_FORMATS: { value: InputFormat; label: string }[] = [
    { value: 'xml', label: 'XML' },
    { value: 'csv', label: 'CSV' },
];

const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
    { value: 'json', label: 'JSON' },
    { value: 'csv', label: 'CSV' },
    { value: 'dat', label: 'DAT' },
    { value: 'parquet', label: 'Parquet' },
];

export function SchemaForm({ defaultValues, onSubmit, isSubmitting, submitLabel = 'Save' }: SchemaFormProps) {
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<SchemaFormData>({
        defaultValues: {
            directoryPath: '',
            name: '',
            inputFormat: 'xml',
            outputFormat: 'json',
            fieldMappings: [{ sourceField: '', targetField: '', dataType: 'string' }],
            ...defaultValues,
        },
    });

    const inputFormat = watch('inputFormat');
    const fieldMappings = watch('fieldMappings');
    const csvOptions = watch('csvOptions');

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Schema Configuration</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="directoryPath" className="block text-sm font-medium text-gray-700">
                            Directory Path
                        </label>
                        <input
                            id="directoryPath"
                            type="text"
                            placeholder="/data/incoming/forecasts"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                            {...register('directoryPath', { required: 'Directory path is required' })}
                        />
                        {errors.directoryPath && (
                            <p className="mt-1 text-sm text-red-600">{errors.directoryPath.message}</p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                            Schema Name
                        </label>
                        <input
                            id="name"
                            type="text"
                            placeholder="Forecast NAM to JSON"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                            {...register('name', { required: 'Schema name is required' })}
                        />
                        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
                    </div>

                    <div>
                        <label htmlFor="inputFormat" className="block text-sm font-medium text-gray-700">
                            Input Format
                        </label>
                        <select
                            id="inputFormat"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                            {...register('inputFormat', { required: 'Input format is required' })}
                        >
                            {INPUT_FORMATS.map((f) => (
                                <option key={f.value} value={f.value}>
                                    {f.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="outputFormat" className="block text-sm font-medium text-gray-700">
                            Output Format
                        </label>
                        <select
                            id="outputFormat"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                            {...register('outputFormat', { required: 'Output format is required' })}
                        >
                            {OUTPUT_FORMATS.map((f) => (
                                <option key={f.value} value={f.value}>
                                    {f.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {inputFormat === 'csv' && (
                <CsvOptionsPanel
                    value={csvOptions}
                    onChange={(opts) => setValue('csvOptions', opts)}
                />
            )}

            <FieldMappingEditor
                value={fieldMappings}
                onChange={(mappings) => setValue('fieldMappings', mappings)}
            />

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 px-6 py-2 rounded-md text-sm font-medium"
                >
                    {isSubmitting ? 'Saving...' : submitLabel}
                </button>
            </div>
        </form>
    );
}
