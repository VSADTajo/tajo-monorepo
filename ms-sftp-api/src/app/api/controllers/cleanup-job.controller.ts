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
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

// DTOs
import {
    CreateCleanupJobRequestDto,
    UpdateCleanupJobRequestDto,
    ToggleCleanupJobRequestDto,
    CleanupJobResponseDto,
    CleanupJobOrNullResponseDto,
    DeleteCleanupJobResponseDto,
} from '@api/dtos/cleanup-job.dtos';

// Mappers
import {
    CreateCleanupJobMapper,
    UpdateCleanupJobMapper,
    ToggleCleanupJobMapper,
    DeleteCleanupJobMapper,
    GetCleanupJobMapper,
} from '@application/mappers/cleanup-job.mappers';

// Domain
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { CleanupJobResult } from '@domain/results/cleanup-job.result';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

@ApiTags('CleanupJobs')
@Controller('cleanup-jobs')
export class CleanupJobController {
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
        summary: 'Create a new cleanup job for a path',
        body: CreateCleanupJobRequestDto,
        response: { status: 201, type: CleanupJobResponseDto, description: 'Cleanup job created and scheduled' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 409, description: 'A cleanup job already exists for this path' },
        ],
    })
    async create(@Body() dto: CreateCleanupJobRequestDto): Promise<CleanupJobResponseDto> {
        const command = CreateCleanupJobMapper.toCommand(dto);
        try {
            const result: CleanupJobResult = await this.commandBus.execute(command);
            return CreateCleanupJobMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Get by Path (must be before :id to avoid route conflict)
    // ─────────────────────────────────────────────────────────────

    @Get('by-path')
    @ApiEndpoint({
        summary: 'Get cleanup job for a specific directory path',
        response: { status: 200, type: CleanupJobOrNullResponseDto, description: 'Cleanup job or null' },
        errors: [{ status: 400, description: 'directoryPath query param required' }],
    })
    async findByPath(@Query('directoryPath') directoryPath: string): Promise<CleanupJobOrNullResponseDto> {
        if (!directoryPath) {
            throw new HttpException('directoryPath query param is required', HttpStatus.BAD_REQUEST);
        }
        const query = GetCleanupJobMapper.toGetByPathQuery(directoryPath);
        try {
            const result = await this.cachingQueryBus.execute<CleanupJobResult | null>(query);
            return GetCleanupJobMapper.toNullableResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // List All
    // ─────────────────────────────────────────────────────────────

    @Get()
    @ApiEndpoint({
        summary: 'List all cleanup jobs',
        response: { status: 200, type: CleanupJobResponseDto, description: 'List of cleanup jobs' },
    })
    async findAll(): Promise<CleanupJobResponseDto[]> {
        const query = GetCleanupJobMapper.toListQuery();
        try {
            const result = await this.cachingQueryBus.execute<CleanupJobResult[]>(query);
            return GetCleanupJobMapper.toListResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Get by ID
    // ─────────────────────────────────────────────────────────────

    @Get(':id')
    @ApiEndpoint({
        summary: 'Get a cleanup job by ID',
        response: { status: 200, type: CleanupJobResponseDto, description: 'Cleanup job details' },
        errors: [{ status: 404, description: 'Cleanup job not found' }],
    })
    async findById(@Param('id') id: string): Promise<CleanupJobResponseDto> {
        const query = GetCleanupJobMapper.toGetByIdQuery(id);
        try {
            const result = await this.cachingQueryBus.execute<CleanupJobResult>(query);
            return GetCleanupJobMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Update
    // ─────────────────────────────────────────────────────────────

    @Patch(':id')
    @ApiEndpoint({
        summary: 'Update extensions and/or frequency of an existing cleanup job',
        body: UpdateCleanupJobRequestDto,
        response: { status: 200, type: CleanupJobResponseDto, description: 'Cleanup job updated' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 404, description: 'Cleanup job not found' },
        ],
    })
    async update(@Param('id') id: string, @Body() dto: UpdateCleanupJobRequestDto): Promise<CleanupJobResponseDto> {
        const command = UpdateCleanupJobMapper.toCommand(id, dto);
        try {
            const result: CleanupJobResult = await this.commandBus.execute(command);
            return UpdateCleanupJobMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Toggle
    // ─────────────────────────────────────────────────────────────

    @Patch(':id/toggle')
    @ApiEndpoint({
        summary: 'Activate or deactivate a cleanup job',
        body: ToggleCleanupJobRequestDto,
        response: { status: 200, type: CleanupJobResponseDto, description: 'Cleanup job toggled' },
        errors: [{ status: 404, description: 'Cleanup job not found' }],
    })
    async toggle(@Param('id') id: string, @Body() dto: ToggleCleanupJobRequestDto): Promise<CleanupJobResponseDto> {
        const command = ToggleCleanupJobMapper.toCommand(id, dto);
        try {
            const result: CleanupJobResult = await this.commandBus.execute(command);
            return ToggleCleanupJobMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Delete
    // ─────────────────────────────────────────────────────────────

    @Delete(':id')
    @ApiEndpoint({
        summary: 'Permanently delete a cleanup job',
        response: { status: 200, type: DeleteCleanupJobResponseDto, description: 'Cleanup job deleted' },
        errors: [{ status: 404, description: 'Cleanup job not found' }],
    })
    async delete(@Param('id') id: string): Promise<DeleteCleanupJobResponseDto> {
        const command = DeleteCleanupJobMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return DeleteCleanupJobMapper.toResponseDto(result);
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
        this.logger.error({ msg: 'Cleanup job operation error', entity: 'CleanupJob', error: String(error) });
        throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
