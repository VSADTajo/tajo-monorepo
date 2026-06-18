import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpException,
    HttpStatus,
    Inject,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// DTOs
import {
    RegisterUserRequestDto,
    RegisterUserResponseDto,
    GetUserByIdResponseDto,
    UpdateUserRequestDto,
    UpdateUserResponseDto,
    GetUserByEmailResponseDto,
    GetUserStatusResponseDto,
    UpdatePasswordRequestDto,
    ListUsersResponseDto,
} from '@api/dtos/user.dtos';

// Mappers
import {
    RegisterUserMapper,
    GetUserByIdMapper,
    GetUserByEmailMapper,
    GetUserStatusMapper,
    UpdateUserMapper,
    ListUsersMapper,
} from '@application/mappers/user.mappers';

// Commands
import { DeleteUserCommand, UpdateUserPasswordCommand } from '@application/commands/user.commands';
import { AssignGroupToUserCommand, RemoveGroupFromUserCommand } from '@application/commands/group.commands';

// Queries
import { GetUserByIdQuery, GetUserByEmailQuery, ListUsersQuery } from '@application/queries/user.queries';
import { GetUserGroupsQuery } from '@application/queries/group.queries';

// Domain
import { User } from '@domain/entities/user.entity';
import { GetUserByEmailResult } from '@domain/results/get-user-by-email.result';
import { ListUsersResult } from '@domain/results/list-users.result';
import { GetUserGroupsResult } from '@domain/results/group.result';

import {
    AssignGroupToUserRequestDto,
    AssignGroupToUserResponseDto,
    GetUserGroupsResponseDto,
    MessageResponseDto,
} from '@api/dtos/group.dtos';
import { AssignGroupToUserMapper, GetUserGroupsMapper } from '@application/mappers/group.mappers';

