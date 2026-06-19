import { ApiProperty } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────
// Shared: SimulationItem
// ─────────────────────────────────────────────────────────────

export class SimulationItemDto {
    @ApiProperty({ example: '62246c7f-1e77-4806-ba4a-27206d19b69d' }) id: string;
    @ApiProperty({ example: '20260129000000' }) simulationDate: string;
    @ApiProperty({ nullable: true, example: null }) jobType: string | null;
    @ApiProperty({ nullable: true, example: 'Harmonie Pluviometría' }) modmeteo: string | null;
    @ApiProperty({ example: 'FINALIZED' }) status: string;
    @ApiProperty({ example: 'AUTOMATIC' }) type: string;
    @ApiProperty({ nullable: true, example: null }) environment: string | null;
    @ApiProperty({ nullable: true, example: null }) description: string | null;
    @ApiProperty({ nullable: true, example: null }) createdBy: string | null;
    @ApiProperty({ nullable: true, enum: ['HISTORICAL', 'FORECAST'], example: 'FORECAST' }) dataOrigin: string | null;
    @ApiProperty({ example: '2026-03-19T02:40:54.000Z' }) createdAt: Date | undefined;
    @ApiProperty({ example: '2026-03-19T02:40:54.000Z' }) updatedAt: Date | undefined;
    @ApiProperty({ required: false, example: 236 }) predictionCount?: number;
}

// ─────────────────────────────────────────────────────────────
// GetLatestSimulation
// ─────────────────────────────────────────────────────────────

export class LatestSimulationResponseDto extends SimulationItemDto {}

// ─────────────────────────────────────────────────────────────
// GetSimulationByDate
// ─────────────────────────────────────────────────────────────

export class GetSimulationByDateResponseDto extends SimulationItemDto {}

// ─────────────────────────────────────────────────────────────
// FinalizeSimulation
// ─────────────────────────────────────────────────────────────

export class FinalizeSimulationResponseDto extends SimulationItemDto {}

// ─────────────────────────────────────────────────────────────
// SimulationAvailableDates
// ─────────────────────────────────────────────────────────────

export class SimulationAvailableDatesResponseDto {
    @ApiProperty({ type: [String], example: ['20260129000000', '20260130000000'] }) dates: string[];
}

// ─────────────────────────────────────────────────────────────
// HistoricalSimulations
// ─────────────────────────────────────────────────────────────

export class HistoricalSimulationsResponseDto {
    @ApiProperty({ type: [SimulationItemDto] }) data: SimulationItemDto[];
    @ApiProperty({ example: 15 }) total: number;
    @ApiProperty({ example: 1 }) page: number;
    @ApiProperty({ example: 20 }) limit: number;
}

// ─────────────────────────────────────────────────────────────
// Shared: nested prediction item (used by Raw and Forecast)
// ─────────────────────────────────────────────────────────────

export class LegacyPredictionResultItemDto {
    @ApiProperty({ description: 'Result ID', example: 1 }) id: number;
    @ApiProperty({ description: 'Result date', example: '2026-01-29T01:00:00.000Z' }) date: string;
    @ApiProperty({ description: 'Result value', example: 0.16 }) value: number;
    @ApiProperty({ description: 'Flag', example: 0 }) flag: number;
}

export class LegacyPredictionItemDto {
    @ApiProperty({ description: 'Prediction ID', example: '0de7c1f4-4184-42e5-b8e6-2cfc61138ba5' }) id: string;
    @ApiProperty({ description: 'Station ID', example: 'AC01' }) stationId: string;
    @ApiProperty({ description: 'Station name', nullable: true, example: 'AC01 ENTREPENAS-BUENDIA_PLUVIO' })
    stationName: string | null;
    @ApiProperty({ description: 'Prediction type name', nullable: true, example: 'P.harmonie.forecast' })
    predictionTypeName: string | null;
    @ApiProperty({ description: 'Simulation date', nullable: true, example: '20260129000000' }) simulationDate:
        | string
        | null;
    @ApiProperty({ description: 'Prediction date', nullable: true, example: '2026-01-29T01:00:00.000Z' })
    predictionDate: string | null;
    @ApiProperty({ description: 'Percentile', nullable: true, example: 75 }) percentile: number | null;
    @ApiProperty({ description: 'Prediction provider', nullable: true, example: 'Harmonie Pluviometría' })
    predictionProvider: string | null;
    @ApiProperty({ description: 'Predicted by', nullable: true, example: 'Processing_Harmonie' }) predictedBy:
        | string
        | null;
    @ApiProperty({ description: 'Prediction results', type: [LegacyPredictionResultItemDto] })
    results: LegacyPredictionResultItemDto[];
}

