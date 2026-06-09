import { Body, Controller, Get, HttpException, HttpStatus, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// DTOs
import {
    ListSimulationsQueryDto,
    ListSimulationsResponseDto,
    GetSimulationByDateResponseDto,
    LatestSimulationResponseDto,
    HistoricalSimulationsQueryDto,
    HistoricalSimulationsResponseDto,
    FinalizeSimulationResponseDto,
    AvailableDatesQueryDto,
    AvailableDatesResponseDto,
    BatchIngestRequestDto,
    BatchIngestResponseDto,
} from '@api/dtos/simulation.dtos';

// Mappers
import {
    ListSimulationsMapper,
    GetSimulationByDateMapper,
    LatestSimulationMapper,
    HistoricalSimulationsMapper,
    FinalizeSimulationMapper,
    AvailableDatesMapper,
    BatchIngestMapper,
} from '@application/mappers/simulation.mappers';

// Queries
import {
    ListSimulationsQuery,
    GetSimulationByDateQuery,
    GetLatestSimulationQuery,
    GetHistoricalSimulationsQuery,
    GetAvailableDatesQuery,
} from '@application/queries/simulation.queries';

// Commands
import { FinalizeSimulationCommand } from '@application/commands/simulation.commands';

// Domain
import { Simulation } from '@domain/entities/simulation.entity';
import { PaginatedResult } from '@domain/ports/simulation-repository.port';

// Errors
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Simulations')
@Controller('simulations')
export class SimulationController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Post('with-predictions')
    @ApiEndpoint({
        summary: 'Create simulation with predictions in batch',
        body: BatchIngestRequestDto,
        response: { status: 201, type: BatchIngestResponseDto, description: 'Batch ingestion result' },
        errors: [{ status: 400, description: 'Invalid payload' }],
    })
    async batchIngest(@Body() dto: BatchIngestRequestDto): Promise<BatchIngestResponseDto> {
        this.logger.log({ msg: 'Batch ingest request', entity: 'Simulations' });
        try {
            const command = BatchIngestMapper.toCommand(dto);
            const result = await this.commandBus.execute(command);
            return BatchIngestMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Batch ingest error', entity: 'Simulations', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get()
    @ApiEndpoint({
        summary: 'List simulations with optional filters',
        response: { status: 200, type: ListSimulationsResponseDto, description: 'Paginated list of simulations' },
    })
    async listSimulations(@Query() dto: ListSimulationsQueryDto): Promise<ListSimulationsResponseDto> {
        this.logger.log('List simulations request');
        try {
            const query = new ListSimulationsQuery({
                filters: {
                    status: dto.status,
                    startDate: dto.startDate,
                    endDate: dto.endDate,
                    modmeteo: dto.modmeteo,
                    environment: dto.environment,
                    dataOrigin: dto.dataOrigin,
                },
                page: dto.page ?? 1,
                limit: dto.limit ?? 20,
            });
            const result = await this.cachingQueryBus.execute<PaginatedResult<Simulation>>(query);
            return ListSimulationsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'List simulations error', entity: 'Simulations', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('latest')
    @ApiEndpoint({
        summary: 'Get the latest finalized simulation',
        response: { status: 200, type: LatestSimulationResponseDto, description: 'Latest finalized simulation' },
        errors: [{ status: 404, description: 'No finalized simulation found' }],
    })
    async getLatest(): Promise<LatestSimulationResponseDto> {
        this.logger.log('Get latest simulation request');
        try {
            const result = await this.cachingQueryBus.execute<Simulation>(new GetLatestSimulationQuery());
            return LatestSimulationMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Get latest simulation error', entity: 'Simulations', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('historical')
    @ApiEndpoint({
        summary: 'Get historical finalized simulations',
        response: {
            status: 200,
            type: HistoricalSimulationsResponseDto,
            description: 'Paginated list of historical simulations',
        },
    })
    async getHistorical(@Query() dto: HistoricalSimulationsQueryDto): Promise<HistoricalSimulationsResponseDto> {
        this.logger.log('Get historical simulations request');
        try {
            const query = new GetHistoricalSimulationsQuery({
                page: dto.page ?? 1,
                limit: dto.limit ?? 20,
            });
            const result = await this.cachingQueryBus.execute<PaginatedResult<Simulation>>(query);
            return HistoricalSimulationsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Get historical simulations error', entity: 'Simulations', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('available-dates')
    @ApiEndpoint({
        summary: 'Get available simulation dates',
        response: { status: 200, type: AvailableDatesResponseDto, description: 'List of available dates' },
    })
    async getAvailableDates(@Query() dto: AvailableDatesQueryDto): Promise<AvailableDatesResponseDto> {
        this.logger.log('Get available dates request');
        try {
            const result = await this.cachingQueryBus.execute<string[]>(
                new GetAvailableDatesQuery({ dataOrigin: dto.dataOrigin }),
            );
            return AvailableDatesMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Get available dates error', entity: 'Simulations', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':simulationDate')
    @ApiEndpoint({
        summary: 'Get simulation by date',
        response: { status: 200, type: GetSimulationByDateResponseDto, description: 'Simulation found by date' },
        errors: [{ status: 404, description: 'Simulation not found' }],
    })
    async getByDate(@Param('simulationDate') simulationDate: string): Promise<GetSimulationByDateResponseDto> {
        this.logger.log(`Get simulation by date request: ${simulationDate}`);
        try {
            const result = await this.cachingQueryBus.execute<Simulation>(
                new GetSimulationByDateQuery({ simulationDate }),
            );
            return GetSimulationByDateMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Get simulation by date error', entity: 'Simulations', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Patch(':id/finalize')
    @ApiEndpoint({
        summary: 'Finalize a simulation',
        response: {
            status: 200,
            type: FinalizeSimulationResponseDto,
            description: 'Simulation finalized successfully',
        },
        errors: [
            { status: 404, description: 'Simulation not found' },
            { status: 409, description: 'Simulation cannot be finalized from current status' },
        ],
    })
    async finalize(@Param('id') id: string): Promise<FinalizeSimulationResponseDto> {
        this.logger.log(`Finalize simulation request: ${id}`);
        try {
            const command = new FinalizeSimulationCommand({ id });
            const result = await this.commandBus.execute(command);
            return FinalizeSimulationMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Finalize simulation error', entity: 'Simulations', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
