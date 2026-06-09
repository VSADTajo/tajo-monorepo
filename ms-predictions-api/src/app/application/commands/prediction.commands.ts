import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { Prediction } from '@domain/entities/prediction.entity';
import { PredictionResult as PredictionResultEntity } from '@domain/entities/prediction-result.entity';
import { SimulationStatus, SimulationType, DataOrigin } from '@domain/entities/simulation.entity';
import { Simulation } from '@domain/entities/simulation.entity';
import { SimulationDateValueObject } from '@domain/value-objects/simulation-date.value-object';
import { IPredictionTypeRepository } from '@domain/ports/prediction-type-repository.port';
import { ISimulationRepository } from '@domain/ports/simulation-repository.port';
import { IPredictionRepository } from '@domain/ports/prediction-repository.port';
import { IPredictionResultRepository } from '@domain/ports/prediction-result-repository.port';
import { IStationThresholdService } from '@domain/ports/station-threshold-service.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { IMessageBroker } from '@domain/ports/message-broker.port';
import { SimulationCacheKeys, PredictionCacheKeys } from '@infrastructure/cache/cache-config.registry';
import { Topics } from '@infrastructure/messaging/messaging.registry';

// ─────────────────────────────────────────────────────────────
// ProcessTimeSeries
// ─────────────────────────────────────────────────────────────

export interface ITimeSeriesEvent {
    timestamp: string;
    value: number;
    flag?: number;
    isMissing?: boolean;
}

export interface ITimeSeriesData {
    locationId: string;
    parameterId: string;
    sourceParameterId?: string;
    moduleInstanceId: string;
    stationName?: string;
    units?: string;
    forecastDate: string;
    startDate?: string;
    endDate?: string;
    events: ITimeSeriesEvent[];
}

export interface IProcessTimeSeriesCommand {
    series: ITimeSeriesData;
    providerConfigId?: string;
    providerName?: string;
    providerType?: string;
}

export class ProcessTimeSeriesCommand {
    constructor(private readonly parameters: IProcessTimeSeriesCommand) {}

    get series(): ITimeSeriesData {
        return this.parameters.series;
    }
    get providerConfigId(): string | undefined {
        return this.parameters.providerConfigId;
    }
    get providerName(): string | undefined {
        return this.parameters.providerName;
    }
    get providerType(): string | undefined {
        return this.parameters.providerType;
    }
}

export interface ProcessTimeSeriesResult {
    simulationId: string;
    predictionId: string;
    resultsCount: number;
    notificationCreated: boolean;
}

