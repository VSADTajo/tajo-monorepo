import { ApiProperty } from '@nestjs/swagger';

// Type-only: it is a plain union used in a decorated signature, and with
// isolatedModules + emitDecoratorMetadata a value import fails to compile.
import type { SimulationFileStatus } from '@domain/results/simulation-files.result';
// ModelSource is an enum, so it must stay a value import — @ApiProperty reads it.
import { ModelSource } from '@domain/entities/simulation.entity';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Matches,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SimulationStatus } from '@domain/entities/simulation.entity';
import { SIMULATION_SORT_FIELDS, SORT_ORDERS } from '@domain/ports/simulation-repository.port';
import type { SimulationSortBy, SortOrder } from '@domain/ports/simulation-repository.port';

// ─────────────────────────────────────────────────────────────
// ListSimulations
// ─────────────────────────────────────────────────────────────

export class ListSimulationsQueryDto {
    @ApiProperty({
        description: 'Filter by status',
        required: false,
        enum: SimulationStatus,
    })
    @IsOptional()
    @IsEnum(SimulationStatus)
    status?: SimulationStatus;

    @ApiProperty({ description: 'Start date filter (YYYYMMDDHHMMSS or ISO)', required: false })
    @IsOptional()
    @IsString()
    startDate?: string;

    @ApiProperty({ description: 'End date filter (YYYYMMDDHHMMSS or ISO)', required: false })
    @IsOptional()
    @IsString()
    endDate?: string;

    @ApiProperty({ description: 'Filter by modmeteo', required: false, example: 'Harmonie Pluviometría' })
    @IsOptional()
    @IsString()
    modmeteo?: string;

    @ApiProperty({ description: 'Filter by environment', required: false })
    @IsOptional()
    @IsString()
    environment?: string;

    @ApiProperty({ description: 'Filter by data origin', required: false, enum: ['HISTORICAL', 'FORECAST'] })
    @IsOptional()
    @IsString()
    dataOrigin?: string;

    @ApiProperty({
        description: 'Keep only simulations with at least one prediction for this station code',
        required: false,
        example: 'E001',
    })
    @IsOptional()
    @IsString()
    stationCode?: string;

    @ApiProperty({
        description: 'Field to sort by',
        required: false,
        enum: SIMULATION_SORT_FIELDS,
        default: 'createdAt',
    })
    @IsOptional()
    @IsIn(SIMULATION_SORT_FIELDS)
    sortBy?: SimulationSortBy;

    @ApiProperty({
        description: 'Sort direction (case-insensitive)',
        required: false,
        enum: SORT_ORDERS,
        default: 'DESC',
    })
    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
    @IsIn(SORT_ORDERS)
    sortOrder?: SortOrder;

