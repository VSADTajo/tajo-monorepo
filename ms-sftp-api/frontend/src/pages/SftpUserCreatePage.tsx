import { useNavigate } from 'react-router-dom';
import { SftpUserForm, type SftpUserFormData } from '../components/SftpUserForm';
import { useCreateSftpUser } from '../hooks/useSftpUserMutations';

export function SftpUserCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreateSftpUser();

    const handleSubmit = (data: SftpUserFormData) => {
        createMutation.mutate(data, {
            onSuccess: () => navigate('/sftp-users'),
        });
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Create SFTP User</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Add a new user that can connect to the embedded SFTP server.
                </p>
            </div>

            {createMutation.error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                    {createMutation.error.message}
                </div>
            )}

            <SftpUserForm
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending}
                submitLabel="Create User"
            />
        </div>
    );
}
