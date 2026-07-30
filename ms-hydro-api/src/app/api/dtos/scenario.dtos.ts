import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────
// CreateScenario
// ─────────────────────────────────────────────────────────────

export class CreateScenarioRequestDto {
    @ApiProperty({ description: 'Scenario name / filename', example: 'sample-stations' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ description: 'Optional description', example: 'Escenario de prueba con estaciones ficticias', required: false, nullable: true })
    @IsOptional()
    @IsString()
    description?: string | null;

    @ApiProperty({
        description: 'Raw JSON payload stored verbatim (e.g. { items: [...] }). Not processed nor related to stations.',
        type: 'object',
        additionalProperties: true,
        example: { items: [{ stationCode: 'AR50', name: 'Río Ejemplo' }] },
    })
    @IsNotEmpty()
    @IsObject()
    payload: Record<string, unknown>;
}

export class ScenarioMetadataResponseDto {
    @ApiProperty({ description: 'Scenario ID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Scenario name', example: 'sample-stations' })
    name: string;

    @ApiProperty({ description: 'Scenario description', example: 'Escenario de prueba', nullable: true })
    description: string | null;

    @ApiProperty({ description: 'Number of items in payload.items (0 if absent)', example: 3 })
    itemsCount: number;

    @ApiProperty({ description: 'Payload size in bytes', example: 370245 })
    sizeBytes: number;

    @ApiProperty({ description: 'Creation timestamp', example: '2026-07-30T00:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ description: 'Last update timestamp', example: '2026-07-30T00:00:00.000Z' })
    updatedAt: Date;
}

export class CreateScenarioResponseDto extends ScenarioMetadataResponseDto {}

// ─────────────────────────────────────────────────────────────
// ListScenarios
// ─────────────────────────────────────────────────────────────

export class ListScenariosRequestDto {
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
}

export class ListScenariosResponseDto {
    @ApiProperty({ description: 'List of scenarios (metadata only, no payload)', type: [ScenarioMetadataResponseDto] })
    items: ScenarioMetadataResponseDto[];

    @ApiProperty({ description: 'Total number of scenarios', example: 5 })
    total: number;
}

// ─────────────────────────────────────────────────────────────
// GetScenario (metadata + payload)
// ─────────────────────────────────────────────────────────────

export class GetScenarioResponseDto extends ScenarioMetadataResponseDto {
    @ApiProperty({
        description: 'Raw JSON payload stored verbatim',
        type: 'object',
        additionalProperties: true,
        example: { items: [{ stationCode: 'AR50' }] },
    })
    payload: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// DeleteScenario
// ─────────────────────────────────────────────────────────────

export class DeleteScenarioResponseDto {
    @ApiProperty({ description: 'Deleted scenario ID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Whether the scenario was deleted', example: true })
    deleted: boolean;
}
