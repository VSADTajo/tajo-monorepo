import { useQuery } from '@tanstack/react-query';
import { fetchFiles } from '../api/files.api';

export function useFilesList(directory: string | undefined, enabled: boolean) {
    return useQuery({
        queryKey: ['files', directory],
        queryFn: () => fetchFiles(directory!),
        enabled: !!directory && enabled,
        select: (data) => data.files,
        retry: false,
    });
}