    @ApiProperty({ description: 'Page number', required: false, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiProperty({ description: 'Items per page', required: false, default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}

export class SimulationItemDto {
    @ApiProperty() id: string;
    @ApiProperty() simulationDate: string;
    @ApiProperty({ nullable: true }) jobType: string | null;
    @ApiProperty({ nullable: true }) modmeteo: string | null;
    @ApiProperty() status: string;
    @ApiProperty() type: string;
    @ApiProperty({ nullable: true }) environment: string | null;
    @ApiProperty({ nullable: true }) description: string | null;
    @ApiProperty({ nullable: true }) createdBy: string | null;
    @ApiProperty({ nullable: true, enum: ['HISTORICAL', 'FORECAST'] }) dataOrigin: string | null;
    @ApiProperty() createdAt: Date | undefined;
    @ApiProperty() updatedAt: Date | undefined;
    @ApiProperty({ required: false }) predictionCount?: number;
}

export class ListSimulationsResponseDto {
    @ApiProperty({ type: [SimulationItemDto] }) data: SimulationItemDto[];
    @ApiProperty() total: number;
    @ApiProperty() page: number;
    @ApiProperty() limit: number;
}

// ─────────────────────────────────────────────────────────────
// GetSimulationByDate
// ─────────────────────────────────────────────────────────────

export class GetSimulationByDateResponseDto extends SimulationItemDto {}

// ─────────────────────────────────────────────────────────────
// LatestSimulation
// ─────────────────────────────────────────────────────────────

export class LatestSimulationResponseDto extends SimulationItemDto {}

// ─────────────────────────────────────────────────────────────
// HistoricalSimulations
// ─────────────────────────────────────────────────────────────

export class HistoricalSimulationsQueryDto {
    @ApiProperty({ required: false, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiProperty({ required: false, default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}

export class HistoricalSimulationsResponseDto {
    @ApiProperty({ type: [SimulationItemDto] }) data: SimulationItemDto[];
    @ApiProperty() total: number;
    @ApiProperty() page: number;
    @ApiProperty() limit: number;
}

// ─────────────────────────────────────────────────────────────
// FinalizeSimulation
// ─────────────────────────────────────────────────────────────

export class FinalizeSimulationResponseDto extends SimulationItemDto {}

// ─────────────────────────────────────────────────────────────
// DeleteSimulation
// ─────────────────────────────────────────────────────────────

export class DeleteSimulationResponseDto {
    @ApiProperty({ description: 'Id of the soft-deleted simulation', example: '7c1f8e2a-...' })
    id: string;

    @ApiProperty({ description: 'Whether the simulation was soft-deleted', example: true })
    deleted: boolean;

    @ApiProperty({
        description: 'Number of exclusively-associated maneuvers also soft-deleted (shared ones are kept)',
        example: 2,
    })
    deletedManeuvers: number;
}

// ─────────────────────────────────────────────────────────────
// AvailableDates
// ─────────────────────────────────────────────────────────────

export class AvailableDatesQueryDto {
    @ApiProperty({ description: 'Filter by data origin', required: false, enum: ['HISTORICAL', 'FORECAST'] })
    @IsOptional()
    @IsString()
    dataOrigin?: string;
}

export class SimulationAvailableDatesResponseDto {
    @ApiProperty({ type: [String] }) dates: string[];
}

// ─────────────────────────────────────────────────────────────
// BatchIngest
// ─────────────────────────────────────────────────────────────

export class BatchIngestEventDto {
    @ApiProperty({ description: 'Event timestamp (ISO 8601)' })
    @IsNotEmpty()
    @IsString()
    timestamp: string;

    @ApiProperty({ description: 'Event value' })
    @IsNotEmpty()
    @IsNumber()
    value: number;

    @ApiProperty({ description: 'Event flag', required: false, default: 0 })
    @IsOptional()
    @IsInt()
    flag?: number;
}

export class BatchIngestPredictionDto {
    @ApiProperty({ description: 'Station ID', example: 'AC01' })
    @IsNotEmpty()
    @IsString()
    stationId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    stationName?: string;

    @ApiProperty({ description: 'Prediction type name', example: 'P.harmonie.forecast' })
    @IsNotEmpty()
    @IsString()
    typeName: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    units?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    percentile?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    predictionProvider?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    predictedBy?: string;

    @ApiProperty({ type: [BatchIngestEventDto] })
    @ValidateNested({ each: true })
    @Type(() => BatchIngestEventDto)
    @ArrayMinSize(1)
    events: BatchIngestEventDto[];
}

export class BatchIngestRequestDto {
    @ApiProperty({ description: 'Simulation date (YYYYMMDDHHMMSS format)', example: '20260129000000' })
    @IsNotEmpty()
    @IsString()
    simulationDate: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    modmeteo?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    environment?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    createdBy?: string;

    @ApiProperty({ type: [BatchIngestPredictionDto] })
    @ValidateNested({ each: true })
    @Type(() => BatchIngestPredictionDto)
    @ArrayMinSize(1)
    predictions: BatchIngestPredictionDto[];
}

export class BatchIngestResponseDto {
    @ApiProperty() simulationId: string;
    @ApiProperty() processedCount: number;
    @ApiProperty({ type: [String] }) errors: string[];
}

// ─────────────────────────────────────────────────────────────
// CreateManualSimulation
// ─────────────────────────────────────────────────────────────

export enum ModmeteoChoice {
    HARMONIE = 'HARMONIE',
    EPS = 'EPS',
    BOTH = 'BOTH',
}

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

    @ApiProperty({ description: 'Output flow value in m³/s', example: 12.5, minimum: 0 })
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
            'Optional full 15-minute series modified in the visor (CURVE mode). ' +
            'When provided, it is written verbatim as the station events (passthrough, FEWS shape) ' +
            'and takes precedence over `outputFlowValue`. When omitted (FLAT mode), a complete ' +
            '15-minute grid is generated with the constant `outputFlowValue` over the modified window.',
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
        description: 'Optional description',
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
            'Meteorological forcing recorded on the simulation and published in the dispatch event. ' +
            'It no longer splits the SFTP input file: a single Q_mod_input_<firstStep>.json is always generated ' +
            'with the modified station series, regardless of this value.',
        enum: ModmeteoChoice,
        example: ModmeteoChoice.BOTH,
    })
    @IsEnum(ModmeteoChoice)
    modmeteo: ModmeteoChoice;

    @ApiProperty({
        description:
            'Where the model output should come from. SFTP is the real flow (FEWS leaves the result in the ' +
            'output folder). MOCK seeds a known-good reference output so the whole pipeline can be exercised ' +
            'without FEWS — useful for testing and demos.',
        enum: ModelSource,
        required: false,
        default: ModelSource.SFTP,
        example: ModelSource.SFTP,
    })
    @IsOptional()
    @IsEnum(ModelSource)
    modelSource?: ModelSource;

    @ApiProperty({
        description:
            'IDs of existing reusable maneuvers to attach. Combine with `maneuvers` as needed; ' +
            'at least one maneuver in total (from `maneuverIds` and/or `maneuvers`) is required.',
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
            'New maneuvers to create and attach inline. Combine with `maneuverIds` as needed; ' +
            'at least one maneuver in total is required.',
        type: [ManeuverInputDto],
        required: false,
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ManeuverInputDto)
    maneuvers?: ManeuverInputDto[];
}

export class ManeuverResponseDto {
    @ApiProperty({ description: 'Maneuver unique identifier' }) id: string;
    @ApiProperty({ description: 'Reservoir code', example: 'E001' }) reservoirCode: string;
    @ApiProperty({ description: 'Output flow value in m³/s', example: 12.5 }) outputFlowValue: number;
    @ApiProperty({ description: 'Maneuver start date (ISO 8601)', nullable: true }) startDate: Date | null;
    @ApiProperty({ description: 'Maneuver end date (ISO 8601)', nullable: true }) endDate: Date | null;
}

export class ManualSimulationResponseDto {
    @ApiProperty({ description: 'Simulation unique identifier' }) id: string;
    @ApiProperty({ description: 'Simulation date in YYYYMMDDHHMMSS format' }) simulationDate: string;
    @ApiProperty({
        description: 'Simulation status',
        enum: ['CREATED', 'MODEL_PROCESSING', 'IN_PROGRESS', 'FINALIZED', 'MODEL_FAILED'],
    })
    status: string;
    @ApiProperty({ description: 'Simulation type', example: 'MANUAL' }) type: string;
    @ApiProperty({ description: 'Optional description', nullable: true }) description: string | null;
    @ApiProperty({ description: 'Operator who created the simulation (from auth token)', nullable: true })
    createdBy: string | null;
    @ApiProperty({ description: 'Meteorological forcing chosen by the operator', nullable: true, example: 'BOTH' })
    modmeteo: string | null;

    @ApiProperty({ description: 'Where the model output came from', enum: ModelSource, example: ModelSource.SFTP })
    modelSource: ModelSource;
    @ApiProperty({ description: 'Maneuvers included in the simulation', type: [ManeuverResponseDto] })
    maneuvers: ManeuverResponseDto[];
    @ApiProperty({ description: 'Creation timestamp' }) createdAt: Date | undefined;
    @ApiProperty({ description: 'Last update timestamp' }) updatedAt: Date | undefined;
}

// ─────────────────────────────────────────────────────────────
// ListManualSimulations
// ─────────────────────────────────────────────────────────────

export class ListManualSimulationsQueryDto {
    @ApiProperty({
        description: 'Filter by status',
        required: false,
        enum: SimulationStatus,
    })
    @IsOptional()
    @IsEnum(SimulationStatus)
    status?: SimulationStatus;

    @ApiProperty({
        description: 'Keep only manual simulations with at least one prediction for this station code',
        required: false,
        example: 'E001',
    })
    @IsOptional()
    @IsString()
    stationCode?: string;

    @ApiProperty({
        description: 'Field to sort by',
        required: false,
        enum: SIMULATION_SORT_FIELDS,
        default: 'createdAt',
    })
    @IsOptional()
    @IsIn(SIMULATION_SORT_FIELDS)
    sortBy?: SimulationSortBy;

    @ApiProperty({
        description: 'Sort direction (case-insensitive)',
        required: false,
        enum: SORT_ORDERS,
        default: 'DESC',
    })
    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
    @IsIn(SORT_ORDERS)
    sortOrder?: SortOrder;

    @ApiProperty({ description: 'Page number', required: false, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiProperty({ description: 'Items per page', required: false, default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}

export class ManualSimulationListItemDto {
    @ApiProperty() id: string;
    @ApiProperty() simulationDate: string;
    @ApiProperty() status: string;
    @ApiProperty() type: string;
    @ApiProperty({ nullable: true }) description: string | null;
    @ApiProperty() maneuverCount: number;
    @ApiProperty({ description: 'Maneuvers attached to the simulation', type: [ManeuverResponseDto] })
    maneuvers: ManeuverResponseDto[];
    @ApiProperty() createdAt: Date | undefined;
}

export class ListManualSimulationsResponseDto {
    @ApiProperty({ type: [ManualSimulationListItemDto] }) data: ManualSimulationListItemDto[];
    @ApiProperty() total: number;
    @ApiProperty() page: number;
    @ApiProperty() limit: number;
}

// ─────────────────────────────────────────────────────────────
// GetManualSimulationById
// ─────────────────────────────────────────────────────────────

export class GetManualSimulationByIdResponseDto extends ManualSimulationResponseDto {}

// ─────────────────────────────────────────────────────────────
// SimulationFiles (SFTP input/output)
// ─────────────────────────────────────────────────────────────

export class SftpFileMetaDto {
    @ApiProperty({ description: 'File name', example: 'tagus_harmonie_Q_202606191200.json' })
    name: string;

    @ApiProperty({ description: 'File size in bytes', example: 20480 })
    size: number;

    @ApiProperty({
        description: 'Last modification time (ISO 8601)',
        nullable: true,
        example: '2026-06-19T12:05:00.000Z',
    })
    modifiedAt: string | null;

    @ApiProperty({
        description:
            'What happened to the file. Output files are moved out of output/ once polled: ' +
            '"processed" (historial/) or "failed" (corrupted/). "pending" means not consumed yet.',
        enum: ['pending', 'processed', 'failed'],
        example: 'processed',
    })
    status: SimulationFileStatus;
}

export class SimulationFilesResponseDto {
    @ApiProperty({ description: 'Files in the simulation input folder', type: [SftpFileMetaDto] })
    input: SftpFileMetaDto[];

    @ApiProperty({
        description: 'Files in the simulation output folder, including those already processed or failed',
        type: [SftpFileMetaDto],
    })
    output: SftpFileMetaDto[];
}

// ─────────────────────────────────────────────────────────────
// GetSimulationResults
// ─────────────────────────────────────────────────────────────

export class GetSimulationResultsQueryDto {
    @ApiProperty({
        description: 'Keep only predictions for this station code (case-insensitive exact match)',
        required: false,
        example: 'AR71',
    })
    @IsOptional()
    @IsString()
    stationCode?: string;

    @ApiProperty({
        description: 'Keep only predictions whose prediction type name matches (case-insensitive exact match)',
        required: false,
        example: 'Q.NAM.forecast',
    })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiProperty({
        description: [
            'Include the full time-series `results[]` array on each prediction.',
            'When omitted or false, each prediction returns only its `station`, `max` and `last` — smaller payload, useful for summary views.',
            'When true, the full results array is included alongside max/last.',
        ].join(' '),
        required: false,
        example: 'true',
        default: false,
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === true || value === 'true' || value === '1') return true;
        if (value === false || value === 'false' || value === '0') return false;
        return value;
    })
    @IsBoolean()
    withResults?: boolean;
}

export class PredictionResultItemDto {
    @ApiProperty({ description: 'Time-series entry timestamp (ISO 8601)', example: '2026-07-10T00:00:00.000Z' })
    date: Date;

    @ApiProperty({ description: 'Numeric value at this timestamp', example: 123.4 })
    value: number;

    @ApiProperty({ description: 'Quality flag (0 = reliable)', example: 0 })
    flag: number;
}

// Threshold snapshot nested under PredictionStationDto — mirrors StationThresholdDto
// on ms-hydro-api. All numeric fields are nullable because they come from hetero-
// geneous SAIH sources.
export class StationThresholdSnapshotDto {
    @ApiProperty({ description: 'Threshold row id (UUID)', example: '4708e332-3c70-4863-a510-dd51343fcd43' })
    id: string;

    @ApiProperty({
        description: 'Station id (UUID) — foreign key to the parent station',
        example: '5fab2257-fbe3-447d-b05b-9ea5ff863d61',
    })
    stationId: string;

    @ApiProperty({ description: 'Measurement parameter type', example: 'NIVEL', nullable: true })
    parametro: string | null;

    @ApiProperty({ description: 'SAIH signal code', example: 'AR01LI__01', nullable: true })
    senal: string | null;

    @ApiProperty({ description: 'Level threshold 1 (pre-alert)', nullable: true, example: null })
    umbralNivel1: number | null;

    @ApiProperty({ description: 'Flow threshold 1 (pre-alert)', nullable: true, example: null })
    umbralCaudal1: number | null;

    @ApiProperty({ description: 'Level threshold 2 (alert)', nullable: true, example: null })
    umbralNivel2: number | null;

    @ApiProperty({ description: 'Flow threshold 2 (alert)', nullable: true, example: null })
    umbralCaudal2: number | null;

    @ApiProperty({ description: 'Level threshold 3 (alarm)', nullable: true, example: null })
    umbralNivel3: number | null;

    @ApiProperty({ description: 'Flow threshold 3 (alarm)', nullable: true, example: null })
    umbralCaudal3: number | null;

    @ApiProperty({ description: 'Max wall level', nullable: true, example: null })
    maxNivelMuro: number | null;

    @ApiProperty({ description: 'Max booth level', nullable: true, example: null })
    maxNivelCaseta: number | null;

    @ApiProperty({ description: 'Volume threshold 1 (hm3)', nullable: true, example: 12 })
    umbralVolumen1: number | null;

    @ApiProperty({ description: 'Volume threshold 2 (hm3)', nullable: true, example: 20 })
    umbralVolumen2: number | null;

    @ApiProperty({ description: 'Volume threshold 3 (hm3)', nullable: true, example: 35 })
    umbralVolumen3: number | null;

    @ApiProperty({ description: 'Inflow SAIH signal code', nullable: true, example: 'FICT99' })
    caudalEntrada: string | null;

    @ApiProperty({ description: 'Outflow SAIH signal code', nullable: true, example: 'FICT98' })
    caudalSalida: string | null;

    @ApiProperty({ description: 'Reservoir capacity (hm3)', nullable: true, example: 31 })
    capacidad: number | null;
}

// Nested station snapshot resolved from ms-hydro-api (via IStationCatalogService).
// Shape mirrors CreateStationResponseDto on hydro-api.
export class PredictionStationDto {
    @ApiProperty({ description: 'Station ID (UUID from hydro-api)', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Station display name', example: 'Embalse del Tranco' })
    name: string;

    @ApiProperty({ description: 'Sub-basin name', example: 'Tajo Alto' })
    subBasinName: string;

    @ApiProperty({ description: 'SAIH station code — matches Prediction.stationId', example: 'AR71' })
    stationCode: string;

    @ApiProperty({ description: 'Station type (StationType enum on hydro-api)', example: 'EMBALSE' })
    stationType: string;

    @ApiProperty({ description: 'Sub-basin ID (UUID)', example: '550e8400-e29b-41d4-a716-446655440000' })
    subBasinId: string;

    @ApiProperty({
        description: [
            'Station threshold snapshot from hydro-api. Contains SAIH thresholds for level/flow/volume',
            '(pre-alert/alert/alarm). All numeric fields are individually nullable — a station typically',
            'populates only the metrics that apply to it (e.g. an EMBALSE populates volume thresholds;',
            'a river gauge populates level/flow).',
        ].join(' '),
        type: StationThresholdSnapshotDto,
        nullable: true,
    })
    threshold: StationThresholdSnapshotDto | null;

    @ApiProperty({ description: 'Latitude', nullable: true, example: 40.1234 })
    latitude: number | null;

    @ApiProperty({ description: 'Longitude', nullable: true, example: -4.5678 })
    longitude: number | null;

    @ApiProperty({ description: 'Altitude (m)', nullable: true, example: 550.0 })
    altitude: number | null;

    @ApiProperty({ description: 'Municipality', nullable: true, example: 'Sacedón' })
    municipio: string | null;

    @ApiProperty({ description: 'Province', nullable: true, example: 'Guadalajara' })
    provincia: string | null;

    @ApiProperty({ description: 'Autonomous community', nullable: true, example: 'Castilla La Mancha' })
    ccaa: string | null;

    @ApiProperty({ description: 'Station type code (SAIH)', nullable: true, example: 'AC' })
    tipoCod: string | null;

    @ApiProperty({ description: 'SAIH zone', nullable: true, example: 'CABECERA' })
    zona: string | null;

    @ApiProperty({ description: 'Exploitation zone ogc_fid', nullable: true, example: 2 })
    zonaExplOgcFid: number | null;

    @ApiProperty({ description: 'Exploitation zone name', nullable: true, example: 'ZONA 2' })
    zonaExplNombre: string | null;

    @ApiProperty({ description: 'Agricultural district (comarca)', nullable: true, example: 'TALAVERA DE LA REINA' })
    comarcaName: string | null;

    @ApiProperty({ description: 'Water system name', nullable: true, example: 'CABECERA' })
    sistemaName: string | null;

    @ApiProperty({ description: 'AEMET meteoalert zone code', nullable: true, example: '670502' })
    meteoalertaZonaCode: string | null;

    @ApiProperty({ description: 'AEMET meteoalert zone name', nullable: true, example: 'Sistema Central de Ávila' })
    meteoalertaZonaNombre: string | null;

    @ApiProperty({ description: 'Station description', nullable: true, example: 'Estación aforo tramo alto' })
    description: string | null;

    @ApiProperty({ description: 'Whether the station is active', example: true })
    isActive: boolean;

    @ApiProperty({ description: 'Station creation timestamp', nullable: true, example: '2026-03-12T00:00:00.000Z' })
    createdAt: Date | string | null;

    @ApiProperty({ description: 'Station last update timestamp', nullable: true, example: '2026-03-12T00:00:00.000Z' })
    updatedAt: Date | string | null;
}

export class PredictionWithResultsDto {
    @ApiProperty({ description: 'Prediction unique identifier' })
    id: string;

    @ApiProperty({ description: 'Station code — canonical SAIH identifier', example: 'AR71' })
    stationId: string;

    @ApiProperty({ description: 'Station name (denormalized copy)', nullable: true, example: 'Embalse del Tranco' })
    stationName: string | null;

    @ApiProperty({
        description:
            'Full station snapshot resolved from ms-hydro-api by stationCode. Null when the station is not found in the hydro-api catalog (e.g. legacy stations or catalog fetch failure).',
        type: PredictionStationDto,
        nullable: true,
    })
    station: PredictionStationDto | null;

    @ApiProperty({ description: 'Prediction type identifier (UUID)' })
    predictionTypeId: string;

    @ApiProperty({ description: 'Prediction type name', nullable: true, example: 'Q.NAM.forecast' })
    predictionTypeName: string | null;

    @ApiProperty({ description: 'Prediction type unit', nullable: true, example: 'm3/s' })
    predictionTypeUnit: string | null;

    @ApiProperty({ description: 'Ensemble percentile (null when not applicable)', nullable: true, example: 50 })
    percentile: number | null;

    @ApiProperty({ description: 'Prediction provider', nullable: true, example: 'aemet' })
    predictionProvider: string | null;

    @ApiProperty({ description: 'Model instance that produced this prediction', nullable: true, example: 'mod-1' })
    predictedBy: string | null;

    @ApiProperty({
        description: 'Reference forecast date (ISO 8601)',
        nullable: true,
        example: '2026-07-10T00:00:00.000Z',
    })
    predictionDate: Date | null;

    @ApiProperty({
        description: 'Start of the prediction time window (ISO 8601)',
        nullable: true,
        example: '2026-07-10T00:00:00.000Z',
    })
    predictionStartDate: Date | null;

    @ApiProperty({
        description: 'End of the prediction time window (ISO 8601)',
        nullable: true,
        example: '2026-07-13T00:00:00.000Z',
    })
    predictionEndDate: Date | null;

    @ApiProperty({
        description:
            'Ordered time-series entries (date ASC). Only present when the request includes `?withResults=true`. When absent, the summary fields `max` and `last` still convey the peak and latest values of the underlying series.',
        type: [PredictionResultItemDto],
        required: false,
    })
    results?: PredictionResultItemDto[];

    @ApiProperty({
        description:
            'Result entry with the highest value across results[]. Ties resolve to the earliest occurrence (results are date ASC). Null when the prediction has no results.',
        type: PredictionResultItemDto,
        nullable: true,
        example: { date: '2026-07-10T02:00:00.000Z', value: 173.9, flag: 0 },
    })
    max: PredictionResultItemDto | null;

    @ApiProperty({
        description:
            'Chronologically last result entry (highest date in results[]). Null when the prediction has no results.',
        type: PredictionResultItemDto,
        nullable: true,
        example: { date: '2026-07-13T00:00:00.000Z', value: 118.6, flag: 0 },
    })
    last: PredictionResultItemDto | null;
}

export class SimulationIdentityDto {
    @ApiProperty({ description: 'Simulation unique identifier' })
    id: string;

    @ApiProperty({ description: 'Simulation date in YYYYMMDDHHMMSS format', example: '20260710120000' })
    simulationDate: string;

    @ApiProperty({
        description: 'Current simulation status',
        enum: ['CREATED', 'MODEL_PROCESSING', 'IN_PROGRESS', 'FINALIZED', 'MODEL_FAILED'],
        example: 'FINALIZED',
    })
    status: string;

    @ApiProperty({ description: 'Simulation type', example: 'MANUAL' })
    type: string;

    @ApiProperty({
        description: 'Data origin used for the run',
        nullable: true,
        enum: ['HISTORICAL', 'FORECAST'],
        example: 'FORECAST',
    })
    dataOrigin: string | null;

    @ApiProperty({ description: 'Creation timestamp' })
    createdAt: Date | undefined;

    @ApiProperty({ description: 'Last update timestamp' })
    updatedAt: Date | undefined;
}

export class GetSimulationResultsResponseDto {
    @ApiProperty({ description: 'Simulation identity and current status', type: SimulationIdentityDto })
    simulation: SimulationIdentityDto;

    @ApiProperty({
        description:
            'Predictions ordered by (stationId ASC, predictionTypeId ASC), each with its time-series results ordered by date ASC',
        type: [PredictionWithResultsDto],
    })
    predictions: PredictionWithResultsDto[];
}
