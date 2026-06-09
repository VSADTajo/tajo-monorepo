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
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// DTOs
import {
    CreateProviderConfigRequestDto,
    UpdateProviderConfigRequestDto,
    ProviderConfigResponseDto,
    ListProviderConfigsResponseDto,
    DeleteProviderConfigResponseDto,
    TriggerIngestionResponseDto,
} from '@api/dtos/provider-config.dtos';

// Mappers
import {
    CreateProviderConfigMapper,
    UpdateProviderConfigMapper,
    DeleteProviderConfigMapper,
    ToggleProviderConfigMapper,
    ListProviderConfigsMapper,
    GetProviderConfigByIdMapper,
    TriggerIngestionMapper,
} from '@application/mappers/provider-config.mappers';

// Queries
import { ListProviderConfigsQuery, GetProviderConfigByIdQuery } from '@application/queries/provider-config.queries';

// Results
import { ProviderConfigResult } from '@domain/results/provider-config.result';

// Errors
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Provider Configs')
@Controller('provider-configs')
export class ProviderConfigController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Post()
    @ApiEndpoint({
        summary: 'Create a new provider configuration',
        body: CreateProviderConfigRequestDto,
        response: { status: 201, type: ProviderConfigResponseDto, description: 'Provider config created successfully' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 409, description: 'Provider config with this name already exists' },
        ],
    })
    async createProviderConfig(@Body() dto: CreateProviderConfigRequestDto): Promise<ProviderConfigResponseDto> {
        this.logger.log(`Create provider config request: ${dto.name}`);
        const command = CreateProviderConfigMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return CreateProviderConfigMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error creating provider config: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get()
    @ApiEndpoint({
        summary: 'List all provider configurations',
        response: { status: 200, type: ListProviderConfigsResponseDto, description: 'List of all provider configs' },
    })
    async listProviderConfigs(): Promise<ListProviderConfigsResponseDto> {
        this.logger.log('List provider configs request');
        try {
            const result = await this.cachingQueryBus.execute<ProviderConfigResult[]>(new ListProviderConfigsQuery());
            return ListProviderConfigsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error listing provider configs: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':id')
    @ApiEndpoint({
        summary: 'Get a provider configuration by ID',
        response: { status: 200, type: ProviderConfigResponseDto, description: 'Provider config details' },
        errors: [{ status: 404, description: 'Provider config not found' }],
    })
    async getProviderConfigById(@Param('id') id: string): Promise<ProviderConfigResponseDto> {
        this.logger.log(`Get provider config request: id=${id}`);
        try {
            const result = await this.cachingQueryBus.execute<ProviderConfigResult>(
                new GetProviderConfigByIdQuery({ id }),
            );
            return GetProviderConfigByIdMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error getting provider config: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Put(':id')
    @ApiEndpoint({
        summary: 'Update a provider configuration',
        body: UpdateProviderConfigRequestDto,
        response: { status: 200, type: ProviderConfigResponseDto, description: 'Provider config updated successfully' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 404, description: 'Provider config not found' },
            { status: 409, description: 'Provider config with this name already exists' },
        ],
    })
    async updateProviderConfig(
        @Param('id') id: string,
        @Body() dto: UpdateProviderConfigRequestDto,
    ): Promise<ProviderConfigResponseDto> {
        this.logger.log(`Update provider config request: id=${id}`);
        const command = UpdateProviderConfigMapper.toCommand(id, dto);
        try {
            const result = await this.commandBus.execute(command);
            return UpdateProviderConfigMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error updating provider config: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Patch(':id/toggle')
    @ApiEndpoint({
        summary: 'Toggle provider configuration active status',
        response: { status: 200, type: ProviderConfigResponseDto, description: 'Provider config toggled successfully' },
        errors: [{ status: 404, description: 'Provider config not found' }],
    })
    async toggleProviderConfig(@Param('id') id: string): Promise<ProviderConfigResponseDto> {
        this.logger.log(`Toggle provider config request: id=${id}`);
        const command = ToggleProviderConfigMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return ToggleProviderConfigMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error toggling provider config: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post(':id/trigger')
    @ApiEndpoint({
        summary: 'Trigger an immediate ingestion for a provider',
        response: { status: 201, type: TriggerIngestionResponseDto, description: 'Ingestion triggered successfully' },
        errors: [
            { status: 404, description: 'Provider config not found' },
            { status: 409, description: 'Ingestion already running for this provider' },
        ],
    })
    async triggerIngestion(@Param('id') id: string): Promise<TriggerIngestionResponseDto> {
        this.logger.log(`Trigger ingestion request: providerConfigId=${id}`);
        const command = TriggerIngestionMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return TriggerIngestionMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error triggering ingestion: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Delete(':id')
    @ApiEndpoint({
        summary: 'Delete a provider configuration',
        response: {
            status: 200,
            type: DeleteProviderConfigResponseDto,
            description: 'Provider config deleted successfully',
        },
        errors: [{ status: 404, description: 'Provider config not found' }],
    })
    async deleteProviderConfig(@Param('id') id: string): Promise<DeleteProviderConfigResponseDto> {
        this.logger.log(`Delete provider config request: id=${id}`);
        const command = DeleteProviderConfigMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return { message: result.message };
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error deleting provider config: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
