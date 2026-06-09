import { Inject, Injectable } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { Logger } from 'nestjs-pino';

import { ISftpFileClient, SftpFileEntry } from '@domain/ports/sftp-file-client.port';
import { ProviderError } from '@domain/errors/provider.error';
import { MeteoConfigService } from '@config/meteo/meteo-config.service';

interface ListFilesResponse {
    directory: string;
    files: SftpFileEntry[];
}

interface ReadFileTextResponse {
    path: string;
    size: number;
    modifiedAt: string;
    content: string;
}

@Injectable()
export class SftpFileClient extends ISftpFileClient {
    private readonly http: AxiosInstance;

    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly config: MeteoConfigService,
    ) {
        super();
        this.http = axios.create({
            baseURL: this.config.sftpApiUrl,
            timeout: 30_000,
            headers: {
                'x-internal-caller': this.config.sftpApiInternalCaller,
            },
        });
    }

    async listDirectory(directoryPath: string): Promise<SftpFileEntry[]> {
        try {
            const { data } = await this.http.get<ListFilesResponse>('/files', {
                params: { directory: directoryPath },
            });
            return data.files ?? [];
        } catch (error) {
            this.handleError(error, `listDirectory(${directoryPath})`);
        }
    }

    async readText(filePath: string): Promise<string> {
        try {
            const { data } = await this.http.get<ReadFileTextResponse>('/files/read', {
                params: { path: filePath },
            });
            return data.content;
        } catch (error) {
            this.handleError(error, `readText(${filePath})`);
        }
    }

    async download(filePath: string): Promise<Buffer> {
        try {
            const { data } = await this.http.get<ArrayBuffer>('/files/download', {
                params: { path: filePath },
                responseType: 'arraybuffer',
            });
            return Buffer.from(data);
        } catch (error) {
            this.handleError(error, `download(${filePath})`);
        }
    }

    private handleError(error: unknown, context: string): never {
        if (error instanceof AxiosError) {
            const status = error.response?.status;
            const message = `sftp-api ${context} failed: status=${status} message=${error.message}`;
            this.logger.error({
                msg: 'sftp-api request failed',
                entity: 'MeteoSync',
                context,
                status,
                error: error.message,
            });
            throw new ProviderError(message);
        }
        const message = `sftp-api ${context} failed: ${(error as Error).message}`;
        this.logger.error({
            msg: 'sftp-api request failed',
            entity: 'MeteoSync',
            context,
            error: (error as Error).message,
        });
        throw new ProviderError(message);
    }
}
