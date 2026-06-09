/**
 * Builds a valid SFTP connection DTO for tests.
 */
export function buildSftpConnectionDto(
    overrides?: Partial<{ host: string; port: number; username: string; password: string }>,
) {
    return {
        host: 'sftp.example.com',
        port: 22,
        username: 'testuser',
        password: 'testpassword',
        ...overrides,
    };
}

/**
 * Builds an SFTP list files request DTO.
 */
export function buildSftpListFilesDto(overrides?: Partial<{ directory: string }>) {
    return {
        connection: buildSftpConnectionDto(),
        directory: '/remote/inbox',
        ...overrides,
    };
}

/**
 * Builds an SFTP download file request DTO.
 */
export function buildSftpDownloadFileDto(overrides?: Partial<{ path: string }>) {
    return {
        connection: buildSftpConnectionDto(),
        path: '/remote/inbox/report.csv',
        ...overrides,
    };
}

/**
 * Builds an SFTP download-to-local request DTO.
 */
export function buildSftpDownloadToLocalDto(
    overrides?: Partial<{ remotePath: string; localPath: string; overwrite: boolean }>,
) {
    return {
        connection: buildSftpConnectionDto(),
        remotePath: '/remote/inbox/report.csv',
        localPath: 'inbox/report.csv',
        ...overrides,
    };
}

/**
 * Builds an SFTP move file request DTO.
 */
export function buildSftpMoveFileDto(overrides?: Partial<{ sourcePath: string; destinationPath: string }>) {
    return {
        connection: buildSftpConnectionDto(),
        sourcePath: '/remote/inbox/report.csv',
        destinationPath: '/remote/processed/report.csv',
        ...overrides,
    };
}

/**
 * Builds an SFTP delete file request DTO.
 */
export function buildSftpDeleteFileDto(overrides?: Partial<{ path: string }>) {
    return {
        connection: buildSftpConnectionDto(),
        path: '/remote/processed/old-report.csv',
        ...overrides,
    };
}
