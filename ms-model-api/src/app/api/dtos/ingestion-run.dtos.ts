import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

// ─────────────────────────────────────────────────────────────
// IngestionRunResponse
// ─────────────────────────────────────────────────────────────

export class IngestionRunResponseDto {
    @ApiProperty({
        description: 'Ingestion run ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Provider configuration ID',
        example: '550e8400-e29b-41d4-a716-446655440001',
    })
    providerConfigId: string;

    @ApiProperty({
        description: 'Ingestion run status',
        example: 'COMPLETED',
    })
    status: string;

    @ApiProperty({
        description: 'When the ingestion run started',
        example: '2026-03-11T10:00:00.000Z',
    })
    startedAt: Date;

    @ApiProperty({
        description: 'When the ingestion run completed',
        example: '2026-03-11T10:05:00.000Z',
        nullable: true,
    })
    completedAt: Date | null;

    @ApiProperty({
        description: 'Number of series ingested',
        example: 236,
    })
    seriesCount: number;

    @ApiProperty({
        description: 'Number of events ingested',
        example: 11564,
    })
    eventsCount: number;

    @ApiProperty({
        description: 'Error message if the run failed',
        example: 'Connection timeout',
        nullable: true,
    })
    errorMessage: string | null;

    @ApiProperty({
        description: 'Record creation timestamp',
        example: '2026-03-11T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Record last update timestamp',
        example: '2026-03-11T10:05:00.000Z',
    })
    updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// ListIngestionRuns
// ─────────────────────────────────────────────────────────────

export class ListIngestionRunsResponseDto {
    @ApiProperty({
        description: 'List of ingestion runs',
        type: [IngestionRunResponseDto],
    })
    runs: IngestionRunResponseDto[];
}

export class ListIngestionRunsQueryDto {
    @ApiProperty({
        description: 'Filter by provider configuration ID',
        example: '550e8400-e29b-41d4-a716-446655440001',
        required: false,
    })
    @IsOptional()
    @IsUUID()
    providerConfigId?: string;
}
