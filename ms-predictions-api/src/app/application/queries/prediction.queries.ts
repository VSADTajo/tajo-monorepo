import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import {
    IPredictionRepository,
    HistoricalTimelineFilters,
    ForecastFilters,
    MaxAndLatestFilters,
    SimulationDateSummaryItem,
} from '@domain/ports/prediction-repository.port';

import { HistoricalPredictionsResult } from '@domain/results/historical-predictions.result';
import { LegacyPredictionsResult, ILegacyPredictionItem } from '@domain/results/legacy-predictions.result';
import { MaxAndLatestValuesResult } from '@domain/results/max-and-latest-values.result';
import { PrecipAccumulationResult } from '@domain/results/precip-accumulation.result';
import { Prediction } from '@domain/entities/prediction.entity';
import { PrecipAccumulationWindowValueObject } from '@domain/value-objects/precip-accumulation-window.value-object';

// ─────────────────────────────────────────────────────────────
// Helper: map Prediction entity to legacy nested item (used by Raw / Forecast)
// ─────────────────────────────────────────────────────────────

function mapPredictionToItem(prediction: Prediction): ILegacyPredictionItem {
    return {
        id: prediction.id,
        stationId: prediction.stationId,
        stationName: prediction.stationName,
        predictionTypeName: prediction.predictionType?.name ?? null,
        simulationDate: prediction.simulation?.simulationDate ?? null,
        predictionDate: prediction.predictionDate ? prediction.predictionDate.toISOString() : null,
        percentile: prediction.percentile,
        predictionProvider: prediction.predictionProvider,
        predictedBy: prediction.predictedBy,
        results: (prediction.results ?? []).map((r) => ({
            id: r.id,
            date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
            value: r.value,
            flag: r.flag,
        })),
    };
}

// ─────────────────────────────────────────────────────────────
// GetHistoricalPredictions
// ─────────────────────────────────────────────────────────────

export interface IGetHistoricalPredictionsQuery {
    filters: HistoricalTimelineFilters;
}

export class GetHistoricalPredictionsQuery {
    constructor(private readonly parameters: IGetHistoricalPredictionsQuery) {}

    get filters(): HistoricalTimelineFilters {
        return this.parameters.filters;
    }
}

@QueryHandler(GetHistoricalPredictionsQuery)
export class GetHistoricalPredictionsHandler implements IQueryHandler<
    GetHistoricalPredictionsQuery,
    HistoricalPredictionsResult
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly predictionRepository: IPredictionRepository,
    ) {}

    async execute(query: GetHistoricalPredictionsQuery): Promise<HistoricalPredictionsResult> {
        const { filters } = query;

        this.logger.debug(`Reconstructing historical timeline with filters: ${JSON.stringify(filters)}`);

        const points = await this.predictionRepository.findHistorical(filters);

        return new HistoricalPredictionsResult(filters.stationId, filters.predictionType, points);
    }
}

// ─────────────────────────────────────────────────────────────
// GetRawPredictions
// ─────────────────────────────────────────────────────────────

export interface IGetRawPredictionsQuery {
    provider: string;
    simulationDate: string;
}

export class GetRawPredictionsQuery {
    constructor(private readonly parameters: IGetRawPredictionsQuery) {}

    get provider(): string {
        return this.parameters.provider;
    }

    get simulationDate(): string {
        return this.parameters.simulationDate;
    }
}

@QueryHandler(GetRawPredictionsQuery)
export class GetRawPredictionsHandler implements IQueryHandler<GetRawPredictionsQuery, LegacyPredictionsResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly predictionRepository: IPredictionRepository,
    ) {}

    async execute(query: GetRawPredictionsQuery): Promise<LegacyPredictionsResult> {
        this.logger.debug(`Getting raw predictions for provider=${query.provider}, date=${query.simulationDate}`);

        const predictions = await this.predictionRepository.findByProviderAndDate(query.provider, query.simulationDate);

        return new LegacyPredictionsResult(predictions.map(mapPredictionToItem));
    }
}

// ─────────────────────────────────────────────────────────────
// GetForecastPredictions
// ─────────────────────────────────────────────────────────────

export interface IGetForecastPredictionsQuery {
    filters: ForecastFilters;
}

export class GetForecastPredictionsQuery {
    constructor(private readonly parameters: IGetForecastPredictionsQuery) {}

    get filters(): ForecastFilters {
        return this.parameters.filters;
    }
}