@CommandHandler(ProcessTimeSeriesCommand)
export class ProcessTimeSeriesHandler implements ICommandHandler<ProcessTimeSeriesCommand, ProcessTimeSeriesResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly predictionTypeRepository: IPredictionTypeRepository,
        private readonly simulationRepository: ISimulationRepository,
        private readonly predictionRepository: IPredictionRepository,
        private readonly predictionResultRepository: IPredictionResultRepository,
        private readonly stationThresholdService: IStationThresholdService,
        private readonly cacheService: ICacheService,
        private readonly messageBroker: IMessageBroker,
    ) {}

    async execute(command: ProcessTimeSeriesCommand): Promise<ProcessTimeSeriesResult> {
        const { series } = command;

        // 1a. Strip trailing "P" from locationId (e.g. "AR71P" → "AR71")
        const stationId = series.locationId.replace(/P$/, '');

        // 1b. Extract percentile from parameterId (e.g. "P.ens.forecast.75" → 75)
        //     Non-numeric suffixes like "Med" are treated as no-percentile (null)
        const percentileMatch = series.parameterId.match(/\.(\d+)$/);
        const percentile = percentileMatch ? parseFloat(percentileMatch[1]) : null;

        // 1c. Strip percentile/label suffix for the prediction type name
        //     "P.ens.forecast.75" → "P.ens.forecast", "P.ens.forecast.Med" → "P.ens.forecast"
        const typeName = series.parameterId.replace(/\.\d+$/, '').replace(/\.Med$/, '');

        this.logger.log(`Processing time series: station=${stationId}, type=${typeName}, percentile=${percentile}`);

        // 1. Find or create PredictionType
        const predictionType = await this.predictionTypeRepository.findOrCreateByName(
            typeName,
            series.units || 'unknown',
        );

        // 2. Normalize simulation date — use startDate (matches filename date) instead of forecastDate
        const simDateSource = series.startDate || series.forecastDate;
        const simDateVO = new SimulationDateValueObject(simDateSource);
        const simulationDate = simDateVO.value;

        // 3. Derive simulation fields — ignore moduleInstanceId, use one simulation per date+provider
        const modmeteo = command.providerName || null;

        // 3b. Derive data origin from parameterId
        const dataOrigin = series.parameterId.includes('.historical') ? DataOrigin.HISTORICAL : DataOrigin.FORECAST;

        // 4. Find or create Simulation (environment=null — no split by moduleInstanceId)
        let simulation = await this.simulationRepository.findByDateAndEnvAndModmeteo(simulationDate, null, modmeteo);

        if (simulation) {
            if (simulation.status === SimulationStatus.FINALIZED) {
                this.logger.log(
                    `Simulation ${simulationDate} already finalized for provider=${modmeteo} — skipping station=${stationId}`,
                );
                return {
                    simulationId: simulation.id,
                    predictionId: '',
                    resultsCount: 0,
                    notificationCreated: false,
                };
            }
        } else {
            simulation = new Simulation({
                simulationDate,
                jobType: command.providerType || null,
                modmeteo,
                environment: null,
                status: SimulationStatus.IN_PROGRESS,
                type: SimulationType.AUTOMATIC,
                createdBy: command.providerName || 'system',
                dataOrigin,
            });
            simulation.validate();
            simulation = await this.simulationRepository.create(simulation);
        }

        // 5. Check idempotency
        const existingPrediction = await this.predictionRepository.findByUniqueConstraint(
            simulation.id,
            stationId,
            predictionType.id,
            percentile,
        );

        if (existingPrediction) {
            this.logger.log(
                `Prediction already exists for sim=${simulation.id}, station=${stationId}, type=${predictionType.name}, percentile=${percentile} — skipping`,
            );
            return {
                simulationId: simulation.id,
                predictionId: existingPrediction.id,
                resultsCount: 0,
                notificationCreated: false,
            };
        }

        // 6. Create Prediction
        const prediction = new Prediction({
            stationId,
            stationName: series.stationName || null,
            predictionTypeId: predictionType.id,
            simulationId: simulation.id,
            predictionDate: series.startDate ? new Date(series.startDate) : null,
            predictionStartDate: series.startDate ? new Date(series.startDate) : null,
            predictionEndDate: series.endDate ? new Date(series.endDate) : null,
            percentile,
            predictionProvider: modmeteo,
            predictedBy: series.moduleInstanceId || null,
        });
        prediction.validate();
        const persistedPrediction = await this.predictionRepository.create(prediction);

        // 7. Filter out missing events and bulk insert PredictionResults
        const validEvents = series.events.filter((e) => !e.isMissing);
        let persistedResults: PredictionResultEntity[] = [];
        if (validEvents.length > 0) {
            const results: Partial<PredictionResultEntity>[] = validEvents.map((event) => ({
                predictionId: persistedPrediction.id,
                date: new Date(event.timestamp),
                value: event.value,
                flag: event.flag ?? 0,
            }));
            persistedResults = await this.predictionResultRepository.bulkCreate(results);
        }

        // 8. Check threshold and publish notification to ms-notifications-api
        let notificationCreated = false;
        const threshold = await this.stationThresholdService.getThreshold(stationId);
        if (threshold !== null && persistedResults.length > 0) {
            const maxValue = Math.max(...validEvents.map((e) => e.value));
            if (maxValue > threshold) {
                const maxResult = persistedResults.reduce((prev, curr) => (curr.value > prev.value ? curr : prev));

                await this.messageBroker.publishToTopic(
                    Topics.NOTIFICATIONS.exchange,
                    Topics.NOTIFICATIONS.routingKeys.CREATED,
                    {
                        type: 'THRESHOLD_EXCEEDED',
                        source: 'ms-predictions-api',
                        title: `Umbral superado en estación ${series.stationName || stationId}`,
                        message: `El valor predicho ${maxValue} superó el umbral de ${threshold} en la estación ${series.stationName || stationId}`,
                        severity: 'CRITICAL',
                        metadata: {
                            stationId,
                            stationName: series.stationName || null,
                            predictionId: persistedPrediction.id,
                            predictionResultId: maxResult.id,
                            thresholdValue: threshold,
                            actualValue: maxValue,
                            forecastDate: series.forecastDate,
                        },
                    },
                );

                notificationCreated = true;
                this.logger.log(
                    `Notification published: station=${stationId}, value=${maxValue} > threshold=${threshold}`,
                );
            }
        }

        // 9. Invalidate caches
        await this.cacheService.delByPattern(SimulationCacheKeys.pattern());
        await this.cacheService.delByPattern(PredictionCacheKeys.pattern());

        this.logger.log({
            msg: 'Time series processed',
            entity: 'Predictions',
            simulationId: simulation.id,
            predictionId: persistedPrediction.id,
            resultsCount: validEvents.length,
        });

        return {
            simulationId: simulation.id,
            predictionId: persistedPrediction.id,
            resultsCount: validEvents.length,
            notificationCreated,
        };
    }
}
