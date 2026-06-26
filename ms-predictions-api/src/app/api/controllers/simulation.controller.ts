import {
    Body,
    Controller,
    Delete,
    Get,
    HttpException,
    HttpStatus,
    Inject,
    Param,
    Patch,
    Post,
    Query,
    Req,
    Res,
    StreamableFile,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import type { Response } from 'express';
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
    DeleteSimulationResponseDto,
    AvailableDatesQueryDto,
    SimulationAvailableDatesResponseDto,
    BatchIngestRequestDto,
    BatchIngestResponseDto,
    CreateManualSimulationRequestDto,
    ManualSimulationResponseDto,
    ListManualSimulationsQueryDto,
    ListManualSimulationsResponseDto,
    GetManualSimulationByIdResponseDto,
    SimulationFilesResponseDto,
} from '@api/dtos/simulation.dtos';

// Mappers
import {
    ListSimulationsMapper,
    GetSimulationByDateMapper,
    LatestSimulationMapper,
    HistoricalSimulationsMapper,
    FinalizeSimulationMapper,
    DeleteSimulationMapper,
    AvailableDatesMapper,
    BatchIngestMapper,
    SimulationFilesMapper,
} from '@application/mappers/simulation.mappers';
import {
    CreateManualSimulationMapper,
    ListManualSimulationsMapper,
    GetManualSimulationByIdMapper,
} from '@application/mappers/manual-simulation.mappers';

// Queries
import {
    ListSimulationsQuery,
    GetSimulationByDateQuery,
    GetLatestSimulationQuery,
    GetHistoricalSimulationsQuery,
    GetAvailableDatesQuery,
    GetSimulationFilesQuery,
    DownloadSimulationFileQuery,
} from '@application/queries/simulation.queries';
// Commands
import { FinalizeSimulationCommand, DeleteSimulationCommand } from '@application/commands/simulation.commands';
import { CreateManualSimulationCommand } from '@application/commands/manual-simulation.commands';

// Domain
import { Simulation } from '@domain/entities/simulation.entity';
import { PaginatedResult } from '@domain/ports/simulation-repository.port';
import { ManualSimulationResult } from '@domain/results/manual-simulation.result';
import { PaginatedManualSimulationResult } from '@domain/results/manual-simulation.result';
import {
    SimulationFilesResult,
    SimulationFileDownloadResult,
    SimulationFolder,
    SIMULATION_FOLDERS,
} from '@domain/results/simulation-files.result';
import { SftpFileNameValueObject } from '@domain/value-objects/sftp-file-name.value-object';

