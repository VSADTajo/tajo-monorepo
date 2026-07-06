import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { ISimulationRunRepository } from '@domain/ports/simulation-run-repository.port';
import { IMessageBroker } from '@domain/ports/message-broker.port';
import { SimulationRun } from '@domain/entities/simulation-run.entity';
import { NormalizedTimeSeriesResult } from '@domain/results/normalized-timeseries.result';
import { WiskiTimeSeriesResult } from '@domain/results/wiski-timeseries.result';
import { Topics } from '@infrastructure/messaging/messaging.registry';
import { SimulationResultFetcherService } from '@infrastructure/services/simulation-result-fetcher.service';
import { AppConfigService } from '@config/app/app-config.service';

const DEFAULT_POLL_INTERVAL_MINUTES = 5;
const MISS_VAL = '-999.0';

interface CalculatorTimeSeriesEntry {
    header: {
        locationId: string;
        parameterId: string;
        moduleInstanceId?: string;
        stationName?: string;
        units?: string;
        timeStep?: { unit: string; multiplier: number };
        forecastDate?: string | null;
        startDate?: string | null;
        endDate?: string | null;
        sourceTimezone?: string;
        missVal?: string;
        lat?: number;
        lon?: number;
        x?: number;
        y?: number;
    };
    events: { date: string; time: string; value: string; flag: string }[];
}

@Injectable()
export class SimulationRunPollerService implements OnModuleInit {
    private readonly pollIntervalMs: number;

    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly simulationRunRepository: ISimulationRunRepository,
        private readonly simulationResultFetcherService: SimulationResultFetcherService,
        private readonly messageBroker: IMessageBroker,
        private readonly appConfigService: AppConfigService,
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

            const useCalculatorPipeline = this.appConfigService.useCalculatorPipeline;

            if (useCalculatorPipeline) {
                const vobsSeries = await this.simulationResultFetcherService.fetchVobsSeries(run.simulationId);
                const timeSeries = this.toCalculatorPayloadShape(result.timeSeries, vobsSeries ?? []);
                const eventsCount = timeSeries.reduce((sum, s) => sum + s.events.length, 0);

                await this.messageBroker.publishToTopic(
                    Topics.SIMULATION_EVENTS.exchange,
                    Topics.SIMULATION_EVENTS.routingKeys.MANUAL_OUTPUT_FETCHED,
                    {
                        simulationId: run.simulationId,
                        providerName: 'manual-simulation',
                        seriesCount: timeSeries.length,
                        eventsCount,
                        timeSeries,
                    },
                    { 'x-simulation-id': run.simulationId },
                );

                run.complete();
                await this.simulationRunRepository.update(run);

                this.logger.log({
                    msg: 'Simulation run routed to calculator pipeline',
                    entity: 'SimulationRunPoller',
                    simulationId: run.simulationId,
                    seriesCount: timeSeries.length,
                    eventsCount,
                    vobsIncluded: vobsSeries !== null && vobsSeries.length > 0,
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

    private toCalculatorPayloadShape(
        normalizedSeries: NormalizedTimeSeriesResult[],
        wiskiSeries: WiskiTimeSeriesResult[],
    ): CalculatorTimeSeriesEntry[] {
        const fromNormalized: CalculatorTimeSeriesEntry[] = normalizedSeries.map((series) => ({
            header: {
                locationId: series.locationId,
                parameterId: series.parameterId,
                moduleInstanceId: series.moduleInstanceId,
                stationName: series.stationName,
                units: series.units,
                timeStep: series.timeStep,
                forecastDate: series.forecastDate,
                startDate: series.startDate,
                endDate: series.endDate,
                sourceTimezone: 'UTC',
                missVal: MISS_VAL,
                lat: series.lat,
                lon: series.lon,
                x: series.x,
                y: series.y,
            },
            events: series.events.map((event) => {
                const [datePart, timePartRaw] = event.timestamp.split('T');
                const timePart = (timePartRaw ?? '').replace(/Z$/, '');
                return {
                    date: datePart ?? '',
                    time: timePart,
                    value: event.isMissing ? MISS_VAL : String(event.value),
                    flag: String(event.flag),
                };
            }),
        }));

        const fromWiski: CalculatorTimeSeriesEntry[] = wiskiSeries.map((series) => ({
            header: {
                locationId: series.header.locationId,
                parameterId: series.header.parameterId,
                moduleInstanceId: series.header.moduleInstanceId,
                stationName: series.header.stationName,
                units: series.header.units,
                timeStep: series.header.timeStep,
                forecastDate: series.header.forecastDate ?? null,
                startDate: series.header.startDate ?? null,
                endDate: series.header.endDate ?? null,
                sourceTimezone: series.header.sourceTimezone,
                missVal: MISS_VAL,
                lat: series.header.lat,
                lon: series.header.lon,
                x: series.header.x,
                y: series.header.y,
            },
            events: series.events.map((event) => ({
                date: event.date,
                time: event.time,
                value: event.value,
                flag: event.flag,
            })),
        }));

        return [...fromNormalized, ...fromWiski];
    }
}
