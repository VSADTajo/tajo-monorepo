import { EntityError } from '@domain/errors/entity.error';

export interface ISftpConnection {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
}

export class SftpConnectionValueObject {
    public readonly host: string;
    public readonly port: number;
    public readonly username: string;
    public readonly password?: string;
    public readonly privateKey?: string;

    constructor(params: ISftpConnection) {
        if (!params.host || !params.host.trim()) {
            throw new EntityError('SFTP host is required', 'host');
        }

        if (!params.username || !params.username.trim()) {
            throw new EntityError('SFTP username is required', 'username');
        }

        const port = params.port ?? 22;
        if (port < 1 || port > 65535) {
            throw new EntityError('SFTP port must be between 1 and 65535', 'port');
        }

        if (!params.password && !params.privateKey) {
            throw new EntityError('Either password or privateKey is required for SFTP connection', 'password');
        }

        this.host = params.host.trim();
        this.port = port;
        this.username = params.username.trim();
        this.password = params.password;
        this.privateKey = params.privateKey;
    }
}
