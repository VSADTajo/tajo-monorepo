export type SftpServerUser = {
    username: string;
    password?: string;
    publicKey?: string;
    rootDirectory?: string;
};

export type SftpServerConfig = {
    enabled: boolean;
    port: number;
    hostKeyPath: string;
    autoGenerateHostKey: boolean;
    maxConnections: number;
    users: SftpServerUser[];
};
