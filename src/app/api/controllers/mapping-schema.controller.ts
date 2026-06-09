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
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

// DTOs
import {
    CreateMappingSchemaRequestDto,
    UpdateMappingSchemaRequestDto,
    ToggleMappingSchemaRequestDto,
    MappingSchemaResponseDto,
    ListMappingSchemasResponseDto,
    DeleteMappingSchemaResponseDto,
} from '@api/dtos/mapping-schema.dtos';

// Mappers
import {
    CreateMappingSchemaMapper,
    UpdateMappingSchemaMapper,
    DeleteMappingSchemaMapper,
    ToggleMappingSchemaMapper,
    ListMappingSchemasMapper,
    GetMappingSchemaByIdMapper,
} from '@application/mappers/mapping-schema.mappers';

// Domain
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

// Domain results
import { MappingSchemaResult, ListMappingSchemasResult } from '@domain/results/mapping-schema.result';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

@ApiTags('Mapping Schemas')
@Controller('mapping-schemas')
export class MappingSchemaController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    // ─────────────────────────────────────────────────────────────
    // Create
    // ─────────────────────────────────────────────────────────────

    @Post()
    @ApiEndpoint({
        summary: 'Create a mapping schema',
        body: CreateMappingSchemaRequestDto,
        response: { status: 201, type: MappingSchemaResponseDto, description: 'Schema created' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 409, description: 'Schema already exists for this path' },
        ],
    })
    async create(@Body() dto: CreateMappingSchemaRequestDto): Promise<MappingSchemaResponseDto> {
        const command = CreateMappingSchemaMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return CreateMappingSchemaMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // List All
    // ─────────────────────────────────────────────────────────────

    @Get()
    @ApiEndpoint({
        summary: 'List all mapping schemas',
        response: { status: 200, type: ListMappingSchemasResponseDto, description: 'List of schemas' },
    })
    async findAll(): Promise<ListMappingSchemasResponseDto> {
        const query = ListMappingSchemasMapper.toQuery();
        try {
            const result = await this.cachingQueryBus.execute<ListMappingSchemasResult>(query);
            return ListMappingSchemasMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Get by ID
    // ─────────────────────────────────────────────────────────────

    @Get(':id')
    @ApiEndpoint({
        summary: 'Get a mapping schema by ID',
        response: { status: 200, type: MappingSchemaResponseDto, description: 'Schema details' },
        errors: [{ status: 404, description: 'Schema not found' }],
    })
    async findById(@Param('id') id: string): Promise<MappingSchemaResponseDto> {
        const query = GetMappingSchemaByIdMapper.toQuery(id);
        try {
            const result = await this.cachingQueryBus.execute<MappingSchemaResult>(query);
            return GetMappingSchemaByIdMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Update
    // ─────────────────────────────────────────────────────────────

    @Put(':id')
    @ApiEndpoint({
        summary: 'Update a mapping schema',
        body: UpdateMappingSchemaRequestDto,
        response: { status: 200, type: MappingSchemaResponseDto, description: 'Schema updated' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 404, description: 'Schema not found' },
            { status: 409, description: 'Schema already exists for this path' },
        ],
    })
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateMappingSchemaRequestDto,
    ): Promise<MappingSchemaResponseDto> {
        const command = UpdateMappingSchemaMapper.toCommand(id, dto);
        try {
            const result = await this.commandBus.execute(command);
            return UpdateMappingSchemaMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Delete
    // ─────────────────────────────────────────────────────────────

    @Delete(':id')
    @ApiEndpoint({
        summary: 'Delete a mapping schema',
        response: { status: 200, type: DeleteMappingSchemaResponseDto, description: 'Schema deleted' },
        errors: [{ status: 404, description: 'Schema not found' }],
    })
    async delete(@Param('id') id: string): Promise<DeleteMappingSchemaResponseDto> {
        const command = DeleteMappingSchemaMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return DeleteMappingSchemaMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Toggle
    // ─────────────────────────────────────────────────────────────

    @Patch(':id/toggle')
    @ApiEndpoint({
        summary: 'Toggle mapping schema active/inactive',
        body: ToggleMappingSchemaRequestDto,
        response: { status: 200, type: MappingSchemaResponseDto, description: 'Schema toggled' },
        errors: [{ status: 404, description: 'Schema not found' }],
    })
    async toggle(
        @Param('id') id: string,
        @Body() dto: ToggleMappingSchemaRequestDto,
    ): Promise<MappingSchemaResponseDto> {
        const command = ToggleMappingSchemaMapper.toCommand(id, dto);
        try {
            const result = await this.commandBus.execute(command);
            return ToggleMappingSchemaMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Error Handler
    // ─────────────────────────────────────────────────────────────

    private handleError(error: unknown): never {
        if (error instanceof EntityError) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        if (error instanceof ApiError) {
            throw new HttpException(error.message, error.statusCode);
        }
        this.logger.error(`Mapping schema operation error: ${error}`);
        throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
