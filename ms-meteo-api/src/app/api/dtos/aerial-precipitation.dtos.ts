import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────
// Shared enums
// ─────────────────────────────────────────────────────────────

export enum AerialPrecipLayerEnum {
    Sistema = 'sistema',
    Aemet = 'aemet',
    SubcNAM = 'subcNAM',
}

export enum AerialPrecipProviderEnum {
    Ens = 'ens',
    Harmonie = 'harmonie',
    Obs = 'obs',
}

export enum AerialPrecipAccumulationEnum {
    OneH = '1h',
    TwelveH = '12h',
    TwentyFourH = '24h',
}

export enum AerialPrecipStatEnum {
    Med = 'Med',
    Max = 'Max',
    None = 'none',
}

// ─────────────────────────────────────────────────────────────
// Shared response sub-DTOs
// ─────────────────────────────────────────────────────────────

export class AerialPrecipitationEventPointDto {
    @ApiProperty({ description: 'UTC timestamp of the event', example: '2026-07-21T01:00:00.000Z' })
    eventDate: string;

    @ApiProperty({ description: 'Precipitation value in mm', example: 0.9 })
    value: number;

    @ApiProperty({ description: 'FEWS quality flag (2 = approved)', example: 2 })
    flag: number;
}

export class AerialPrecipitationSeriesDto {
    @ApiProperty({ description: 'UUID primary key', example: 'a1b2c3d4-e5f6-...' })
    id: string;

    @ApiProperty({ description: 'FEWS locationId', example: 'Cuenca.NAM.E_08' })
    locationId: string;

    @ApiProperty({ description: 'FEWS parameterId', example: 'P.areal.ens.subcNAM.Med.24h' })
    parameterId: string;

    @ApiProperty({ description: 'Derived provider', example: 'ens', enum: AerialPrecipProviderEnum })
    provider: string;

    @ApiProperty({ description: 'Derived layer', example: 'subcNAM', enum: AerialPrecipLayerEnum })
    layer: string;

    @ApiPropertyOptional({
        description: 'Statistical aggregate type (ens only)',
        example: 'Med',
        nullable: true,
        enum: ['Med', 'Max'],
    })
    stat: string | null;

    @ApiProperty({ description: 'Derived accumulation', example: '24h', enum: AerialPrecipAccumulationEnum })
    accumulation: string;

    @ApiProperty({ description: 'Forecast run UTC datetime', example: '2026-07-21T00:00:00.000Z' })
    forecastDate: string;

    @ApiPropertyOptional({ nullable: true, example: '2026-07-21T01:00:00.000Z' })
    startDate: string | null;

    @ApiPropertyOptional({ nullable: true, example: '2026-07-24T01:00:00.000Z' })
    endDate: string | null;

    @ApiPropertyOptional({ nullable: true, example: 'Processing_Catchment_EPS' })
    moduleInstanceId: string | null;

    @ApiPropertyOptional({ nullable: true, example: 'CABECERA' })
    stationName: string | null;

    @ApiPropertyOptional({ nullable: true, example: 40.4721 })
    lat: number | null;

    @ApiPropertyOptional({ nullable: true, example: -2.4155 })
    lon: number | null;

    @ApiProperty({ description: 'Measurement units', example: 'mm' })
    units: string;

    @ApiProperty({ description: 'Time step in seconds', example: 3600 })
    timeStepSeconds: number;

    @ApiPropertyOptional({ nullable: true, example: '2026-07-21T11:15:08.000Z' })
    creationDate: string | null;

    @ApiPropertyOptional({ nullable: true, example: '2026-07-21T11:17:46.000Z' })
    approvedDate: string | null;

    @ApiProperty({
        description: 'Source SFTP filename for auditability',
        example: 'tagus_eps_Pareal_202607210000.json',
    })
    sourceFileName: string;

    @ApiPropertyOptional({
        description: 'Event with the highest value (null when no events)',
        nullable: true,
        type: () => AerialPrecipitationEventPointDto,
    })
    max: AerialPrecipitationEventPointDto | null;