@QueryHandler(GetForecastPredictionsQuery)
export class GetForecastPredictionsHandler implements IQueryHandler<
    GetForecastPredictionsQuery,
    LegacyPredictionsResult
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly predictionRepository: IPredictionRepository,
    ) {}

    async execute(query: GetForecastPredictionsQuery): Promise<LegacyPredictionsResult> {
        this.logger.debug(`Getting forecast predictions with filters: ${JSON.stringify(query.filters)}`);

        const predictions = await this.predictionRepository.findForecast(query.filters);

        return new LegacyPredictionsResult(predictions.map(mapPredictionToItem));
    }
}

// ─────────────────────────────────────────────────────────────
// GetMaxAndLatestValues
// ─────────────────────────────────────────────────────────────

export interface IGetMaxAndLatestValuesQuery {
    filters: MaxAndLatestFilters;
}

export class GetMaxAndLatestValuesQuery {
    constructor(private readonly parameters: IGetMaxAndLatestValuesQuery) {}

    get filters(): MaxAndLatestFilters {
        return this.parameters.filters;
    }
}

@QueryHandler(GetMaxAndLatestValuesQuery)
export class GetMaxAndLatestValuesHandler implements IQueryHandler<
    GetMaxAndLatestValuesQuery,
    MaxAndLatestValuesResult
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly predictionRepository: IPredictionRepository,
    ) {}

    async execute(query: GetMaxAndLatestValuesQuery): Promise<MaxAndLatestValuesResult> {
        this.logger.debug('Getting max and latest values');

        const values = await this.predictionRepository.findMaxAndLatestValues(query.filters);

        return new MaxAndLatestValuesResult(values);
    }
}

// ─────────────────────────────────────────────────────────────
// GetPrecipAccumulation
// ─────────────────────────────────────────────────────────────

export interface IGetPrecipAccumulationQuery {
    source: string;
    hours: number;
}

export class GetPrecipAccumulationQuery {
    constructor(private readonly parameters: IGetPrecipAccumulationQuery) {}

    get source(): string {
        return this.parameters.source;
    }

    get hours(): number {
        return this.parameters.hours;
    }
}

@QueryHandler(GetPrecipAccumulationQuery)
export class GetPrecipAccumulationHandler implements IQueryHandler<
    GetPrecipAccumulationQuery,
    PrecipAccumulationResult
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly predictionRepository: IPredictionRepository,
    ) {}

    async execute(query: GetPrecipAccumulationQuery): Promise<PrecipAccumulationResult> {
        // 1. Validate the requested window (throws EntityError)
        const window = new PrecipAccumulationWindowValueObject(query.source, query.hours);
        const referenceDate = new Date();
        const filters = { predictionType: window.predictionType, hours: window.hours, referenceDate };

        this.logger.debug(`Computing ${window.hours}h precipitation accumulation for source=${window.source}`);

        // 2. Read the accumulations of the requested series
        const { simulationDate, items } = window.isObserved
            ? { simulationDate: null, items: await this.predictionRepository.findObservedPrecipAccumulation(filters) }
            : await this.predictionRepository.findForecastPrecipAccumulation(filters);

        // 3. Build the result; dates are kept as ISO strings so a cached copy reads the same
        return new PrecipAccumulationResult({
            source: window.source,
            hours: window.hours,
            predictionType: window.predictionType,
            simulationDate,
            referenceDate: referenceDate.toISOString(),
            items: items.map((item) => ({
                stationId: item.stationId,
                stationName: item.stationName,
                accumulated: item.accumulated,
                windowStart: item.windowStart.toISOString(),
                windowEnd: item.windowEnd.toISOString(),
                lastDate: item.lastDate.toISOString(),
                isStale: window.isStale(item.lastDate, referenceDate),
            })),
        });
    }
}

// ─────────────────────────────────────────────────────────────
// GetSimulationDatesByStation
// ─────────────────────────────────────────────────────────────

export interface IGetSimulationDatesByStationQuery {
    stationId: string;
    predictionTypes?: string[];
}

export class GetSimulationDatesByStationQuery {
    constructor(private readonly parameters: IGetSimulationDatesByStationQuery) {}

    get stationId(): string {
        return this.parameters.stationId;
    }

    get predictionTypes(): string[] | undefined {
        return this.parameters.predictionTypes;
    }
}

@QueryHandler(GetSimulationDatesByStationQuery)
export class GetSimulationDatesByStationHandler implements IQueryHandler<
    GetSimulationDatesByStationQuery,
    SimulationDateSummaryItem[]
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly predictionRepository: IPredictionRepository,
    ) {}

    async execute(query: GetSimulationDatesByStationQuery): Promise<SimulationDateSummaryItem[]> {
        this.logger.debug(`Getting simulation dates for station: ${query.stationId}`);

        return this.predictionRepository.findSimulationDatesByStation(query.stationId, query.predictionTypes);
    }
}
