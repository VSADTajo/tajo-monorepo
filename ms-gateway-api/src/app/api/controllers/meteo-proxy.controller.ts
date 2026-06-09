import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import * as express from 'express';

import { ProxyService } from '@infrastructure/services/proxy.service';
import { ServicesConfigService } from '@config/services/services-config.service';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';
import {
    AccumulateResponseDto,
    MeteoInfoResponseDto,
    MeteoProviderDto,
    SyncResultDto,
    GetAvisosResponseDto,
    GetAvisosResumenResponseDto,
    GetAvisosTiposResponseDto,
} from '@api/dtos/meteo-proxy.dtos';

const INTERNAL_CALLER_HEADER_VALUE = 'ms-gateway-api';

@ApiTags('Meteo')
@ApiBearerAuth('JWTAuthorization')
@Controller('meteo')
export class MeteoProxyController {
    constructor(
        private readonly proxyService: ProxyService,
        private readonly servicesConfig: ServicesConfigService,
    ) {}

    @Get('info')
    @ApiEndpoint({
        summary: 'List metadata for all meteorological datasets',
        response: {
            status: 200,
            type: [MeteoInfoResponseDto],
            description: 'List of meteo datasets with info and last ingest run',
        },
    })
    @ApiQuery({ name: 'provider', required: false, type: String, example: 'HARMONIE' })
    @ApiQuery({ name: 'variable', required: false, type: String, example: 'Precipitacion' })
    async getInfo(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.meteoApiUrl,
            path: '/meteo/info',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('providers')
    @ApiEndpoint({
        summary: 'List distinct meteo providers and their available variables',
        response: { status: 200, type: [MeteoProviderDto], description: 'Array of providers with variables' },
    })
    async getProviders(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.meteoApiUrl,
            path: '/meteo/providers',
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('sync')
    @ApiEndpoint({
        summary: 'Trigger a manual meteorological data sync',
        response: { status: 201, type: SyncResultDto, description: 'Sync result per dataset' },
    })
    @ApiQuery({ name: 'provider', required: false, type: String, example: 'HARMONIE' })
    @ApiQuery({ name: 'variable', required: false, type: String, example: 'Precipitacion' })
    async sync(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.meteoApiUrl,
            path: '/meteo/sync',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('accumulate')
    @ApiEndpoint({
        summary: 'Compute accumulated layer for a specific date range',
        response: { status: 200, type: AccumulateResponseDto, description: 'Accumulation result with layer name' },
        errors: [
            { status: 400, description: 'Invalid date range or multiple datasets without variable filter' },
            { status: 404, description: 'Provider/variable not found or no data in range' },
            { status: 502, description: 'ms-meteo-api or GeoServer unreachable' },
        ],
    })
    async accumulate(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.meteoApiUrl,
            path: '/meteo/accumulate',
            body: req.body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('avisos/tipos')
    @ApiEndpoint({
        summary: 'List AEMET alert event types (codes and names)',
        response: {
            status: 200,
            type: GetAvisosTiposResponseDto,
            description: 'Array of event type codes with their names',
        },
    })
    async getAvisosTipos(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.meteoApiUrl,
            path: '/meteo/avisos/tipos',
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('avisos/resumen')
    @ApiEndpoint({
        summary: 'Get summary of active alert categories for today, tomorrow, and day after tomorrow',
        response: {
            status: 200,
            type: GetAvisosResumenResponseDto,
            description: 'Categories with active alerts and total count',
        },
        errors: [{ status: 502, description: 'AEMET API unreachable' }],
    })
    async getAvisosResumen(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.meteoApiUrl,
            path: '/meteo/avisos/resumen',
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('avisos')
    @ApiEndpoint({
        summary: 'Get AEMET weather alerts (avisos CAP) as GeoJSON, filtered to Tajo basin',
        response: {
            status: 200,
            type: GetAvisosResponseDto,
            description: 'GeoJSON FeatureCollection of active alerts for Tajo basin provinces',
        },
        errors: [{ status: 502, description: 'AEMET API unreachable' }],
    })
    @ApiQuery({ name: 'tipo', required: false, type: String, description: 'AEMET event type code', example: 'AT' })
    @ApiQuery({ name: 'provincia', required: false, type: String, description: 'INE province code', example: '28' })
    async getAvisos(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.meteoApiUrl,
            path: '/meteo/avisos',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('accumulate/map')
    @ApiOperation({ summary: 'Compute accumulated layer for a date range and return WMS image' })
    @ApiProduces('image/png', 'image/jpeg')
    @ApiQuery({ name: 'provider', required: true, type: String, example: 'HARMONIE' })
    @ApiQuery({ name: 'variable', required: false, type: String, example: 'Precipitacion' })
    @ApiQuery({ name: 'from', required: true, type: String, example: '2026-05-01T06:00:00Z' })
    @ApiQuery({ name: 'to', required: true, type: String, example: '2026-05-10T18:00:00Z' })
    @ApiQuery({ name: 'BBOX', required: false, type: String, example: '-7.5438,38.7845,-1.4508,41.3045' })
    @ApiQuery({ name: 'WIDTH', required: false, type: String, example: '768' })
    @ApiQuery({ name: 'HEIGHT', required: false, type: String, example: '330' })
    @ApiQuery({ name: 'FORMAT', required: false, type: String, example: 'image/png' })
    async accumulateMap(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.meteoApiUrl,
            path: '/meteo/accumulate/map',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            responseType: 'arraybuffer',
            timeoutMs: 60_000,
            traceId: (req as any).id,
        });

        const contentType = result.contentType ?? 'image/png';
        if (contentType.startsWith('image/')) {
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'no-store');
            res.status(result.status).send(result.data);
        } else {
            // Upstream returned an error as JSON/text/XML — data may be a Buffer when responseType is arraybuffer
            const raw = Buffer.isBuffer(result.data) ? (result.data as Buffer).toString('utf-8') : result.data;
            try {
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                res.status(result.status).json(parsed);
            } catch {
                res.status(result.status).json({
                    message: typeof raw === 'string' ? raw : 'Unexpected upstream response',
                });
            }
        }
    }
}
