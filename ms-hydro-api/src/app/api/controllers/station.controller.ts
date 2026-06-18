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
    Put,
    Query,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// DTOs
import {
    CreateStationRequestDto,
    CreateStationResponseDto,
    GetStationResponseDto,
    GetStationBySubBasinNameResponseDto,
    GetStationByCodeResponseDto,
    UpdateThresholdRequestDto,
    UpdateThresholdResponseDto,
    GetThresholdResponseDto,
    ListStationsRequestDto,
    ListStationsResponseDto,
    UpdateStationRequestDto,
    UpdateStationResponseDto,
    ToggleStationResponseDto,
    DeleteStationResponseDto,
} from '@api/dtos/station.dtos';

// Mappers
import {
    CreateStationMapper,
    GetStationByIdMapper,
    GetStationBySubBasinNameMapper,
    GetStationByCodeMapper,
    UpdateThresholdMapper,
    GetThresholdMapper,
    ListStationsMapper,
    UpdateStationMapper,
    ToggleStationMapper,
    DeleteStationMapper,
} from '@application/mappers/station.mappers';

// Results
import { GetStationResult, ListStationsResult, GetStationBySubBasinNameResult } from '@domain/results/station.results';
import { GetThresholdResult } from '@domain/results/station.results';

// Errors
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Stations')
@Controller('stations')
export class StationController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Post()
    @ApiEndpoint({
        summary: 'Create a new station',
        body: CreateStationRequestDto,
        response: { status: 201, type: CreateStationResponseDto, description: 'Station created successfully' },
        errors: [
            { status: 400, description: 'Validation error (invalid payload)' },
            { status: 409, description: 'Station with this code already exists' },
        ],
    })
    async createStation(@Body() dto: CreateStationRequestDto): Promise<CreateStationResponseDto> {
        this.logger.log(`Create station request: ${dto.stationCode}`);
        const command = CreateStationMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return CreateStationMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error creating station', entity: 'Station', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get()
    @ApiEndpoint({
        summary: 'List stations with optional filters',
        response: { status: 200, type: ListStationsResponseDto, description: 'List of stations' },
    })
    async listStations(@Query() dto: ListStationsRequestDto): Promise<ListStationsResponseDto> {
        this.logger.log('List stations request');
        try {
            const query = ListStationsMapper.toQuery(dto);
            const result = await this.cachingQueryBus.execute<ListStationsResult>(query);
            return ListStationsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error listing stations', entity: 'Station', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('by-code/:code')
    @ApiEndpoint({
        summary: 'Get a station by SAIH station code',
        response: { status: 200, type: GetStationByCodeResponseDto, description: 'Station found' },
        errors: [{ status: 404, description: 'Station not found for this code' }],
    })
    async getStationByCode(@Param('code') code: string): Promise<GetStationByCodeResponseDto> {
        this.logger.log(`Get station by code request: code=${code}`);
        try {
            const query = GetStationByCodeMapper.toQuery(code);
            const result = await this.cachingQueryBus.execute<GetStationResult>(query);
            return GetStationByCodeMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error getting station by code', entity: 'Station', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':id')
    @ApiEndpoint({
        summary: 'Get a station by ID',
        response: { status: 200, type: GetStationResponseDto, description: 'Station found' },
        errors: [{ status: 404, description: 'Station not found' }],
    })
    async getStation(@Param('id') id: string): Promise<GetStationResponseDto> {
        this.logger.log(`Get station request: id=${id}`);
        try {
            const query = GetStationByIdMapper.toQuery(id);
            const result = await this.cachingQueryBus.execute<GetStationResult>(query);
            return GetStationByIdMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error getting station', entity: 'Station', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('by-sub-basin-name/:subBasinName')
    @ApiEndpoint({
        summary: 'Get a station by sub-basin name',
        response: { status: 200, type: GetStationBySubBasinNameResponseDto, description: 'Station found' },
        errors: [{ status: 404, description: 'Station not found for this sub-basin name' }],
    })
    async getStationBySubBasinName(
        @Param('subBasinName') subBasinName: string,
    ): Promise<GetStationBySubBasinNameResponseDto> {
        const decodedSubBasinName = decodeURIComponent(subBasinName);
        this.logger.log(`Get station by sub-basin name request: subBasinName=${decodedSubBasinName}`);
        try {
            const query = GetStationBySubBasinNameMapper.toQuery(decodedSubBasinName);
            const result = await this.cachingQueryBus.execute<GetStationBySubBasinNameResult>(query);
            return GetStationBySubBasinNameMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error getting station by sub-basin name', entity: 'Station', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Put(':id')
    @ApiEndpoint({
        summary: 'Update a station',
        body: UpdateStationRequestDto,
        response: { status: 200, type: UpdateStationResponseDto, description: 'Station updated' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 404, description: 'Station not found' },
            { status: 409, description: 'Duplicate subBasinName or stationCode' },
        ],
    })
    async updateStation(
        @Param('id') id: string,
        @Body() dto: UpdateStationRequestDto,
    ): Promise<UpdateStationResponseDto> {
        this.logger.log(`Update station request: id=${id}`);
        const command = UpdateStationMapper.toCommand(id, dto);
        try {
            const result = await this.commandBus.execute(command);
            return UpdateStationMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error updating station', entity: 'Station', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Patch(':id/toggle')
    @ApiEndpoint({
        summary: 'Toggle station active status',
        response: { status: 200, type: ToggleStationResponseDto, description: 'Station toggled' },
        errors: [{ status: 404, description: 'Station not found' }],
    })
    async toggleStation(@Param('id') id: string): Promise<ToggleStationResponseDto> {
        this.logger.log(`Toggle station request: id=${id}`);
        const command = ToggleStationMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return ToggleStationMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error toggling station', entity: 'Station', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Put(':id/threshold')
    @ApiEndpoint({
        summary: 'Update a station threshold',
        body: UpdateThresholdRequestDto,
        response: { status: 200, type: UpdateThresholdResponseDto, description: 'Threshold updated successfully' },
        errors: [
            { status: 400, description: 'Validation error (invalid threshold value)' },
            { status: 404, description: 'Station not found' },
        ],
    })
    async updateThreshold(
        @Param('id') id: string,
        @Body() dto: UpdateThresholdRequestDto,
    ): Promise<UpdateThresholdResponseDto> {
        this.logger.log(`Update threshold request: id=${id}`);
        const command = UpdateThresholdMapper.toCommand(id, dto);
        try {
            const result = await this.commandBus.execute(command);
            return UpdateThresholdMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error updating threshold', entity: 'Station', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':id/threshold')
    @ApiEndpoint({
        summary: 'Get a station threshold',
        response: { status: 200, type: GetThresholdResponseDto, description: 'Threshold found' },
        errors: [{ status: 404, description: 'Station not found' }],
    })
    async getThreshold(@Param('id') id: string): Promise<GetThresholdResponseDto> {
        this.logger.log(`Get threshold request: id=${id}`);
        try {
            const query = GetThresholdMapper.toQuery(id);
            const result = await this.cachingQueryBus.execute<GetThresholdResult>(query);
            return GetThresholdMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error getting threshold', entity: 'Station', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Delete(':id')
    @ApiEndpoint({
        summary: 'Soft delete a station',
        response: { status: 200, type: DeleteStationResponseDto, description: 'Station deactivated' },
        errors: [{ status: 404, description: 'Station not found' }],
    })
    async deleteStation(@Param('id') id: string): Promise<DeleteStationResponseDto> {
        this.logger.log(`Delete station request: id=${id}`);
        const command = DeleteStationMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return DeleteStationMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error deleting station', entity: 'Station', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
