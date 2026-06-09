export interface SftpUser {
    id: string;
    username: string;
    rootDirectory: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateSftpUserRequest {
    username: string;
    password: string;
    rootDirectory: string;
}

export interface UpdateSftpUserRequest {
    password?: string;
    rootDirectory?: string;
}

export interface ToggleSftpUserRequest {
    isActive: boolean;
}

export interface ListSftpUsersResponse {
    users: SftpUser[];
}

export interface DeleteSftpUserResponse {
    deletedId: string;
    username: string;
}
