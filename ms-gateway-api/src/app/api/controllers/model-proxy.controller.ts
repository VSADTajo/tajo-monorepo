import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import * as express from 'express';

import { ProxyService } from '@infrastructure/services/proxy.service';
import { ServicesConfigService } from '@config/services/services-config.service';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';
import {
    CreateProviderConfigGwRequestDto,
    IngestionRunGwResponseDto,
    ListIngestionRunsGwResponseDto,
    ListProviderConfigsGwResponseDto,
    ProviderConfigGwResponseDto,
    UpdateProviderConfigGwRequestDto,
} from '@api/dtos/model-proxy.dtos';

const INTERNAL_CALLER_HEADER_VALUE = 'ms-gateway-api';

/** A manual trigger runs the full ingestion inline before answering. */
const TRIGGER_TIMEOUT_MS = 300_000;

/**
 * Data-provider administration, proxied to ms-model-api.
 *
 * These endpoints are what the backoffice uses to see the ingestion sources and
 * switch between them — activating the WISKI API in place of the CSV that
 * arrives over SFTP, for instance. Until now the only way to reach them was to
 * ssh into the VM and curl the container directly.
 */
@ApiTags('Data Providers')
@ApiBearerAuth('JWTAuthorization')
@Controller()
export class ModelProxyController {
    constructor(
        private readonly proxyService: ProxyService,
        private readonly servicesConfig: ServicesConfigService,
    ) {}

    // ─────────────────────────────────────────────────────────────
    // Provider configs
    // ─────────────────────────────────────────────────────────────

    @Get('model/provider-configs')
    @ApiEndpoint({
        summary: 'List the configured data providers',
        response: { status: 200, type: ListProviderConfigsGwResponseDto, description: 'Providers' },
        errors: [{ status: 500, description: 'ms-model-api unreachable' }],
    })
    async listProviderConfigs(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        await this.pipe(req, res, { method: 'GET', path: '/provider-configs' });
    }

    @Get('model/provider-configs/:id')
    @ApiEndpoint({
        summary: 'Get one data provider',
        response: { status: 200, type: ProviderConfigGwResponseDto, description: 'Provider' },
        errors: [{ status: 404, description: 'Provider not found' }],
    })
    async getProviderConfig(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        await this.pipe(req, res, { method: 'GET', path: `/provider-configs/${id}` });
    }

    @Post('model/provider-configs')
    @ApiEndpoint({
        summary: 'Create a data provider',
        body: CreateProviderConfigGwRequestDto,
        response: { status: 201, type: ProviderConfigGwResponseDto, description: 'Provider created' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 409, description: 'A provider with that name already exists' },
        ],
    })
    async createProviderConfig(
        @Body() dto: CreateProviderConfigGwRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        await this.pipe(req, res, { method: 'POST', path: '/provider-configs', body: dto });
    }

    @Put('model/provider-configs/:id')
    @ApiEndpoint({
        summary: 'Update a data provider',
        body: UpdateProviderConfigGwRequestDto,
        response: { status: 200, type: ProviderConfigGwResponseDto, description: 'Provider updated' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 404, description: 'Provider not found' },
        ],
    })
    async updateProviderConfig(
        @Param('id') id: string,
        @Body() dto: UpdateProviderConfigGwRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        await this.pipe(req, res, { method: 'PUT', path: `/provider-configs/${id}`, body: dto });
    }

    @Patch('model/provider-configs/:id/toggle')
    @ApiEndpoint({
        summary: 'Activate or deactivate a data provider (and its scheduled job)',
        response: { status: 200, type: ProviderConfigGwResponseDto, description: 'Provider toggled' },
        errors: [{ status: 404, description: 'Provider not found' }],
    })
    async toggleProviderConfig(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        await this.pipe(req, res, { method: 'PATCH', path: `/provider-configs/${id}/toggle` });
    }

    @Post('model/provider-configs/:id/trigger')
    @ApiEndpoint({
        summary: 'Run an ingestion now, without activating the provider',
        response: { status: 201, type: IngestionRunGwResponseDto, description: 'Ingestion run' },
        errors: [
            { status: 404, description: 'Provider not found' },
            { status: 409, description: 'An ingestion is already running for this provider' },
        ],
    })
    async triggerIngestion(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        await this.pipe(req, res, {
            method: 'POST',
            path: `/provider-configs/${id}/trigger`,
            timeoutMs: TRIGGER_TIMEOUT_MS,
        });
    }

    @Delete('model/provider-configs/:id')
    @ApiEndpoint({
        summary: 'Delete a data provider',
        response: { status: 200, type: ProviderConfigGwResponseDto, description: 'Provider deleted' },
        errors: [{ status: 404, description: 'Provider not found' }],
    })
    async deleteProviderConfig(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        await this.pipe(req, res, { method: 'DELETE', path: `/provider-configs/${id}` });
    }

    // ─────────────────────────────────────────────────────────────
    // Ingestion runs
    // ─────────────────────────────────────────────────────────────

    @Get('model/ingestion-runs')
    @ApiQuery({ name: 'providerConfigId', required: false, type: String, description: 'Filter by provider' })
    @ApiEndpoint({
        summary: 'List ingestion runs',
        response: { status: 200, type: ListIngestionRunsGwResponseDto, description: 'Ingestion runs' },
        errors: [{ status: 400, description: 'Invalid providerConfigId' }],
    })
    async listIngestionRuns(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const providerConfigId = req.query.providerConfigId;
        await this.pipe(req, res, {
            method: 'GET',
            path: '/ingestion-runs',
            query: typeof providerConfigId === 'string' ? { providerConfigId } : undefined,
        });
    }

    // ─────────────────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────────────────

    private async pipe(
        req: express.Request,
        res: express.Response,
        options: {
            method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
            path: string;
            body?: unknown;
            query?: Record<string, string | string[]>;
            timeoutMs?: number;
        },
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: options.method,
            baseUrl: this.servicesConfig.modelApiUrl,
            path: options.path,
            body: options.body,
            query: options.query,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as express.Request & { user?: { userId: string; roles: string[] } }).user,
            traceId: (req as express.Request & { id?: string }).id,
            timeoutMs: options.timeoutMs,
        });

        res.status(result.status).json(result.data);
    }
}
