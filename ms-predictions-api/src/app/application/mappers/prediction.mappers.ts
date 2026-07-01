import {
    HistoricalPredictionsQueryDto,
    HistoricalPredictionsResponseDto,
    RawPredictionsResponseDto,
    ForecastPredictionsQueryDto,
    ForecastPredictionsResponseDto,
    AvailableDatesResponseDto,
    MaxAndLatestValuesQueryDto,
    MaxAndLatestValuesResponseDto,
} from '@api/dtos/prediction.dtos';
import {
    GetHistoricalPredictionsQuery,
    GetRawPredictionsQuery,
    GetForecastPredictionsQuery,
    GetMaxAndLatestValuesQuery,
    GetSimulationDatesByStationQuery,
} from '@application/queries/prediction.queries';
import { GetAvailableDatesQuery } from '@application/queries/simulation.queries';
import { HistoricalPredictionsResult } from '@domain/results/historical-predictions.result';
import { LegacyPredictionsResult } from '@domain/results/legacy-predictions.result';
import { MaxAndLatestValuesResult } from '@domain/results/max-and-latest-values.result';

// ─────────────────────────────────────────────────────────────
// HistoricalPredictions
// ─────────────────────────────────────────────────────────────

export class HistoricalPredictionsMapper {
    static toQuery(dto: HistoricalPredictionsQueryDto): GetHistoricalPredictionsQuery {
        return new GetHistoricalPredictionsQuery({
            filters: {
                stationId: dto.stationId,
                predictionType: dto.predictionType,
                startDate: dto.startDate,
                endDate: dto.endDate,
            },
        });
    }

    static toResponseDto(result: HistoricalPredictionsResult): HistoricalPredictionsResponseDto {
        return {
            stationId: result.stationId,
            predictionType: result.predictionType,
            results: result.results.map((p) => ({
                date: p.date,
                value: p.value,
                flag: p.flag,
            })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// Legacy nested → DTO (shared by Raw and Forecast)
// ─────────────────────────────────────────────────────────────

function legacyResultToDto(result: LegacyPredictionsResult): { predictions: RawPredictionsResponseDto['predictions'] } {
    return {
        predictions: result.predictions.map((p) => ({
            id: p.id,
            stationId: p.stationId,
            stationName: p.stationName,
            predictionTypeName: p.predictionTypeName,
            simulationDate: p.simulationDate,
            predictionDate: p.predictionDate,
            percentile: p.percentile,
            predictionProvider: p.predictionProvider,
            predictedBy: p.predictedBy,
            results: p.results.map((r) => ({
                id: r.id,
                date: r.date,
                value: r.value,
                flag: r.flag,
            })),
        })),
    };
}

// ─────────────────────────────────────────────────────────────
// RawPredictions
// ─────────────────────────────────────────────────────────────

export class RawPredictionsMapper {
    static toQuery(provider: string, simulationDate: string): GetRawPredictionsQuery {
        return new GetRawPredictionsQuery({ provider, simulationDate });
    }

    static toResponseDto(result: LegacyPredictionsResult): RawPredictionsResponseDto {
        return legacyResultToDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// ForecastPredictions
// ─────────────────────────────────────────────────────────────

export class ForecastPredictionsMapper {
    static toQuery(dto: ForecastPredictionsQueryDto): GetForecastPredictionsQuery {
        return new GetForecastPredictionsQuery({
            filters: {
                stationId: dto.stationId,
                simulationDate: dto.simulationDate,
                predictionType: dto.predictionType,
                percentile: dto.percentile,
                startDate: dto.startDate,
                endDate: dto.endDate,
            },
        });
    }

    static toResponseDto(result: LegacyPredictionsResult): ForecastPredictionsResponseDto {
        return legacyResultToDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// AvailableDates
// ─────────────────────────────────────────────────────────────

export class AvailableDatesMapper {
    static toQuery(dataOrigin?: string, predictionTypes?: string[]): GetAvailableDatesQuery {
        return new GetAvailableDatesQuery({ dataOrigin, predictionTypes });
    }

    static toResponseDto(result: string[]): AvailableDatesResponseDto {
        return {
            dates: result,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// MaxAndLatestValues
// ─────────────────────────────────────────────────────────────

export class MaxAndLatestValuesMapper {
    static toQuery(dto: MaxAndLatestValuesQueryDto): GetMaxAndLatestValuesQuery {
        return new GetMaxAndLatestValuesQuery({
            filters: {
                typeName: dto.typeName,
                percentile: dto.percentile,
                simulationDate: dto.simulationDate,
                modmeteo: dto.modmeteo,
            },
        });
    }

    static toResponseDto(result: MaxAndLatestValuesResult): MaxAndLatestValuesResponseDto {
        return {
            values: result.values.map((v) => ({
                stationId: v.stationId,
                stationName: v.stationName,
                maxValue: v.maxValue,
                maxDate: v.maxDate instanceof Date ? v.maxDate.toISOString() : String(v.maxDate),
                latestValue: v.latestValue,
                latestDate: v.latestDate instanceof Date ? v.latestDate.toISOString() : String(v.latestDate),
                predictionTypeName: v.predictionTypeName,
                simulationDate: v.simulationDate,
            })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// SimulationDatesByStation
// ─────────────────────────────────────────────────────────────

import { SimulationDateSummaryItem } from '@domain/ports/prediction-repository.port';

export class SimulationDatesByStationMapper {
    static toQuery(stationId: string, predictionTypes?: string[]): GetSimulationDatesByStationQuery {
        return new GetSimulationDatesByStationQuery({ stationId, predictionTypes });
    }

    static toResponseDto(result: SimulationDateSummaryItem[]): AvailableDatesResponseDto {
        return { simulationDates: result };
    }
}