// Errors
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ProviderError } from '@domain/errors/provider.error';
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
        summary: 'List simulations with optional filters, station-code filter and sorting',
        response: { status: 200, type: ListSimulationsResponseDto, description: 'Paginated list of simulations' },
        errors: [{ status: 400, description: 'Invalid query parameter (e.g. unknown sortBy or sortOrder)' }],
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
                    stationCode: dto.stationCode,
                    sortBy: dto.sortBy,
                    sortOrder: dto.sortOrder,
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
        response: { status: 200, type: SimulationAvailableDatesResponseDto, description: 'List of available dates' },
    })
    async getAvailableDates(@Query() dto: AvailableDatesQueryDto): Promise<SimulationAvailableDatesResponseDto> {
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

    @Post('manual')
    @ApiEndpoint({
        summary: 'Create a manual simulation with maneuvers',
        body: CreateManualSimulationRequestDto,
        response: {
            status: 201,
            type: ManualSimulationResponseDto,
            description: 'Manual simulation created and dispatched',
        },
        errors: [
            { status: 400, description: 'Validation error — invalid payload or negative outputFlowValue' },
            { status: 503, description: 'SFTP upload failed — simulation persisted in CREATED status' },
        ],
    })
    async createManual(
        @Body() dto: CreateManualSimulationRequestDto,
        @Req() req: import('express').Request,
    ): Promise<ManualSimulationResponseDto> {
        this.logger.log({ msg: 'Create manual simulation request', entity: 'Simulations' });
        const rawName = req.headers['x-user-name'];
        const operatorName = Array.isArray(rawName) ? rawName[0] : rawName;
        const createdBy = operatorName ? decodeURIComponent(operatorName) : null;
        const command = CreateManualSimulationMapper.toCommand(dto, createdBy);
        try {
            const result = await this.commandBus.execute<CreateManualSimulationCommand, ManualSimulationResult>(
                command,
            );
            return CreateManualSimulationMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            if (error instanceof ProviderError) {
                throw new HttpException(error.message, HttpStatus.SERVICE_UNAVAILABLE);
            }
            this.logger.error({ msg: 'Create manual simulation error', entity: 'Simulations', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('manual')
    @ApiEndpoint({
        summary: 'List manual simulations with optional filters',
        response: {
            status: 200,
            type: ListManualSimulationsResponseDto,
            description: 'Paginated list of manual simulations',
        },
    })
    async listManual(@Query() dto: ListManualSimulationsQueryDto): Promise<ListManualSimulationsResponseDto> {
        this.logger.log('List manual simulations request');
        try {
            const query = ListManualSimulationsMapper.toQuery(dto);
            const result = await this.cachingQueryBus.execute<PaginatedManualSimulationResult>(query);
            return ListManualSimulationsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'List manual simulations error', entity: 'Simulations', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('manual/:id')
    @ApiEndpoint({
        summary: 'Get a manual simulation by ID',
        response: { status: 200, type: GetManualSimulationByIdResponseDto, description: 'Manual simulation found' },
        errors: [{ status: 404, description: 'Simulation not found or is not MANUAL type' }],
    })
    async getManualById(@Param('id') id: string): Promise<GetManualSimulationByIdResponseDto> {
        this.logger.log(`Get manual simulation by id request: ${id}`);
        try {
            const query = GetManualSimulationByIdMapper.toQuery(id);
            const result = await this.cachingQueryBus.execute<ManualSimulationResult>(query);
            return GetManualSimulationByIdMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Get manual simulation error', entity: 'Simulations', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':id/files')
    @ApiEndpoint({
        summary: 'List the SFTP input and output files of a simulation (read-only)',
        response: {
            status: 200,
            type: SimulationFilesResponseDto,
            description: 'Input and output files for the simulation',
        },
        errors: [
            { status: 400, description: 'Invalid simulation id' },
            { status: 404, description: 'Simulation not found' },
        ],
    })
    async listSimulationFiles(@Param('id') id: string): Promise<SimulationFilesResponseDto> {
        this.logger.log(`List simulation files request: ${id}`);

        if (!isUUID(id)) {
            throw new HttpException('Invalid simulation id', HttpStatus.BAD_REQUEST);
        }

        try {
            const result = await this.cachingQueryBus.execute<SimulationFilesResult>(
                new GetSimulationFilesQuery({ id }),
            );
            return SimulationFilesMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'List simulation files error', entity: 'Simulations', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':id/files/download')
    @ApiOperation({ summary: 'Download a single SFTP file of a simulation (read-only)' })
    @ApiProduces('application/octet-stream')
    @ApiResponse({ status: 200, description: 'File binary stream' })
    @ApiResponse({ status: 400, description: 'Invalid simulation id, folder or file name' })
    @ApiResponse({ status: 404, description: 'Simulation or file not found' })
    async downloadSimulationFile(
        @Param('id') id: string,
        @Query('folder') folder: string,
        @Query('name') name: string,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        this.logger.log(`Download simulation file request: ${id} ${folder}/${name}`);

        if (!isUUID(id)) {
            throw new HttpException('Invalid simulation id', HttpStatus.BAD_REQUEST);
        }
        if (!SIMULATION_FOLDERS.includes(folder as SimulationFolder)) {
            throw new HttpException('folder must be either "input" or "output"', HttpStatus.BAD_REQUEST);
        }

        try {
            const safeName = new SftpFileNameValueObject(name).value;
            const result = await this.cachingQueryBus.execute<SimulationFileDownloadResult>(
                new DownloadSimulationFileQuery({ id, folder: folder as SimulationFolder, fileName: safeName }),
            );

            res.set({
                'Content-Type': result.contentType,
                'Content-Disposition': `attachment; filename="${result.fileName}"`,
                'Content-Length': result.content.length.toString(),
            });
            return new StreamableFile(result.content);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Download simulation file error', entity: 'Simulations', error: String(error) });
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

    @Delete(':id')
    @ApiEndpoint({
        summary: 'Soft-delete a simulation and its exclusively-associated maneuvers',
        response: {
            status: 200,
            type: DeleteSimulationResponseDto,
            description: 'Simulation soft-deleted',
        },
        errors: [{ status: 404, description: 'Simulation not found' }],
    })
    async deleteSimulation(@Param('id') id: string): Promise<DeleteSimulationResponseDto> {
        this.logger.log(`Delete simulation request: ${id}`);
        try {
            const command = new DeleteSimulationCommand({ id });
            const result = await this.commandBus.execute(command);
            return DeleteSimulationMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Delete simulation error', entity: 'Simulations', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
