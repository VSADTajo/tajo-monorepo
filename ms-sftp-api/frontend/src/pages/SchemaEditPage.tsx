import { useNavigate, useParams } from 'react-router-dom';
import { SchemaForm, type SchemaFormData } from '../components/SchemaForm';
import { useSchemaById } from '../hooks/useSchemas';
import { useUpdateSchema } from '../hooks/useSchemaMutations';

export function SchemaEditPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: schema, isLoading, error } = useSchemaById(id);
    const updateMutation = useUpdateSchema();

    if (isLoading) {
        return <div className="text-center py-12 text-gray-500">Loading schema...</div>;
    }

    if (error || !schema) {
        return (
            <div className="text-center py-12 text-red-600">
                {error ? `Error: ${error.message}` : 'Schema not found'}
            </div>
        );
    }

    const handleSubmit = (data: SchemaFormData) => {
        updateMutation.mutate(
            { id: schema.id, data },
            { onSuccess: () => navigate('/') },
        );
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Edit Mapping Schema</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Modify the mapping configuration for <span className="font-mono">{schema.directoryPath}</span>
                </p>
            </div>

            {updateMutation.error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                    {updateMutation.error.message}
                </div>
            )}

            <SchemaForm
                defaultValues={{
                    directoryPath: schema.directoryPath,
                    name: schema.name,
                    inputFormat: schema.inputFormat,
                    outputFormat: schema.outputFormat,
                    fieldMappings: schema.fieldMappings,
                    csvOptions: schema.csvOptions ?? undefined,
                }}
                onSubmit={handleSubmit}
                isSubmitting={updateMutation.isPending}
                submitLabel="Update Schema"
            />
        </div>
    );
}
