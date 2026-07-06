import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────
// CreateManeuver
// ─────────────────────────────────────────────────────────────

export class CreateManeuverRequestDto {
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

// ─────────────────────────────────────────────────────────────
// UpdateManeuver
// ─────────────────────────────────────────────────────────────

export class UpdateManeuverRequestDto {
    @ApiProperty({ description: 'Reservoir SAIH code', example: 'AR01', required: false })
    @IsOptional()
    @IsString()
    reservoirCode?: string;

    @ApiProperty({ description: 'Output flow value (m³/s)', example: 14.0, required: false, minimum: 0 })
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

// ─────────────────────────────────────────────────────────────
// ListManeuvers
// ─────────────────────────────────────────────────────────────

export class ListManeuversQueryDto {
    @ApiProperty({ description: 'Filter by reservoir code (exact match)', required: false, example: 'AR01' })
    @IsOptional()
    @IsString()
    reservoirCode?: string;

    @ApiProperty({ description: 'Page (1-based)', required: false, default: 1, example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiProperty({ description: 'Items per page', required: false, default: 20, example: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────

export class ManeuverResponseDto {
    @ApiProperty({ description: 'Maneuver unique identifier' }) id: string;
    @ApiProperty({ description: 'Reservoir SAIH code', example: 'AR01' }) reservoirCode: string;
    @ApiProperty({ description: 'Output flow value (m³/s)', example: 12.5 }) outputFlowValue: number;
    @ApiProperty({ description: 'Maneuver start date (ISO 8601)', nullable: true }) startDate: Date | null;
    @ApiProperty({ description: 'Maneuver end date (ISO 8601)', nullable: true }) endDate: Date | null;
    @ApiProperty({ description: 'Creation timestamp' }) createdAt: Date | undefined;
    @ApiProperty({ description: 'Last update timestamp' }) updatedAt: Date | undefined;
}

export class ListManeuversResponseDto {
    @ApiProperty({ type: [ManeuverResponseDto] }) data: ManeuverResponseDto[];
    @ApiProperty({ example: 1 }) total: number;
    @ApiProperty({ example: 1 }) page: number;
    @ApiProperty({ example: 20 }) limit: number;
}

export class DeleteManeuverResponseDto {
    @ApiProperty({ description: 'Deleted maneuver id' }) id: string;
    @ApiProperty({ example: true }) deleted: boolean;
}
