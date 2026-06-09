// ─────────────────────────────────────────────────────────────
// SftpUserResult
// ─────────────────────────────────────────────────────────────

export interface ISftpUserResult {
    id: string;
    username: string;
    rootDirectory: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export class SftpUserResult {
    readonly id: string;
    readonly username: string;
    readonly rootDirectory: string;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(params: ISftpUserResult) {
        this.id = params.id;
        this.username = params.username;
        this.rootDirectory = params.rootDirectory;
        this.isActive = params.isActive;
        this.createdAt = params.createdAt;
        this.updatedAt = params.updatedAt;
    }
}

// ─────────────────────────────────────────────────────────────
// ListSftpUsersResult
// ─────────────────────────────────────────────────────────────

export class ListSftpUsersResult {
    readonly users: SftpUserResult[];

    constructor(users: SftpUserResult[]) {
        this.users = users;
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteSftpUserResult
// ─────────────────────────────────────────────────────────────

export class DeleteSftpUserResult {
    readonly deletedId: string;
    readonly username: string;

    constructor(params: { deletedId: string; username: string }) {
        this.deletedId = params.deletedId;
        this.username = params.username;
    }
}
