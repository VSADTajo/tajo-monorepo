import { Body, Controller, Delete, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as express from 'express';

import { ProxyService } from '@infrastructure/services/proxy.service';
import { ServicesConfigService } from '@config/services/services-config.service';

const INTERNAL_CALLER_HEADER_VALUE = 'ms-gateway-api';

@ApiTags('Permissions')
@Controller('permissions')
export class PermissionProxyController {
    constructor(
        private readonly proxyService: ProxyService,
        private readonly servicesConfig: ServicesConfigService,
    ) {}

    @Get()
    @ApiBearerAuth('JWTAuthorization')
    @ApiOperation({ summary: 'List all permissions', description: 'Proxies to ms-user-api.' })
    @ApiResponse({ status: 200, description: 'List of permissions' })
    async listPermissions(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.userApiUrl,
            path: '/permissions',
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
    @ApiOperation({ summary: 'Create a permission', description: 'Proxies to ms-user-api.' })
    @ApiResponse({ status: 201, description: 'Permission created' })
    @ApiResponse({ status: 409, description: 'Permission already exists' })
    async createPermission(
        @Body() body: unknown,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.userApiUrl,
            path: '/permissions',
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

    @Post('sync')
    @ApiBearerAuth('JWTAuthorization')
    @ApiOperation({
        summary: 'Sync permissions from gateway routes',
        description: 'Upserts permissions by method+path. Proxies to ms-user-api.',
    })
    @ApiResponse({ status: 200, description: 'Synced permissions' })
    async syncPermissions(
        @Body() body: unknown,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.userApiUrl,
            path: '/permissions/sync',
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
        summary: 'Delete a permission',
        description: 'Proxies to ms-user-api. Fails if assigned to roles.',
    })
    @ApiParam({ name: 'id', description: 'Permission UUID' })
    @ApiResponse({ status: 200, description: 'Permission deleted' })
    @ApiResponse({ status: 404, description: 'Not found' })
    @ApiResponse({ status: 409, description: 'Assigned to roles' })
    async deletePermission(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'DELETE',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/permissions/${id}`,
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
