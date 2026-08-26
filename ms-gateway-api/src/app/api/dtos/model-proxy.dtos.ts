import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Mirrors ProviderType in ms-model-api. Kept explicit so the gateway rejects a typo. */
export const PROVIDER_TYPES = ['FEWS_API', 'SFTP_FILE', 'CSV_FILE', 'WISKI_API'] as const;

// ─────────────────────────────────────────────────────────────
// CreateProviderConfig
// ─────────────────────────────────────────────────────────────

export class CreateProviderConfigGwRequestDto {
    @ApiProperty({ description: 'Provider name (unique)', example: 'WISKI Observados (API)' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    name: string;

    @ApiProperty({ description: 'Provider type', enum: PROVIDER_TYPES, example: 'WISKI_API' })
    @IsNotEmpty()
    @IsIn(PROVIDER_TYPES as unknown as string[])
    type: string;

    @ApiProperty({ description: 'Base URL of the upstream source', example: 'https://apisaih.saihchtajo.es' })
    @IsNotEmpty()
    @IsString()
    baseUrl: string;

    @ApiProperty({ description: 'Polling interval in minutes (min 5)', example: 60 })
    @IsNotEmpty()
    @IsNumber()
    @Min(5)
    pollingIntervalMinutes: number;

    @ApiProperty({
        description: 'Type-specific settings',
        example: { endpointPath: '/wiski/tagus_flowcast_observado/', sourceTimezone: 'Europe/Madrid' },
        required: false,
    })
    @IsOptional()
    @IsObject()
    settings?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// UpdateProviderConfig
// ─────────────────────────────────────────────────────────────

/**
 * Deliberately without `isActive`: ms-model-api's update DTO does not accept it
 * and runs with forbidNonWhitelisted, so advertising it here would hand callers
 * a field that 400s. Activation goes through PATCH /toggle.
 */
export class UpdateProviderConfigGwRequestDto {
    @ApiProperty({ required: false, example: 'WISKI Observados (API)' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    name?: string;

    @ApiProperty({ required: false, enum: PROVIDER_TYPES })
    @IsOptional()
    @IsIn(PROVIDER_TYPES as unknown as string[])
    type?: string;

    @ApiProperty({ required: false, example: 'https://apisaih.saihchtajo.es' })
    @IsOptional()
    @IsString()
    baseUrl?: string;

    @ApiProperty({ required: false, example: 60 })
    @IsOptional()
    @IsNumber()
    @Min(5)
    pollingIntervalMinutes?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsObject()
    settings?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────

export class ProviderConfigGwResponseDto {
    @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
    id: string;

    @ApiProperty({ example: 'WISKI Observados (API)' })
    name: string;

    @ApiProperty({ enum: PROVIDER_TYPES, example: 'WISKI_API' })
    type: string;

    @ApiProperty({ example: 'https://apisaih.saihchtajo.es' })
    baseUrl: string;

    @ApiProperty({ example: 60 })
    pollingIntervalMinutes: number;

    @ApiProperty({ example: false })
    isActive: boolean;

    @ApiProperty({ example: { endpointPath: '/wiski/tagus_flowcast_observado/' } })
    settings: Record<string, unknown>;

    @ApiProperty({ example: '2026-08-25T10:00:00.000Z' })
    createdAt: string;

    @ApiProperty({ example: '2026-08-25T10:00:00.000Z' })
    updatedAt: string;
}

export class ListProviderConfigsGwResponseDto {
    // Key kept as ms-model-api spells it: this is a pass-through proxy, and a
    // prettier name here would be a lie about the payload the client receives.
    @ApiProperty({ type: [ProviderConfigGwResponseDto] })
    providerConfigs: ProviderConfigGwResponseDto[];
}

export class IngestionRunGwResponseDto {
    @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
    id: string;

    @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
    providerConfigId: string;

    @ApiProperty({ enum: ['RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL'], example: 'SUCCESS' })
    status: string;

    @ApiProperty({ example: '2026-08-25T10:00:00.000Z' })
    startedAt: string;

    @ApiProperty({ example: '2026-08-25T10:00:12.000Z', nullable: true })
    completedAt: string | null;

    @ApiProperty({ example: 456 })
    seriesCount: number;

    @ApiProperty({ example: 267510 })
    eventsCount: number;

    @ApiProperty({ example: null, nullable: true })
    errorMessage: string | null;
}

export class ListIngestionRunsGwResponseDto {
    @ApiProperty({ type: [IngestionRunGwResponseDto] })
    runs: IngestionRunGwResponseDto[];
}

