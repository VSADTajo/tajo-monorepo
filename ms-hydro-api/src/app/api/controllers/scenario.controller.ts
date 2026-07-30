import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Inject, Param, Post, Query } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// DTOs
import {
    CreateScenarioRequestDto,
    CreateScenarioResponseDto,
    ListScenariosRequestDto,
    ListScenariosResponseDto,
    GetScenarioResponseDto,
    DeleteScenarioResponseDto,
} from '@api/dtos/scenario.dtos';

// Mappers
import {
    CreateScenarioMapper,
    ListScenariosMapper,
    GetScenarioByIdMapper,
    DeleteScenarioMapper,
} from '@application/mappers/scenario.mappers';

// Results
import { GetScenarioResult, ListScenariosResult } from '@domain/results/scenario.results';

// Errors
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Scenarios')
@Controller('scenarios')
export class ScenarioController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Post()
    @ApiEndpoint({
        summary: 'Create a scenario (store a raw JSON test dataset)',
        body: CreateScenarioRequestDto,
        response: { status: 201, type: CreateScenarioResponseDto, description: 'Scenario created (metadata)' },
        errors: [{ status: 400, description: 'Validation error (invalid payload)' }],
    })
    async createScenario(@Body() dto: CreateScenarioRequestDto): Promise<CreateScenarioResponseDto> {
        this.logger.log(`Create scenario request: ${dto.name}`);
        const command = CreateScenarioMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return CreateScenarioMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error creating scenario: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get()
    @ApiEndpoint({
        summary: 'List scenarios (metadata only, no payload)',
        response: { status: 200, type: ListScenariosResponseDto, description: 'List of scenarios' },
    })
    async listScenarios(@Query() dto: ListScenariosRequestDto): Promise<ListScenariosResponseDto> {
        this.logger.log('List scenarios request');
        try {
            const query = ListScenariosMapper.toQuery(dto);
            const result = await this.cachingQueryBus.execute<ListScenariosResult>(query);
            return ListScenariosMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error listing scenarios: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':id')
    @ApiEndpoint({
        summary: 'Get a scenario by ID (with full payload)',
        response: { status: 200, type: GetScenarioResponseDto, description: 'Scenario found' },
        errors: [{ status: 404, description: 'Scenario not found' }],
    })
    async getScenario(@Param('id') id: string): Promise<GetScenarioResponseDto> {
        this.logger.log(`Get scenario request: id=${id}`);
        try {
            const query = GetScenarioByIdMapper.toQuery(id);
            const result = await this.cachingQueryBus.execute<GetScenarioResult>(query);
            return GetScenarioByIdMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error getting scenario: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiEndpoint({
        summary: 'Delete a scenario',
        response: { status: 200, type: DeleteScenarioResponseDto, description: 'Scenario deleted' },
        errors: [{ status: 404, description: 'Scenario not found' }],
    })
    async deleteScenario(@Param('id') id: string): Promise<DeleteScenarioResponseDto> {
        this.logger.log(`Delete scenario request: id=${id}`);
        const command = DeleteScenarioMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return DeleteScenarioMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error deleting scenario: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
