import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsOptional, IsString, IsNumber, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';

import { IsAfterOrEqual } from '@common/validators/is-after-or-equal.validator';

// ─────────────────────────────────────────────────────────────
// HistoricalPredictions — deduplicated observed timeline
// ─────────────────────────────────────────────────────────────

export class HistoricalPredictionsQueryDto {
    @ApiProperty({
        description: 'Station ID to reconstruct the observed timeline for',
        example: 'AR35',
    })
    @IsNotEmpty()
    @IsString()
    stationId: string;

    @ApiProperty({
        description: 'Prediction type name (exact match, e.g. Q.historical, Precip.historical, WI__01.historical)',
        example: 'Q.historical',
    })
    @IsNotEmpty()
    @IsString()
    predictionType: string;

    @ApiProperty({
        description: 'Inclusive lower bound of the date window (ISO 8601, UTC)',
        example: '2026-03-01T00:00:00Z',
    })
    @IsNotEmpty()
    @IsISO8601({ strict: true })
    startDate: string;

    @ApiProperty({
        description: 'Inclusive upper bound of the date window (ISO 8601, UTC)',
        example: '2026-03-31T23:59:59Z',
    })
    @IsNotEmpty()
    @IsISO8601({ strict: true })
    endDate: string;
}

export class HistoricalTimelinePointDto {
    @ApiProperty({ description: 'Point timestamp (UTC)', example: '2026-03-10T00:00:00.000Z' })
    date: string;

    @ApiProperty({ description: 'Measured value', example: 45.2 })
    value: number;

    @ApiProperty({ description: 'Ingestion flag', example: 0 })
    flag: number;
}

export class HistoricalPredictionsResponseDto {
    @ApiProperty({ description: 'Echoed station identifier', example: 'AR35' })
    stationId: string;

    @ApiProperty({ description: 'Echoed prediction type name', example: 'Q.historical' })
    predictionType: string;

    @ApiProperty({
        description: 'Observed points ordered ascending by date, deduplicated by latest createdAt per timestamp',
        type: [HistoricalTimelinePointDto],
    })
    results: HistoricalTimelinePointDto[];
}

// ─────────────────────────────────────────────────────────────
// Legacy nested shape — used by Raw and Forecast endpoints
// ─────────────────────────────────────────────────────────────

export class LegacyPredictionResultItemDto {
    @ApiProperty({ description: 'Result ID', example: 1 })
    id: number;

    @ApiProperty({ description: 'Result date', example: '2026-03-10T00:00:00.000Z' })
    date: string;

    @ApiProperty({ description: 'Result value', example: 45.2 })
    value: number;

    @ApiProperty({ description: 'Flag', example: 0 })
    flag: number;
}

export class LegacyPredictionItemDto {
    @ApiProperty({ description: 'Prediction ID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Station ID', example: 'AC01' })
    stationId: string;

    @ApiProperty({ description: 'Station name', example: 'AC01 ENTREPENAS-BUENDIA_PLUVIO', nullable: true })
    stationName: string | null;

    @ApiProperty({ description: 'Prediction type name', example: 'P.harmonie.forecast', nullable: true })
    predictionTypeName: string | null;

    @ApiProperty({ description: 'Simulation date', example: '20260129000000', nullable: true })
    simulationDate: string | null;

    @ApiProperty({ description: 'Prediction date', example: '2026-01-29T01:00:00.000Z', nullable: true })
    predictionDate: string | null;

    @ApiProperty({ description: 'Percentile', example: 75, nullable: true })
    percentile: number | null;

    @ApiProperty({ description: 'Prediction provider', example: 'Harmonie Pluviometría', nullable: true })
    predictionProvider: string | null;

    @ApiProperty({ description: 'Predicted by (module instance)', example: 'Processing_Harmonie', nullable: true })
    predictedBy: string | null;

    @ApiProperty({ description: 'Prediction results', type: [LegacyPredictionResultItemDto] })
    results: LegacyPredictionResultItemDto[];
}

// ─────────────────────────────────────────────────────────────
// RawPredictions
// ─────────────────────────────────────────────────────────────

export class RawPredictionsResponseDto {
    @ApiProperty({
        description: 'List of raw predictions by provider and simulation date',
        type: [LegacyPredictionItemDto],
    })
    predictions: LegacyPredictionItemDto[];
}

// ─────────────────────────────────────────────────────────────
// ForecastPredictions
// ─────────────────────────────────────────────────────────────

export class ForecastPredictionsQueryDto {
    @ApiProperty({
        description: 'Filter by station ID',
        example: 'AC01',
        required: false,
    })
    @IsOptional()
    @IsString()
    stationId?: string;

    @ApiProperty({
        description: 'Filter by simulation date',
        example: '20260129000000',
        required: false,
    })
    @IsOptional()
    @IsString()
    simulationDate?: string;

    @ApiProperty({
        description: 'Filter by prediction type name (exact match)',
        example: 'P.ens.forecast',
        required: false,
    })
    @IsOptional()
    @IsString()
    predictionType?: string;

