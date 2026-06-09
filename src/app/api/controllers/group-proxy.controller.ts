import { Body, Controller, Delete, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as express from 'express';

import { ProxyService } from '@infrastructure/services/proxy.service';
import { ServicesConfigService } from '@config/services/services-config.service';

const INTERNAL_CALLER_HEADER_VALUE = 'ms-gateway-api';

@ApiTags('Groups')
@Controller('groups')
export class GroupProxyController {
    constructor(
        private readonly proxyService: ProxyService,
        private readonly servicesConfig: ServicesConfigService,
    ) {}

    @Get()
    @ApiBearerAuth('JWTAuthorization')
    @ApiOperation({ summary: 'List all groups with roles', description: 'Proxies to ms-user-api.' })
    @ApiResponse({ status: 200, description: 'List of groups' })
    async listGroups(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.userApiUrl,
            path: '/groups',
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post()
    @ApiBearerAuth('JWTAuthorization')
    @ApiOperation({ summary: 'Create a group', description: 'Proxies to ms-user-api.' })
    @ApiResponse({ status: 201, description: 'Group created' })
    @ApiResponse({ status: 409, description: 'Group name already exists' })
    async createGroup(@Body() body: unknown, @Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.userApiUrl,
            path: '/groups',
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

    @Delete(':id')
    @ApiBearerAuth('JWTAuthorization')
    @ApiOperation({
        summary: 'Delete a group',
        description: 'Proxies to ms-user-api. Cascades to group_roles and user_groups.',
    })
    @ApiParam({ name: 'id', description: 'Group UUID' })
    @ApiResponse({ status: 200, description: 'Group deleted' })
    @ApiResponse({ status: 404, description: 'Group not found' })
    async deleteGroup(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'DELETE',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/groups/${id}`,
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post(':id/roles')
    @ApiBearerAuth('JWTAuthorization')
    @ApiOperation({ summary: 'Assign a role to a group', description: 'Proxies to ms-user-api.' })
    @ApiParam({ name: 'id', description: 'Group UUID' })
    @ApiResponse({ status: 201, description: 'Role assigned to group' })
    @ApiResponse({ status: 409, description: 'Group already has this role' })
    async assignRoleToGroup(
        @Param('id') groupId: string,
        @Body() body: unknown,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/groups/${groupId}/roles`,
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

    @Delete(':id/roles/:roleId')
    @ApiBearerAuth('JWTAuthorization')
    @ApiOperation({ summary: 'Remove a role from a group', description: 'Proxies to ms-user-api.' })
    @ApiParam({ name: 'id', description: 'Group UUID' })
    @ApiParam({ name: 'roleId', description: 'Role UUID' })
    @ApiResponse({ status: 200, description: 'Role removed from group' })
    @ApiResponse({ status: 404, description: 'Assignment not found' })
    async removeRoleFromGroup(
        @Param('id') groupId: string,
        @Param('roleId') roleId: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'DELETE',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/groups/${groupId}/roles/${roleId}`,
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
