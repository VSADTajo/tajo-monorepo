import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class StorageConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get basePath(): string {
        return this.configService.getOrThrow('storage.basePath', { infer: true });
    }

    public get maxFileSize(): number {
        return this.configService.getOrThrow('storage.maxFileSize', { infer: true });
    }
}
