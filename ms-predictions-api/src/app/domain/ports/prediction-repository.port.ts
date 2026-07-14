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
