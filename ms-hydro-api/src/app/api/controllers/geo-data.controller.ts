import { Controller, Get, HttpException, HttpStatus, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

// DTOs
import { SearchGeoDataRequestDto, SearchGeoDataResponseDto } from '@api/dtos/geo-data.dtos';

// Mappers
import { SearchGeoDataMapper } from '@application/mappers/geo-data.mappers';

// Domain
import { ApiError } from '@domain/errors/api.error';
import { SearchGeoDataResult } from '@domain/results/search-geo-data.result';

// Infrastructure
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Geo Data')
@Controller('search')
export class GeoDataController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Get()
    @ApiEndpoint({
        summary: 'Search across all CHT geographic entities',
        response: {
            status: 200,
            type: SearchGeoDataResponseDto,
            description: 'List of matching geographic entities',
        },
        errors: [{ status: 400, description: 'Validation error (missing or invalid query)' }],
    })
    async search(@Query() dto: SearchGeoDataRequestDto): Promise<SearchGeoDataResponseDto> {
        this.logger.log(`Search geo data request: q=${dto.q}`);
        try {
            const query = SearchGeoDataMapper.toQuery(dto);
            const result = await this.cachingQueryBus.execute<SearchGeoDataResult[]>(query);
            return SearchGeoDataMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error searching geo data: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
