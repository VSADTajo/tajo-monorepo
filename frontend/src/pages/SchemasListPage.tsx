import { Link } from 'react-router-dom';
import { useSchemasList } from '../hooks/useSchemas';
import { useDeleteSchema, useToggleSchema } from '../hooks/useSchemaMutations';
import { SchemaTable } from '../components/SchemaTable';

function TableSkeleton() {
    return (
        <div className="bg-white shadow rounded-lg overflow-hidden animate-pulse">
            <div className="bg-gray-50 px-6 py-3 flex gap-8">
                {[160, 140, 120, 60, 70, 80].map((w, i) => (
                    <div key={i} className="h-3 bg-gray-200 rounded" style={{ width: w }} />
                ))}
            </div>
            {[...Array(4)].map((_, i) => (
                <div key={i} className="px-6 py-4 border-t border-gray-100 flex gap-8 items-center">
                    <div className="h-4 bg-gray-100 rounded w-40" />
                    <div className="h-4 bg-gray-100 rounded w-36" />
                    <div className="h-4 bg-gray-100 rounded w-28" />
                    <div className="h-4 bg-gray-100 rounded w-12" />
                    <div className="h-4 bg-gray-100 rounded w-16" />
                    <div className="h-4 bg-gray-100 rounded w-16" />
                </div>
            ))}
        </div>
    );
}

export function SchemasListPage() {
    const { data: schemas, isLoading, error } = useSchemasList();
    const deleteMutation = useDeleteSchema();
    const toggleMutation = useToggleSchema();

    return (
        <div>
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Schemas de Mapeo</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Definen cómo se transforman los archivos de cada ruta SFTP al descargarlos.
                        Cada schema especifica el formato de entrada, el de salida y los campos a mapear.
                    </p>
                </div>
                <Link
                    to="/schemas/create"
                    className="ml-4 flex-shrink-0 inline-flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Nuevo schema
                </Link>
            </div>

            {error && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    Error cargando schemas: {error.message}
                </div>
            )}

            {isLoading ? (
                <TableSkeleton />
            ) : (
                <SchemaTable
                    schemas={schemas ?? []}
                    onToggle={(id, isActive) => toggleMutation.mutate({ id, isActive })}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    isToggling={toggleMutation.isPending}
                />
            )}
        </div>
    );
}
