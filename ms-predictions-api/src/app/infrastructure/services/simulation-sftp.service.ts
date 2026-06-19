import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';
import FormData from 'form-data';

import { ISimulationSftpService } from '@domain/ports/simulation-sftp.port';
import { ProviderError } from '@domain/errors/provider.error';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';

@Injectable()
export class SimulationSftpService implements ISimulationSftpService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly sftpApiConfig: SftpApiConfigService,
    ) {}

    async uploadInputFile(simulationId: string, content: Buffer): Promise<void> {
        const fileName = `${simulationId}.json`;
        const fullPath = `simulations/${simulationId}/input/${fileName}`;

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
            });
        } catch (error) {
            this.logger.error({
                msg: 'Failed to upload simulation input file to SFTP API',
                entity: 'Simulations',
                simulationId,
                error: String(error),
            });
            throw new ProviderError(`Failed to upload simulation input file: ${String(error)}`);
        }
    }
}
