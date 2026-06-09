import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────
// CreateBasin
// ─────────────────────────────────────────────────────────────

export class CreateBasinRequestDto {
    @ApiProperty({
        description: 'Basin name',
        example: 'Río Negro',
    })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({
        description: 'Basin code',
        example: 'RN-001',
    })
    @IsNotEmpty()
    @IsString()
    code: string;

    @ApiProperty({
        description: 'Optional basin description',
        example: 'Cuenca del Río Negro',
        required: false,
    })
    @IsOptional()
    @IsString()
    description?: string;
}

export class CreateBasinResponseDto {
    @ApiProperty({
        description: 'Basin ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Basin name',
        example: 'Río Negro',
    })
    name: string;

    @ApiProperty({
        description: 'Basin code',
        example: 'RN-001',
    })
    code: string;

    @ApiProperty({
        description: 'Basin description',
        example: 'Cuenca del Río Negro',
        nullable: true,
    })
    description: string | null;

    @ApiProperty({
        description: 'Whether the basin is active',
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
// ListBasins
// ─────────────────────────────────────────────────────────────

export class ListBasinsRequestDto {
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

    @ApiProperty({ description: 'Filter by active status', required: false })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    isActive?: boolean;
}

export class ListBasinsResponseDto {
    @ApiProperty({ description: 'List of basins', type: [CreateBasinResponseDto] })
    items: CreateBasinResponseDto[];

    @ApiProperty({ description: 'Total number of matching basins', example: 42 })
    total: number;
}

// ─────────────────────────────────────────────────────────────
// GetBasin (with sub-basins)
// ─────────────────────────────────────────────────────────────

export class GetBasinSubBasinItemDto {
    @ApiProperty({ description: 'Sub-basin ID' })
    id: string;

    @ApiProperty({ description: 'Sub-basin name' })
    name: string;

    @ApiProperty({ description: 'Sub-basin code' })
    code: string;

    @ApiProperty({ description: 'Whether the sub-basin is active' })
    isActive: boolean;
}

export class GetBasinResponseDto extends CreateBasinResponseDto {
    @ApiProperty({ description: 'Sub-basins in this basin', type: [GetBasinSubBasinItemDto] })
    subBasins: GetBasinSubBasinItemDto[];
}

// ─────────────────────────────────────────────────────────────
// UpdateBasin
// ─────────────────────────────────────────────────────────────

export class UpdateBasinRequestDto {
    @ApiProperty({ description: 'Basin name', example: 'Río Negro', required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ description: 'Basin code', example: 'RN-001', required: false })
    @IsOptional()
    @IsString()
    code?: string;

    @ApiProperty({ description: 'Basin description', required: false, nullable: true })
    @IsOptional()
    @IsString()
    description?: string | null;
}

export class UpdateBasinResponseDto extends CreateBasinResponseDto {}

// ─────────────────────────────────────────────────────────────
// ToggleBasin
// ─────────────────────────────────────────────────────────────

export class ToggleBasinResponseDto {
    @ApiProperty({ description: 'Basin ID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Basin name', example: 'Río Negro' })
    name: string;

    @ApiProperty({ description: 'Basin code', example: 'RN-001' })
    code: string;

    @ApiProperty({ description: 'Whether the basin is active', example: false })
    isActive: boolean;

    @ApiProperty({ description: 'Last update timestamp', example: '2026-03-12T00:00:00.000Z' })
    updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// DeleteBasin
// ─────────────────────────────────────────────────────────────

export class DeleteBasinResponseDto extends ToggleBasinResponseDto {}
