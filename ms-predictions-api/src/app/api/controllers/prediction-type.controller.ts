import { Body, Controller, Get, HttpException, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// DTOs
import {
    CreatePredictionTypeRequestDto,
    CreatePredictionTypeResponseDto,
    ListPredictionTypesResponseDto,
    StationPredictionTypesResponseDto,
} from '@api/dtos/prediction-type.dtos';

// Mappers
import {
    ListPredictionTypesMapper,
    CreatePredictionTypeMapper,
    ListStationPredictionTypesMapper,
} from '@application/mappers/prediction-type.mappers';

// Results
import { ListPredictionTypesResult } from '@domain/results/prediction-type.result';
import { PredictionTypeResult } from '@domain/results/prediction-type.result';
import { StationPredictionTypesResult } from '@domain/results/prediction-type.result';

// Errors
import { EntityError } from '@domain/errors/entity.error';
import { ApiError } from '@domain/errors/api.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('PredictionTypes')
@Controller('prediction-types')
export class PredictionTypeController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly cachingQueryBus: CachingQueryBus,
        private readonly commandBus: CommandBus,
    ) {}

    @Get()
    @ApiEndpoint({
        summary: 'List all prediction types',
        response: { status: 200, type: ListPredictionTypesResponseDto, description: 'List of prediction types' },
    })
    async list(): Promise<ListPredictionTypesResponseDto> {
        this.logger.log('List prediction types request');
        try {
            const query = ListPredictionTypesMapper.toQuery();
            const result = await this.cachingQueryBus.execute<ListPredictionTypesResult>(query);
            return ListPredictionTypesMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error listing prediction types: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('by-station/:stationCode')
    @ApiEndpoint({
        summary: 'List prediction types that have data for a station',
        response: {
            status: 200,
            type: StationPredictionTypesResponseDto,
            description: 'Prediction types with data (results) for the given station code',
        },
    })
    async listByStation(@Param('stationCode') stationCode: string): Promise<StationPredictionTypesResponseDto> {
        this.logger.log(`List prediction types with data for station: ${stationCode}`);
        try {
            const query = ListStationPredictionTypesMapper.toQuery(stationCode);
            const result = await this.cachingQueryBus.execute<StationPredictionTypesResult>(query);
            return ListStationPredictionTypesMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error listing prediction types by station: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post()
    @ApiEndpoint({
        summary: 'Create a prediction type',
        body: CreatePredictionTypeRequestDto,
        response: { status: 201, type: CreatePredictionTypeResponseDto, description: 'Prediction type created' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 409, description: 'Prediction type with this name already exists' },
        ],
    })
    async create(@Body() dto: CreatePredictionTypeRequestDto): Promise<CreatePredictionTypeResponseDto> {
        this.logger.log(`Create prediction type request: name=${dto.name}, unit=${dto.unit}`);
        try {
            const command = CreatePredictionTypeMapper.toCommand(dto);
            const result = await this.commandBus.execute<typeof command, PredictionTypeResult>(command);
            return CreatePredictionTypeMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error creating prediction type: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