    @ApiProperty({
        description: 'Filter by percentile. If omitted, returns predictions without percentile (IS NULL)',
        example: 75,
        required: false,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    percentile?: number;

    @ApiProperty({
        description: 'Inclusive lower bound of the result date window (ISO 8601, UTC)',
        example: '2026-03-01T00:00:00Z',
        required: false,
    })
    @IsOptional()
    @IsISO8601({ strict: true })
    startDate?: string;

    @ApiProperty({
        description: 'Inclusive upper bound of the result date window (ISO 8601, UTC). Must be >= startDate.',
        example: '2026-03-31T23:59:59Z',
        required: false,
    })
    @IsOptional()
    @IsISO8601({ strict: true })
    @IsAfterOrEqual('startDate')
    endDate?: string;
}

export class ForecastPredictionsResponseDto {
    @ApiProperty({
        description: 'Forecast predictions filtered by the given criteria',
        type: [LegacyPredictionItemDto],
    })
    predictions: LegacyPredictionItemDto[];
}

// ─────────────────────────────────────────────────────────────
// SimulationDateSummary (used by available-dates when stationId is provided)
// ─────────────────────────────────────────────────────────────

export class SimulationDateSummaryItemDto {
    @ApiProperty({ description: 'Simulation date', example: '20260418000000' })
    simulationDate: string;

    @ApiProperty({ description: 'Provider name', example: 'Harmonie Caudal', nullable: true })
    modmeteo: string | null;

    @ApiProperty({ description: 'Simulation status', example: 'FINALIZED' })
    status: string;

    @ApiProperty({ description: 'Prediction types available', type: [String], example: ['Q.NAM.harmonie'] })
    predictionTypes: string[];

    @ApiProperty({ description: 'Total prediction results', example: 15895 })
    totalResults: number;
}

// ─────────────────────────────────────────────────────────────
// AvailableDates
// ─────────────────────────────────────────────────────────────

export class AvailableDatesQueryDto {
    @ApiProperty({ description: 'Filter by data origin', required: false, enum: ['HISTORICAL', 'FORECAST'] })
    @IsOptional()
    @IsString()
    dataOrigin?: string;

    @ApiProperty({
        description: 'Filter by station ID — returns detailed info with prediction types per date',
        required: false,
        example: 'AR35',
    })
    @IsOptional()
    @IsString()
    stationId?: string;

    @ApiProperty({
        description: 'Filter by prediction type names',
        required: false,
        type: [String],
        example: ['Q.NAM.harmonie'],
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    predictionType?: string[];
}

export class AvailableDatesResponseDto {
    @ApiProperty({
        description: 'List of distinct available simulation dates (when no stationId)',
        type: [String],
        example: ['20260129000000', '20260130000000'],
        required: false,
    })
    dates?: string[];

    @ApiProperty({
        description: 'Simulation dates with prediction type details (when stationId is provided)',
        type: [SimulationDateSummaryItemDto],
        required: false,
    })
    simulationDates?: SimulationDateSummaryItemDto[];
}

// ─────────────────────────────────────────────────────────────
// MaxAndLatestValues
// ─────────────────────────────────────────────────────────────

export class MaxAndLatestValuesQueryDto {
    @ApiProperty({
        description: 'Filter by prediction type name',
        example: 'P.ens.forecast',
        required: false,
    })
    @IsOptional()
    @IsString()
    typeName?: string;

    @ApiProperty({
        description: 'Filter by percentile',
        example: 75,
        required: false,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    percentile?: number;

    @ApiProperty({
        description: 'Filter by simulation date',
        example: '20260129000000',
        required: false,
    })
    @IsOptional()
    @IsString()
    simulationDate?: string;

    @ApiProperty({
        description: 'Filter by modmeteo',
        example: 'EPS Pluviometría',
        required: false,
    })
    @IsOptional()
    @IsString()
    modmeteo?: string;
}

export class MaxAndLatestValueItemDto {
    @ApiProperty({ description: 'Station ID', example: 'AC01' })
    stationId: string;

    @ApiProperty({ description: 'Station name', example: 'AC01 ENTREPENAS-BUENDIA_PLUVIO', nullable: true })
    stationName: string | null;

    @ApiProperty({ description: 'Maximum value', example: 12.5 })
    maxValue: number;

    @ApiProperty({ description: 'Date of the maximum value (UTC)', example: '2026-02-07T15:00:00.000Z' })
    maxDate: string;

    @ApiProperty({ description: 'Latest value', example: 0.03 })
    latestValue: number;

    @ApiProperty({ description: 'Latest date (UTC)', example: '2026-02-08T00:00:00.000Z' })
    latestDate: string;

    @ApiProperty({ description: 'Prediction type name', example: 'P.harmonie.forecast' })
    predictionTypeName: string;

    @ApiProperty({ description: 'Simulation date', example: '20260129000000' })
    simulationDate: string;
}

// ─────────────────────────────────────────────────────────────
// MaxAndLatestValues
// ─────────────────────────────────────────────────────────────

export class MaxAndLatestValuesResponseDto {
    @ApiProperty({
        description: 'Max and latest values per station',
        type: [MaxAndLatestValueItemDto],
    })
    values: MaxAndLatestValueItemDto[];
}
