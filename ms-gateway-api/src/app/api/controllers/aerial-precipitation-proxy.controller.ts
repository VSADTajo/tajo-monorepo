import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as express from 'express';

import { ProxyService } from '@infrastructure/services/proxy.service';
import { ServicesConfigService } from '@config/services/services-config.service';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';
import {
    ListAerialPrecipitationGwResponseDto,
    GetAerialPrecipitationLatestGwResponseDto,
    GetAerialPrecipitationByLocationGwResponseDto,
} from '@api/dtos/aerial-precipitation-proxy.dtos';

const INTERNAL_CALLER_HEADER_VALUE = 'ms-gateway-api';

// Only these query params are forwarded downstream to /aerial-precipitation.
// The upstream service runs with forbidNonWhitelisted — unrecognised params would 400.
const LIST_ALLOWED_QUERY_PARAMS = [
    'layer',
    'provider',
    'locationId',
    'accumulation',
    'stat',
    'fromForecastDate',
    'toForecastDate',
    'includeEvents',
    'page',
    'limit',
] as const;

const LATEST_ALLOWED_QUERY_PARAMS = ['layer', 'provider', 'accumulation', 'stat', 'includeEvents'] as const;

const BY_LOCATION_ALLOWED_QUERY_PARAMS = [
    'provider',
    'accumulation',
    'fromForecastDate',
    'toForecastDate',
    'includeEvents',
] as const;

function pickAllowedQuery(
    query: Record<string, unknown>,
    allowed: readonly string[],
): Record<string, string | string[]> {
    return Object.fromEntries(Object.entries(query).filter(([key]) => allowed.includes(key))) as Record<
        string,
        string | string[]
    >;
}

@ApiTags('Aerial Precipitation')
@ApiBearerAuth('JWTAuthorization')
@Controller()
export class AerialPrecipitationProxyController {
    constructor(
        private readonly proxyService: ProxyService,
        private readonly servicesConfig: ServicesConfigService,
    ) {}

    // ─────────────────────────────────────────────────────────────
    // GET /aerial-precipitation (paginated list)
    // ─────────────────────────────────────────────────────────────

