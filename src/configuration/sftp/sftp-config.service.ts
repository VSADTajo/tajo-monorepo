import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class SftpConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get connectionTimeout(): number {
        return this.configService.getOrThrow('sftp.connectionTimeout', { infer: true });
    }

    public get operationTimeout(): number {
        return this.configService.getOrThrow('sftp.operationTimeout', { infer: true });
    }
}
