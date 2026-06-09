import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { ProviderType } from '@domain/types/provider-type.enum';

// ─────────────────────────────────────────────────────────────
// CreateProviderConfig
// ─────────────────────────────────────────────────────────────

export class CreateProviderConfigRequestDto {
    @ApiProperty({
        description: 'Provider name',
        example: 'Harmonie Pluviometría',
    })
    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    name: string;

    @ApiProperty({
        description: 'Provider type',
        example: 'SFTP_FILE',
        enum: ProviderType,
    })
    @IsNotEmpty()
    @IsString()
    @IsEnum(ProviderType)
    type: string;

    @ApiProperty({
        description: 'Base URL of the provider',
        example: 'http://ms-sftp-api:3003',
    })
    @IsNotEmpty()
    @IsString()
    baseUrl: string;

    @ApiProperty({
        description: 'Polling interval in minutes',
        example: 60,
    })
    @IsNotEmpty()
    @IsNumber()
    @Min(5)
    pollingIntervalMinutes: number;

    @ApiProperty({
        description: 'Additional provider settings',
        example: { filePath: 'predicciones/pluvio', filePrefix: 'Harmonie' },
        required: false,
        default: {},
    })
    @IsOptional()
    @IsObject()
    settings?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// UpdateProviderConfig
// ─────────────────────────────────────────────────────────────

export class UpdateProviderConfigRequestDto {
    @ApiProperty({
        description: 'Provider name',
        example: 'EPS Pluviometría',
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    name?: string;

    @ApiProperty({
        description: 'Provider type',
        example: 'SFTP_FILE',
        enum: ProviderType,
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsEnum(ProviderType)
    type?: string;

    @ApiProperty({
        description: 'Base URL of the provider',
        example: 'http://ms-sftp-api:3003',
        required: false,
    })
    @IsOptional()
    @IsString()
    baseUrl?: string;

    @ApiProperty({
        description: 'Polling interval in minutes',
        example: 60,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(5)
    pollingIntervalMinutes?: number;

    @ApiProperty({
        description: 'Additional provider settings',
        example: { filePath: 'predicciones/pluvio', filePrefix: 'EPS' },
        required: false,
    })
    @IsOptional()
    @IsObject()
    settings?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// ProviderConfigResponse
// ─────────────────────────────────────────────────────────────

export class ProviderConfigResponseDto {
    @ApiProperty({
        description: 'Provider config ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Provider name',
        example: 'Harmonie Pluviometría',
    })
    name: string;

    @ApiProperty({
        description: 'Provider type',
        example: 'SFTP_FILE',
    })
    type: string;

    @ApiProperty({
        description: 'Base URL of the provider',
        example: 'http://ms-sftp-api:3003',
    })
    baseUrl: string;

    @ApiProperty({
        description: 'Polling interval in minutes',
        example: 60,
    })
    pollingIntervalMinutes: number;

    @ApiProperty({
        description: 'Whether the provider is active',
        example: false,
    })
    isActive: boolean;

    @ApiProperty({
        description: 'Additional provider settings',
        example: { filePath: 'predicciones/pluvio', filePrefix: 'Harmonie' },
    })
    settings: Record<string, unknown>;

    @ApiProperty({
        description: 'Creation timestamp',
        example: '2026-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Last update timestamp',
        example: '2026-01-01T00:00:00.000Z',
    })
    updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// ListProviderConfigs
// ─────────────────────────────────────────────────────────────

export class ListProviderConfigsResponseDto {
    @ApiProperty({
        description: 'List of all provider configurations',
        type: [ProviderConfigResponseDto],
    })
    providerConfigs: ProviderConfigResponseDto[];
}

// ─────────────────────────────────────────────────────────────
// TriggerIngestion
// ─────────────────────────────────────────────────────────────

export class TriggerIngestionResponseDto {
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
        example: 'SUCCESS',
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
        example: 1055,
    })
    seriesCount: number;

    @ApiProperty({
        description: 'Number of events ingested',
        example: 254255,
    })
    eventsCount: number;

    @ApiProperty({
        description: 'Error message if the run failed',
        example: null,
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
// DeleteProviderConfig
// ─────────────────────────────────────────────────────────────

export class DeleteProviderConfigResponseDto {
    @ApiProperty({
        description: 'Success message',
        example: 'Provider config deleted successfully',
    })
    message: string;
}
