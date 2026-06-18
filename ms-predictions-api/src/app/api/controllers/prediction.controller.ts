import { Controller, Get, HttpException, HttpStatus, Inject, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// DTOs
import {
    HistoricalPredictionsQueryDto,
    HistoricalPredictionsResponseDto,
    RawPredictionsResponseDto,
    ForecastPredictionsQueryDto,
    ForecastPredictionsResponseDto,
    AvailableDatesQueryDto,
    AvailableDatesResponseDto,
    MaxAndLatestValuesQueryDto,
    MaxAndLatestValuesResponseDto,
} from '@api/dtos/prediction.dtos';

// Mappers
import {
    HistoricalPredictionsMapper,
    RawPredictionsMapper,
    ForecastPredictionsMapper,
    AvailableDatesMapper,
    MaxAndLatestValuesMapper,
    SimulationDatesByStationMapper,
} from '@application/mappers/prediction.mappers';

// Results
import { HistoricalPredictionsResult } from '@domain/results/historical-predictions.result';
import { LegacyPredictionsResult } from '@domain/results/legacy-predictions.result';
import { MaxAndLatestValuesResult } from '@domain/results/max-and-latest-values.result';
import { SimulationDateSummaryItem } from '@domain/ports/prediction-repository.port';

// Errors
import { ApiError } from '@domain/errors/api.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Predictions')
@Controller('predictions')
export class PredictionController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Get('available-dates')
    @ApiEndpoint({
        summary: 'Get available simulation dates, optionally filtered by station with prediction type details',
        response: { status: 200, type: AvailableDatesResponseDto, description: 'Available dates with optional detail' },
    })
    async getAvailableDates(@Query() dto: AvailableDatesQueryDto): Promise<AvailableDatesResponseDto> {
        this.logger.log({ msg: 'Get available dates request', entity: 'Predictions', filters: dto });
        try {
            if (dto.stationId) {
                const query = SimulationDatesByStationMapper.toQuery(dto.stationId, dto.predictionType);
                const result = await this.cachingQueryBus.execute<SimulationDateSummaryItem[]>(query);
                return SimulationDatesByStationMapper.toResponseDto(result);
            }
            const query = AvailableDatesMapper.toQuery(dto.dataOrigin, dto.predictionType);
            const result = await this.cachingQueryBus.execute<string[]>(query);
            return AvailableDatesMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Get available dates error', entity: 'Predictions', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('max-and-latest-values')
    @ApiEndpoint({
        summary: 'Get max and latest values per station',
        response: {
            status: 200,
            type: MaxAndLatestValuesResponseDto,
            description: 'Max and latest values per station',
        },
    })
    async getMaxAndLatest(@Query() dto: MaxAndLatestValuesQueryDto): Promise<MaxAndLatestValuesResponseDto> {
        this.logger.log('Get max and latest values request');
        try {
            const query = MaxAndLatestValuesMapper.toQuery(dto);
            const result = await this.cachingQueryBus.execute<MaxAndLatestValuesResult>(query);
            return MaxAndLatestValuesMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Get max and latest values error', entity: 'Predictions', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('raw/:provider/:simulationDate')
    @ApiEndpoint({
        summary: 'Get raw predictions by provider and simulation date',
        response: { status: 200, type: RawPredictionsResponseDto, description: 'Raw predictions' },
    })
    async getRaw(
        @Param('provider') provider: string,
        @Param('simulationDate') simulationDate: string,
    ): Promise<RawPredictionsResponseDto> {
        this.logger.log(`Get raw predictions request: provider=${provider}, date=${simulationDate}`);
        try {
            const query = RawPredictionsMapper.toQuery(provider, simulationDate);
            const result = await this.cachingQueryBus.execute<LegacyPredictionsResult>(query);
            return RawPredictionsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Get raw predictions error', entity: 'Predictions', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('forecast')
    @ApiEndpoint({
        summary: 'Get forecast predictions with optional filters',
        response: { status: 200, type: ForecastPredictionsResponseDto, description: 'Forecast predictions' },
    })
    async getForecast(@Query() dto: ForecastPredictionsQueryDto): Promise<ForecastPredictionsResponseDto> {
        this.logger.log({ msg: 'Get forecast predictions request', entity: 'Predictions', filters: dto });
        try {
            const query = ForecastPredictionsMapper.toQuery(dto);
            const result = await this.cachingQueryBus.execute<LegacyPredictionsResult>(query);
            return ForecastPredictionsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Get forecast predictions error', entity: 'Predictions', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('historical')
    @ApiEndpoint({
        summary: 'Reconstruct the deduplicated observed timeline for a station, prediction type and date window',
        response: {
            status: 200,
            type: HistoricalPredictionsResponseDto,
            description:
                'Observed points ordered ascending by date. For each timestamp the row with the latest createdAt wins.',
        },
    })
    async getHistorical(@Query() dto: HistoricalPredictionsQueryDto): Promise<HistoricalPredictionsResponseDto> {
        this.logger.log({ msg: 'Reconstruct historical timeline request', entity: 'Predictions', filters: dto });
        try {
            const query = HistoricalPredictionsMapper.toQuery(dto);
            const result = await this.cachingQueryBus.execute<HistoricalPredictionsResult>(query);
            return HistoricalPredictionsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Get historical timeline error', entity: 'Predictions', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
