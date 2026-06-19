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

import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { Maneuver } from '@domain/entities/maneuver.entity';
import { PaginatedManeuvers } from '@domain/ports/maneuver-repository.port';
import {
    CreateManeuverRequestDto,
    UpdateManeuverRequestDto,
    ListManeuversQueryDto,
    ListManeuversResponseDto,
    ManeuverResponseDto,
    DeleteManeuverResponseDto,
} from '@api/dtos/maneuver.dtos';
import {
    CreateManeuverMapper,
    UpdateManeuverMapper,
    DeleteManeuverMapper,
    ListManeuversMapper,
    GetManeuverByIdMapper,
} from '@application/mappers/maneuver.mappers';

@ApiTags('Maneuvers')
@Controller('maneuvers')
export class ManeuverController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Post()
    @ApiEndpoint({
        summary: 'Create a standalone, reusable maneuver',
        body: CreateManeuverRequestDto,
        response: { status: 201, type: ManeuverResponseDto, description: 'Maneuver created' },
        errors: [{ status: 400, description: 'Invalid payload' }],
    })
    async create(@Body() dto: CreateManeuverRequestDto): Promise<ManeuverResponseDto> {
        try {
            const command = CreateManeuverMapper.toCommand(dto);
            const created: Maneuver = await this.commandBus.execute(command);
            return CreateManeuverMapper.toResponseDto(created);
        } catch (error) {
            return this.handleError(error, 'Create maneuver');
        }
    }

    @Get()
    @ApiEndpoint({
        summary: 'List maneuvers (paginated, optionally filtered by reservoirCode)',
        response: { status: 200, type: ListManeuversResponseDto, description: 'Paginated maneuvers' },
    })
    async list(@Query() dto: ListManeuversQueryDto): Promise<ListManeuversResponseDto> {
        try {
            const query = ListManeuversMapper.toQuery(dto);
            const result: PaginatedManeuvers = await this.cachingQueryBus.execute(query);
            return ListManeuversMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error, 'List maneuvers');
        }
    }

    @Get(':id')
    @ApiEndpoint({
        summary: 'Get a maneuver by ID',
        response: { status: 200, type: ManeuverResponseDto, description: 'Maneuver detail' },
        errors: [{ status: 404, description: 'Maneuver not found' }],
    })
    async getById(@Param('id') id: string): Promise<ManeuverResponseDto> {
        try {
            const query = GetManeuverByIdMapper.toQuery(id);
            const maneuver: Maneuver = await this.cachingQueryBus.execute(query);
            return GetManeuverByIdMapper.toResponseDto(maneuver);
        } catch (error) {
            return this.handleError(error, 'Get maneuver by id');
        }
    }

    @Patch(':id')
    @ApiEndpoint({
        summary: 'Update a maneuver (also affects every simulation referencing it)',
        body: UpdateManeuverRequestDto,
        response: { status: 200, type: ManeuverResponseDto, description: 'Maneuver updated' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 404, description: 'Maneuver not found' },
        ],
    })
    async update(@Param('id') id: string, @Body() dto: UpdateManeuverRequestDto): Promise<ManeuverResponseDto> {
        try {
            const command = UpdateManeuverMapper.toCommand(id, dto);
            const updated: Maneuver = await this.commandBus.execute(command);
            return UpdateManeuverMapper.toResponseDto(updated);
        } catch (error) {
            return this.handleError(error, 'Update maneuver');
        }
    }

    @Delete(':id')
    @ApiEndpoint({
        summary: 'Delete a maneuver (cascade: removes its links from simulation_maneuvers)',
        response: { status: 200, type: DeleteManeuverResponseDto, description: 'Maneuver deleted' },
        errors: [{ status: 404, description: 'Maneuver not found' }],
    })
    async delete(@Param('id') id: string): Promise<DeleteManeuverResponseDto> {
        try {
            const command = DeleteManeuverMapper.toCommand(id);
            await this.commandBus.execute(command);
            return { id, deleted: true };
        } catch (error) {
            return this.handleError(error, 'Delete maneuver');
        }
    }

    private handleError(error: unknown, action: string): never {
        if (error instanceof EntityError) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        if (error instanceof ApiError) {
            throw new HttpException(error.message, error.statusCode);
        }
        this.logger.error({ msg: `${action} error`, entity: 'Maneuvers', error: String(error) });
        throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
