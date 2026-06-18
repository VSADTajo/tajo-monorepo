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
    CreateSftpUserRequestDto,
    UpdateSftpUserRequestDto,
    ToggleSftpUserRequestDto,
    SftpUserResponseDto,
    ListSftpUsersResponseDto,
    DeleteSftpUserResponseDto,
} from '@api/dtos/sftp-user.dtos';

// Mappers
import {
    CreateSftpUserMapper,
    UpdateSftpUserMapper,
    DeleteSftpUserMapper,
    ToggleSftpUserMapper,
    ListSftpUsersMapper,
    GetSftpUserByIdMapper,
} from '@application/mappers/sftp-user.mappers';

// Domain
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

// Domain results
import { SftpUserResult, ListSftpUsersResult } from '@domain/results/sftp-user.result';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

@ApiTags('SFTP Users')
@Controller('sftp-users')
export class SftpUserController {
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
        summary: 'Create an SFTP user',
        body: CreateSftpUserRequestDto,
        response: { status: 201, type: SftpUserResponseDto, description: 'User created' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 409, description: 'Username already exists' },
        ],
    })
    async create(@Body() dto: CreateSftpUserRequestDto): Promise<SftpUserResponseDto> {
        const command = CreateSftpUserMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return CreateSftpUserMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // List All
    // ─────────────────────────────────────────────────────────────

    @Get()
    @ApiEndpoint({
        summary: 'List all SFTP users',
        response: { status: 200, type: ListSftpUsersResponseDto, description: 'List of SFTP users' },
    })
    async findAll(): Promise<ListSftpUsersResponseDto> {
        const query = ListSftpUsersMapper.toQuery();
        try {
            const result = await this.cachingQueryBus.execute<ListSftpUsersResult>(query);
            return ListSftpUsersMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Get by ID
    // ─────────────────────────────────────────────────────────────

    @Get(':id')
    @ApiEndpoint({
        summary: 'Get an SFTP user by ID',
        response: { status: 200, type: SftpUserResponseDto, description: 'User details' },
        errors: [{ status: 404, description: 'User not found' }],
    })
    async findById(@Param('id') id: string): Promise<SftpUserResponseDto> {
        const query = GetSftpUserByIdMapper.toQuery(id);
        try {
            const result = await this.cachingQueryBus.execute<SftpUserResult>(query);
            return GetSftpUserByIdMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Update
    // ─────────────────────────────────────────────────────────────

    @Put(':id')
    @ApiEndpoint({
        summary: 'Update an SFTP user',
        body: UpdateSftpUserRequestDto,
        response: { status: 200, type: SftpUserResponseDto, description: 'User updated' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 404, description: 'User not found' },
        ],
    })
    async update(@Param('id') id: string, @Body() dto: UpdateSftpUserRequestDto): Promise<SftpUserResponseDto> {
        const command = UpdateSftpUserMapper.toCommand(id, dto);
        try {
            const result = await this.commandBus.execute(command);
            return UpdateSftpUserMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Delete
    // ─────────────────────────────────────────────────────────────

    @Delete(':id')
    @ApiEndpoint({
        summary: 'Delete an SFTP user',
        response: { status: 200, type: DeleteSftpUserResponseDto, description: 'User deleted' },
        errors: [{ status: 404, description: 'User not found' }],
    })
    async delete(@Param('id') id: string): Promise<DeleteSftpUserResponseDto> {
        const command = DeleteSftpUserMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return DeleteSftpUserMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Toggle
    // ─────────────────────────────────────────────────────────────

    @Patch(':id/toggle')
    @ApiEndpoint({
        summary: 'Toggle SFTP user active/inactive',
        body: ToggleSftpUserRequestDto,
        response: { status: 200, type: SftpUserResponseDto, description: 'User toggled' },
        errors: [{ status: 404, description: 'User not found' }],
    })
    async toggle(@Param('id') id: string, @Body() dto: ToggleSftpUserRequestDto): Promise<SftpUserResponseDto> {
        const command = ToggleSftpUserMapper.toCommand(id, dto);
        try {
            const result = await this.commandBus.execute(command);
            return ToggleSftpUserMapper.toResponseDto(result);
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
        this.logger.error({ msg: 'SFTP user operation error', entity: 'SFTPUser', error: String(error) });
        throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
