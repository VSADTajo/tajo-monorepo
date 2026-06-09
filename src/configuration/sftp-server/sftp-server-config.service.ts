import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';
import { SftpServerUser } from './sftp-server-config.type';

@Injectable()
export class SftpServerConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get enabled(): boolean {
        return this.configService.getOrThrow('sftpServer.enabled', { infer: true });
    }

    public get port(): number {
        return this.configService.getOrThrow('sftpServer.port', { infer: true });
    }

    public get hostKeyPath(): string {
        return this.configService.getOrThrow('sftpServer.hostKeyPath', { infer: true });
    }

    public get autoGenerateHostKey(): boolean {
        return this.configService.getOrThrow('sftpServer.autoGenerateHostKey', { infer: true });
    }

    public get maxConnections(): number {
        return this.configService.getOrThrow('sftpServer.maxConnections', { infer: true });
    }

    public get users(): SftpServerUser[] {
        return this.configService.getOrThrow('sftpServer.users', { infer: true });
    }
}
