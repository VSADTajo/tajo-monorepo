import { Link } from 'react-router-dom';
import type { MappingSchema } from '../types/mapping-schema.types';
import { StatusToggle } from './StatusToggle';

interface SchemaTableProps {
    schemas: MappingSchema[];
    onToggle: (id: string, isActive: boolean) => void;
    onDelete: (id: string) => void;
    isToggling?: boolean;
}

const FORMAT_BADGE: Record<string, string> = {
    xml:     'bg-orange-100 text-orange-700',
    csv:     'bg-amber-100 text-amber-700',
    json:    'bg-emerald-100 text-emerald-700',
    dat:     'bg-violet-100 text-violet-700',
    parquet: 'bg-sky-100 text-sky-700',
};

function FormatBadge({ format }: { format: string }) {
    const cls = FORMAT_BADGE[format.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${cls}`}>
            {format}
        </span>
    );
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return 'hace un momento';
    if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)}h`;
    return `hace ${Math.floor(diff / 86_400_000)} días`;
}

export function SchemaTable({ schemas, onToggle, onDelete, isToggling }: SchemaTableProps) {
    if (schemas.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-500 text-sm">No hay schemas configurados aún.</p>
                <Link
                    to="/schemas/create"
                    className="mt-4 inline-block bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium"
                >
                    Crear el primer schema
                </Link>
            </div>
        );
    }

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruta</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transformación</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campos</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Actualizado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {schemas.map((schema) => (
                        <tr key={schema.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-mono text-gray-900 max-w-xs truncate">
                                <span title={schema.directoryPath}>{schema.directoryPath}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{schema.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                    <FormatBadge format={schema.inputFormat} />
                                    <svg className="h-3 w-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                    </svg>
                                    <FormatBadge format={schema.outputFormat} />
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {schema.fieldMappings.length} {schema.fieldMappings.length === 1 ? 'campo' : 'campos'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                    <StatusToggle
                                        isActive={schema.isActive}
                                        onToggle={(active) => onToggle(schema.id, active)}
                                        disabled={isToggling}
                                    />
                                    <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                                        schema.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        {schema.isActive ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 hidden lg:table-cell">
                                <span title={new Date(schema.updatedAt).toLocaleString()}>
                                    {relativeTime(schema.updatedAt)}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                                <Link
                                    to={`/schemas/${schema.id}/edit`}
                                    className="text-indigo-600 hover:text-indigo-900 font-medium"
                                >
                                    Editar
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm(`¿Eliminar schema "${schema.name}"?`)) {
                                            onDelete(schema.id);
                                        }
                                    }}
                                    className="text-red-600 hover:text-red-900 font-medium"
                                >
                                    Eliminar
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
