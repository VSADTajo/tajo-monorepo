import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
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
