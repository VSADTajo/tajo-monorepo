import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSftpUser, updateSftpUser, deleteSftpUser, toggleSftpUser } from '../api/sftp-users.api';
import type { CreateSftpUserRequest, UpdateSftpUserRequest } from '../types/sftp-user.types';

export function useCreateSftpUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateSftpUserRequest) => createSftpUser(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sftp-users'] });
        },
    });
}

export function useUpdateSftpUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateSftpUserRequest }) => updateSftpUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sftp-users'] });
        },
    });
}

export function useDeleteSftpUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteSftpUser(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sftp-users'] });
        },
    });
}

export function useToggleSftpUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            toggleSftpUser(id, { isActive }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sftp-users'] });
        },
    });
}
