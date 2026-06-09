import { useQuery } from '@tanstack/react-query';
import { fetchSftpUsers, fetchSftpUserById } from '../api/sftp-users.api';

export function useSftpUsersList() {
    return useQuery({
        queryKey: ['sftp-users'],
        queryFn: fetchSftpUsers,
        select: (data) => data.users,
    });
}

export function useSftpUserById(id: string | undefined) {
    return useQuery({
        queryKey: ['sftp-users', id],
        queryFn: () => fetchSftpUserById(id!),
        enabled: !!id,
    });
}
