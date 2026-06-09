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
