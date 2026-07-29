import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';

import { ProviderError } from '@domain/errors/provider.error';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';
import { FewsTaskClientService } from '@infrastructure/services/fews-task-client.service';

const INTERNAL_CALLER_HEADER = { 'x-internal-caller': 'ms-model-api' };

/** Forecast horizon of a manual simulation, matching what the model returns. */
const HORIZON_DAYS = 3;

/**
 * Launches a manual simulation directly against FEWS.
 *
 * The input file is still produced and stored by ms-predictions-api exactly as
 * in the SFTP flow — this only changes how it reaches the model: instead of
 * leaving it in a folder and waiting for someone to import it, it is posted to
 * the PI REST service and the workflow is started. What comes back is followed
 * by task id rather than by watching an output folder.
 */
@Injectable()
export class FewsSimulationLauncherService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly sftpApiConfigService: SftpApiConfigService,
        private readonly fewsTaskClient: FewsTaskClientService,
    ) {}

    /**
     * Sends the simulation input to FEWS and starts the workflow.
     * Returns the task id to follow.
     */
    async launch(simulationId: string, outputFolder: string): Promise<string> {
        const inputFolder = outputFolder.replace(/\/output$/, '/input');
        const content = await this.readGeneratedInput(simulationId, inputFolder);

        // Post first, launch second: starting a workflow whose input never
        // arrived would produce a run that looks fine and computes nothing.
        await this.fewsTaskClient.postTimeSeries(content);

        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);

        const taskId = await this.fewsTaskClient.runTask({
            startTime,
            endTime,
            description: `Manual simulation ${simulationId}`,
        });

        this.logger.log({
            msg: 'Manual simulation launched on FEWS',
            entity: 'FewsSimulationLauncher',
            simulationId,
            taskId,
        });

        return taskId;
    }

    /** Reads the input file ms-predictions-api generated for this simulation. */
    private async readGeneratedInput(simulationId: string, inputFolder: string): Promise<string> {
        const baseUrl = this.sftpApiConfigService.baseUrl;

        let files: { name: string }[];
        try {
            const response = await axios.get(`${baseUrl}/files`, {
                params: { directory: inputFolder },
                headers: INTERNAL_CALLER_HEADER,
            });
            files = ((response.data?.files ?? []) as { name: string; isDirectory?: boolean }[]).filter(
                (file) => !file.isDirectory && file.name.toLowerCase().endsWith('.json'),
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new ProviderError(`Failed to list the input folder "${inputFolder}": ${message}`);
        }

        if (files.length === 0) {
            throw new ProviderError(
                `Simulation "${simulationId}" has no input file in "${inputFolder}" — nothing to send to FEWS`,
            );
        }

        const file = files[0];
        try {
            const response = await axios.get(`${baseUrl}/files/download`, {
                params: { path: `${inputFolder}/${file.name}` },
                responseType: 'arraybuffer',
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: INTERNAL_CALLER_HEADER,
            });
            return Buffer.from(response.data as ArrayBuffer).toString('utf-8');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new ProviderError(`Failed to read the input file "${file.name}": ${message}`);
        }
    }
}
