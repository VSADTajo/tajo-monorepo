import { useQuery } from '@tanstack/react-query';
import { fetchPathsOverview } from '../api/files.api';

export function usePathsOverview() {
    return useQuery({
        queryKey: ['paths-overview'],
        queryFn: fetchPathsOverview,
        select: (data) => data.paths,
    });
}