    @Get('aerial-precipitation')
    @ApiEndpoint({
        summary: 'List areal precipitation series with optional filters (paginated)',
        description: [
            'Returns a paginated list of areal precipitation series stored in ms-meteo-api.',
            'Each series represents one FEWS polygon (locationId + parameterId combination) with',
            'its latest max/last event snapshots. Pass includeEvents=true to receive the full',
            'event timeseries within each series.',
            'Unknown query params are silently dropped at the gateway (upstream enforces forbidNonWhitelisted).',
        ].join(' '),
        response: {
            status: 200,
            type: ListAerialPrecipitationGwResponseDto,
            description: 'Paginated list of areal precipitation series.',
        },
        errors: [
            { status: 400, description: 'Invalid query parameter value (e.g. unknown layer/provider/accumulation)' },
            { status: 500, description: 'Internal server error or ms-meteo-api unreachable' },
        ],
    })
    @ApiQuery({
        name: 'layer',
        required: false,
        enum: ['sistema', 'aemet', 'subcNAM'],
        description: 'Filter by spatial layer',
        example: 'subcNAM',
    })
    @ApiQuery({
        name: 'provider',
        required: false,
        enum: ['ens', 'harmonie', 'obs'],
        description: 'Filter by forecast provider',
        example: 'harmonie',
    })
    @ApiQuery({
        name: 'locationId',
        required: false,
        isArray: true,
        description: 'Filter by locationId (repeatable). E.g. ?locationId=Sistema.Tajo.3&locationId=Cuenca.NAM.E_08',
        example: 'Cuenca.NAM.E_08',
    })
    @ApiQuery({
        name: 'accumulation',
        required: false,
        enum: ['1h', '12h', '24h'],
        description: 'Filter by accumulation window',
        example: '24h',
    })
    @ApiQuery({
        name: 'stat',
        required: false,
        enum: ['Med', 'Max', 'none'],
        description: 'Filter by statistical aggregate (use "none" to match null stat)',
    })
    @ApiQuery({
        name: 'fromForecastDate',
        required: false,
        type: String,
        description: 'Lower bound on forecastDate (inclusive, ISO 8601)',
        example: '2026-07-14T00:00:00Z',
    })
    @ApiQuery({
        name: 'toForecastDate',
        required: false,
        type: String,
        description: 'Upper bound on forecastDate (inclusive, ISO 8601)',
        example: '2026-07-21T00:00:00Z',
    })
    @ApiQuery({
        name: 'includeEvents',
        required: false,
        type: Boolean,
        description: 'Include full event timeseries in each series (default false)',
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (min 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 50, description: 'Page size (max 500)' })
    @ApiResponse({
        status: 200,
        description: 'Example response with two series for subcNAM harmonie 24h',
        schema: {
            example: {
                data: [
                    {
                        id: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
                        locationId: 'Cuenca.NAM.E_08',
                        parameterId: 'P.areal.harmonie.subcNAM.24H',
                        provider: 'harmonie',
                        layer: 'subcNAM',
                        stat: null,
                        accumulation: '24h',
                        forecastDate: '2026-07-21T00:00:00.000Z',
                        startDate: '2026-07-21T01:00:00.000Z',
                        endDate: '2026-07-24T01:00:00.000Z',
                        moduleInstanceId: 'Processing_Catchment_Harmonie',
                        stationName: 'PÁLMACES',
                        lat: 40.4721,
                        lon: -2.4155,
                        units: 'mm',
                        timeStepSeconds: 3600,
                        creationDate: '2026-07-21T11:15:08.000Z',
                        approvedDate: '2026-07-21T11:17:46.000Z',
                        sourceFileName: 'tagus_harmonie_Pareal_202607210000.json',
                        max: { eventDate: '2026-07-22T13:00:00.000Z', value: 12.5, flag: 2 },
                        last: { eventDate: '2026-07-24T01:00:00.000Z', value: 0.3, flag: 2 },
                    },
                    {
                        id: 'b2c3d4e5-f6a7-8901-bcde-f01234567890',
                        locationId: 'Sistema.Tajo.3',
                        parameterId: 'P.areal.harmonie.subcNAM.24H',
                        provider: 'harmonie',
                        layer: 'subcNAM',
                        stat: null,
                        accumulation: '24h',
                        forecastDate: '2026-07-21T00:00:00.000Z',
                        startDate: '2026-07-21T01:00:00.000Z',
                        endDate: '2026-07-24T01:00:00.000Z',
                        moduleInstanceId: 'Processing_Catchment_Harmonie',
                        stationName: 'HENARES',
                        lat: 40.9812,
                        lon: -3.2047,
                        units: 'mm',
                        timeStepSeconds: 3600,
                        creationDate: '2026-07-21T11:15:08.000Z',
                        approvedDate: '2026-07-21T11:17:46.000Z',
                        sourceFileName: 'tagus_harmonie_Pareal_202607210000.json',
                        max: { eventDate: '2026-07-22T06:00:00.000Z', value: 8.2, flag: 2 },
                        last: { eventDate: '2026-07-24T01:00:00.000Z', value: 1.1, flag: 2 },
                    },
                ],
                total: 4176,
                page: 1,
                limit: 50,
            },
        },
    })
    async listAerialPrecipitation(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.meteoApiUrl,
            path: '/aerial-precipitation',
            query: pickAllowedQuery(req.query, LIST_ALLOWED_QUERY_PARAMS),
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    // ─────────────────────────────────────────────────────────────
    // GET /aerial-precipitation/latest
    // ─────────────────────────────────────────────────────────────

    @Get('aerial-precipitation/latest')
    @ApiEndpoint({
        summary: 'Get the latest areal precipitation run for a given layer/provider/accumulation combination',
        description: [
            'Returns the most recent forecast run (highest forecastDate) for the specified layer,',
            'provider and accumulation. All polygon series belonging to that run are included.',
            'The layer, provider and accumulation query params are required by the upstream service.',
            'Unknown query params are silently dropped at the gateway.',
        ].join(' '),
        response: {
            status: 200,
            type: GetAerialPrecipitationLatestGwResponseDto,
            description:
                'Latest forecast run with all its polygon series. generatedAt is the query execution timestamp.',
        },
        errors: [
            { status: 400, description: 'Missing or invalid required query params (layer, provider, accumulation)' },
            { status: 500, description: 'Internal server error or ms-meteo-api unreachable' },
        ],
    })
    @ApiQuery({
        name: 'layer',
        required: true,
        enum: ['sistema', 'aemet', 'subcNAM'],
        description: 'Spatial layer to query',
        example: 'subcNAM',
    })
    @ApiQuery({
        name: 'provider',
        required: true,
        enum: ['ens', 'harmonie', 'obs'],
        description: 'Forecast provider',
        example: 'ens',
    })
    @ApiQuery({
        name: 'accumulation',
        required: true,
        enum: ['1h', '12h', '24h'],
        description: 'Accumulation window',
        example: '12h',
    })
    @ApiQuery({
        name: 'stat',
        required: false,
        enum: ['Med', 'Max', 'none'],
        description: 'Statistical aggregate (required for ens provider)',
        example: 'Med',
    })
    @ApiQuery({
        name: 'includeEvents',
        required: false,
        type: Boolean,
        description: 'Include full event timeseries in each series (default false)',
    })
    @ApiResponse({
        status: 200,
        description: 'Example response for layer=subcNAM, provider=ens, accumulation=12h, stat=Med',
        schema: {
            example: {
                generatedAt: '2026-07-21T11:20:00.000Z',
                layer: 'subcNAM',
                provider: 'ens',
                accumulation: '12h',
                stat: 'Med',
                series: [
                    {
                        id: 'c3d4e5f6-a7b8-9012-cdef-012345678901',
                        locationId: 'Cuenca.AEMET.1',
                        parameterId: 'P.areal.ens.aemet.Med.12h',
                        provider: 'ens',
                        layer: 'aemet',
                        stat: 'Med',
                        accumulation: '12h',
                        forecastDate: '2026-07-21T00:00:00.000Z',
                        startDate: '2026-07-21T12:00:00.000Z',
                        endDate: '2026-07-24T00:00:00.000Z',
                        moduleInstanceId: 'Processing_Catchment_EPS',
                        stationName: 'Albarracín y Jiloca',
                        lat: 40.4001,
                        lon: -1.4389,
                        units: 'mm',
                        timeStepSeconds: 3600,
                        creationDate: '2026-07-21T11:15:08.000Z',
                        approvedDate: '2026-07-21T11:17:46.000Z',
                        sourceFileName: 'tagus_eps_Pareal_202607210000.json',
                        max: { eventDate: '2026-07-22T12:00:00.000Z', value: 9.8, flag: 2 },
                        last: { eventDate: '2026-07-24T00:00:00.000Z', value: 0.0, flag: 2 },
                    },
                ],
            },
        },
    })
    async getLatestAerialPrecipitation(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.meteoApiUrl,
            path: '/aerial-precipitation/latest',
            query: pickAllowedQuery(req.query, LATEST_ALLOWED_QUERY_PARAMS),
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    // ─────────────────────────────────────────────────────────────
    // GET /aerial-precipitation/by-location/:locationId
    // ─────────────────────────────────────────────────────────────

    @Get('aerial-precipitation/by-location/:locationId')
    @ApiEndpoint({
        summary: 'Get all areal precipitation series for a specific FEWS locationId',
        description: [
            'Returns all series stored for the given locationId, grouped by (provider, accumulation, stat).',
            'Useful for building timeseries charts for a single catchment polygon.',
            'Unknown query params are silently dropped at the gateway (upstream enforces forbidNonWhitelisted).',
        ].join(' '),
        response: {
            status: 200,
            type: GetAerialPrecipitationByLocationGwResponseDto,
            description: 'Series grouped by (provider, accumulation, stat) for the given locationId.',
        },
        errors: [
            { status: 400, description: 'Invalid query parameter value' },
            { status: 500, description: 'Internal server error or ms-meteo-api unreachable' },
        ],
    })
    @ApiQuery({
        name: 'provider',
        required: false,
        enum: ['ens', 'harmonie', 'obs'],
        description: 'Filter by forecast provider',
        example: 'obs',
    })
    @ApiQuery({
        name: 'accumulation',
        required: false,
        enum: ['1h', '12h', '24h'],
        description: 'Filter by accumulation window',
        example: '1h',
    })
    @ApiQuery({
        name: 'fromForecastDate',
        required: false,
        type: String,
        description: 'Lower bound on forecastDate (inclusive, ISO 8601)',
        example: '2026-07-14T00:00:00Z',
    })
    @ApiQuery({
        name: 'toForecastDate',
        required: false,
        type: String,
        description: 'Upper bound on forecastDate (inclusive, ISO 8601)',
        example: '2026-07-21T00:00:00Z',
    })
    @ApiQuery({
        name: 'includeEvents',
        required: false,
        type: Boolean,
        description: 'Include full event timeseries in each series (default false)',
    })
    @ApiResponse({
        status: 200,
        description: 'Example response for locationId=Sistema.Tajo.3 (HENARES)',
        schema: {
            example: {
                locationId: 'Sistema.Tajo.3',
                groups: [
                    {
                        provider: 'obs',
                        accumulation: '1h',
                        stat: null,
                        series: [
                            {
                                id: 'd4e5f6a7-b8c9-0123-defa-123456789012',
                                locationId: 'Sistema.Tajo.3',
                                parameterId: 'P.areal.obs.sis10.1h.v',
                                provider: 'obs',
                                layer: 'sistema',
                                stat: null,
                                accumulation: '1h',
                                forecastDate: '2026-07-21T00:00:00.000Z',
                                startDate: '2026-07-20T01:00:00.000Z',
                                endDate: '2026-07-21T00:00:00.000Z',
                                moduleInstanceId: null,
                                stationName: 'HENARES',
                                lat: 40.9812,
                                lon: -3.2047,
                                units: 'mm',
                                timeStepSeconds: 3600,
                                creationDate: '2026-07-21T02:05:00.000Z',
                                approvedDate: null,
                                sourceFileName: 'tagus_obs_Pareal_202607210000.json',
                                max: { eventDate: '2026-07-20T16:00:00.000Z', value: 12.5, flag: 2 },
                                last: { eventDate: '2026-07-21T00:00:00.000Z', value: 0.1, flag: 2 },
                            },
                        ],
                    },
                    {
                        provider: 'harmonie',
                        accumulation: '24h',
                        stat: null,
                        series: [
                            {
                                id: 'e5f6a7b8-c9d0-1234-efab-234567890123',
                                locationId: 'Sistema.Tajo.3',
                                parameterId: 'P.areal.harmonie.subcNAM.24H',
                                provider: 'harmonie',
                                layer: 'subcNAM',
                                stat: null,
                                accumulation: '24h',
                                forecastDate: '2026-07-21T00:00:00.000Z',
                                startDate: '2026-07-21T01:00:00.000Z',
                                endDate: '2026-07-24T01:00:00.000Z',
                                moduleInstanceId: 'Processing_Catchment_Harmonie',
                                stationName: 'HENARES',
                                lat: 40.9812,
                                lon: -3.2047,
                                units: 'mm',
                                timeStepSeconds: 3600,
                                creationDate: '2026-07-21T11:15:08.000Z',
                                approvedDate: '2026-07-21T11:17:46.000Z',
                                sourceFileName: 'tagus_harmonie_Pareal_202607210000.json',
                                max: { eventDate: '2026-07-22T06:00:00.000Z', value: 8.2, flag: 2 },
                                last: { eventDate: '2026-07-24T01:00:00.000Z', value: 1.1, flag: 2 },
                            },
                        ],
                    },
                ],
            },
        },
    })
    async getAerialPrecipitationByLocation(
        @Param('locationId') locationId: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.meteoApiUrl,
            path: `/aerial-precipitation/by-location/${locationId}`,
            query: pickAllowedQuery(req.query, BY_LOCATION_ALLOWED_QUERY_PARAMS),
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }
}
