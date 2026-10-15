import { Controller, Get, HttpException, HttpStatus, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

// DTOs
import {
    GetMeteoalertaZoneThresholdsRequestDto,
    GetMeteoalertaZoneThresholdsResponseDto,
} from '@api/dtos/meteoalerta-zone.dtos';

// Mappers
import { GetMeteoalertaZoneThresholdsMapper } from '@application/mappers/meteoalerta-zone.mappers';

// Domain
import { ApiError } from '@domain/errors/api.error';
import { MeteoalertaZoneThresholdResult } from '@domain/results/meteoalerta-zone-threshold.result';

// Infrastructure
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Meteoalerta Zones')
@Controller('meteoalerta-zones')
export class MeteoalertaZoneController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Get('thresholds')
    @ApiEndpoint({
        summary: 'Get the 1h/12h precipitation thresholds of the meteoalerta zone containing a coordinate',
        response: {
            status: 200,
            type: GetMeteoalertaZoneThresholdsResponseDto,
            description: 'Zone containing the coordinate and its precipitation thresholds',
        },
        errors: [
            { status: 400, description: 'Validation error (missing or out-of-range lat/lon)' },
            { status: 404, description: 'The coordinate is outside every meteoalerta zone' },
        ],
    })
    async getThresholdsByPoint(
        @Query() dto: GetMeteoalertaZoneThresholdsRequestDto,
    ): Promise<GetMeteoalertaZoneThresholdsResponseDto> {
        try {
            const query = GetMeteoalertaZoneThresholdsMapper.toQuery(dto);
            const result = await this.cachingQueryBus.execute<MeteoalertaZoneThresholdResult>(query);
            return GetMeteoalertaZoneThresholdsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error getting meteoalerta zone thresholds: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
