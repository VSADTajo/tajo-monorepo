import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────
// Shared sub-DTOs
// ─────────────────────────────────────────────────────────────

export class AerialPrecipitationEventPointGwDto {
    @ApiProperty({ description: 'UTC timestamp of the event', example: '2026-07-21T01:00:00.000Z' })
    eventDate: string;

    @ApiProperty({ description: 'Precipitation value in mm', example: 12.5 })
    value: number;

    @ApiProperty({ description: 'FEWS quality flag (2 = approved)', example: 2 })
    flag: number;
}

export class AerialPrecipitationSeriesGwDto {
    @ApiProperty({ description: 'UUID primary key', example: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789' })
    id: string;

    @ApiProperty({ description: 'FEWS locationId', example: 'Cuenca.NAM.E_08' })
    locationId: string;

    @ApiProperty({ description: 'FEWS parameterId', example: 'P.areal.harmonie.subcNAM.24H' })
    parameterId: string;

    @ApiProperty({ description: 'Derived provider', example: 'harmonie', enum: ['ens', 'harmonie', 'obs'] })
    provider: string;

    @ApiProperty({ description: 'Derived layer', example: 'subcNAM', enum: ['sistema', 'aemet', 'subcNAM'] })
    layer: string;

    @ApiPropertyOptional({
        description: 'Statistical aggregate type (ens only)',
        example: 'Med',
        nullable: true,
        enum: ['Med', 'Max'],
    })
    stat: string | null;

    @ApiProperty({ description: 'Derived accumulation', example: '24h', enum: ['1h', '12h', '24h'] })
    accumulation: string;

    @ApiProperty({ description: 'Forecast run UTC datetime', example: '2026-07-21T00:00:00.000Z' })
    forecastDate: string;

    @ApiPropertyOptional({ nullable: true, example: '2026-07-21T01:00:00.000Z' })
    startDate: string | null;

    @ApiPropertyOptional({ nullable: true, example: '2026-07-24T01:00:00.000Z' })
    endDate: string | null;

    @ApiPropertyOptional({ nullable: true, example: 'Processing_Catchment_EPS' })
    moduleInstanceId: string | null;

    @ApiPropertyOptional({ nullable: true, example: 'PÁLMACES' })
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
        type: () => AerialPrecipitationEventPointGwDto,
    })
    max: AerialPrecipitationEventPointGwDto | null;

    @ApiPropertyOptional({
        description: 'Chronologically latest event (null when no events)',
        nullable: true,
        type: () => AerialPrecipitationEventPointGwDto,
    })
    last: AerialPrecipitationEventPointGwDto | null;

    @ApiPropertyOptional({
        description: 'Full event list (only present when includeEvents=true)',
        type: [AerialPrecipitationEventPointGwDto],
    })
    events?: AerialPrecipitationEventPointGwDto[];
}

// ─────────────────────────────────────────────────────────────
// GET /aerial-precipitation (list)
// ─────────────────────────────────────────────────────────────

export class ListAerialPrecipitationGwResponseDto {
    @ApiProperty({ type: [AerialPrecipitationSeriesGwDto] })
    data: AerialPrecipitationSeriesGwDto[];

    @ApiProperty({ example: 4176 })
    total: number;

    @ApiProperty({ example: 1 })
    page: number;

    @ApiProperty({ example: 50 })
    limit: number;
}

// ─────────────────────────────────────────────────────────────
// GET /aerial-precipitation/latest
// ─────────────────────────────────────────────────────────────

export class GetAerialPrecipitationLatestGwResponseDto {
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

    @ApiProperty({ description: 'One series per polygon', type: [AerialPrecipitationSeriesGwDto] })
    series: AerialPrecipitationSeriesGwDto[];
}

// ─────────────────────────────────────────────────────────────
// GET /aerial-precipitation/by-location/:locationId
// ─────────────────────────────────────────────────────────────

export class AerialPrecipitationByLocationGroupGwDto {
    @ApiProperty({ description: 'Provider of this group', example: 'obs' })
    provider: string;

    @ApiProperty({ description: 'Accumulation of this group', example: '1h' })
    accumulation: string;

    @ApiPropertyOptional({ nullable: true, example: null })
    stat: string | null;

    @ApiProperty({ description: 'Series in this group', type: [AerialPrecipitationSeriesGwDto] })
    series: AerialPrecipitationSeriesGwDto[];
}

export class GetAerialPrecipitationByLocationGwResponseDto {
    @ApiProperty({ description: 'Location queried', example: 'Sistema.Tajo.3' })
    locationId: string;

    @ApiProperty({
        description: 'Groups keyed by (provider, accumulation, stat)',
        type: [AerialPrecipitationByLocationGroupGwDto],
    })
    groups: AerialPrecipitationByLocationGroupGwDto[];
}
