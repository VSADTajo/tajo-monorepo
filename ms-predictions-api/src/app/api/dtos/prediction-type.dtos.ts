import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// ─────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────

export class PredictionTypeItemDto {
    @ApiProperty({ description: 'Prediction type ID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Prediction type name', example: 'P.harmonie.forecast' })
    name: string;

    @ApiProperty({ description: 'Unit of measurement', example: 'mm' })
    unit: string;
}

// ─────────────────────────────────────────────────────────────
// ListPredictionTypes
// ─────────────────────────────────────────────────────────────

export class ListPredictionTypesResponseDto {
    @ApiProperty({
        description: 'List of prediction types',
        type: [PredictionTypeItemDto],
    })
    predictionTypes: PredictionTypeItemDto[];
}

// ─────────────────────────────────────────────────────────────
// ListStationPredictionTypes — coverage of ALL catalog types for a station
// ─────────────────────────────────────────────────────────────

export class StationTypeCoverageItemDto {
    @ApiProperty({ description: 'Prediction type ID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Prediction type name', example: 'P.harmonie.forecast' })
    name: string;

    @ApiProperty({ description: 'Unit of measurement', example: 'mm' })
    unit: string;

    @ApiProperty({
        description: 'Whether the station has any FINALIZED data for this type',
        example: true,
    })
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
// TypeCoverageMatrix — all stations × all types
// ─────────────────────────────────────────────────────────────

export class CoverageMatrixStationDto {
    @ApiProperty({ description: 'Station code', example: 'E_01' })
    stationCode: string;

    @ApiProperty({ description: 'Station name', example: 'Bolarque', nullable: true })
    stationName: string | null;

    @ApiProperty({
        description: 'Last ingestion per type, aligned by index with `types`; null = never entered',
        example: ['2026-07-10T08:15:00.000Z', null, '2026-07-08T06:00:00.000Z'],
        type: [String],
        nullable: true,
    })
    cells: (string | null)[];

    @ApiProperty({ description: 'How many types this station has data for', example: 3 })
    withData: number;
}

export class CoverageMatrixResponseDto {
    @ApiProperty({ description: 'ISO-8601 timestamp the matrix was built at', example: '2026-07-10T09:30:00.000Z' })
    generatedAt: string;

    @ApiProperty({
        description: 'Ordered catalog prediction types (matrix columns)',
        type: [PredictionTypeItemDto],
    })
    types: PredictionTypeItemDto[];

    @ApiProperty({
        description: 'One entry per station (matrix rows)',
        type: [CoverageMatrixStationDto],
    })
    stations: CoverageMatrixStationDto[];
}

// ─────────────────────────────────────────────────────────────
// CreatePredictionType
// ─────────────────────────────────────────────────────────────

export class CreatePredictionTypeRequestDto {
    @ApiProperty({ description: 'Prediction type name', example: 'P.harmonie.forecast' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ description: 'Unit of measurement', example: 'mm' })
    @IsNotEmpty()
    @IsString()
    unit: string;
}

export class CreatePredictionTypeResponseDto {
    @ApiProperty({ description: 'Prediction type ID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Prediction type name', example: 'P.harmonie.forecast' })
    name: string;

    @ApiProperty({ description: 'Unit of measurement', example: 'mm' })
    unit: string;
}
