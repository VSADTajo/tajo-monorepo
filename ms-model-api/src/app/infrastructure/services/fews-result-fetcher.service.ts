import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { ProviderError } from '@domain/errors/provider.error';
import { ModelSource } from '@domain/types/model-source.type';
import { SimulationFetchResult } from '@infrastructure/services/simulation-result-fetcher.service';
import { FewsTaskClientService } from '@infrastructure/services/fews-task-client.service';
import { FewsTargetResolverService } from '@infrastructure/services/fews-target-resolver.service';
import { SimulationOutputArchiverService } from '@infrastructure/services/simulation-output-archiver.service';
import { mapPiJsonToNormalized } from '@infrastructure/services/pi-json.mapper';

/**
 * Reads the results of a simulation launched through the PI REST service.
 *
 * The counterpart of SimulationResultFetcherService for the direct flow: same
 * return shape, so the poller and everything downstream stay untouched. The
 * PI-JSON is parsed with the same tolerant mapper used for the files, which is
 * the one that knows FEWS omits the execution metadata on series no module
 * produced.
 */
@Injectable()
export class FewsResultFetcherService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly fewsTaskClient: FewsTaskClientService,
        private readonly targetResolver: FewsTargetResolverService,
        private readonly outputArchiver: SimulationOutputArchiverService,
    ) {}

    /**
     * Returns null while the task is still running or its results are not fully
     * available yet, so the poller retries.
     * Every other non-usable outcome throws: a run that will never produce results
     * has to be reported as failed rather than left waiting forever.
     */
    async fetchByTask(
        taskId: string,
        modelSource: ModelSource,
        outputFolder: string,
    ): Promise<SimulationFetchResult | null> {
        const target = this.targetResolver.resolve(modelSource);
        const outcome = await this.fewsTaskClient.getTaskStatus(target, taskId);

        if (FewsTaskClientService.isInFlight(outcome.status)) {
            return null;
        }

        if (FewsTaskClientService.isTerminalFailure(outcome.status)) {
            throw new ProviderError(
                `FEWS task "${taskId}" ended as ${outcome.status} (${outcome.description || 'no detail'})`,
            );
        }

        if (!FewsTaskClientService.isUsable(outcome.status)) {
            throw new ProviderError(
                `FEWS task "${taskId}" reported an unrecognised status "${outcome.status}" — refusing to assume success`,
            );
        }

        if (!outcome.taskRunId) {
            // The status endpoint only reports taskRunId from FEWS 2024.01 on, and
            // the results are addressed by it. Failing loudly beats polling a run
            // that already finished: otherwise the simulation sits in WAITING_RESULT
            // until the timeout with nothing in the logs to explain why.
            throw new ProviderError(
                `FEWS task "${taskId}" finished as ${outcome.status} but reported no taskRunId — ` +
                    'results cannot be addressed (the status endpoint returns it from FEWS 2024.01 on)',
            );
        }

        const { document: piJson, complete } = await this.fewsTaskClient.getTimeSeries(target, outcome.taskRunId);

        if (!complete) {
            // 206: the run finished but the web service cannot see all of it yet.
            // Reading a partial answer would persist half a forecast as if it were
            // whole, so this waits for the next poll like an in-flight task.
            this.logger.warn({
                msg: 'FEWS results are not completely available yet (206) — will retry next poll cycle',
                entity: 'FewsResultFetcher',
                taskId,
                taskRunId: outcome.taskRunId,
            });
            return null;
        }

        const mapped = mapPiJsonToNormalized(piJson, (message, context) =>
            this.logger.warn({ msg: message, entity: 'FewsResultFetcher', ...context }),
        );

        const processedFileName = `fews-taskrun-${outcome.taskRunId}.json`;

        // Leave the answer where the SFTP flow leaves it, so the operator can see
        // and download what the model replied in either mode. Deliberately after
        // the mapping: only a response we could actually read is worth keeping.
        await this.outputArchiver.archive(outputFolder, processedFileName, piJson);

        this.logger.log({
            msg: 'Fetched simulation results from the PI REST service',
            entity: 'FewsResultFetcher',
            modelSource,
            taskId,
            taskRunId: outcome.taskRunId,
            seriesKept: mapped.series.length,
            skippedEmptySeries: mapped.skippedEmptySeries,
            skippedInvalidSeries: mapped.skippedInvalidSeries,
        });

        return {
            timeSeries: mapped.series,
            processedFileName,
            skippedEmptySeries: mapped.skippedEmptySeries,
            skippedInvalidSeries: mapped.skippedInvalidSeries,
        };
    }
}
