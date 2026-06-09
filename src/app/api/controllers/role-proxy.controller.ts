import { Body, Controller, Delete, Get, Param, Post, Put, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as express from 'express';

import { CreateRoleRequestDto, AssignRoleRequestDto, RoleResponseDto } from '@api/dtos/role-proxy.dtos';
import { ProxyService } from '@infrastructure/services/proxy.service';
import { ServicesConfigService } from '@config/services/services-config.service';
import { PermissionCacheService } from '@infrastructure/services/permission-cache.service';

const INTERNAL_CALLER_HEADER_VALUE = 'ms-gateway-api';

@ApiTags('Roles')
@Controller()
export class RoleProxyController {
    constructor(
        private readonly proxyService: ProxyService,
        private readonly servicesConfig: ServicesConfigService,
        private readonly permissionCache: PermissionCacheService,
    ) {}

    @Delete('roles/:roleId')
    @ApiOperation({
        summary: 'Delete role',
        description: 'Deletes a role and removes all its user assignments. Proxies to ms-user-api. Requires JWT.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiParam({ name: 'roleId', description: 'Role UUID' })
    @ApiResponse({ status: 200, description: 'Role deleted' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Role not found' })
    async deleteRole(
        @Param('roleId') roleId: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'DELETE',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/roles/${roleId}`,
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('roles')
    @ApiOperation({
        summary: 'Create role',
        description: 'Creates a new role. Proxies to ms-user-api. Requires JWT.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiBody({ type: CreateRoleRequestDto })
    @ApiResponse({ status: 201, description: 'Role created', type: RoleResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid payload' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 409, description: 'Role name already exists' })
    async createRole(
        @Body() body: CreateRoleRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.userApiUrl,
            path: '/roles',
            body,
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('roles')
    @ApiOperation({
        summary: 'List roles',
        description: 'Returns all roles. Proxies to ms-user-api. Requires JWT.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiResponse({ status: 200, description: 'List of roles', type: [RoleResponseDto] })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async listRoles(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.userApiUrl,
            path: '/roles',
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('roles/:roleId/permissions')
    @ApiOperation({
        summary: 'Get role permissions',
        description: 'Returns all permissions for a role. Proxies to ms-user-api. Requires JWT.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiParam({ name: 'roleId', description: 'Role UUID' })
    @ApiResponse({ status: 200, description: 'Role permissions' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Role not found' })
    async getRolePermissions(
        @Param('roleId') roleId: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/roles/${roleId}/permissions`,
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Put('roles/:roleId/permissions')
    @ApiOperation({
        summary: 'Sync role permissions',
        description:
            'Replaces all permissions for a role. Proxies to ms-user-api. Pass X-Role-Name header to immediately invalidate gateway permission cache. Requires JWT.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiParam({ name: 'roleId', description: 'Role UUID' })
    @ApiResponse({ status: 200, description: 'Permissions synced' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Role not found' })
    async syncRolePermissions(
        @Param('roleId') roleId: string,
        @Body() body: unknown,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'PUT',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/roles/${roleId}/permissions`,
            body,
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });

        // Invalidate gateway permission cache for this role so changes take effect immediately
        const roleName = req.headers['x-role-name'] as string | undefined;
        if (roleName && result.status >= 200 && result.status < 300) {
            await this.permissionCache.clearPermissions(roleName);
        }

        res.status(result.status).json(result.data);
    }

    @Post('users/:userId/roles')
    @ApiOperation({
        summary: 'Assign role to user',
        description: 'Assigns a role to a user by user ID and role ID. Proxies to ms-user-api. Requires JWT.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiParam({
        name: 'userId',
        description: 'User UUID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiBody({ type: AssignRoleRequestDto })
    @ApiResponse({ status: 201, description: 'Role assigned' })
    @ApiResponse({ status: 400, description: 'Invalid payload' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User or role not found' })
    async assignRole(
        @Param('userId') userId: string,
        @Body() body: AssignRoleRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/users/${userId}/roles`,
            body,
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('users/:userId/roles')
    @ApiOperation({
        summary: 'Get user roles',
        description: 'Returns all roles assigned to a user. Proxies to ms-user-api. Requires JWT.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiParam({
        name: 'userId',
        description: 'User UUID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiResponse({ status: 200, description: 'List of user roles', type: [RoleResponseDto] })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async getUserRoles(
        @Param('userId') userId: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/users/${userId}/roles`,
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Delete('users/:userId/roles/:roleId')
    @ApiOperation({
        summary: 'Remove role from user',
        description: 'Removes a role from a user. Proxies to ms-user-api. Requires JWT.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiParam({
        name: 'userId',
        description: 'User UUID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiParam({
        name: 'roleId',
        description: 'Role UUID',
        example: '660e8400-e29b-41d4-a716-446655440001',
    })
    @ApiResponse({ status: 200, description: 'Role removed' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User or role not found' })
    async removeRole(
        @Param('userId') userId: string,
        @Param('roleId') roleId: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'DELETE',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/users/${userId}/roles/${roleId}`,
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    // ─── User Groups ────────────────────────────────────────────

    @Get('users/:userId/groups')
    @ApiOperation({
        summary: 'Get user groups',
        description: 'Returns all groups assigned to a user. Proxies to ms-user-api.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiParam({ name: 'userId', description: 'User UUID' })
    @ApiResponse({ status: 200, description: 'User groups' })
    async getUserGroups(
        @Param('userId') userId: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/users/${userId}/groups`,
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('users/:userId/groups')
    @ApiOperation({
        summary: 'Assign group to user',
        description: 'Assigns a group to a user. Proxies to ms-user-api.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiParam({ name: 'userId', description: 'User UUID' })
    @ApiResponse({ status: 201, description: 'Group assigned' })
    @ApiResponse({ status: 409, description: 'User already has this group' })
    async assignGroupToUser(
        @Param('userId') userId: string,
        @Body() body: unknown,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/users/${userId}/groups`,
            body,
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Delete('users/:userId/groups/:groupId')
    @ApiOperation({
        summary: 'Remove group from user',
        description: 'Removes a group from a user. Proxies to ms-user-api.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiParam({ name: 'userId', description: 'User UUID' })
    @ApiParam({ name: 'groupId', description: 'Group UUID' })
    @ApiResponse({ status: 200, description: 'Group removed' })
    @ApiResponse({ status: 404, description: 'Assignment not found' })
    async removeGroupFromUser(
        @Param('userId') userId: string,
        @Param('groupId') groupId: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'DELETE',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/users/${userId}/groups/${groupId}`,
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }
}
