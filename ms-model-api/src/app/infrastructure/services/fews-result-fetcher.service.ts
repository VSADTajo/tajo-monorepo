import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { SimulationFetchResult } from '@infrastructure/services/simulation-result-fetcher.service';
import { FewsTaskClientService, FewsTaskStatus } from '@infrastructure/services/fews-task-client.service';
import { mapPiJsonToNormalized } from '@infrastructure/services/pi-json.mapper';

/** States in which the task is still running and the poller should come back later. */
const STILL_RUNNING: FewsTaskStatus[] = [FewsTaskStatus.PENDING, FewsTaskStatus.RUNNING];

/**
 * Reads the results of a simulation launched through the FEWS REST API.
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
    ) {}

    /**
     * Returns null while the task is still running, so the poller simply retries.
     * Throws when the task failed — a run with no usable results must not be
     * reported as completed.
     */
    async fetchByTask(taskId: string): Promise<SimulationFetchResult | null> {
        const outcome = await this.fewsTaskClient.getTaskStatus(taskId);

        if (STILL_RUNNING.includes(outcome.status)) {
            return null;
        }

        // Anything not running and not usable is settled by waitForTask's own
        // rules; reuse them rather than duplicating the state table here.
        if (!outcome.taskRunId) {
            return null;
        }

        const piJson = await this.fewsTaskClient.getTimeSeries(outcome.taskRunId);
        const mapped = mapPiJsonToNormalized(piJson, (message, context) =>
            this.logger.warn({ msg: message, entity: 'FewsResultFetcher', ...context }),
        );

        this.logger.log({
            msg: 'Fetched simulation results from FEWS',
            entity: 'FewsResultFetcher',
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
