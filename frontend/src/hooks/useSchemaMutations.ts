import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSchema, updateSchema, deleteSchema, toggleSchema } from '../api/mapping-schemas.api';
import type { CreateMappingSchemaRequest, UpdateMappingSchemaRequest } from '../types/mapping-schema.types';

export function useCreateSchema() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateMappingSchemaRequest) => createSchema(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mapping-schemas'] });
        },
    });
}

export function useUpdateSchema() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateMappingSchemaRequest }) => updateSchema(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mapping-schemas'] });
        },
    });
}

export function useDeleteSchema() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteSchema(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mapping-schemas'] });
        },
    });
}

export function useToggleSchema() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            toggleSchema(id, { isActive }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mapping-schemas'] });
            queryClient.invalidateQueries({ queryKey: ['paths-overview'] });
        },
    });
}