// ─────────────────────────────────────────────────────────────
// PredictionAvailableDates
// ─────────────────────────────────────────────────────────────

export class PredictionAvailableDatesResponseDto {
    @ApiProperty({
        type: [String],
        description: 'List of distinct available simulation dates',
        example: ['20260129000000', '20260130000000'],
    })
    dates: string[];
}

// ─────────────────────────────────────────────────────────────
// MaxAndLatestValues
// ─────────────────────────────────────────────────────────────

export class MaxAndLatestValueItemDto {
    @ApiProperty({ description: 'Station ID', example: 'AC01' }) stationId: string;
    @ApiProperty({ description: 'Station name', nullable: true, example: 'AC01 ENTREPENAS-BUENDIA_PLUVIO' })
    stationName: string | null;
    @ApiProperty({ description: 'Maximum value', example: 12.5 }) maxValue: number;
    @ApiProperty({ description: 'Date of the maximum value (UTC)', example: '2026-02-07T15:00:00.000Z' })
    maxDate: string;
    @ApiProperty({ description: 'Latest value', example: 0.03 }) latestValue: number;
    @ApiProperty({ description: 'Latest date (UTC)', example: '2026-02-08T00:00:00.000Z' }) latestDate: string;
    @ApiProperty({ description: 'Prediction type name', example: 'P.harmonie.forecast' }) predictionTypeName: string;
    @ApiProperty({ description: 'Simulation date', example: '20260129000000' }) simulationDate: string;
}

export class MaxAndLatestValuesResponseDto {
    @ApiProperty({ description: 'Max and latest values per station', type: [MaxAndLatestValueItemDto] })
    values: MaxAndLatestValueItemDto[];
}

// ─────────────────────────────────────────────────────────────
// HistoricalPredictions — deduplicated observed timeline
// ─────────────────────────────────────────────────────────────

export class HistoricalTimelinePointDto {
    @ApiProperty({ description: 'Point timestamp (UTC)', example: '2026-03-10T00:00:00.000Z' }) date: string;
    @ApiProperty({ description: 'Measured value', example: 45.2 }) value: number;
    @ApiProperty({ description: 'Ingestion flag', example: 0 }) flag: number;
}

export class HistoricalPredictionsResponseDto {
    @ApiProperty({ description: 'Echoed station identifier', example: 'AR35' }) stationId: string;
    @ApiProperty({ description: 'Echoed prediction type name', example: 'Q.historical' }) predictionType: string;
    @ApiProperty({
        description: 'Observed points ordered ascending by date, deduplicated by latest createdAt per timestamp',
        type: [HistoricalTimelinePointDto],
    })
    results: HistoricalTimelinePointDto[];
}

// ─────────────────────────────────────────────────────────────
// ForecastPredictions
// ─────────────────────────────────────────────────────────────

export class ForecastPredictionsResponseDto {
    @ApiProperty({
        description: 'Forecast predictions filtered by the given criteria',
        type: [LegacyPredictionItemDto],
    })
    predictions: LegacyPredictionItemDto[];
}

// ─────────────────────────────────────────────────────────────
// Shared: PredictionTypeItem
// ─────────────────────────────────────────────────────────────

export class PredictionTypeItemDto {
    @ApiProperty({ description: 'Prediction type ID', example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ description: 'Prediction type name', example: 'P.harmonie.forecast' }) name: string;
    @ApiProperty({ description: 'Unit of measurement', example: 'mm' }) unit: string;
}

