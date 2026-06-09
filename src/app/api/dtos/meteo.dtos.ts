import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

// ─────────────────────────────────────────────────────────────
// Filter (used by both GET /meteo/info and POST /meteo/sync)
// ─────────────────────────────────────────────────────────────

export class MeteoFilterQueryDto {
    @ApiPropertyOptional({ description: 'Filter by provider name (case-insensitive)', example: 'harmonie' })
    @IsOptional()
    @IsString()
    provider?: string;

    @ApiPropertyOptional({ description: 'Filter by variable name. Requires provider.', example: 'Precipitacion' })
    @ValidateIf((dto: MeteoFilterQueryDto) => dto.variable !== undefined)
    @IsString()
    variable?: string;
}

// ─────────────────────────────────────────────────────────────
// MeteoInfo response shape
// ─────────────────────────────────────────────────────────────

export class MeteoBboxDto {
    @ApiProperty({ example: -7.5438 }) minX: number;
    @ApiProperty({ example: 38.7845 }) minY: number;
    @ApiProperty({ example: -1.4508 }) maxX: number;
    @ApiProperty({ example: 41.3045 }) maxY: number;
}

export class MeteoInfoBodyDto {
    @ApiProperty({ example: 'Precipitación' }) nombre: string;
    @ApiProperty({ example: '2026-04-04T19:00:00Z' }) fechaInicio: string;
    @ApiProperty({ example: '2026-04-06T18:00:00Z' }) fechaFin: string;
    @ApiProperty({ example: 60, description: 'Time step in minutes' }) pasoDeTiempo: number;
    @ApiProperty({ example: 'mm' }) unidad: string;
    @ApiProperty({ example: 677 }) ncols: number;
    @ApiProperty({ example: 280 }) nrows: number;
    @ApiProperty({ type: MeteoBboxDto }) bbox: MeteoBboxDto;
    @ApiProperty({ example: 0.009 }) cellsize: number;
    @ApiProperty({ example: -999 }) nodata: number;
}

export class MeteoLastRunDto {
    @ApiProperty({ nullable: true, example: '2026-04-06T18:00:00Z' }) startedAt: string | null;
    @ApiProperty({ nullable: true, example: '2026-04-06T18:02:14Z' }) finishedAt: string | null;
    @ApiProperty({ example: 'ok', enum: ['running', 'ok', 'partial', 'failed', 'noop'] }) status: string;
    @ApiProperty({ example: 48 }) filesOk: number;
    @ApiProperty({ example: 0 }) filesFailed: number;
}

export class MeteoInfoResponseDto {
    @ApiProperty({ example: 'HARMONIE' }) provider: string;
    @ApiProperty({ nullable: true, example: 'Precipitacion' }) variable: string | null;
    @ApiProperty({ example: 'tajo:harmonie_precipitacion' }) layerName: string;
    @ApiProperty({ type: MeteoInfoBodyDto }) info: MeteoInfoBodyDto;
    @ApiProperty({ type: MeteoLastRunDto, nullable: true }) lastRun: MeteoLastRunDto | null;
}

// ─────────────────────────────────────────────────────────────
// MeteoProviders response shape
// ─────────────────────────────────────────────────────────────

export class MeteoProviderResponseDto {
    @ApiProperty({ example: 'HARMONIE' }) provider: string;
    @ApiProperty({ type: [String], example: ['Precipitacion', 'Temperatura'] }) variables: string[];
}

// ─────────────────────────────────────────────────────────────
// Sync response shape
// ─────────────────────────────────────────────────────────────

export class DatasetSyncResultDto {
    @ApiProperty({ example: 'HARMONIE' }) provider: string;
    @ApiProperty({ nullable: true, example: 'Precipitacion' }) variable: string | null;
    @ApiProperty({ example: 'ok', enum: ['ok', 'partial', 'failed', 'noop'] }) status: string;
    @ApiProperty({ example: 48 }) filesOk: number;
    @ApiProperty({ example: 0 }) filesFailed: number;
    @ApiProperty({ nullable: true, example: '550e8400-e29b-41d4-a716-446655440000' }) runId: string | null;
}

export class SyncResultDto {
    @ApiProperty({ example: 'manual', enum: ['cron', 'manual'] }) triggeredBy: string;
    @ApiProperty({ type: [DatasetSyncResultDto] }) datasets: DatasetSyncResultDto[];
}

// ─────────────────────────────────────────────────────────────
// Accumulate (on-demand range accumulation)
// ─────────────────────────────────────────────────────────────

export class AccumulateRequestDto {
    @ApiProperty({ description: 'Provider name (case-insensitive)', example: 'harmonie' })
    @IsNotEmpty()
    @IsString()
    provider: string;

    @ApiPropertyOptional({
        description: 'Variable name. Required if provider has multiple variables.',
        example: 'Precipitacion',
    })
    @IsOptional()
    @IsString()
    variable?: string;

    @ApiProperty({ description: 'Start datetime (inclusive) ISO 8601', example: '2026-05-01T06:00:00Z' })
    @IsNotEmpty()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}T/, { message: 'from must be a full ISO 8601 datetime (e.g. 2026-05-01T06:00:00Z)' })
    from: string;

    @ApiProperty({ description: 'End datetime (inclusive) ISO 8601', example: '2026-05-10T18:00:00Z' })
    @IsNotEmpty()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}T/, { message: 'to must be a full ISO 8601 datetime (e.g. 2026-05-10T18:00:00Z)' })
    to: string;
}

export class AccumulateResponseDto {
    @ApiProperty({ example: 'HARMONIE' }) provider: string;
    @ApiProperty({ nullable: true, example: 'Precipitacion' }) variable: string | null;
    @ApiProperty({ example: 'tajo:harmonie_precipitacion_acumulado' }) layerName: string;
    @ApiProperty({ example: '2026-05-01T00:00:00.000Z' }) from: string;
    @ApiProperty({ example: '2026-05-10T00:00:00.000Z' }) to: string;
    @ApiProperty({ example: 240 }) filesUsed: number;
}

// ─────────────────────────────────────────────────────────────
// AccumulateMap (WMS proxy)
// ─────────────────────────────────────────────────────────────

export class AccumulateMapQueryDto {
    @ApiProperty({ description: 'Provider name (case-insensitive)', example: 'harmonie' })
    @IsNotEmpty()
    @IsString()
    provider: string;

    @ApiPropertyOptional({
        description: 'Variable name. Required if provider has multiple variables.',
        example: 'Precipitacion',
    })
    @IsOptional()
    @IsString()
    variable?: string;

    @ApiProperty({ description: 'Start datetime (inclusive) ISO 8601', example: '2026-05-01T06:00:00Z' })
    @IsNotEmpty()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}T/, { message: 'from must be a full ISO 8601 datetime (e.g. 2026-05-01T06:00:00Z)' })
    from: string;

    @ApiProperty({ description: 'End datetime (inclusive) ISO 8601', example: '2026-05-10T18:00:00Z' })
    @IsNotEmpty()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}T/, { message: 'to must be a full ISO 8601 datetime (e.g. 2026-05-10T18:00:00Z)' })
    to: string;

    // WMS passthrough params (forwarded verbatim to GeoServer)
    @ApiPropertyOptional() @IsOptional() @IsString() SERVICE?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() VERSION?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() REQUEST?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() BBOX?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() WIDTH?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() HEIGHT?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() SRS?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() CRS?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() FORMAT?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() STYLES?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() TRANSPARENT?: string;
}
