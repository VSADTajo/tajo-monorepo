import { Injectable } from '@nestjs/common';

import { IDataProvider } from '@domain/ports/data-provider.port';
import { ProviderType } from '@domain/types/provider-type.enum';
import { ApiError } from '@domain/errors/api.error';
import { FewsApiProviderService } from './fews-api-provider.service';
import { SftpFileProviderService } from './sftp-file-provider.service';
import { CsvFileProviderService } from './csv-file-provider.service';
import { WiskiApiProviderService } from './wiski-api-provider.service';

@Injectable()
export class DataProviderFactoryService {
    constructor(
        private readonly fewsApiProviderService: FewsApiProviderService,
        private readonly sftpFileProviderService: SftpFileProviderService,
        private readonly csvFileProviderService: CsvFileProviderService,
        private readonly wiskiApiProviderService: WiskiApiProviderService,
    ) {}

    getProvider(type: ProviderType): IDataProvider {
        switch (type) {
            case ProviderType.FEWS_API:
                return this.fewsApiProviderService;
            case ProviderType.SFTP_FILE:
                return this.sftpFileProviderService;
            case ProviderType.CSV_FILE:
                return this.csvFileProviderService;
            case ProviderType.WISKI_API:
                return this.wiskiApiProviderService;
            default:
                throw new ApiError(400, `Unknown provider type: ${type}`);
        }
    }
}
