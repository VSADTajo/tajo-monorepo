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

// DTOs
import {
    CreateBasinRequestDto,
    CreateBasinResponseDto,
    ListBasinsRequestDto,
    ListBasinsResponseDto,
    GetBasinResponseDto,
    UpdateBasinRequestDto,
    UpdateBasinResponseDto,
    ToggleBasinResponseDto,
    DeleteBasinResponseDto,
} from '@api/dtos/basin.dtos';

// Mappers
import {
    CreateBasinMapper,
    GetBasinByIdMapper,
    ListBasinsMapper,
    UpdateBasinMapper,
    ToggleBasinMapper,
    DeleteBasinMapper,
} from '@application/mappers/basin.mappers';

// Domain
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { GetBasinResult, ListBasinsResult } from '@domain/results/basin.results';

// Infrastructure
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Basins')
@Controller('basins')
export class BasinController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Post()
    @ApiEndpoint({
        summary: 'Create a new basin',
        body: CreateBasinRequestDto,
        response: { status: 201, type: CreateBasinResponseDto, description: 'Basin created successfully' },
        errors: [
            { status: 400, description: 'Validation error (invalid payload)' },
            { status: 409, description: 'Basin with this name or code already exists' },
        ],
    })
    async createBasin(@Body() dto: CreateBasinRequestDto): Promise<CreateBasinResponseDto> {
        this.logger.log(`Create basin request: ${dto.name}`);
        const command = CreateBasinMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return CreateBasinMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error creating basin: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get()
    @ApiEndpoint({
        summary: 'List basins with optional filters',
        response: { status: 200, type: ListBasinsResponseDto, description: 'List of basins' },
    })
    async listBasins(@Query() dto: ListBasinsRequestDto): Promise<ListBasinsResponseDto> {
        this.logger.log('List basins request');
        try {
            const query = ListBasinsMapper.toQuery(dto);
            const result = await this.cachingQueryBus.execute<ListBasinsResult>(query);
            return ListBasinsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error listing basins: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':id')
    @ApiEndpoint({
        summary: 'Get a basin by ID with its sub-basins',
        response: { status: 200, type: GetBasinResponseDto, description: 'Basin found' },
        errors: [{ status: 404, description: 'Basin not found' }],
    })
    async getBasin(@Param('id') id: string): Promise<GetBasinResponseDto> {
        this.logger.log(`Get basin request: id=${id}`);
        try {
            const query = GetBasinByIdMapper.toQuery(id);
            const result = await this.cachingQueryBus.execute<GetBasinResult>(query);
            return GetBasinByIdMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error getting basin: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Put(':id')
    @ApiEndpoint({
        summary: 'Update a basin',
        body: UpdateBasinRequestDto,
        response: { status: 200, type: UpdateBasinResponseDto, description: 'Basin updated' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 404, description: 'Basin not found' },
            { status: 409, description: 'Duplicate name or code' },
        ],
    })
    async updateBasin(@Param('id') id: string, @Body() dto: UpdateBasinRequestDto): Promise<UpdateBasinResponseDto> {
        this.logger.log(`Update basin request: id=${id}`);
        const command = UpdateBasinMapper.toCommand(id, dto);
        try {
            const result = await this.commandBus.execute(command);
            return UpdateBasinMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error updating basin: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Patch(':id/toggle')
    @ApiEndpoint({
        summary: 'Toggle basin active status',
        response: { status: 200, type: ToggleBasinResponseDto, description: 'Basin toggled' },
        errors: [{ status: 404, description: 'Basin not found' }],
    })
    async toggleBasin(@Param('id') id: string): Promise<ToggleBasinResponseDto> {
        this.logger.log(`Toggle basin request: id=${id}`);
        const command = ToggleBasinMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return ToggleBasinMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error toggling basin: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Delete(':id')
    @ApiEndpoint({
        summary: 'Soft delete a basin',
        response: { status: 200, type: DeleteBasinResponseDto, description: 'Basin deactivated' },
        errors: [{ status: 404, description: 'Basin not found' }],
    })
    async deleteBasin(@Param('id') id: string): Promise<DeleteBasinResponseDto> {
        this.logger.log(`Delete basin request: id=${id}`);
        const command = DeleteBasinMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return DeleteBasinMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error deleting basin: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
