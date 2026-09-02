import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';

import { ProviderError } from '@domain/errors/provider.error';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';
import { FewsTaskClientService } from '@infrastructure/services/fews-task-client.service';
import { FewsTargetResolverService } from '@infrastructure/services/fews-target-resolver.service';
import { ModelSource } from '@domain/types/model-source.type';
import { FewsApiConfigService } from '@config/fews-api/fews-api-config.service';

const INTERNAL_CALLER_HEADER = { 'x-internal-caller': 'ms-model-api' };

const MINUTE_MS = 60 * 1000;
const QUARTER_HOUR_MS = 15 * MINUTE_MS;
const DAY_MS = 24 * 60 * MINUTE_MS;

export interface RunWindow {
    startTime: Date;
    endTime: Date;
}

/**
 * The period a manual run covers, as Idrica asks for it: the start sits
 * `offsetMinutes` before now, rounded down to the quarter hour, and the end is
 * `horizonDays` later. `timeZero` reuses the start, so it is not returned twice.
 */
export function buildRunWindow(now: Date, offsetMinutes: number, horizonDays: number): RunWindow {
    const shifted = now.getTime() - offsetMinutes * MINUTE_MS;
    const startTime = new Date(Math.floor(shifted / QUARTER_HOUR_MS) * QUARTER_HOUR_MS);
    const endTime = new Date(startTime.getTime() + horizonDays * DAY_MS);
    return { startTime, endTime };
}

/**
 * Launches a manual simulation through the PI REST service.
 *
 * The input file is still produced and stored by ms-predictions-api exactly as
 * in the SFTP flow — this only changes how it reaches the model: instead of
 * leaving it in a folder and waiting for someone to import it, it is posted to
 * the PI REST service and the workflow is started. What comes back is followed
 * by task id rather than by watching an output folder.
 *
 * Serves both FEWS_API and MOCK: the model source only decides which service the
 * requests go to, so the mock run executes this method line for line.
 */
@Injectable()
export class FewsSimulationLauncherService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly sftpApiConfigService: SftpApiConfigService,
        private readonly fewsTaskClient: FewsTaskClientService,
        private readonly targetResolver: FewsTargetResolverService,
        private readonly fewsApiConfig: FewsApiConfigService,
    ) {}

    /**
     * Sends the simulation input to the model and starts the workflow.
     * Returns the task id to follow.
     */
    async launch(simulationId: string, outputFolder: string, modelSource: ModelSource): Promise<string> {
        const target = this.targetResolver.resolve(modelSource);
        const inputFolder = outputFolder.replace(/\/output$/, '/input');
        const content = await this.readGeneratedInput(simulationId, inputFolder);

        // Post first, launch second: starting a workflow whose input never
        // arrived would produce a run that looks fine and computes nothing.
        await this.fewsTaskClient.postTimeSeries(target, content);

        const { startTime, endTime } = buildRunWindow(
            new Date(),
            this.fewsApiConfig.runStartOffsetMinutes,
            this.fewsApiConfig.runHorizonDays,
        );

        const taskId = await this.fewsTaskClient.runTask(target, {
            startTime,
            endTime,
            description: `Manual simulation ${simulationId}`,
        });

        this.logger.log({
            msg: 'Manual simulation launched through the PI REST service',
            entity: 'FewsSimulationLauncher',
            simulationId,
            modelSource,
            taskId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
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
