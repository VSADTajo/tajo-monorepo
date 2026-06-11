import { ApiProperty } from '@nestjs/swagger';
import {
    ArrayMinSize,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────
// ListSimulations
// ─────────────────────────────────────────────────────────────

export class ListSimulationsQueryDto {
    @ApiProperty({
        description: 'Filter by status',
        required: false,
        enum: ['CREATED', 'MODEL_PROCESSING', 'IN_PROGRESS', 'FINALIZED', 'MODEL_FAILED'],
    })
    @IsOptional()
    @IsString()
    status?: string;

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
