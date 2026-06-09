import { useNavigate } from 'react-router-dom';
import { SchemaForm, type SchemaFormData } from '../components/SchemaForm';
import { useCreateSchema } from '../hooks/useSchemaMutations';

export function SchemaCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreateSchema();

    const handleSubmit = (data: SchemaFormData) => {
        createMutation.mutate(data, {
            onSuccess: () => navigate('/'),
        });
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Create Mapping Schema</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Define how files from an SFTP directory should be transformed.
                </p>
            </div>

            {createMutation.error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                    {createMutation.error.message}
                </div>
            )}

            <SchemaForm
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending}
                submitLabel="Create Schema"
            />
        </div>
    );
}
