import type { CsvOptions } from '../types/mapping-schema.types';

interface CsvOptionsPanelProps {
    value?: CsvOptions;
    onChange: (options: CsvOptions) => void;
}

export function CsvOptionsPanel({ value, onChange }: CsvOptionsPanelProps) {
    const opts: CsvOptions = {
        delimiter: ';',
        encoding: 'utf-8',
        metadataRows: 0,
        outputDelimiter: ',',
        includeHeader: true,
        ...value,
    };

    const update = (field: keyof CsvOptions, newValue: string | number | boolean) => {
        onChange({ ...opts, [field]: newValue });
    };

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">CSV Options</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="csv-delimiter" className="block text-sm font-medium text-gray-700">
                        Input Delimiter
                    </label>
                    <input
                        id="csv-delimiter"
                        type="text"
                        value={opts.delimiter ?? ';'}
                        onChange={(e) => update('delimiter', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                    />
                </div>

                <div>
                    <label htmlFor="csv-encoding" className="block text-sm font-medium text-gray-700">
                        Encoding
                    </label>
                    <input
                        id="csv-encoding"
                        type="text"
                        value={opts.encoding ?? 'utf-8'}
                        onChange={(e) => update('encoding', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                    />
                </div>

                <div>
                    <label htmlFor="csv-metadata-rows" className="block text-sm font-medium text-gray-700">
                        Metadata Rows to Skip
                    </label>
                    <input
                        id="csv-metadata-rows"
                        type="number"
                        min={0}
                        value={opts.metadataRows ?? 0}
                        onChange={(e) => update('metadataRows', parseInt(e.target.value, 10) || 0)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                    />
                </div>

                <div>
                    <label htmlFor="csv-output-delimiter" className="block text-sm font-medium text-gray-700">
                        Output Delimiter
                    </label>
                    <input
                        id="csv-output-delimiter"
                        type="text"
                        value={opts.outputDelimiter ?? ','}
                        onChange={(e) => update('outputDelimiter', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                    />
                </div>

                <div className="flex items-center pt-6">
                    <input
                        id="csv-include-header"
                        type="checkbox"
                        checked={opts.includeHeader ?? true}
                        onChange={(e) => update('includeHeader', e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="csv-include-header" className="ml-2 block text-sm text-gray-700">
                        Include Header Row in Output
                    </label>
                </div>
            </div>
        </div>
    );
}
