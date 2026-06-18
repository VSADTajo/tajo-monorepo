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

// Infrastructure
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// DTOs
import {
    CreateSubBasinRequestDto,
    CreateSubBasinResponseDto,
    ListSubBasinsRequestDto,
    ListSubBasinsResponseDto,
    GetSubBasinResponseDto,
    UpdateSubBasinRequestDto,
    UpdateSubBasinResponseDto,
    ToggleSubBasinResponseDto,
    DeleteSubBasinResponseDto,
} from '@api/dtos/sub-basin.dtos';

// Mappers
import {
    CreateSubBasinMapper,
    GetSubBasinByIdMapper,
    ListSubBasinsMapper,
    UpdateSubBasinMapper,
    ToggleSubBasinMapper,
    DeleteSubBasinMapper,
} from '@application/mappers/sub-basin.mappers';

// Results
import { GetSubBasinResult, ListSubBasinsResult } from '@domain/results/sub-basin.results';

// Errors
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Sub-Basins')
@Controller('sub-basins')
export class SubBasinController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Post()
    @ApiEndpoint({
        summary: 'Create a new sub-basin',
        body: CreateSubBasinRequestDto,
        response: { status: 201, type: CreateSubBasinResponseDto, description: 'Sub-basin created successfully' },
        errors: [
            { status: 400, description: 'Validation error (invalid payload)' },
            { status: 409, description: 'Sub-basin with this name or code already exists' },
        ],
    })
    async createSubBasin(@Body() dto: CreateSubBasinRequestDto): Promise<CreateSubBasinResponseDto> {
        this.logger.log(`Create sub-basin request: ${dto.name}`);
        const command = CreateSubBasinMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return CreateSubBasinMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error creating sub-basin', entity: 'SubBasin', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get()
    @ApiEndpoint({
        summary: 'List sub-basins with optional filters',
        response: { status: 200, type: ListSubBasinsResponseDto, description: 'List of sub-basins' },
    })
    async listSubBasins(@Query() dto: ListSubBasinsRequestDto): Promise<ListSubBasinsResponseDto> {
        this.logger.log('List sub-basins request');
        try {
            const query = ListSubBasinsMapper.toQuery(dto);
            const result = await this.cachingQueryBus.execute<ListSubBasinsResult>(query);
            return ListSubBasinsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error listing sub-basins', entity: 'SubBasin', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':id')
    @ApiEndpoint({
        summary: 'Get a sub-basin by ID with its stations',
        response: { status: 200, type: GetSubBasinResponseDto, description: 'Sub-basin found' },
        errors: [{ status: 404, description: 'Sub-basin not found' }],
    })
    async getSubBasin(@Param('id') id: string): Promise<GetSubBasinResponseDto> {
        this.logger.log(`Get sub-basin request: id=${id}`);
        try {
            const query = GetSubBasinByIdMapper.toQuery(id);
            const result = await this.cachingQueryBus.execute<GetSubBasinResult>(query);
            return GetSubBasinByIdMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error getting sub-basin', entity: 'SubBasin', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Put(':id')
    @ApiEndpoint({
        summary: 'Update a sub-basin',
        body: UpdateSubBasinRequestDto,
        response: { status: 200, type: UpdateSubBasinResponseDto, description: 'Sub-basin updated' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 404, description: 'Sub-basin not found' },
            { status: 409, description: 'Duplicate code or name' },
        ],
    })
    async updateSubBasin(
        @Param('id') id: string,
        @Body() dto: UpdateSubBasinRequestDto,
    ): Promise<UpdateSubBasinResponseDto> {
        this.logger.log(`Update sub-basin request: id=${id}`);
        const command = UpdateSubBasinMapper.toCommand(id, dto);
        try {
            const result = await this.commandBus.execute(command);
            return UpdateSubBasinMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error updating sub-basin', entity: 'SubBasin', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Patch(':id/toggle')
    @ApiEndpoint({
        summary: 'Toggle sub-basin active status',
        response: { status: 200, type: ToggleSubBasinResponseDto, description: 'Sub-basin toggled' },
        errors: [{ status: 404, description: 'Sub-basin not found' }],
    })
    async toggleSubBasin(@Param('id') id: string): Promise<ToggleSubBasinResponseDto> {
        this.logger.log(`Toggle sub-basin request: id=${id}`);
        const command = ToggleSubBasinMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return ToggleSubBasinMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error toggling sub-basin', entity: 'SubBasin', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Delete(':id')
    @ApiEndpoint({
        summary: 'Soft delete a sub-basin',
        response: { status: 200, type: DeleteSubBasinResponseDto, description: 'Sub-basin deactivated' },
        errors: [{ status: 404, description: 'Sub-basin not found' }],
    })
    async deleteSubBasin(@Param('id') id: string): Promise<DeleteSubBasinResponseDto> {
        this.logger.log(`Delete sub-basin request: id=${id}`);
        const command = DeleteSubBasinMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return DeleteSubBasinMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error deleting sub-basin', entity: 'SubBasin', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
