import {
    Body,
    Controller,
    Delete,
    Get,
    HttpException,
    HttpStatus,
    Inject,
    Param,
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
    CreateRoleRequestDto,
    CreateRoleResponseDto,
    ListRolesResponseDto,
    AssignRoleRequestDto,
    AssignRoleResponseDto,
    GetUserRolesResponseDto,
    RemoveUserRoleResponseDto,
} from '@api/dtos/role.dtos';
import {
    SyncRolePermissionsRequestDto,
    SyncRolePermissionsResponseDto,
    GetRolePermissionsResponseDto,
    GetBulkPermissionsResponseDto,
} from '@api/dtos/role-permission.dtos';

// Mappers
import {
    CreateRoleMapper,
    ListRolesMapper,
    AssignRoleToUserMapper,
    GetUserRolesMapper,
    RemoveRoleFromUserMapper,
    DeleteRoleMapper,
} from '@application/mappers/role.mappers';
import {
    SyncRolePermissionsMapper,
    GetRolePermissionsMapper,
    GetBulkPermissionsMapper,
} from '@application/mappers/role-permission.mappers';

// Queries
import { ListRolesQuery, GetUserRolesQuery } from '@application/queries/role.queries';

// Results
import { ListRolesResult } from '@domain/results/list-roles.result';
import { GetUserRolesResult } from '@domain/results/get-user-roles.result';
import { GetRolePermissionsResult, GetBulkPermissionsResult } from '@domain/results/role-permission.result';

