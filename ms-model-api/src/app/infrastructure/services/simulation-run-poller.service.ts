import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { ISimulationRunRepository } from '@domain/ports/simulation-run-repository.port';
import { IMessageBroker } from '@domain/ports/message-broker.port';
import { SimulationRun } from '@domain/entities/simulation-run.entity';
import { Topics } from '@infrastructure/messaging/messaging.registry';
import { SimulationResultFetcherService } from '@infrastructure/services/simulation-result-fetcher.service';

const DEFAULT_POLL_INTERVAL_MINUTES = 5;

@Injectable()
export class SimulationRunPollerService implements OnModuleInit {
    private readonly pollIntervalMs: number;

    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly simulationRunRepository: ISimulationRunRepository,
        private readonly simulationResultFetcherService: SimulationResultFetcherService,
        private readonly messageBroker: IMessageBroker,
    ) {
        const raw = parseInt(process.env.SIMULATION_POLL_INTERVAL_MINUTES || '', 10);
        const intervalMinutes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_POLL_INTERVAL_MINUTES;
        this.pollIntervalMs = intervalMinutes * 60 * 1000;
    }

    onModuleInit(): void {
        this.logger.log({
            msg: `SimulationRunPollerService initialized — polling every ${this.pollIntervalMs / 60000} minutes`,
            entity: 'SimulationRunPoller',
        });

        setInterval(() => {
            void this.pollOnce();
        }, this.pollIntervalMs);
    }

    async pollOnce(): Promise<void> {
        let pendingRuns: SimulationRun[];
        try {
            pendingRuns = await this.simulationRunRepository.findWaitingResult();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error({
                msg: 'Failed to query waiting simulation runs',
                entity: 'SimulationRunPoller',
                error: message,
            });
            return;
        }

        if (pendingRuns.length === 0) {
            return;
        }

        this.logger.log({
            msg: `Polling ${pendingRuns.length} pending simulation run(s)`,
            entity: 'SimulationRunPoller',
        });

        for (const run of pendingRuns) {
            await this.processSingleRun(run);
        }
    }

    private async processSingleRun(run: SimulationRun): Promise<void> {
        try {
            const result = await this.simulationResultFetcherService.fetchFromFolder(run.outputFolder);

            if (!result) {
                this.logger.log({
                    msg: 'No result file yet — will retry next poll cycle',
                    entity: 'SimulationRunPoller',
                    simulationId: run.simulationId,
                    outputFolder: run.outputFolder,
                });
                return;
            }

            const eventsCount = result.timeSeries.reduce((sum, s) => sum + s.events.length, 0);

            await this.messageBroker.publishToTopic(
                Topics.MODEL_EVENTS.exchange,
                Topics.MODEL_EVENTS.routingKeys.TIMESERIES_INGESTED,
                {
                    simulationId: run.simulationId,
                    providerName: 'manual-simulation',
                    seriesCount: result.timeSeries.length,
                    eventsCount,
                    timeSeries: result.timeSeries,
                },
            );

            run.complete();
            await this.simulationRunRepository.update(run);

            this.logger.log({
                msg: 'Simulation run completed successfully',
                entity: 'SimulationRunPoller',
                simulationId: run.simulationId,
                seriesCount: result.timeSeries.length,
                eventsCount,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error({
                msg: 'Simulation run processing failed',
                entity: 'SimulationRunPoller',
                simulationId: run.simulationId,
                error: message,
            });

            run.fail(message);
            await this.simulationRunRepository.update(run);

            try {
                await this.messageBroker.publishToTopic(
                    Topics.SIMULATION_EVENTS.exchange,
                    Topics.SIMULATION_EVENTS.routingKeys.STATUS_UPDATED,
                    { simulationId: run.simulationId, status: 'MODEL_FAILED' },
                );
            } catch (publishError) {
                const publishMsg = publishError instanceof Error ? publishError.message : String(publishError);
                this.logger.error({
                    msg: 'Failed to publish simulation.status.updated event',
                    entity: 'SimulationRunPoller',
                    simulationId: run.simulationId,
                    error: publishMsg,
                });
            }
        }
    }
}
