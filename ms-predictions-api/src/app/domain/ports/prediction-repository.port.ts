import { Prediction } from '@domain/entities/prediction.entity';
import { IHistoricalTimelinePoint } from '@domain/results/historical-predictions.result';

export interface HistoricalTimelineFilters {
    stationId: string;
    predictionType: string;
    startDate: string;
    endDate: string;
}

export interface MaxAndLatestFilters {
    typeName?: string;
    percentile?: number;
    simulationDate?: string;
    modmeteo?: string;
}

export interface ForecastFilters {
    stationId?: string;
    simulationDate?: string;
    predictionType?: string;
    percentile?: number; // undefined = IS NULL
    startDate?: string; // inclusive lower bound of the result date window (ISO 8601)
    endDate?: string; // inclusive upper bound of the result date window (ISO 8601)
}

export interface MaxAndLatestValueItem {
    stationId: string;
    stationName: string | null;
    maxValue: number;
    maxDate: Date;
    latestValue: number;
    latestDate: Date;
    predictionTypeName: string;
    simulationDate: string;
}

export interface PrecipAccumulationFilters {
    predictionType: string;
    hours: number;
    /** Instant the accumulation is computed at; observed data after it is ignored. */
    referenceDate: Date;
}

export interface PrecipAccumulationItem {
    stationId: string;
    stationName: string | null;
    accumulated: number;
    windowStart: Date;
    windowEnd: Date;
    lastDate: Date;
}

export interface ForecastPrecipAccumulation {
    /** Latest finalized simulation of the type, or null when there is none. */
    simulationDate: string | null;
    items: PrecipAccumulationItem[];
}

export interface SimulationDateSummaryItem {
    simulationDate: string;
    modmeteo: string | null;
    status: string;
    predictionTypes: string[];
    totalResults: number;
}

export interface StationPredictionTypeItem {
    id: string;
    name: string;
    unit: string;
    /** ISO-8601 timestamp of the most recent ingested result (FINALIZED sims), or null if the type never entered for this station. */
    lastEntered: string | null;
}

export interface TypeCoverageCell {
    stationId: string;
    predictionTypeId: string;
    /** ISO-8601 timestamp of the most recent ingested result for this station/type pair. */
    lastEntered: string;
}

export abstract class IPredictionRepository {
    abstract create(data: Prediction): Promise<Prediction>;
    abstract findById(id: string): Promise<Prediction>;
    abstract findHistorical(filters: HistoricalTimelineFilters): Promise<IHistoricalTimelinePoint[]>;
    abstract findBySimulationId(simulationId: string): Promise<Prediction[]>;
    abstract findByProviderAndDate(provider: string, simulationDate: string): Promise<Prediction[]>;
    abstract findForecast(filters: ForecastFilters): Promise<Prediction[]>;
    abstract findMaxAndLatestValues(filters: MaxAndLatestFilters): Promise<MaxAndLatestValueItem[]>;
    /**
     * Rain fallen at each observed station over the `hours` hours ending at its last
     * measurement. Points are deduplicated across ingestions (latest createdAt wins).
     */
    abstract findObservedPrecipAccumulation(filters: PrecipAccumulationFilters): Promise<PrecipAccumulationItem[]>;
    /**
     * Highest rain each station is forecast to receive over any `hours` consecutive hours
     * of the latest finalized simulation of the type (deterministic member, no percentile).
     */
    abstract findForecastPrecipAccumulation(filters: PrecipAccumulationFilters): Promise<ForecastPrecipAccumulation>;
    abstract findSimulationDatesByStation(
        stationId: string,
        predictionTypes?: string[],
    ): Promise<SimulationDateSummaryItem[]>;
    /**
     * Coverage of ALL catalog prediction types for a station: every type is returned,
     * with lastEntered = null when the station never received data for it (FINALIZED sims only).
     */
    abstract findTypeCoverageByStation(stationId: string): Promise<StationPredictionTypeItem[]>;
    /**
     * One cell per (station, type) pair that has data (FINALIZED sims only), with the most
     * recent ingestion timestamp. Used to build the full stations × types coverage matrix.
     */
    abstract findTypeCoverageMatrix(): Promise<TypeCoverageCell[]>;
    abstract findByUniqueConstraint(
        simulationId: string,
        stationId: string,
        predictionTypeId: string,
        percentile: number | null,
    ): Promise<Prediction | null>;
    abstract findWithResultsBySimulationId(
        simulationId: string,
        filters?: { stationCode?: string; typeName?: string },
    ): Promise<Prediction[]>;
}