// Errors
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Roles')
@Controller()
export class RoleController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Delete('roles/:roleId')
    @ApiEndpoint({
        summary: 'Delete a role and remove all its user assignments',
        response: { status: 200, description: 'Role deleted' },
        errors: [{ status: 404, description: 'Role not found' }],
    })
    async deleteRole(@Param('roleId') roleId: string): Promise<void> {
        this.logger.log(`Delete role request: ${roleId}`);
        const command = DeleteRoleMapper.toCommand(roleId);
        try {
            await this.commandBus.execute(command);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error deleting role: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('roles')
    @ApiEndpoint({
        summary: 'Create a new role',
        body: CreateRoleRequestDto,
        response: { status: 201, type: CreateRoleResponseDto, description: 'Role created successfully' },
        errors: [
            { status: 400, description: 'Validation error (invalid name format, empty name, name too long)' },
            { status: 409, description: 'Role with this name already exists' },
        ],
    })
    async createRole(@Body() dto: CreateRoleRequestDto): Promise<CreateRoleResponseDto> {
        this.logger.log(`Create role request: ${dto.name}`);
        const command = CreateRoleMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return CreateRoleMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error creating role: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('roles')
    @ApiEndpoint({
        summary: 'List all roles',
        response: { status: 200, type: ListRolesResponseDto, description: 'List of all roles' },
    })
    async listRoles(): Promise<ListRolesResponseDto> {
        this.logger.log('List roles request');
        try {
            const result = await this.cachingQueryBus.execute<ListRolesResult>(new ListRolesQuery());
            return ListRolesMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error listing roles: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('roles/permissions/bulk')
    @ApiEndpoint({
        summary: '[Internal Gateway] Get merged permissions for multiple roles by name',
        response: { status: 200, type: GetBulkPermissionsResponseDto, description: 'Merged permissions' },
    })
    async getBulkPermissions(@Query('roles') roles: string): Promise<GetBulkPermissionsResponseDto> {
        const roleNames = roles
            ? roles
                  .split(',')
                  .map((r) => r.trim())
                  .filter(Boolean)
            : [];
        this.logger.log(`Get bulk permissions for roles: ${roleNames.join(', ')}`);
        try {
            // CachingQueryBus passes through — no CACHE_REGISTRY entry for bulk query,
            // so it reaches the handler directly; gateway handles per-role caching externally
            const result = await this.cachingQueryBus.execute<GetBulkPermissionsResult>(
                GetBulkPermissionsMapper.toQuery(roleNames),
            );
            return GetBulkPermissionsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error(`Error getting bulk permissions: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Put('roles/:roleId/permissions')
    @ApiEndpoint({
        summary: 'Sync permissions for a role (replaces all existing)',
        body: SyncRolePermissionsRequestDto,
        response: { status: 200, type: SyncRolePermissionsResponseDto, description: 'Permissions synced' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 404, description: 'Role not found' },
        ],
    })
    async syncRolePermissions(
        @Param('roleId') roleId: string,
        @Body() dto: SyncRolePermissionsRequestDto,
    ): Promise<SyncRolePermissionsResponseDto> {
        this.logger.log(`Sync permissions for role ${roleId}: ${dto.permissionIds.length} items`);
        const command = SyncRolePermissionsMapper.toCommand(roleId, dto);
        try {
            const result = await this.commandBus.execute(command);
            return SyncRolePermissionsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error(`Error syncing permissions: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('roles/:roleId/permissions')
    @ApiEndpoint({
        summary: 'Get all permissions of a role',
        response: { status: 200, type: GetRolePermissionsResponseDto, description: 'Role permissions' },
        errors: [{ status: 404, description: 'Role not found' }],
    })
    async getRolePermissions(@Param('roleId') roleId: string): Promise<GetRolePermissionsResponseDto> {
        this.logger.log(`Get permissions for role ${roleId}`);
        try {
            const result = await this.cachingQueryBus.execute<GetRolePermissionsResult>(
                GetRolePermissionsMapper.toQuery(roleId),
            );
            return GetRolePermissionsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error(`Error getting permissions: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('users/:userId/roles')
    @ApiEndpoint({
        summary: 'Assign a role to a user',
        body: AssignRoleRequestDto,
        response: { status: 201, type: AssignRoleResponseDto, description: 'Role assigned to user successfully' },
        errors: [
            { status: 400, description: 'Validation error (invalid roleId format)' },
            { status: 404, description: 'User or role not found' },
            { status: 409, description: 'User already has this role assigned' },
        ],
    })
    async assignRoleToUser(
        @Param('userId') userId: string,
        @Body() dto: AssignRoleRequestDto,
    ): Promise<AssignRoleResponseDto> {
        this.logger.log(`Assign role request: userId=${userId}, roleId=${dto.roleId}`);
        const command = AssignRoleToUserMapper.toCommand(userId, dto);
        try {
            const result = await this.commandBus.execute(command);
            return AssignRoleToUserMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error assigning role to user: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('users/:userId/roles')
    @ApiEndpoint({
        summary: 'Get all roles assigned to a user',
        response: { status: 200, type: GetUserRolesResponseDto, description: 'List of roles assigned to the user' },
        errors: [{ status: 404, description: 'User not found' }],
    })
    async getUserRoles(@Param('userId') userId: string): Promise<GetUserRolesResponseDto> {
        this.logger.log(`Get user roles request: userId=${userId}`);
        try {
            const result = await this.cachingQueryBus.execute<GetUserRolesResult>(new GetUserRolesQuery({ userId }));
            return GetUserRolesMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error getting user roles: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Delete('users/:userId/roles/:roleId')
    @ApiEndpoint({
        summary: 'Remove a role from a user',
        response: { status: 200, type: RemoveUserRoleResponseDto, description: 'Role removed from user successfully' },
        errors: [{ status: 404, description: 'User, role, or assignment not found' }],
    })
    async removeRoleFromUser(
        @Param('userId') userId: string,
        @Param('roleId') roleId: string,
    ): Promise<RemoveUserRoleResponseDto> {
        this.logger.log(`Remove role request: userId=${userId}, roleId=${roleId}`);
        const command = RemoveRoleFromUserMapper.toCommand(userId, roleId);
        try {
            const result = await this.commandBus.execute(command);
            return { message: result.message };
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error removing role from user: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