    @ApiPropertyOptional({
        description: 'Chronologically latest event (null when no events)',
        nullable: true,
        type: () => AerialPrecipitationEventPointDto,
    })
    last: AerialPrecipitationEventPointDto | null;

    @ApiPropertyOptional({
        description: 'Full event list (only present when includeEvents=true)',
        type: [AerialPrecipitationEventPointDto],
    })
    events?: AerialPrecipitationEventPointDto[];
}

// ─────────────────────────────────────────────────────────────
// GET /aerial-precipitation/latest
// ─────────────────────────────────────────────────────────────

export class GetAerialPrecipitationLatestQueryDto {
    @ApiProperty({ description: 'Layer filter', enum: AerialPrecipLayerEnum })
    @IsEnum(AerialPrecipLayerEnum, { message: 'layer must be one of: sistema, aemet, subcNAM' })
    layer: string;

    @ApiProperty({ description: 'Provider filter', enum: AerialPrecipProviderEnum })
    @IsEnum(AerialPrecipProviderEnum, { message: 'provider must be one of: ens, harmonie, obs' })
    provider: string;

    @ApiProperty({ description: 'Accumulation filter', enum: AerialPrecipAccumulationEnum })
    @IsEnum(AerialPrecipAccumulationEnum, { message: 'accumulation must be one of: 1h, 12h, 24h' })
    @Transform(({ value }: { value: string }) => (typeof value === 'string' ? value.toLowerCase() : value))
    accumulation: string;

    @ApiPropertyOptional({ description: 'Stat filter (ens only)', enum: AerialPrecipStatEnum })
    @IsOptional()
    @IsEnum(AerialPrecipStatEnum, { message: 'stat must be one of: Med, Max, none' })
    stat?: string;

    @ApiPropertyOptional({ description: 'Include event timeseries in response', default: false })
    @IsOptional()
    @Transform(({ value }: { value: unknown }) => {
        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0') return false;
        return value;
    })
    @IsBoolean()
    includeEvents?: boolean;
}

export class GetAerialPrecipitationLatestResponseDto {
    @ApiProperty({ description: 'Query execution time UTC', example: '2026-07-21T11:20:00.000Z' })
    generatedAt: string;

    @ApiProperty({ description: 'Layer queried', example: 'subcNAM' })
    layer: string;

    @ApiProperty({ description: 'Provider queried', example: 'harmonie' })
    provider: string;

    @ApiProperty({ description: 'Accumulation queried', example: '24h' })
    accumulation: string;

    @ApiPropertyOptional({ description: 'Stat queried', nullable: true, example: null })
    stat: string | null;

    @ApiProperty({ description: 'One series per polygon', type: [AerialPrecipitationSeriesDto] })
    series: AerialPrecipitationSeriesDto[];
}

// ─────────────────────────────────────────────────────────────
// GET /aerial-precipitation/by-location/:locationId
// ─────────────────────────────────────────────────────────────

export class GetAerialPrecipitationByLocationQueryDto {
    @ApiPropertyOptional({ description: 'Filter by provider', enum: AerialPrecipProviderEnum })
    @IsOptional()
    @IsEnum(AerialPrecipProviderEnum, { message: 'provider must be one of: ens, harmonie, obs' })
    provider?: string;

    @ApiPropertyOptional({ description: 'Filter by accumulation', enum: AerialPrecipAccumulationEnum })
    @IsOptional()
    @IsEnum(AerialPrecipAccumulationEnum, { message: 'accumulation must be one of: 1h, 12h, 24h' })
    @Transform(({ value }: { value: string }) => (typeof value === 'string' ? value.toLowerCase() : value))
    accumulation?: string;

    @ApiPropertyOptional({ description: 'Lower bound on forecastDate (inclusive)', example: '2026-07-14T00:00:00Z' })
    @IsOptional()
    @IsDateString()
    fromForecastDate?: string;

    @ApiPropertyOptional({ description: 'Upper bound on forecastDate (inclusive)', example: '2026-07-21T00:00:00Z' })
    @IsOptional()
    @IsDateString()
    toForecastDate?: string;

