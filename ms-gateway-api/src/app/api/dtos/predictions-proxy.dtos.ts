import { ApiProperty } from '@nestjs/swagger';
import {
    IsArray,
    IsDateString,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Matches,
    Min,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
// DeleteSimulation
// ─────────────────────────────────────────────────────────────

export class DeleteSimulationGwResponseDto {
    @ApiProperty({ description: 'ID of the deleted simulation', example: '62246c7f-1e77-4806-ba4a-27206d19b69d' })
    id: string;

    @ApiProperty({ description: 'Number of exclusive maneuvers removed alongside the simulation', example: 2 })
    deletedManeuvers: number;
}

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

export class ListSimulationsResponseDto {
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
// StationPredictionTypes
// ─────────────────────────────────────────────────────────────

export class StationTypeCoverageItemDto {
    @ApiProperty({ description: 'Prediction type ID', example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ description: 'Prediction type name', example: 'P.harmonie.forecast' }) name: string;
    @ApiProperty({ description: 'Unit of measurement', example: 'mm' }) unit: string;
    @ApiProperty({ description: 'Whether the station has any FINALIZED data for this type', example: true })
    hasData: boolean;
    @ApiProperty({
        description: 'ISO-8601 timestamp of the most recent ingested result, or null if it never entered',
        example: '2026-07-10T08:15:00.000Z',
        nullable: true,
    })
    lastEntered: string | null;
}

export class StationPredictionTypesResponseDto {
    @ApiProperty({ description: 'Station code the coverage belongs to', example: 'A001' })
    stationCode: string;

    @ApiProperty({ description: 'Total prediction types in the catalog', example: 22 })
    total: number;

    @ApiProperty({ description: 'How many catalog types have data for this station', example: 14 })
    withData: number;

    @ApiProperty({
        description: 'Every catalog prediction type with its coverage status for this station',
        type: [StationTypeCoverageItemDto],
    })
    types: StationTypeCoverageItemDto[];
}

// ─────────────────────────────────────────────────────────────
// TypeCoverageMatrix
// ─────────────────────────────────────────────────────────────

export class CoverageMatrixStationDto {
    @ApiProperty({ description: 'Station code', example: 'E_01' }) stationCode: string;
    @ApiProperty({ description: 'Station name', example: 'Bolarque', nullable: true }) stationName: string | null;
    @ApiProperty({
        description: 'Last ingestion per type, aligned by index with `types`; null = never entered',
        type: [String],
        nullable: true,
    })
    cells: (string | null)[];
    @ApiProperty({ description: 'How many types this station has data for', example: 3 }) withData: number;
}

export class CoverageMatrixResponseDto {
    @ApiProperty({ description: 'ISO-8601 timestamp the matrix was built at', example: '2026-07-10T09:30:00.000Z' })
    generatedAt: string;
    @ApiProperty({ description: 'Ordered catalog prediction types (matrix columns)', type: [PredictionTypeItemDto] })
    types: PredictionTypeItemDto[];
    @ApiProperty({ description: 'One entry per station (matrix rows)', type: [CoverageMatrixStationDto] })
    stations: CoverageMatrixStationDto[];
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

export class ManeuverSeriesPointDto {
    @ApiProperty({ description: 'Event date (YYYY-MM-DD)', example: '2026-07-22' })
    @IsNotEmpty()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'series date must be YYYY-MM-DD' })
    date: string;

    @ApiProperty({ description: 'Event time (HH:MM:SS)', example: '00:15:00' })
    @IsNotEmpty()
    @IsString()
    @Matches(/^\d{2}:\d{2}:\d{2}$/, { message: 'series time must be HH:MM:SS' })
    time: string;

    @ApiProperty({ description: 'Output flow value in m³/s', example: 20.011 })
    @IsNumber()
    value: number;

    @ApiProperty({ description: 'FEWS quality flag', required: false, default: 0, example: 0 })
    @IsOptional()
    @IsInt()
    flag?: number;
}

export class ManeuverInputDto {
    @ApiProperty({ description: 'Reservoir SAIH code', example: 'E001' })
    @IsNotEmpty()
    @IsString()
    reservoirCode: string;

    @ApiProperty({ description: 'Output flow value (m³/s)', example: 12.5, minimum: 0 })
    @IsNumber()
    @Min(0)
    outputFlowValue: number;

    @ApiProperty({
        description: 'Optional maneuver start date (ISO 8601)',
        required: false,
        example: '2026-06-20T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiProperty({
        description: 'Optional maneuver end date (ISO 8601)',
        required: false,
        example: '2026-06-21T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiProperty({
        description:
            'Optional full 15-minute series modified in the visor (CURVE mode). When provided it is ' +
            'forwarded as the station events (passthrough) and takes precedence over `outputFlowValue`. ' +
            'When omitted (FLAT mode), the backend fills a 15-minute grid with the constant `outputFlowValue`.',
        type: [ManeuverSeriesPointDto],
        required: false,
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ManeuverSeriesPointDto)
    series?: ManeuverSeriesPointDto[];
}

export class CreateManualSimulationRequestDto {
    @ApiProperty({
        description: 'Optional operator description',
        required: false,
        maxLength: 500,
        example: 'Operación de control Tranco',
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiProperty({
        description:
            'Meteorological forcing for the SFTP input file. HARMONIE → Q.NAM.harmonie, EPS → Q.NAM.ens, BOTH → both files',
        enum: ['HARMONIE', 'EPS', 'BOTH'],
        example: 'BOTH',
    })
    @IsIn(['HARMONIE', 'EPS', 'BOTH'])
    modmeteo: 'HARMONIE' | 'EPS' | 'BOTH';

    @ApiProperty({
        description:
            'Where the model output comes from. SFTP is the real file flow. FEWS_API pushes the input to the ' +
            'FEWS PI REST service and launches the workflow there. MOCK runs that same direct flow against a ' +
            'local fake PI REST service, so it can be exercised without depending on FEWS.',
        enum: ['SFTP', 'MOCK', 'FEWS_API'],
        required: false,
        default: 'SFTP',
        example: 'SFTP',
    })
    @IsOptional()
    @IsIn(['SFTP', 'MOCK', 'FEWS_API'])
    modelSource?: 'SFTP' | 'MOCK' | 'FEWS_API';

    @ApiProperty({
        description:
            'IDs of existing reusable maneuvers to attach. Combine with `maneuvers`; at least one maneuver in total is required.',
        type: [String],
        required: false,
        example: ['7f2a8b3c-9d1e-4f5a-b6c7-8d9e0f1a2b3c'],
    })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    maneuverIds?: string[];

    @ApiProperty({
        description:
            'New maneuvers to create and attach inline. Combine with `maneuverIds`; at least one maneuver in total is required.',
        type: [ManeuverInputDto],
        required: false,
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ManeuverInputDto)
    maneuvers?: ManeuverInputDto[];
}

export class ManeuverItemDto {
    @ApiProperty({ example: '7f2a8b3c-9d1e-4f5a-b6c7-8d9e0f1a2b3c' }) id: string;
    @ApiProperty({ example: 'E001' }) reservoirCode: string;
    @ApiProperty({ example: 12.5 }) outputFlowValue: number;
    @ApiProperty({ nullable: true, example: '2026-06-20T00:00:00.000Z' }) startDate: Date | null;
    @ApiProperty({ nullable: true, example: '2026-06-21T00:00:00.000Z' }) endDate: Date | null;
}

export class ManualSimulationItemDto extends SimulationItemDto {
    @ApiProperty({ example: 'MANUAL', description: 'Always MANUAL for manual simulations' })
    declare type: string;

    @ApiProperty({ example: '20990201120459', description: 'Auto-generated YYYYMMDDHHMMSS at creation time' })
    declare simulationDate: string;

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
    @ApiProperty({ type: [ManeuverItemDto], description: 'Maneuvers attached to the simulation' })
    maneuvers: ManeuverItemDto[];
    @ApiProperty({ example: '2026-06-19T12:00:00.000Z' }) createdAt: Date | undefined;
    @ApiProperty({ example: '2026-06-19T12:00:00.000Z' }) updatedAt: Date | undefined;
}

export class ListManualSimulationsResponseDto {
    @ApiProperty({ type: [ManualSimulationListItemDto] }) data: ManualSimulationListItemDto[];
    @ApiProperty({ example: 5 }) total: number;
    @ApiProperty({ example: 1 }) page: number;
    @ApiProperty({ example: 20 }) limit: number;
}

// ─────────────────────────────────────────────────────────────
// Maneuvers (standalone CRUD)
// ─────────────────────────────────────────────────────────────

export class CreateManeuverGwRequestDto {
    @ApiProperty({ description: 'Reservoir SAIH code', example: 'AR01' })
    @IsNotEmpty()
    @IsString()
    reservoirCode: string;

    @ApiProperty({ description: 'Output flow value (m³/s)', example: 12.5, minimum: 0 })
    @IsNumber()
    @Min(0)
    outputFlowValue: number;

    @ApiProperty({
        description: 'Optional maneuver start date (ISO 8601)',
        required: false,
        example: '2026-06-20T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiProperty({
        description: 'Optional maneuver end date (ISO 8601)',
        required: false,
        example: '2026-06-21T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;
}

export class UpdateManeuverGwRequestDto {
    @ApiProperty({ description: 'Reservoir SAIH code', example: 'AR01', required: false })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    reservoirCode?: string;

    @ApiProperty({ description: 'Output flow value (m³/s)', example: 14.0, required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    outputFlowValue?: number;

    @ApiProperty({
        description: 'Maneuver start date (ISO 8601). Send null to clear it.',
        required: false,
        nullable: true,
        example: '2026-06-20T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string | null;

    @ApiProperty({
        description: 'Maneuver end date (ISO 8601). Send null to clear it.',
        required: false,
        nullable: true,
        example: '2026-06-21T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    endDate?: string | null;
}

export class ManeuverGwResponseDto {
    @ApiProperty({ example: '7f2a8b3c-9d1e-4f5a-b6c7-8d9e0f1a2b3c' }) id: string;
    @ApiProperty({ example: 'AR01' }) reservoirCode: string;
    @ApiProperty({ example: 12.5 }) outputFlowValue: number;
    @ApiProperty({ nullable: true, example: '2026-06-20T00:00:00.000Z' }) startDate: Date | null;
    @ApiProperty({ nullable: true, example: '2026-06-21T00:00:00.000Z' }) endDate: Date | null;
    @ApiProperty({ example: '2026-06-19T12:00:00.000Z' }) createdAt: Date | undefined;
    @ApiProperty({ example: '2026-06-19T12:00:00.000Z' }) updatedAt: Date | undefined;
}

export class ListManeuversGwResponseDto {
    @ApiProperty({ type: [ManeuverGwResponseDto] }) data: ManeuverGwResponseDto[];
    @ApiProperty({ example: 1 }) total: number;
    @ApiProperty({ example: 1 }) page: number;
    @ApiProperty({ example: 20 }) limit: number;
}

export class DeleteManeuverGwResponseDto {
    @ApiProperty({ example: '7f2a8b3c-9d1e-4f5a-b6c7-8d9e0f1a2b3c' }) id: string;
    @ApiProperty({ example: true }) deleted: boolean;
}

// ─────────────────────────────────────────────────────────────
// Simulation SFTP files (input/output)
// ─────────────────────────────────────────────────────────────

export class SftpFileMetaGwDto {
    @ApiProperty({ example: 'tagus_harmonie_Q_202606191200.json' }) name: string;
    @ApiProperty({ example: 20480 }) size: number;
    @ApiProperty({ nullable: true, example: '2026-06-19T12:05:00.000Z' }) modifiedAt: string | null;
}

export class SimulationFilesGwResponseDto {
    @ApiProperty({ type: [SftpFileMetaGwDto] }) input: SftpFileMetaGwDto[];
    @ApiProperty({ type: [SftpFileMetaGwDto] }) output: SftpFileMetaGwDto[];
}

// ─────────────────────────────────────────────────────────────
// Simulation Results (predictions + time-series for a manual simulation)
// Consumed by the frontend to render the outcome of a manual run.
// ─────────────────────────────────────────────────────────────

export class PredictionResultPointGwDto {
    @ApiProperty({
        example: '2026-06-19T00:00:00.000Z',
        description: 'ISO 8601 timestamp of the sample (UTC).',
    })
    date: Date;

    @ApiProperty({
        example: 123.4,
        description: 'Predicted value at that timestamp, in the prediction type unit.',
    })
    value: number;

    @ApiProperty({
        example: 0,
        description: 'Quality flag. 0 = normal, non-zero = provider-specific status (e.g. missing/derived).',
    })
    flag: number;
}

// Threshold snapshot nested under PredictionStationGwDto — mirrors StationThresholdDto
// on ms-hydro-api. All numeric fields are nullable because they come from heterogeneous
// SAIH sources; a station typically populates only the metrics that apply to it
// (e.g. an EMBALSE populates umbralVolumen* + capacidad; a river gauge populates
// umbralNivel* / umbralCaudal*).
export class StationThresholdSnapshotGwDto {
    @ApiProperty({ example: '4708e332-3c70-4863-a510-dd51343fcd43', description: 'Threshold row id (UUID).' })
    id: string;

    @ApiProperty({ example: '5fab2257-fbe3-447d-b05b-9ea5ff863d61', description: 'Station id (UUID).' })
    stationId: string;

    @ApiProperty({ nullable: true, example: null, description: 'Measurement parameter type.' })
    parametro: string | null;

    @ApiProperty({ nullable: true, example: null, description: 'SAIH signal code.' })
    senal: string | null;

    @ApiProperty({ nullable: true, example: null, description: 'Level threshold 1 (pre-alert).' })
    umbralNivel1: number | null;

    @ApiProperty({ nullable: true, example: null, description: 'Flow threshold 1 (pre-alert).' })
    umbralCaudal1: number | null;

    @ApiProperty({ nullable: true, example: null, description: 'Level threshold 2 (alert).' })
    umbralNivel2: number | null;

    @ApiProperty({ nullable: true, example: null, description: 'Flow threshold 2 (alert).' })
    umbralCaudal2: number | null;

    @ApiProperty({ nullable: true, example: null, description: 'Level threshold 3 (alarm).' })
    umbralNivel3: number | null;

    @ApiProperty({ nullable: true, example: null, description: 'Flow threshold 3 (alarm).' })
    umbralCaudal3: number | null;

    @ApiProperty({ nullable: true, example: null, description: 'Max wall level.' })
    maxNivelMuro: number | null;

    @ApiProperty({ nullable: true, example: null, description: 'Max booth level.' })
    maxNivelCaseta: number | null;

    @ApiProperty({ nullable: true, example: 12, description: 'Volume threshold 1 (hm3).' })
    umbralVolumen1: number | null;

    @ApiProperty({ nullable: true, example: 20, description: 'Volume threshold 2 (hm3).' })
    umbralVolumen2: number | null;

    @ApiProperty({ nullable: true, example: 35, description: 'Volume threshold 3 (hm3).' })
    umbralVolumen3: number | null;

    @ApiProperty({ nullable: true, example: 'FICT99', description: 'Inflow SAIH signal code.' })
    caudalEntrada: string | null;

    @ApiProperty({ nullable: true, example: 'FICT98', description: 'Outflow SAIH signal code.' })
    caudalSalida: string | null;

    @ApiProperty({ nullable: true, example: 31, description: 'Reservoir capacity (hm3).' })
    capacidad: number | null;
}

// Full station snapshot as returned by ms-hydro-api. Pass-through of that
// service's CreateStationResponseDto — see ms-hydro-api swagger for canonical shape.
export class PredictionStationGwDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Station id (UUID from hydro-api).' })
    id: string;

    @ApiProperty({ example: 'Embalse del Tranco' })
    name: string;

    @ApiProperty({ example: 'Tajo Alto' })
    subBasinName: string;

    @ApiProperty({ example: 'AR71', description: 'SAIH station code — matches prediction.stationId.' })
    stationCode: string;

    @ApiProperty({ example: 'EMBALSE' })
    stationType: string;

    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    subBasinId: string;

    @ApiProperty({
        type: StationThresholdSnapshotGwDto,
        nullable: true,
        description: [
            'Threshold snapshot from hydro-api. Contains SAIH thresholds for level/flow/volume',
            '(pre-alert/alert/alarm). Each numeric field is individually nullable — stations populate only',
            'the metrics that apply to them (embalse → volume+capacity; river gauge → level+flow).',
        ].join(' '),
    })
    threshold: StationThresholdSnapshotGwDto | null;

    @ApiProperty({ nullable: true, example: 40.1234 })
    latitude: number | null;

    @ApiProperty({ nullable: true, example: -4.5678 })
    longitude: number | null;

    @ApiProperty({ nullable: true, example: 550.0 })
    altitude: number | null;

    @ApiProperty({ nullable: true, example: 'Sacedón' })
    municipio: string | null;

    @ApiProperty({ nullable: true, example: 'Guadalajara' })
    provincia: string | null;

    @ApiProperty({ nullable: true, example: 'Castilla La Mancha' })
    ccaa: string | null;

    @ApiProperty({ nullable: true, example: 'AC' })
    tipoCod: string | null;

    @ApiProperty({ nullable: true, example: 'CABECERA' })
    zona: string | null;

    @ApiProperty({ nullable: true, example: 2 })
    zonaExplOgcFid: number | null;

    @ApiProperty({ nullable: true, example: 'ZONA 2' })
    zonaExplNombre: string | null;

    @ApiProperty({ nullable: true, example: 'TALAVERA DE LA REINA' })
    comarcaName: string | null;

    @ApiProperty({ nullable: true, example: 'CABECERA' })
    sistemaName: string | null;

    @ApiProperty({ nullable: true, example: '670502' })
    meteoalertaZonaCode: string | null;

    @ApiProperty({ nullable: true, example: 'Sistema Central de Ávila' })
    meteoalertaZonaNombre: string | null;

    @ApiProperty({ nullable: true, example: 'Estación aforo tramo alto' })
    description: string | null;

    @ApiProperty({ example: true })
    isActive: boolean;

    @ApiProperty({ nullable: true, example: '2026-03-12T00:00:00.000Z' })
    createdAt: Date | string | null;

    @ApiProperty({ nullable: true, example: '2026-03-12T00:00:00.000Z' })
    updatedAt: Date | string | null;
}

export class SimulationResultsPredictionGwDto {
    @ApiProperty({ example: '3f9d1e2b-6c47-4a8b-9c1d-2e3f4a5b6c7d' })
    id: string;

    @ApiProperty({ example: 'AR35', description: 'SAIH station identifier.' })
    stationId: string;

    @ApiProperty({
        nullable: true,
        example: 'Embalse de Arévalo',
        description: 'Station display name if the provider supplied one (denormalized on the prediction record).',
    })
    stationName: string | null;

    @ApiProperty({
        type: PredictionStationGwDto,
        nullable: true,
        description:
            'Full station snapshot resolved from ms-hydro-api by stationCode. Null when the station is not found in the hydro-api catalog.',
    })
    station: PredictionStationGwDto | null;

    @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789' })
    predictionTypeId: string;

    @ApiProperty({
        nullable: true,
        example: 'Q.NAM.forecast',
        description: 'Prediction type name (e.g. Q.NAM.forecast, P.ens.forecast).',
    })
    predictionTypeName: string | null;

    @ApiProperty({
        nullable: true,
        example: 'm3/s',
        description: 'Unit of the values in the results timeline.',
    })
    predictionTypeUnit: string | null;

    @ApiProperty({
        nullable: true,
        example: 50,
        description: 'Percentile of the ensemble prediction (0-100) or null for deterministic runs.',
    })
    percentile: number | null;

    @ApiProperty({
        nullable: true,
        example: 'aemet',
        description: 'Provider that generated the prediction.',
    })
    predictionProvider: string | null;

    @ApiProperty({
        nullable: true,
        example: 'harmonie-2026-06-19',
        description: 'External module/instance id, when available.',
    })
    predictedBy: string | null;

    @ApiProperty({
        nullable: true,
        example: '2026-06-19T00:00:00.000Z',
        description: 'Reference date the prediction refers to (usually equal to predictionStartDate).',
    })
    predictionDate: Date | null;

    @ApiProperty({
        nullable: true,
        example: '2026-06-19T00:00:00.000Z',
        description: 'Inclusive lower bound of the prediction time window.',
    })
    predictionStartDate: Date | null;

    @ApiProperty({
        nullable: true,
        example: '2026-06-22T00:00:00.000Z',
        description: 'Inclusive upper bound of the prediction time window.',
    })
    predictionEndDate: Date | null;

    @ApiProperty({
        type: [PredictionResultPointGwDto],
        required: false,
        description:
            'Time-series entries for this prediction, ordered ascending by date. Only present when the request passes `?withResults=true`. Otherwise the response conveys only `max` and `last`.',
    })
    results?: PredictionResultPointGwDto[];

    @ApiProperty({
        type: PredictionResultPointGwDto,
        nullable: true,
        description:
            'Result entry with the highest value across results[]. Ties resolve to the earliest occurrence (results are date ASC). Null when results is empty.',
        example: { date: '2026-06-19T00:00:00.000Z', value: 123.4, flag: 0 },
    })
    max: PredictionResultPointGwDto | null;

    @ApiProperty({
        type: PredictionResultPointGwDto,
        nullable: true,
        description: 'Chronologically last result entry (highest date in results[]). Null when results is empty.',
        example: { date: '2026-06-19T02:00:00.000Z', value: 118.6, flag: 0 },
    })
    last: PredictionResultPointGwDto | null;
}

export class SimulationResultsIdentityGwDto {
    @ApiProperty({ example: '7f2a8b3c-9d1e-4f5a-b6c7-8d9e0f1a2b3c' })
    id: string;

    @ApiProperty({
        example: '20260619120000',
        description: 'Auto-generated YYYYMMDDHHMMSS captured when the simulation was submitted.',
    })
    simulationDate: string;

    @ApiProperty({
        example: 'FINALIZED',
        enum: ['CREATED', 'MODEL_PROCESSING', 'IN_PROGRESS', 'FINALIZED', 'MODEL_FAILED'],
        description: 'Current lifecycle status. Only FINALIZED sims are guaranteed to carry a full results set.',
    })
    status: string;

    @ApiProperty({ example: 'MANUAL' })
    type: string;

    @ApiProperty({ nullable: true, example: 'FORECAST', enum: ['HISTORICAL', 'FORECAST', null] })
    dataOrigin: string | null;

    @ApiProperty({ example: '2026-06-19T12:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ example: '2026-06-19T12:00:00.000Z' })
    updatedAt: Date;
}

export class GetSimulationResultsGwResponseDto {
    @ApiProperty({
        type: SimulationResultsIdentityGwDto,
        description: 'Identity and lifecycle metadata of the manual simulation.',
    })
    simulation: SimulationResultsIdentityGwDto;

    @ApiProperty({
        type: [SimulationResultsPredictionGwDto],
        description:
            'Predictions produced by the model, ordered ascending by (stationId, predictionTypeId). Empty while the simulation is still processing or if it failed.',
    })
    predictions: SimulationResultsPredictionGwDto[];
}