// Errors
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Users')
@Controller('users')
export class UserController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    // ─── Rutas más específicas primero (evitar que :id capture 'by-email' o 'id/status') ───

    @Get()
    @ApiEndpoint({
        summary: 'List all users',
        response: { status: 200, type: ListUsersResponseDto, description: 'List of all users' },
    })
    async listUsers(): Promise<ListUsersResponseDto> {
        this.logger.log('List users request');
        try {
            const result = await this.cachingQueryBus.execute<ListUsersResult>(new ListUsersQuery());
            return ListUsersMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error listing users', entity: 'User', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('by-email/:email')
    @ApiEndpoint({
        summary: '[Interno AUTH-API] Get user by email — id, password, roles, status',
        response: { status: 200, type: GetUserByEmailResponseDto, description: 'User found' },
        errors: [
            { status: 404, description: 'User not found' },
            { status: 500, description: 'Internal server error' },
        ],
    })
    async getUserByEmail(@Param('email') email: string): Promise<GetUserByEmailResponseDto> {
        this.logger.log(`Get user by email (AUTH-API): ${email}`);
        try {
            // QueryBus (no cache) para no cachear credenciales
            const result = (await this.queryBus.execute(new GetUserByEmailQuery(email))) as GetUserByEmailResult;
            return GetUserByEmailMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error getting user by email', entity: 'User', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':id/status')
    @ApiEndpoint({
        summary: 'Get user status (active/pending/inactive)',
        response: { status: 200, type: GetUserStatusResponseDto, description: 'User status' },
        errors: [
            { status: 404, description: 'User not found' },
            { status: 500, description: 'Internal server error' },
        ],
    })
    async getUserStatus(@Param('id') id: string): Promise<GetUserStatusResponseDto> {
        this.logger.log(`Get user status: ${id}`);
        try {
            const result = await this.cachingQueryBus.execute<User>(new GetUserByIdQuery(id));
            return GetUserStatusMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error getting user status', entity: 'User', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':id')
    @ApiEndpoint({
        summary: 'Get a user by id',
        response: { status: 200, type: GetUserByIdResponseDto, description: 'User found' },
        errors: [
            { status: 404, description: 'User not found' },
            { status: 500, description: 'Internal server error' },
        ],
    })
    async getUserById(@Param('id') id: string): Promise<GetUserByIdResponseDto> {
        this.logger.log(`Getting user by id: ${id}`);
        try {
            const result = await this.cachingQueryBus.execute<User>(new GetUserByIdQuery(id));
            return GetUserByIdMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }

            this.logger.error({ msg: 'Error getting user', entity: 'User', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('register')
    @ApiEndpoint({
        summary: 'Register user (called by AUTH-API with name, email, password hash)',
        body: RegisterUserRequestDto,
        response: { status: 201, type: RegisterUserResponseDto, description: 'User registered successfully' },
        errors: [
            { status: 400, description: 'Invalid payload or validation error' },
            { status: 409, description: 'User already exists' },
            { status: 500, description: 'Internal server error' },
        ],
    })
    async register(@Body() dto: RegisterUserRequestDto): Promise<RegisterUserResponseDto> {
        this.logger.log(`Register user request: ${dto.email}`);
        const command = RegisterUserMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return RegisterUserMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error registering user', entity: 'User', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Patch(':id/password')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiEndpoint({
        summary: 'Update user password hash (called by AUTH-API)',
        body: UpdatePasswordRequestDto,
        response: { status: 204, type: Object, description: 'Password updated' },
        errors: [
            { status: 404, description: 'User not found' },
            { status: 500, description: 'Internal server error' },
        ],
    })
    async updatePassword(@Param('id') id: string, @Body() dto: UpdatePasswordRequestDto): Promise<void> {
        this.logger.log(`Update password for user: ${id}`);
        const command = new UpdateUserPasswordCommand({ id, password: dto.password });
        try {
            await this.commandBus.execute(command);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error updating password', entity: 'User', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Patch(':id')
    @ApiEndpoint({
        summary: 'Update a user',
        body: UpdateUserRequestDto,
        response: { status: 200, type: UpdateUserResponseDto, description: 'User updated successfully' },
        errors: [
            { status: 400, description: 'Invalid payload or validation error' },
            { status: 404, description: 'User not found' },
            { status: 409, description: 'Email already in use by another user' },
            { status: 500, description: 'Internal server error' },
        ],
    })
    async updateUser(@Param('id') id: string, @Body() dto: UpdateUserRequestDto): Promise<UpdateUserResponseDto> {
        this.logger.log(`Update user request: ${id}`);
        const command = UpdateUserMapper.toCommand(id, dto);
        try {
            const result = await this.commandBus.execute(command);
            return UpdateUserMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error updating user', entity: 'User', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiEndpoint({
        summary: 'Delete a user',
        response: { status: 204, type: Object, description: 'User deleted successfully' },
        errors: [
            { status: 404, description: 'User not found' },
            { status: 500, description: 'Internal server error' },
        ],
    })
    async deleteUser(@Param('id') id: string): Promise<void> {
        this.logger.log(`Delete user request: ${id}`);
        const command = new DeleteUserCommand({ id });
        try {
            await this.commandBus.execute(command);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error deleting user', entity: 'User', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─── User Groups ───────────────────────────────────────────

    @Get(':id/groups')
    @ApiEndpoint({
        summary: 'Get all groups assigned to a user',
        response: { status: 200, type: GetUserGroupsResponseDto, description: 'User groups' },
        errors: [{ status: 404, description: 'User not found' }],
    })
    async getUserGroups(@Param('id') userId: string): Promise<GetUserGroupsResponseDto> {
        this.logger.log(`Get user groups request: userId=${userId}`);
        try {
            const result = await this.cachingQueryBus.execute<GetUserGroupsResult>(new GetUserGroupsQuery({ userId }));
            return GetUserGroupsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error({ msg: 'Error getting user groups', entity: 'User', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post(':id/groups')
    @ApiEndpoint({
        summary: 'Assign a group to a user',
        body: AssignGroupToUserRequestDto,
        response: { status: 201, type: AssignGroupToUserResponseDto, description: 'Group assigned to user' },
        errors: [
            { status: 404, description: 'User or group not found' },
            { status: 409, description: 'User already has this group' },
        ],
    })
    async assignGroupToUser(
        @Param('id') userId: string,
        @Body() dto: AssignGroupToUserRequestDto,
    ): Promise<AssignGroupToUserResponseDto> {
        this.logger.log(`Assign group to user: userId=${userId}, groupId=${dto.groupId}`);
        try {
            const result = await this.commandBus.execute(
                new AssignGroupToUserCommand({ userId, groupId: dto.groupId }),
            );
            return AssignGroupToUserMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error({ msg: 'Error assigning group to user', entity: 'User', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Delete(':id/groups/:groupId')
    @ApiEndpoint({
        summary: 'Remove a group from a user',
        response: { status: 200, type: MessageResponseDto, description: 'Group removed from user' },
        errors: [{ status: 404, description: 'Assignment not found' }],
    })
    async removeGroupFromUser(
        @Param('id') userId: string,
        @Param('groupId') groupId: string,
    ): Promise<MessageResponseDto> {
        this.logger.log(`Remove group from user: userId=${userId}, groupId=${groupId}`);
        try {
            const result = await this.commandBus.execute(new RemoveGroupFromUserCommand({ userId, groupId }));
            return { message: result.message };
        } catch (error) {
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error({ msg: 'Error removing group from user', entity: 'User', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