    @ApiPropertyOptional({ description: 'Include event timeseries in response', default: false })
    @IsOptional()
    @Transform(({ value }: { value: unknown }) => {
        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0') return false;
        return value;
    })
    @IsBoolean()
    includeEvents?: boolean;
}

export class AerialPrecipitationByLocationGroupDto {
    @ApiProperty({ description: 'Provider of this group', example: 'obs' })
    provider: string;

    @ApiProperty({ description: 'Accumulation of this group', example: '1h' })
    accumulation: string;

    @ApiPropertyOptional({ nullable: true, example: null })
    stat: string | null;

    @ApiProperty({ description: 'Series in this group', type: [AerialPrecipitationSeriesDto] })
    series: AerialPrecipitationSeriesDto[];
}

export class GetAerialPrecipitationByLocationResponseDto {
    @ApiProperty({ description: 'Location queried', example: 'Cuenca.NAM.E_08' })
    locationId: string;

    @ApiProperty({
        description: 'Groups keyed by (provider, accumulation, stat)',
        type: [AerialPrecipitationByLocationGroupDto],
    })
    groups: AerialPrecipitationByLocationGroupDto[];
}

// ─────────────────────────────────────────────────────────────
// GET /aerial-precipitation (paginated list)
// ─────────────────────────────────────────────────────────────

export class ListAerialPrecipitationQueryDto {
    @ApiPropertyOptional({ description: 'Filter by layer', enum: AerialPrecipLayerEnum })
    @IsOptional()
    @IsEnum(AerialPrecipLayerEnum, { message: 'layer must be one of: sistema, aemet, subcNAM' })
    layer?: string;

    @ApiPropertyOptional({ description: 'Filter by provider', enum: AerialPrecipProviderEnum })
    @IsOptional()
    @IsEnum(AerialPrecipProviderEnum, { message: 'provider must be one of: ens, harmonie, obs' })
    provider?: string;

    @ApiPropertyOptional({
        description: 'Filter by locationId (repeatable)',
        isArray: true,
        example: ['Cuenca.NAM.E_08', 'Sistema.Tajo.3'],
    })
    @IsOptional()
    @IsString({ each: true })
    @Transform(({ value }: { value: unknown }) => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') return [value];
        return value;
    })
    locationId?: string | string[];

    @ApiPropertyOptional({ description: 'Filter by accumulation', enum: AerialPrecipAccumulationEnum })
    @IsOptional()
    @IsEnum(AerialPrecipAccumulationEnum, { message: 'accumulation must be one of: 1h, 12h, 24h' })
    @Transform(({ value }: { value: string }) => (typeof value === 'string' ? value.toLowerCase() : value))
    accumulation?: string;

    @ApiPropertyOptional({ description: 'Filter by stat (use "none" to match null stat)', enum: AerialPrecipStatEnum })
    @IsOptional()
    @IsEnum(AerialPrecipStatEnum, { message: 'stat must be one of: Med, Max, none' })
    stat?: string;

    @ApiPropertyOptional({ description: 'Lower bound on forecastDate (inclusive)', example: '2026-07-14T00:00:00Z' })
    @IsOptional()
    @IsDateString()
    fromForecastDate?: string;

    @ApiPropertyOptional({ description: 'Upper bound on forecastDate (inclusive)', example: '2026-07-21T00:00:00Z' })
    @IsOptional()
    @IsDateString()
    toForecastDate?: string;

    @ApiPropertyOptional({ description: 'Include event timeseries in response', default: false })
    @IsOptional()
    @Transform(({ value }: { value: unknown }) => {
        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0') return false;
        return value;
    })
    @IsBoolean()
    includeEvents?: boolean;

    @ApiPropertyOptional({ description: 'Page number (min 1)', default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ description: 'Page size (min 1, max 500)', default: 50, minimum: 1, maximum: 500 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(500)
    limit?: number;
}

export class ListAerialPrecipitationResponseDto {
    @ApiProperty({ type: [AerialPrecipitationSeriesDto] })
    data: AerialPrecipitationSeriesDto[];

    @ApiProperty({ example: 4176 })
    total: number;

    @ApiProperty({ example: 1 })
    page: number;

    @ApiProperty({ example: 50 })
    limit: number;
}
