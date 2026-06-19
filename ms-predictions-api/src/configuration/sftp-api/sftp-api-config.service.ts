import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class SftpApiConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get baseUrl(): string {
        return this.configService.getOrThrow('sftp-api.baseUrl', { infer: true });
    }
}
