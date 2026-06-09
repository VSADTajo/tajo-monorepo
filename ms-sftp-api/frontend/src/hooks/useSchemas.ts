import { useQuery } from '@tanstack/react-query';
import { fetchSchemas, fetchSchemaById } from '../api/mapping-schemas.api';

export function useSchemasList() {
    return useQuery({
        queryKey: ['mapping-schemas'],
        queryFn: fetchSchemas,
        select: (data) => data.schemas,
    });
}

export function useSchemaById(id: string | undefined) {
    return useQuery({
        queryKey: ['mapping-schemas', id],
        queryFn: () => fetchSchemaById(id!),
        enabled: !!id,
    });
}
