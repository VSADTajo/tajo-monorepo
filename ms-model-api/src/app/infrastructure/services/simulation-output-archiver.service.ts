import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';

import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';

const INTERNAL_CALLER_HEADER = { 'x-internal-caller': 'ms-model-api' };

/**
 * Keeps a copy of the model's response for a run that arrived over the PI REST
 * API instead of as a file.
 *
 * In the SFTP flow the operator can see and download what the model answered,
 * because the answer *is* a file. The direct flow reads the results over HTTP and
 * left nothing behind, so a finished simulation showed an empty output folder and
 * looked like the model never replied. This writes the very document the API
 * returned, so both flows leave the same audit trail.
 *
 * It lands in `output/historial/` rather than `output/`, because that is what the
 * listing reads as "processed" — and processed is the truth here: the result was
 * already fetched and ingested before this runs.
 *
 * Best effort on purpose. The results are in hand by the time this is called, so
 * failing to archive them must not fail the run: it costs the audit trail, not
 * the simulation.
 */
@Injectable()
export class SimulationOutputArchiverService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly sftpApiConfigService: SftpApiConfigService,
    ) {}

    /** Returns the path written, or null when archiving failed. */
    async archive(outputFolder: string, fileName: string, content: unknown): Promise<string | null> {
        const destinationPath = `${outputFolder}/historial/${fileName}`;
        const baseUrl = this.sftpApiConfigService.baseUrl;

        try {
            const body = Buffer.from(JSON.stringify(content, null, 2), 'utf-8');
            const form = new FormData();
            form.append('file', new Blob([new Uint8Array(body)], { type: 'application/json' }), fileName);
            form.append('path', destinationPath);
            form.append('overwrite', 'true');

            await axios.post(`${baseUrl}/files/upload`, form, { headers: INTERNAL_CALLER_HEADER });

            this.logger.log({
                msg: 'Archived the model response of a direct run',
                entity: 'SimulationOutputArchiver',
                destinationPath,
                sizeBytes: body.length,
            });

            return destinationPath;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn({
                msg: 'Could not archive the model response — the run keeps its results',
                entity: 'SimulationOutputArchiver',
                destinationPath,
                error: message,
            });
            return null;
        }
    }
}
