import { useNavigate, useParams } from 'react-router-dom';
import { SftpUserForm, type SftpUserFormData } from '../components/SftpUserForm';
import { useSftpUserById } from '../hooks/useSftpUsers';
import { useUpdateSftpUser } from '../hooks/useSftpUserMutations';
import type { UpdateSftpUserRequest } from '../types/sftp-user.types';

export function SftpUserEditPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: user, isLoading, error } = useSftpUserById(id);
    const updateMutation = useUpdateSftpUser();

    if (isLoading) {
        return <div className="text-center py-12 text-gray-500">Loading user...</div>;
    }

    if (error || !user) {
        return (
            <div className="text-center py-12 text-red-600">
                {error ? `Error: ${error.message}` : 'User not found'}
            </div>
        );
    }

    const handleSubmit = (data: SftpUserFormData) => {
        const updateData: UpdateSftpUserRequest = {};
        if (data.password) updateData.password = data.password;
        if (data.rootDirectory) updateData.rootDirectory = data.rootDirectory;

        updateMutation.mutate(
            { id: user.id, data: updateData },
            { onSuccess: () => navigate('/sftp-users') },
        );
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Edit SFTP User</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Modify configuration for user <span className="font-mono">{user.username}</span>
                </p>
            </div>

            {updateMutation.error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                    {updateMutation.error.message}
                </div>
            )}

            <SftpUserForm
                defaultValues={{
                    username: user.username,
                    rootDirectory: user.rootDirectory,
                }}
                onSubmit={handleSubmit}
                isSubmitting={updateMutation.isPending}
                submitLabel="Update User"
                isEditing
            />
        </div>
    );
}
