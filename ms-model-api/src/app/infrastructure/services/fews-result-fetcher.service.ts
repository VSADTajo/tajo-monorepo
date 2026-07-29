import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { ProviderError } from '@domain/errors/provider.error';
import { ModelSource } from '@domain/types/model-source.type';
import { SimulationFetchResult } from '@infrastructure/services/simulation-result-fetcher.service';
import { FewsTaskClientService } from '@infrastructure/services/fews-task-client.service';
import { FewsTargetResolverService } from '@infrastructure/services/fews-target-resolver.service';
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
    ) {}

    /**
     * Returns null only while the task is still running, so the poller retries.
     * Every other non-usable outcome throws: a run that will never produce results
     * has to be reported as failed rather than left waiting forever.
     */
    async fetchByTask(taskId: string, modelSource: ModelSource): Promise<SimulationFetchResult | null> {
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

        const piJson = await this.fewsTaskClient.getTimeSeries(target, outcome.taskRunId);
        const mapped = mapPiJsonToNormalized(piJson, (message, context) =>
            this.logger.warn({ msg: message, entity: 'FewsResultFetcher', ...context }),
        );

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
            processedFileName: `fews-taskrun-${outcome.taskRunId}`,
            skippedEmptySeries: mapped.skippedEmptySeries,
            skippedInvalidSeries: mapped.skippedInvalidSeries,
        };
    }
}
