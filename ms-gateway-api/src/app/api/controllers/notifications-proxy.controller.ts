import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import * as express from 'express';

import { ProxyService } from '@infrastructure/services/proxy.service';
import { ServicesConfigService } from '@config/services/services-config.service';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';
import { ListNotificationsResponseDto } from '@api/dtos/notifications-proxy.dtos';

const INTERNAL_CALLER_HEADER_VALUE = 'ms-gateway-api';

@ApiTags('Notifications')
@ApiBearerAuth('JWTAuthorization')
@Controller()
export class NotificationsProxyController {
    constructor(
        private readonly proxyService: ProxyService,
        private readonly servicesConfig: ServicesConfigService,
    ) {}

    @Get('notifications')
    @ApiEndpoint({
        summary: 'List notifications with filters and pagination',
        response: { status: 200, type: ListNotificationsResponseDto, description: 'Paginated list of notifications' },
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status', example: 'UNREAD' })
    @ApiQuery({
        name: 'severity',
        required: false,
        type: String,
        description: 'Filter by severity',
        example: 'CRITICAL',
    })
    @ApiQuery({
        name: 'source',
        required: false,
        type: String,
        description: 'Filter by source',
        example: 'ms-predictions-api',
    })
    @ApiQuery({
        name: 'type',
        required: false,
        type: String,
        description: 'Filter by type',
        example: 'THRESHOLD_EXCEEDED',
    })
    async listNotifications(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.notificationsApiUrl,
            path: '/notifications',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }
}
