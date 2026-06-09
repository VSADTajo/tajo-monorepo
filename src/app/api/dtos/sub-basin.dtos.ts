import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { StationThresholdDto } from './station.dtos';

// ─────────────────────────────────────────────────────────────
// CreateSubBasin
// ─────────────────────────────────────────────────────────────

export class CreateSubBasinRequestDto {
    @ApiProperty({
        description: 'Sub-basin name',
        example: 'Río Negro Alto',
    })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({
        description: 'Sub-basin code',
        example: 'RNA-001',
    })
    @IsNotEmpty()
    @IsString()
    code: string;

    @ApiProperty({
        description: 'Parent basin ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsNotEmpty()
    @IsUUID()
    basinId: string;

    @ApiProperty({
        description: 'Optional sub-basin description',
        example: 'Sub-cuenca del tramo alto del Río Negro',
        required: false,
    })
    @IsOptional()
    @IsString()
    description?: string;
}

export class CreateSubBasinResponseDto {
    @ApiProperty({
        description: 'Sub-basin ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Sub-basin name',
        example: 'Río Negro Alto',
    })
    name: string;

    @ApiProperty({
        description: 'Sub-basin code',
        example: 'RNA-001',
    })
    code: string;

    @ApiProperty({
        description: 'Parent basin ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    basinId: string;

    @ApiProperty({
        description: 'Parent basin name',
        example: 'Cabecera',
        nullable: true,
    })
    basinName: string | null;

    @ApiProperty({
        description: 'Sub-basin description',
        example: 'Sub-cuenca del tramo alto del Río Negro',
        nullable: true,
    })
    description: string | null;

    @ApiProperty({
        description: 'Area in km²',
        example: 1234.56,
        nullable: true,
    })
    area: number | null;

    @ApiProperty({
        description: 'Perimeter in km',
        example: 234.78,
        nullable: true,
    })
    perimetro: number | null;

    @ApiProperty({
        description: 'Centroid X coordinate (longitude)',
        example: -2.345,
        nullable: true,
    })
    centroidX: number | null;

    @ApiProperty({
        description: 'Centroid Y coordinate (latitude)',
        example: 40.123,
        nullable: true,
    })
    centroidY: number | null;

    @ApiProperty({
        description: 'Whether the sub-basin is active',
        example: true,
    })
    isActive: boolean;

    @ApiProperty({
        description: 'Creation timestamp',
        example: '2026-03-12T00:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Last update timestamp',
        example: '2026-03-12T00:00:00.000Z',
    })
    updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// ListSubBasins
// ─────────────────────────────────────────────────────────────

export class ListSubBasinsRequestDto {
    @ApiProperty({ description: 'Page number', example: 1, required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    page?: number;

    @ApiProperty({ description: 'Items per page', example: 10, required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit?: number;

    @ApiProperty({ description: 'Filter by basin ID', required: false })
    @IsOptional()
    @IsUUID()
    basinId?: string;

    @ApiProperty({ description: 'Filter by active status', required: false })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    isActive?: boolean;
}

export class ListSubBasinsResponseDto {
    @ApiProperty({ description: 'List of sub-basins', type: [CreateSubBasinResponseDto] })
    items: CreateSubBasinResponseDto[];

    @ApiProperty({ description: 'Total number of matching sub-basins', example: 42 })
    total: number;
}

// ─────────────────────────────────────────────────────────────
// GetSubBasin (with stations)
// ─────────────────────────────────────────────────────────────

export class GetSubBasinStationItemDto {
    @ApiProperty({ description: 'Station ID' })
    id: string;

    @ApiProperty({ description: 'Station name' })
    name: string;

    @ApiProperty({ description: 'Sub-basin name' })
    subBasinName: string;

    @ApiProperty({ description: 'Station code' })
    stationCode: string;

    @ApiProperty({ description: 'Station type' })
    stationType: string;

    @ApiProperty({ description: 'Station threshold data', nullable: true })
    threshold: StationThresholdDto | null;

    @ApiProperty({ description: 'Whether the station is active' })
    isActive: boolean;
}

export class GetSubBasinResponseDto extends CreateSubBasinResponseDto {
    @ApiProperty({ description: 'Stations in this sub-basin', type: [GetSubBasinStationItemDto] })
    stations: GetSubBasinStationItemDto[];
}

// ─────────────────────────────────────────────────────────────
// UpdateSubBasin
// ─────────────────────────────────────────────────────────────

export class UpdateSubBasinRequestDto {
    @ApiProperty({ description: 'Sub-basin name', example: 'Río Negro Alto', required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ description: 'Sub-basin code', example: 'RNA-001', required: false })
    @IsOptional()
    @IsString()
    code?: string;

    @ApiProperty({ description: 'Description', required: false, nullable: true })
    @IsOptional()
    @IsString()
    description?: string | null;
}

export class UpdateSubBasinResponseDto extends CreateSubBasinResponseDto {}

// ─────────────────────────────────────────────────────────────
// ToggleSubBasin
// ─────────────────────────────────────────────────────────────

export class ToggleSubBasinResponseDto {
    @ApiProperty({ description: 'Sub-basin ID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Sub-basin name', example: 'Río Negro Alto' })
    name: string;

    @ApiProperty({ description: 'Sub-basin code', example: 'RNA-001' })
    code: string;

    @ApiProperty({ description: 'Whether the sub-basin is active', example: false })
    isActive: boolean;

    @ApiProperty({ description: 'Last update timestamp', example: '2026-03-12T00:00:00.000Z' })
    updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// DeleteSubBasin
// ─────────────────────────────────────────────────────────────

export class DeleteSubBasinResponseDto extends ToggleSubBasinResponseDto {}
