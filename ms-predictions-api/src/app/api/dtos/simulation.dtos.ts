import { ApiProperty } from '@nestjs/swagger';
import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsEnum,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
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
            'Meteorological forcing to use when building the SFTP input file. ' +
            'HARMONIE → Q.NAM.harmonie, EPS → Q.NAM.ens, BOTH → both files (tagus_harmonie_Q_*.json and tagus_eps_Q_*.json).',
        enum: ModmeteoChoice,
        example: ModmeteoChoice.BOTH,
    })
    @IsEnum(ModmeteoChoice)
    modmeteo: ModmeteoChoice;

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
