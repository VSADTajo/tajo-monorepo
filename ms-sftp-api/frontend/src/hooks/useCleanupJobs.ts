import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    createCleanupJob,
    updateCleanupJob,
    toggleCleanupJob,
    deleteCleanupJob,
} from '../api/cleanup-jobs.api';
import type { CreateCleanupJobRequest, UpdateCleanupJobRequest } from '../types/cleanup-job.types';

export function useCreateCleanupJob() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateCleanupJobRequest) => createCleanupJob(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['paths-overview'] });
        },
    });
}

export function useUpdateCleanupJob() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateCleanupJobRequest }) =>
            updateCleanupJob(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['paths-overview'] });
        },
    });
}

export function useToggleCleanupJob() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            toggleCleanupJob(id, isActive),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['paths-overview'] });
        },
    });
}

export function useDeleteCleanupJob() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteCleanupJob(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['paths-overview'] });
        },
    });
}
