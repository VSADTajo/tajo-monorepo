import { Controller, Get, HttpException, HttpStatus, Inject, Param, Query } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';

import {
    GetAerialPrecipitationLatestQueryDto,
    GetAerialPrecipitationLatestResponseDto,
    GetAerialPrecipitationByLocationQueryDto,
    GetAerialPrecipitationByLocationResponseDto,
    ListAerialPrecipitationQueryDto,
    ListAerialPrecipitationResponseDto,
} from '@api/dtos/aerial-precipitation.dtos';
import {
    GetAerialPrecipitationLatestMapper,
    GetAerialPrecipitationByLocationMapper,
    ListAerialPrecipitationMapper,
} from '@application/mappers/aerial-precipitation.mappers';
import {
    AerialPrecipitationLatestResult,
    AerialPrecipitationByLocationResult,
    AerialPrecipitationListResult,
} from '@domain/results/aerial-precipitation-series.result';

@ApiTags('Aerial Precipitation')
@Controller('aerial-precipitation')
export class AerialPrecipitationController {
    constructor(
        @Inject(Logger) protected readonly logger: Logger,
        protected readonly commandBus: CommandBus,
        protected readonly cachingQueryBus: CachingQueryBus,
    ) {}

    // ─────────────────────────────────────────────────────────────
    // GET /aerial-precipitation/latest
    // ─────────────────────────────────────────────────────────────

    @Get('latest')
    @ApiEndpoint({
        summary: 'Latest series per polygon for a given layer/provider/accumulation combination',
        response: {
            status: 200,
            type: GetAerialPrecipitationLatestResponseDto,
            description: 'One series per polygon (the one with the max forecastDate)',
        },
        errors: [
            {
                status: 400,
                description: 'Missing required params or invalid combination (e.g. stat=Max with provider != ens)',
            },
            { status: 500, description: 'Internal server error' },
        ],
    })
    async getLatest(
        @Query() dto: GetAerialPrecipitationLatestQueryDto,
    ): Promise<GetAerialPrecipitationLatestResponseDto> {
        const query = GetAerialPrecipitationLatestMapper.toQuery(dto);
        try {
            const result = await this.cachingQueryBus.execute<AerialPrecipitationLatestResult>(query);
            return GetAerialPrecipitationLatestMapper.toResponseDto(result, query);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: `getLatest error: ${(error as Error).message}` });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // GET /aerial-precipitation/by-location/:locationId
    // ─────────────────────────────────────────────────────────────

    @Get('by-location/:locationId')
    @ApiParam({
        name: 'locationId',
        description: 'FEWS locationId (e.g. Cuenca.NAM.E_08, Sistema.Tajo.3, Cuenca.AEMET.1)',
        example: 'Cuenca.NAM.E_08',
    })
    @ApiEndpoint({
        summary: 'All active series for one polygon, grouped by (provider, accumulation, stat)',
        response: {
            status: 200,
            type: GetAerialPrecipitationByLocationResponseDto,
            description: 'Series grouped by (provider, accumulation, stat)',
        },
        errors: [
            { status: 400, description: 'Invalid locationId format' },
            { status: 500, description: 'Internal server error' },
        ],
    })
    async getByLocation(
        @Param('locationId') locationId: string,
        @Query() dto: GetAerialPrecipitationByLocationQueryDto,
    ): Promise<GetAerialPrecipitationByLocationResponseDto> {
        const query = GetAerialPrecipitationByLocationMapper.toQuery(locationId, dto);
        try {
            const result = await this.cachingQueryBus.execute<AerialPrecipitationByLocationResult>(query);
            return GetAerialPrecipitationByLocationMapper.toResponseDto(result, query);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: `getByLocation error: ${(error as Error).message}` });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // GET /aerial-precipitation
    // ─────────────────────────────────────────────────────────────

    @Get()
    @ApiEndpoint({
        summary: 'Paginated filtered list of aerial precipitation series',
        response: {
            status: 200,
            type: ListAerialPrecipitationResponseDto,
            description: 'Paginated list of series matching the filters',
        },
        errors: [
            { status: 400, description: 'Validation error (unknown param, invalid enum, out-of-range pagination)' },
            { status: 500, description: 'Internal server error' },
        ],
    })
    async list(@Query() dto: ListAerialPrecipitationQueryDto): Promise<ListAerialPrecipitationResponseDto> {
        const query = ListAerialPrecipitationMapper.toQuery(dto);
        try {
            const result = await this.cachingQueryBus.execute<AerialPrecipitationListResult>(query);
            return ListAerialPrecipitationMapper.toResponseDto(result, query);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: `list error: ${(error as Error).message}` });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
