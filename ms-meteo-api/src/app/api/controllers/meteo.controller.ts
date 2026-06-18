import { Body, Controller, Get, HttpException, HttpStatus, Inject, Post, Query, Res } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import type { Response } from 'express';

import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ProviderError } from '@domain/errors/provider.error';
import { TriggerSource } from '@domain/types/ingest-status.enum';
import { IGeoserverImageMosaicClient } from '@domain/ports/geoserver-image-mosaic-client.port';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

import {
    AccumulateMapQueryDto,
    AccumulateRequestDto,
    AccumulateResponseDto,
    MeteoFilterQueryDto,
    MeteoInfoResponseDto,
    MeteoProviderResponseDto,
    SyncResultDto,
} from '@api/dtos/meteo.dtos';
import {
    GetAvisosQueryDto,
    GetAvisosResponseDto,
    GetAvisosResumenResponseDto,
    GetAvisosTiposResponseDto,
} from '@api/dtos/avisos.dtos';
import {
    AccumulateMeteoMapper,
    MeteoInfoMapper,
    MeteoProvidersMapper,
    SyncMeteoMapper,
} from '@application/mappers/meteo.mappers';
import { GetAvisosMapper, GetAvisosResumenMapper, GetAvisosTiposMapper } from '@application/mappers/avisos.mappers';
import { AccumulateMeteoCommand } from '@application/commands/meteo.commands';
import { AccumulateResult, MeteoInfoResult, MeteoProviderResult, SyncResult } from '@domain/results/meteo.results';
import { GetAvisosResumenResult, GetAvisosResult, GetAvisosTiposResult } from '@domain/results/avisos.results';

@ApiTags('Meteo')
@Controller('meteo')
export class MeteoController {
    constructor(
        @Inject(Logger) protected readonly logger: Logger,
        protected readonly commandBus: CommandBus,
        protected readonly cachingQueryBus: CachingQueryBus,
        private readonly geoserverClient: IGeoserverImageMosaicClient,
    ) {}

    // ─────────────────────────────────────────────────────────────
    // GET /meteo/info — list datasets (filters optional)
    // ─────────────────────────────────────────────────────────────

