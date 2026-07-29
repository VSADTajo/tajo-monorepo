import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';

import { ProviderError } from '@domain/errors/provider.error';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';
import { AppConfigService } from '@config/app/app-config.service';

const INTERNAL_CALLER_HEADER = { 'x-internal-caller': 'ms-model-api' };

/**
 * Stands in for FEWS when a manual simulation runs in MOCK mode.
 *
 * Rather than short-circuiting the pipeline, it drops a known-good FEWS output
 * into the simulation's output folder — exactly where the real model would
 * leave it. Everything downstream (poller, parser, calculator, predictions)
 * then runs untouched, so the mock exercises the real path instead of a
 * parallel one that could drift away from it.
 *
 * The reference file is copied, never moved: it has to stay reusable for the
 * next run.
 */
@Injectable()
export class MockModelOutputService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly sftpApiConfigService: SftpApiConfigService,
        private readonly appConfigService: AppConfigService,
    ) {}

    /**
     * Copies the reference output into `outputFolder`.
     * Returns the path it was written to.
     */
    async seedOutput(outputFolder: string): Promise<string> {
        const sourcePath = this.appConfigService.mockModelOutputSftpPath;

        if (!sourcePath) {
            throw new ProviderError(
                'MOCK mode requested but MOCK_MODEL_OUTPUT_SFTP_PATH is not configured — there is no reference output to copy',
            );
        }

        const fileName = sourcePath.split('/').pop() ?? 'mock_output.json';
        const destinationPath = `${outputFolder}/${fileName}`;
        const baseUrl = this.sftpApiConfigService.baseUrl;

        let content: Buffer;
        try {
            const response = await axios.get(`${baseUrl}/files/download`, {
                params: { path: sourcePath },
                responseType: 'arraybuffer',
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: INTERNAL_CALLER_HEADER,
            });
            content = Buffer.from(response.data as ArrayBuffer);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error({
                msg: 'Failed to read the mock reference output',
                entity: 'MockModelOutput',
                sourcePath,
                error: message,
            });
            throw new ProviderError(`Failed to read mock reference output "${sourcePath}": ${message}`);
        }

        try {
            const form = new FormData();
            form.append('file', new Blob([new Uint8Array(content)], { type: 'application/json' }), fileName);
            form.append('path', destinationPath);
            form.append('overwrite', 'true');

            await axios.post(`${baseUrl}/files/upload`, form, { headers: INTERNAL_CALLER_HEADER });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error({
                msg: 'Failed to seed the mock output into the simulation folder',
                entity: 'MockModelOutput',
                destinationPath,
                error: message,
            });
            throw new ProviderError(`Failed to seed mock output into "${destinationPath}": ${message}`);
        }

        this.logger.log({
            msg: 'Seeded mock model output — the poller will pick it up as a real result',
            entity: 'MockModelOutput',
            sourcePath,
            destinationPath,
            sizeBytes: content.length,
        });

        return destinationPath;
    }
}
