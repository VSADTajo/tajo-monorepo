import { Body, Controller, Delete, Get, Param, Patch, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as express from 'express';

import { UpdateUserRequestDto, UserResponseDto } from '@api/dtos/user-proxy.dtos';
import { ProxyService } from '@infrastructure/services/proxy.service';
import { ServicesConfigService } from '@config/services/services-config.service';

const INTERNAL_CALLER_HEADER_VALUE = 'ms-gateway-api';

@ApiTags('Users')
@Controller('users')
export class UserProxyController {
    constructor(
        private readonly proxyService: ProxyService,
        private readonly servicesConfig: ServicesConfigService,
    ) {}

    @Get()
    @ApiOperation({
        summary: 'List all users',
        description: 'Returns all users. Proxies to ms-user-api. Requires JWT.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiResponse({ status: 200, description: 'List of users' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async listUsers(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.userApiUrl,
            path: '/users',
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Get user by ID',
        description: 'Returns a single user by UUID. Proxies to ms-user-api. Requires JWT.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiParam({ name: 'id', description: 'User UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
    @ApiResponse({ status: 200, description: 'User found', type: UserResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async getUserById(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/users/${id}`,
            headers: {
                authorization: req.headers.authorization || '',
                'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE,
            },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Patch(':id')
    @ApiOperation({
        summary: 'Update user',
        description: 'Partially updates a user (name and/or email). Proxies to ms-user-api. Requires JWT.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiParam({ name: 'id', description: 'User UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
    @ApiBody({ type: UpdateUserRequestDto })
    @ApiResponse({ status: 200, description: 'User updated', type: UserResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid payload' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async updateUser(
        @Param('id') id: string,
        @Body() body: UpdateUserRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'PATCH',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/users/${id}`,
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
    @ApiOperation({
        summary: 'Delete user',
        description: 'Deletes a user by UUID. Proxies to ms-user-api. Requires JWT.',
    })
    @ApiBearerAuth('JWTAuthorization')
    @ApiParam({ name: 'id', description: 'User UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
    @ApiResponse({ status: 200, description: 'User deleted' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async deleteUser(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'DELETE',
            baseUrl: this.servicesConfig.userApiUrl,
            path: `/users/${id}`,
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