    @Get('info')
    @ApiEndpoint({
        summary: 'List meteo datasets metadata (all, by provider, or by dataset)',
        response: { status: 200, type: MeteoInfoResponseDto, description: 'Array of dataset metadata' },
        errors: [
            { status: 400, description: 'variable filter requires provider' },
            { status: 404, description: 'Provider or variable not found in SFTP' },
            { status: 502, description: 'sftp-api unreachable' },
        ],
    })
    async getMeteoInfo(@Query() query: MeteoFilterQueryDto): Promise<MeteoInfoResponseDto[]> {
        this.logger.log({
            msg: 'MeteoInfo request',
            entity: 'MeteoSync',
            provider: query.provider ?? 'all',
            variable: query.variable ?? 'all',
        });

        try {
            // Pass plain object to mapper (decoupled from DTO class)
            const q = MeteoInfoMapper.toQuery({ provider: query.provider, variable: query.variable });
            const results: MeteoInfoResult[] = await this.cachingQueryBus.execute(q);
            // Map domain results to response DTOs
            return results.map((r) => MeteoInfoMapper.toResponse(r) as MeteoInfoResponseDto);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            if (error instanceof ProviderError) {
                throw new HttpException(error.message, HttpStatus.BAD_GATEWAY);
            }
            this.logger.error({ msg: 'MeteoInfo error', entity: 'MeteoSync', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // GET /meteo/providers — distinct providers and their variables
    // ─────────────────────────────────────────────────────────────

    @Get('providers')
    @ApiEndpoint({
        summary: 'List distinct meteo providers and their available variables',
        response: { status: 200, type: [MeteoProviderResponseDto], description: 'Array of providers with variables' },
        errors: [{ status: 502, description: 'sftp-api unreachable' }],
    })
    async getProviders(): Promise<MeteoProviderResponseDto[]> {
        try {
            const q = MeteoProvidersMapper.toQuery();
            const results: MeteoProviderResult[] = await this.cachingQueryBus.execute(q);
            return results.map((r) => MeteoProvidersMapper.toResponse(r) as MeteoProviderResponseDto);
        } catch (error) {
            if (error instanceof ProviderError) {
                throw new HttpException(error.message, HttpStatus.BAD_GATEWAY);
            }
            this.logger.error({ msg: 'MeteoProviders error', entity: 'MeteoSync', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // POST /meteo/sync — manual trigger (filters optional)
    // ─────────────────────────────────────────────────────────────

    @Post('sync')
    @ApiEndpoint({
        summary: 'Trigger an immediate sync of meteo datasets (all, by provider, or one)',
        response: { status: 200, type: SyncResultDto, description: 'Per-dataset sync result' },
        errors: [
            { status: 400, description: 'variable filter requires provider' },
            { status: 404, description: 'Provider or variable not found in SFTP' },
            { status: 502, description: 'sftp-api or geoserver unreachable' },
        ],
    })
    async syncMeteo(@Query() query: MeteoFilterQueryDto): Promise<SyncResultDto> {
        this.logger.log({
            msg: 'Sync request',
            entity: 'MeteoSync',
            provider: query.provider ?? 'all',
            variable: query.variable ?? 'all',
        });

        try {
            // Pass plain object to mapper (decoupled from DTO class)
            const command = SyncMeteoMapper.toCommand(
                { provider: query.provider, variable: query.variable },
                TriggerSource.MANUAL,
            );
            const result: SyncResult = await this.commandBus.execute(command);
            // Map domain result to response DTO
            return SyncMeteoMapper.toResponse(result) as SyncResultDto;
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            if (error instanceof ProviderError) {
                throw new HttpException(error.message, HttpStatus.BAD_GATEWAY);
            }
            this.logger.error({ msg: 'Sync error', entity: 'MeteoSync', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // POST /meteo/accumulate — on-demand range accumulation
    // ─────────────────────────────────────────────────────────────

    @Post('accumulate')
    @ApiEndpoint({
        summary: 'Compute an accumulated layer for a specific date range',
        body: AccumulateRequestDto,
        response: { status: 200, type: AccumulateResponseDto, description: 'Accumulation result' },
        errors: [
            { status: 400, description: 'Invalid date range or multiple datasets without variable filter' },
            { status: 404, description: 'Provider/variable not found or no data in range' },
            { status: 502, description: 'sftp-api or geoserver unreachable' },
        ],
    })
    async accumulate(@Body() dto: AccumulateRequestDto): Promise<AccumulateResponseDto> {
        this.logger.log({
            msg: 'Accumulate request',
            entity: 'MeteoSync',
            provider: dto.provider,
            variable: dto.variable ?? 'all',
            from: dto.from,
            to: dto.to,
        });

        try {
            const command = AccumulateMeteoMapper.toCommand(dto);
            const result: AccumulateResult = await this.commandBus.execute(command);
            return AccumulateMeteoMapper.toResponse(result) as AccumulateResponseDto;
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            if (error instanceof ProviderError) {
                throw new HttpException(error.message, HttpStatus.BAD_GATEWAY);
            }
            this.logger.error({ msg: 'Accumulate error', entity: 'MeteoSync', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // GET /meteo/accumulate/map — WMS proxy with on-demand range accumulation
    // ─────────────────────────────────────────────────────────────

    @Get('accumulate/map')
    @ApiOperation({ summary: 'Compute accumulated layer for a date range and proxy GeoServer WMS response as image' })
    @ApiProduces('image/png', 'image/jpeg')
    async accumulateMap(@Query() dto: AccumulateMapQueryDto, @Res() res: Response): Promise<void> {
        this.logger.log({
            msg: 'AccumulateMap request',
            entity: 'MeteoSync',
            provider: dto.provider,
            variable: dto.variable ?? 'all',
            from: dto.from,
            to: dto.to,
        });

        try {
            // 1. Compute (or hit cache) accumulated layer.
            const command = new AccumulateMeteoCommand({
                provider: dto.provider,
                variable: dto.variable,
                from: dto.from,
                to: dto.to,
            });
            const result: AccumulateResult = await this.commandBus.execute(command);

            // 2. Build WMS params: inject LAYERS from computed layer, forward remaining query params.
            // Defaults cover the full Tajo watershed at a reasonable resolution.
            const NON_WMS_KEYS = new Set(['provider', 'variable', 'from', 'to']);
            const params: Record<string, string> = {
                SERVICE: 'WMS',
                VERSION: '1.1.1',
                REQUEST: 'GetMap',
                SRS: 'EPSG:4326',
                BBOX: '-7.5438,38.7845,-1.4508,41.3045',
                WIDTH: '768',
                HEIGHT: '330',
                FORMAT: 'image/png',
                TRANSPARENT: 'true',
                ...(Object.fromEntries(
                    Object.entries(dto).filter(([k, v]) => !NON_WMS_KEYS.has(k) && v !== undefined),
                ) as Record<string, string>),
                LAYERS: result.layerName, // Always override with computed layer name.
            };

            // 3. Proxy GeoServer WMS response.
            const workspace = result.layerName.split(':')[0];
            const { data, contentType } = await this.geoserverClient.proxyWms(workspace, params);

            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'no-store');
            res.send(data);
        } catch (error) {
            if (error instanceof EntityError) {
                res.status(HttpStatus.BAD_REQUEST).json({ message: (error as EntityError).message });
                return;
            }
            if (error instanceof ApiError) {
                res.status((error as ApiError).statusCode).json({ message: (error as ApiError).message });
                return;
            }
            if (error instanceof ProviderError) {
                res.status(HttpStatus.BAD_GATEWAY).json({ message: (error as ProviderError).message });
                return;
            }
            this.logger.error({ msg: 'AccumulateMap error', entity: 'MeteoSync', error: String(error) });
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // GET /meteo/avisos/tipos — list AEMET alert event types
    // ─────────────────────────────────────────────────────────────

    @Get('avisos/tipos')
    @ApiEndpoint({
        summary: 'List AEMET alert event types (codes and names)',
        response: {
            status: 200,
            type: GetAvisosTiposResponseDto,
            description: 'Array of event type codes with their names',
        },
        errors: [],
    })
    async getAvisosTipos(): Promise<GetAvisosTiposResponseDto> {
        const query = GetAvisosTiposMapper.toQuery();
        const result = await this.cachingQueryBus.execute<GetAvisosTiposResult>(query);
        return GetAvisosTiposMapper.toResponseDto(result);
    }

    // ─────────────────────────────────────────────────────────────
    // GET /meteo/avisos/resumen — active alert categories summary
    // ─────────────────────────────────────────────────────────────

    @Get('avisos/resumen')
    @ApiEndpoint({
        summary: 'Get summary of active alert categories for today, tomorrow, and day after tomorrow',
        response: {
            status: 200,
            type: GetAvisosResumenResponseDto,
            description: 'Categories with active alerts and total count',
        },
        errors: [{ status: 502, description: 'AEMET API unreachable or returned error' }],
    })
    async getAvisosResumen(): Promise<GetAvisosResumenResponseDto> {
        this.logger.log({ msg: 'Get AEMET avisos resumen' });

        try {
            const query = GetAvisosResumenMapper.toQuery();
            const result = await this.cachingQueryBus.execute<GetAvisosResumenResult>(query);
            return GetAvisosResumenMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ProviderError) {
                throw new HttpException(error.message, HttpStatus.BAD_GATEWAY);
            }
            this.logger.error({ msg: 'Error getting avisos resumen', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // GET /meteo/avisos — AEMET weather alerts as GeoJSON
    // ─────────────────────────────────────────────────────────────

    @Get('avisos')
    @ApiEndpoint({
        summary: 'Get AEMET weather alerts (avisos CAP) as GeoJSON, filtered to Tajo basin',
        response: {
            status: 200,
            type: GetAvisosResponseDto,
            description: 'GeoJSON FeatureCollection of active alerts for Tajo basin provinces',
        },
        errors: [{ status: 502, description: 'AEMET API unreachable or returned error' }],
    })
    async getAvisos(@Query() dto: GetAvisosQueryDto): Promise<GetAvisosResponseDto> {
        this.logger.log({ msg: 'Get AEMET avisos', tipo: dto.tipo, provincia: dto.provincia });

        try {
            const query = GetAvisosMapper.toQuery(dto);
            const result = await this.cachingQueryBus.execute<GetAvisosResult>(query);
            return GetAvisosMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ProviderError) {
                throw new HttpException(error.message, HttpStatus.BAD_GATEWAY);
            }
            this.logger.error({ msg: 'Error getting avisos', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
