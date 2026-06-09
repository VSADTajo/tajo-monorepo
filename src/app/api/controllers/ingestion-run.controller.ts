import { Controller, Get, HttpException, HttpStatus, Inject, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// DTOs
import {
    ListIngestionRunsResponseDto,
    ListIngestionRunsQueryDto,
    IngestionRunResponseDto,
} from '@api/dtos/ingestion-run.dtos';

// Mappers
import { ListIngestionRunsMapper, GetIngestionRunByIdMapper } from '@application/mappers/ingestion-run.mappers';

// Queries
import { ListIngestionRunsQuery, GetIngestionRunByIdQuery } from '@application/queries/ingestion-run.queries';

// Results
import { IngestionRunResult } from '@domain/results/ingestion-run.result';

// Errors
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Ingestion Runs')
@Controller()
export class IngestionRunController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Get('ingestion-runs')
    @ApiEndpoint({
        summary: 'List ingestion runs',
        response: { status: 200, type: ListIngestionRunsResponseDto, description: 'List of ingestion runs' },
        errors: [{ status: 400, description: 'Validation error (invalid providerConfigId format)' }],
    })
    async listIngestionRuns(@Query() query: ListIngestionRunsQueryDto): Promise<ListIngestionRunsResponseDto> {
        this.logger.log('List ingestion runs request');
        try {
            const result = await this.cachingQueryBus.execute<IngestionRunResult[]>(
                new ListIngestionRunsQuery({ providerConfigId: query.providerConfigId }),
            );
            return ListIngestionRunsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error listing ingestion runs: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('ingestion-runs/:id')
    @ApiEndpoint({
        summary: 'Get ingestion run by ID',
        response: { status: 200, type: IngestionRunResponseDto, description: 'Ingestion run details' },
        errors: [{ status: 404, description: 'Ingestion run not found' }],
    })
    async getIngestionRunById(@Param('id') id: string): Promise<IngestionRunResponseDto> {
        this.logger.log(`Get ingestion run request: id=${id}`);
        try {
            const result = await this.cachingQueryBus.execute<IngestionRunResult>(new GetIngestionRunByIdQuery({ id }));
            return GetIngestionRunByIdMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error getting ingestion run: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
