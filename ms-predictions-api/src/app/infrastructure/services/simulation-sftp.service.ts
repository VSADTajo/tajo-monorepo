import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';
import FormData from 'form-data';

import { ISimulationSftpService } from '@domain/ports/simulation-sftp.port';
import { ProviderError } from '@domain/errors/provider.error';
import { ApiError } from '@domain/errors/api.error';
import { SftpFileMeta, SimulationFileDownloadResult, SimulationFolder } from '@domain/results/simulation-files.result';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';

const INTERNAL_CALLER_HEADER = { 'x-internal-caller': 'ms-predictions-api' };

interface SftpListEntry {
    name: string;
    size: number;
    isDirectory: boolean;
    modifiedAt: string;
}

@Injectable()
export class SimulationSftpService implements ISimulationSftpService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly sftpApiConfig: SftpApiConfigService,
    ) {}

    async uploadInputFile(simulationId: string, fileName: string, content: Buffer): Promise<void> {
        const fullPath = `tajo/SIMULATIONS/${simulationId}/input/${fileName}`;

        const form = new FormData();
        form.append('file', content, {
            filename: fileName,
            contentType: 'application/json',
        });
        form.append('path', fullPath);
        form.append('overwrite', 'true');

        try {
            this.logger.log({
                msg: 'Uploading simulation input file to SFTP API',
                entity: 'Simulations',
                simulationId,
                path: fullPath,
            });

            await axios.post(`${this.sftpApiConfig.baseUrl}/files/upload`, form, {
                headers: {
                    ...form.getHeaders(),
                    'x-internal-caller': 'ms-predictions-api',
                },
            });

            this.logger.log({
                msg: 'Simulation input file uploaded successfully',
                entity: 'Simulations',
                simulationId,
                path: fullPath,
            });
        } catch (error) {
            this.logger.error({
                msg: 'Failed to upload simulation input file to SFTP API',
                entity: 'Simulations',
                simulationId,
                path: fullPath,
                error: String(error),
            });
            throw new ProviderError(`Failed to upload simulation input file: ${String(error)}`);
        }
    }

    async ensureOutputFolder(simulationId: string): Promise<void> {
        const folderPath = `tajo/SIMULATIONS/${simulationId}/output`;

        try {
            await axios.post(
                `${this.sftpApiConfig.baseUrl}/files/folder`,
                { path: folderPath },
                { headers: { 'x-internal-caller': 'ms-predictions-api' } },
            );

            this.logger.log({
                msg: 'Simulation output folder ensured on SFTP API',
                entity: 'Simulations',
                simulationId,
                path: folderPath,
            });
        } catch (error) {
            this.logger.error({
                msg: 'Failed to ensure simulation output folder on SFTP API',
                entity: 'Simulations',
                simulationId,
                path: folderPath,
                error: String(error),
            });
            throw new ProviderError(`Failed to ensure simulation output folder: ${String(error)}`);
        }
    }

    async listFiles(simulationId: string): Promise<{ input: SftpFileMeta[]; output: SftpFileMeta[] }> {
        const [input, output] = await Promise.all([
            this.listFolder(simulationId, 'input'),
            this.listFolder(simulationId, 'output'),
        ]);
        return { input, output };
    }

    async downloadFile(
        simulationId: string,
        folder: SimulationFolder,
        fileName: string,
    ): Promise<SimulationFileDownloadResult> {
        const fullPath = `tajo/SIMULATIONS/${simulationId}/${folder}/${fileName}`;

        try {
            const response = await axios.get(`${this.sftpApiConfig.baseUrl}/files/download`, {
                params: { path: fullPath },
                responseType: 'arraybuffer',
                headers: INTERNAL_CALLER_HEADER,
            });

            const contentType = (response.headers['content-type'] as string) || 'application/octet-stream';
            return new SimulationFileDownloadResult({
                content: Buffer.from(response.data as ArrayBuffer),
                fileName,
                contentType,
            });
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === HttpStatus.NOT_FOUND) {
                throw new ApiError(HttpStatus.NOT_FOUND, `File "${fileName}" not found in ${folder} folder`);
            }
            this.logger.error({
                msg: 'Failed to download simulation file from SFTP API',
                entity: 'Simulations',
                simulationId,
                path: fullPath,
                error: String(error),
            });
            throw new ProviderError(`Failed to download simulation file: ${String(error)}`);
        }
    }

    private async listFolder(simulationId: string, folder: SimulationFolder): Promise<SftpFileMeta[]> {
        const directory = `tajo/SIMULATIONS/${simulationId}/${folder}`;

        try {
            const response = await axios.get(`${this.sftpApiConfig.baseUrl}/files`, {
                params: { directory },
                headers: INTERNAL_CALLER_HEADER,
            });

            const entries: SftpListEntry[] = response.data?.files ?? [];
            return entries
                .filter((entry) => !entry.isDirectory)
                .map((entry) => ({
                    name: entry.name,
                    size: entry.size,
                    modifiedAt: entry.modifiedAt ?? null,
                }));
        } catch (error) {
            // The folder may not exist yet (e.g. output/ before the model drops its result) — treat as empty.
            if (axios.isAxiosError(error) && error.response?.status === HttpStatus.NOT_FOUND) {
                return [];
            }
            this.logger.error({
                msg: 'Failed to list simulation files from SFTP API',
                entity: 'Simulations',
                simulationId,
                path: directory,
                error: String(error),
            });
            throw new ProviderError(`Failed to list simulation files: ${String(error)}`);
        }
    }
}