// ─────────────────────────────────────────────────────────────
// ListPredictionTypes
// ─────────────────────────────────────────────────────────────

export class ListPredictionTypesResponseDto {
    @ApiProperty({ description: 'List of prediction types', type: [PredictionTypeItemDto] })
    predictionTypes: PredictionTypeItemDto[];
}

// ─────────────────────────────────────────────────────────────
// CreatePredictionType
// ─────────────────────────────────────────────────────────────

export class CreatePredictionTypeResponseDto {
    @ApiProperty({ description: 'Prediction type ID', example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ description: 'Prediction type name', example: 'P.harmonie.forecast' }) name: string;
    @ApiProperty({ description: 'Unit of measurement', example: 'mm' }) unit: string;
}

// ─────────────────────────────────────────────────────────────
// Manual Simulation
// ─────────────────────────────────────────────────────────────

export class ManeuverInputDto {
    @ApiProperty({ description: 'Reservoir code', example: 'E001' }) reservoirCode: string;
    @ApiProperty({ description: 'Output flow value (m3/s)', example: 12.5, minimum: 0 }) outputFlowValue: number;
}

export class CreateManualSimulationRequestDto {
    @ApiProperty({ description: 'Simulation date (YYYYMMDDHHMMSS)', example: '20260619120000' }) simulationDate: string;
    @ApiProperty({
        description: 'Optional operator description',
        required: false,
        example: 'Operación de control Tranco',
    })
    description?: string;
    @ApiProperty({
        description:
            'Meteorological forcing for the SFTP input file. HARMONIE → Q.NAM.harmonie, EPS → Q.NAM.ens, BOTH → both files',
        enum: ['HARMONIE', 'EPS', 'BOTH'],
        example: 'BOTH',
    })
    modmeteo: 'HARMONIE' | 'EPS' | 'BOTH';
    @ApiProperty({ type: [ManeuverInputDto], description: 'Maneuvers (at least one required)' })
    maneuvers: ManeuverInputDto[];
}

export class ManeuverItemDto {
    @ApiProperty({ example: '7f2a8b3c-9d1e-4f5a-b6c7-8d9e0f1a2b3c' }) id: string;
    @ApiProperty({ example: 'E001' }) reservoirCode: string;
    @ApiProperty({ example: 12.5 }) outputFlowValue: number;
}

export class ManualSimulationItemDto extends SimulationItemDto {
    @ApiProperty({ type: [ManeuverItemDto], description: 'Maneuvers linked to the simulation' })
    maneuvers: ManeuverItemDto[];
}

export class CreateManualSimulationResponseDto extends ManualSimulationItemDto {}

export class GetManualSimulationByIdResponseDto extends ManualSimulationItemDto {}

export class ManualSimulationListItemDto {
    @ApiProperty({ example: '7f2a8b3c-9d1e-4f5a-b6c7-8d9e0f1a2b3c' }) id: string;
    @ApiProperty({ example: '20260619120000' }) simulationDate: string;
    @ApiProperty({ example: 'MODEL_PROCESSING' }) status: string;
    @ApiProperty({ example: 'MANUAL' }) type: string;
    @ApiProperty({ nullable: true, example: 'Operación de control' }) description: string | null;
    @ApiProperty({ nullable: true, example: 'Sebastián Aliceio' }) createdBy: string | null;
    @ApiProperty({ nullable: true, example: 'BOTH' }) modmeteo: string | null;
    @ApiProperty({ example: 2 }) maneuverCount: number;
    @ApiProperty({ example: '2026-06-19T12:00:00.000Z' }) createdAt: Date | undefined;
    @ApiProperty({ example: '2026-06-19T12:00:00.000Z' }) updatedAt: Date | undefined;
}

export class ListManualSimulationsResponseDto {
    @ApiProperty({ type: [ManualSimulationListItemDto] }) data: ManualSimulationListItemDto[];
    @ApiProperty({ example: 5 }) total: number;
    @ApiProperty({ example: 1 }) page: number;
    @ApiProperty({ example: 20 }) limit: number;
}
