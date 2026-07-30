import { Controller, Delete, Get, Param, Patch, Post, Put, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import * as express from 'express';

import { ProxyService } from '@infrastructure/services/proxy.service';
import { ServicesConfigService } from '@config/services/services-config.service';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';
import {
    ListBasinsResponseDto,
    GetBasinResponseDto,
    ToggleBasinResponseDto,
    DeleteBasinResponseDto,
    ListSubBasinsResponseDto,
    GetSubBasinResponseDto,
    ToggleSubBasinResponseDto,
    DeleteSubBasinResponseDto,
    ListStationsResponseDto,
    GetStationResponseDto,
    ToggleStationResponseDto,
    DeleteStationResponseDto,
    GetThresholdResponseDto,
    UpdateThresholdResponseDto,
    SyncGeoserverResponseDto,
    SearchGeoDataResponseDto,
    GetResguardosByStationResponseDto,
    GetResguardoByDateResponseDto,
    UpdateResguardoRequestDto,
    UpdateResguardoResponseDto,
    GetDownstreamStationsResponseDto,
    ImportStationsResponseDto,
    ListScenariosResponseDto,
    GetScenarioResponseDto,
    DeleteScenarioResponseDto,
} from '@api/dtos/hydro-proxy.dtos';

const INTERNAL_CALLER_HEADER_VALUE = 'ms-gateway-api';

@ApiTags('Hydro')
@ApiBearerAuth('JWTAuthorization')
@Controller()
export class HydroProxyController {
    constructor(
        private readonly proxyService: ProxyService,
        private readonly servicesConfig: ServicesConfigService,
    ) {}

    // ─────────────────────────────────────────────────────────────
    // Basins
    // ─────────────────────────────────────────────────────────────

    @Get('basins')
    @ApiEndpoint({
        summary: 'List basins with optional filters',
        response: { status: 200, type: ListBasinsResponseDto, description: 'List of basins' },
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'isActive', required: false, type: Boolean })
    async listBasins(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: '/basins',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('basins/:id')
    @ApiEndpoint({
        summary: 'Get a basin by ID with its sub-basins',
        response: { status: 200, type: GetBasinResponseDto, description: 'Basin with sub-basins' },
        errors: [{ status: 404, description: 'Basin not found' }],
    })
    async getBasin(@Param('id') id: string, @Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/basins/${id}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('basins')
    @ApiEndpoint({
        summary: 'Create a basin',
        response: { status: 201, type: GetBasinResponseDto, description: 'Basin created' },
        errors: [{ status: 400, description: 'Invalid payload' }],
    })
    async createBasin(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: '/basins',
            body: req.body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Put('basins/:id')
    @ApiEndpoint({
        summary: 'Update a basin',
        response: { status: 200, type: GetBasinResponseDto, description: 'Basin updated' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 404, description: 'Basin not found' },
        ],
    })
    async updateBasin(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'PUT',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/basins/${id}`,
            body: req.body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Patch('basins/:id/toggle')
    @ApiEndpoint({
        summary: 'Toggle basin active status',
        response: { status: 200, type: ToggleBasinResponseDto, description: 'Basin toggled' },
        errors: [{ status: 404, description: 'Basin not found' }],
    })
    async toggleBasin(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'PATCH',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/basins/${id}/toggle`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Delete('basins/:id')
    @ApiEndpoint({
        summary: 'Delete a basin',
        response: { status: 200, type: DeleteBasinResponseDto, description: 'Basin deleted' },
        errors: [{ status: 404, description: 'Basin not found' }],
    })
    async deleteBasin(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'DELETE',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/basins/${id}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    // ─────────────────────────────────────────────────────────────
    // Sub-Basins
    // ─────────────────────────────────────────────────────────────

    @Get('sub-basins')
    @ApiEndpoint({
        summary: 'List sub-basins with optional filters',
        response: { status: 200, type: ListSubBasinsResponseDto, description: 'List of sub-basins' },
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'basinId', required: false, type: String, description: 'Filter by basin ID' })
    @ApiQuery({ name: 'isActive', required: false, type: Boolean })
    async listSubBasins(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: '/sub-basins',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('sub-basins/:id')
    @ApiEndpoint({
        summary: 'Get a sub-basin by ID with its stations',
        response: { status: 200, type: GetSubBasinResponseDto, description: 'Sub-basin with stations' },
        errors: [{ status: 404, description: 'Sub-basin not found' }],
    })
    async getSubBasin(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/sub-basins/${id}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('sub-basins')
    @ApiEndpoint({
        summary: 'Create a sub-basin',
        response: { status: 201, type: GetSubBasinResponseDto, description: 'Sub-basin created' },
        errors: [{ status: 400, description: 'Invalid payload' }],
    })
    async createSubBasin(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: '/sub-basins',
            body: req.body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Put('sub-basins/:id')
    @ApiEndpoint({
        summary: 'Update a sub-basin',
        response: { status: 200, type: GetSubBasinResponseDto, description: 'Sub-basin updated' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 404, description: 'Sub-basin not found' },
        ],
    })
    async updateSubBasin(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'PUT',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/sub-basins/${id}`,
            body: req.body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Patch('sub-basins/:id/toggle')
    @ApiEndpoint({
        summary: 'Toggle sub-basin active status',
        response: { status: 200, type: ToggleSubBasinResponseDto, description: 'Sub-basin toggled' },
        errors: [{ status: 404, description: 'Sub-basin not found' }],
    })
    async toggleSubBasin(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'PATCH',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/sub-basins/${id}/toggle`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Delete('sub-basins/:id')
    @ApiEndpoint({
        summary: 'Delete a sub-basin',
        response: { status: 200, type: DeleteSubBasinResponseDto, description: 'Sub-basin deleted' },
        errors: [{ status: 404, description: 'Sub-basin not found' }],
    })
    async deleteSubBasin(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'DELETE',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/sub-basins/${id}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    // ─────────────────────────────────────────────────────────────
    // Stations
    // ─────────────────────────────────────────────────────────────

    @Get('stations')
    @ApiEndpoint({
        summary: 'List stations with optional filters',
        response: { status: 200, type: ListStationsResponseDto, description: 'List of stations' },
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'subBasinId', required: false, type: String, description: 'Filter by sub-basin ID' })
    @ApiQuery({
        name: 'stationType',
        required: false,
        type: String,
        description: 'Filter by station type',
        example: 'AFORO_EN_RIO',
    })
    @ApiQuery({ name: 'isActive', required: false, type: Boolean })
    @ApiQuery({
        name: 'zona',
        required: false,
        type: String,
        description: 'Filter by SAIH zone name (exact match)',
        example: 'MADRID',
    })
    @ApiQuery({
        name: 'zonaExplOgcFid',
        required: false,
        type: Number,
        description: 'Filter by exploitation zone ogc_fid (exact match)',
        example: 1,
    })
    @ApiQuery({
        name: 'zonaExplNombre',
        required: false,
        type: String,
        description: 'Filter by exploitation zone name (exact match)',
        example: 'ZONA 1',
    })
    @ApiQuery({
        name: 'subBasinName',
        required: false,
        type: String,
        description: 'Filter by sub-basin name',
        example: 'EL ATAZAR',
    })
    @ApiQuery({
        name: 'comarcaName',
        required: false,
        type: String,
        description: 'Filter by agricultural district name',
        example: 'LOZOYA SOMOSIERRA',
    })
    @ApiQuery({
        name: 'sistemaName',
        required: false,
        type: String,
        description: 'Filter by water system name',
        example: 'MADRID',
    })
    @ApiQuery({
        name: 'meteoalertaZonaCode',
        required: false,
        type: String,
        description: 'Filter by AEMET meteoalert zone code (cod_z / geocode, exact match)',
        example: '670502',
    })
    @ApiQuery({
        name: 'meteoalertaZonaNombre',
        required: false,
        type: String,
        description: 'Filter by AEMET meteoalert zone name (nom_z, partial match)',
        example: 'Norte de Cáceres',
    })
    @ApiQuery({
        name: 'stationCode',
        required: false,
        type: String,
        description: 'Filter by station code',
        example: 'R504',
    })
    async listStations(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: '/stations',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('stations/by-sub-basin-name/:subBasinName')
    @ApiEndpoint({
        summary: 'Get stations by sub-basin name',
        response: { status: 200, type: GetStationResponseDto, description: 'Station details' },
        errors: [{ status: 404, description: 'Station not found' }],
    })
    async getStationBySubBasinName(
        @Param('subBasinName') subBasinName: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/stations/by-sub-basin-name/${encodeURIComponent(subBasinName)}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('stations/by-code/:code')
    @ApiEndpoint({
        summary: 'Get a station by SAIH station code',
        response: { status: 200, type: GetStationResponseDto, description: 'Station details' },
        errors: [{ status: 404, description: 'Station not found for this code' }],
    })
    async getStationByCode(
        @Param('code') code: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/stations/by-code/${encodeURIComponent(code)}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('stations/downstream')
    @ApiEndpoint({
        summary: 'Get stations and reservoirs located downstream of the given origin codes',
        response: {
            status: 200,
            type: GetDownstreamStationsResponseDto,
            description: 'Distinct downstream destinations (network analysis from GIS materialized view)',
        },
        errors: [{ status: 400, description: 'Empty or missing codes' }],
    })
    @ApiQuery({
        name: 'codes',
        required: true,
        type: String,
        isArray: true,
        description:
            'Origin station codes. Pass the parameter once per code: `?codes=AR01&codes=AR02`. ' +
            'A single value is also accepted: `?codes=AR01`.',
        example: ['AR01', 'AR02'],
    })
    async getDownstreamStations(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: '/stations/downstream',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('stations/:id')
    @ApiEndpoint({
        summary: 'Get a station by ID',
        response: { status: 200, type: GetStationResponseDto, description: 'Station details' },
        errors: [{ status: 404, description: 'Station not found' }],
    })
    async getStation(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/stations/${id}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('stations/import')
    @ApiEndpoint({
        summary: 'Bulk import stations from a JSON payload',
        response: { status: 200, type: ImportStationsResponseDto, description: 'Import summary (created/updated/skipped + errors)' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 404, description: 'Basin not found' },
        ],
    })
    async importStations(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: '/stations/import',
            body: req.body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('stations')
    @ApiEndpoint({
        summary: 'Create a station',
        response: { status: 201, type: GetStationResponseDto, description: 'Station created' },
        errors: [{ status: 400, description: 'Invalid payload' }],
    })
    async createStation(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: '/stations',
            body: req.body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Put('stations/:id')
    @ApiEndpoint({
        summary: 'Update a station',
        response: { status: 200, type: GetStationResponseDto, description: 'Station updated' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 404, description: 'Station not found' },
        ],
    })
    async updateStation(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'PUT',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/stations/${id}`,
            body: req.body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Patch('stations/:id/toggle')
    @ApiEndpoint({
        summary: 'Toggle station active status',
        response: { status: 200, type: ToggleStationResponseDto, description: 'Station toggled' },
        errors: [{ status: 404, description: 'Station not found' }],
    })
    async toggleStation(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'PATCH',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/stations/${id}/toggle`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Delete('stations/:id')
    @ApiEndpoint({
        summary: 'Delete a station',
        response: { status: 200, type: DeleteStationResponseDto, description: 'Station deleted' },
        errors: [{ status: 404, description: 'Station not found' }],
    })
    async deleteStation(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'DELETE',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/stations/${id}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Put('stations/:id/threshold')
    @ApiEndpoint({
        summary: 'Update station threshold',
        response: { status: 200, type: UpdateThresholdResponseDto, description: 'Threshold updated' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 404, description: 'Station not found' },
        ],
    })
    async updateThreshold(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'PUT',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/stations/${id}/threshold`,
            body: req.body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('stations/:id/threshold')
    @ApiEndpoint({
        summary: 'Get station threshold',
        response: { status: 200, type: GetThresholdResponseDto, description: 'Threshold value' },
        errors: [{ status: 404, description: 'Station not found' }],
    })
    async getThreshold(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/stations/${id}/threshold`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    // ─────────────────────────────────────────────────────────────
    // Resguardos
    // ─────────────────────────────────────────────────────────────

    @Get('resguardos/:stationCode')
    @ApiEndpoint({
        summary: 'Get resguardos by station code (daily time series)',
        response: { status: 200, type: GetResguardosByStationResponseDto, description: 'Resguardo time series' },
        errors: [{ status: 404, description: 'Station not found' }],
    })
    @ApiQuery({ name: 'year', required: false, type: Number, description: 'Filter by year', example: 2025 })
    @ApiQuery({
        name: 'from',
        required: false,
        type: String,
        description: 'Filter from date (YYYY-MM-DD)',
        example: '2025-01-01',
    })
    @ApiQuery({
        name: 'to',
        required: false,
        type: String,
        description: 'Filter to date (YYYY-MM-DD)',
        example: '2025-12-31',
    })
    async getResguardosByStation(
        @Param('stationCode') stationCode: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/resguardos/${encodeURIComponent(stationCode)}`,
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('resguardos/:stationCode/:date')
    @ApiEndpoint({
        summary: 'Get resguardo for a specific station and date',
        response: { status: 200, type: GetResguardoByDateResponseDto, description: 'Single resguardo entry' },
        errors: [{ status: 404, description: 'Station or date not found' }],
    })
    async getResguardoByDate(
        @Param('stationCode') stationCode: string,
        @Param('date') date: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/resguardos/${encodeURIComponent(stationCode)}/${encodeURIComponent(date)}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Put('resguardos/:stationCode/:date')
    @ApiEndpoint({
        summary: 'Update editable resguardo values for a specific date',
        body: UpdateResguardoRequestDto,
        response: { status: 200, type: UpdateResguardoResponseDto, description: 'Resguardo updated' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 404, description: 'Station or date not found' },
        ],
    })
    async updateResguardo(
        @Param('stationCode') stationCode: string,
        @Param('date') date: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'PUT',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/resguardos/${encodeURIComponent(stationCode)}/${encodeURIComponent(date)}`,
            body: req.body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    // ─────────────────────────────────────────────────────────────
    // Sync
    // ─────────────────────────────────────────────────────────────

    @Post('sync/geoserver')
    @ApiEndpoint({
        summary: 'Sync data from GeoServer database',
        response: { status: 201, type: SyncGeoserverResponseDto, description: 'Sync completed' },
        errors: [{ status: 500, description: 'GeoServer database unreachable or sync failed' }],
    })
    async syncGeoserver(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: '/sync/geoserver',
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    // ─────────────────────────────────────────────────────────────
    // Search
    // ─────────────────────────────────────────────────────────────

    @Get('search')
    @ApiEndpoint({
        summary: 'Search across all CHT geographic entities',
        response: { status: 200, type: SearchGeoDataResponseDto, description: 'List of matching entities' },
        errors: [{ status: 400, description: 'Validation error (missing or invalid query)' }],
    })
    @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query text', example: 'tajo' })
    async searchGeoData(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: '/search',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
        });
        res.status(result.status).json(result.data);
    }

    // ─────────────────────────────────────────────────────────────
    // Scenarios (test datasets — raw JSON storage)
    // ─────────────────────────────────────────────────────────────

    @Get('scenarios')
    @ApiEndpoint({
        summary: 'List scenarios (metadata only, no payload)',
        response: { status: 200, type: ListScenariosResponseDto, description: 'List of scenarios' },
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    async listScenarios(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: '/scenarios',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('scenarios/:id')
    @ApiEndpoint({
        summary: 'Get a scenario by ID (with full payload)',
        response: { status: 200, type: GetScenarioResponseDto, description: 'Scenario found' },
        errors: [{ status: 404, description: 'Scenario not found' }],
    })
    async getScenario(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/scenarios/${id}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('scenarios')
    @ApiEndpoint({
        summary: 'Create a scenario (store a raw JSON test dataset)',
        response: { status: 201, type: GetScenarioResponseDto, description: 'Scenario created (metadata)' },
        errors: [{ status: 400, description: 'Invalid payload' }],
    })
    async createScenario(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: '/scenarios',
            body: req.body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Delete('scenarios/:id')
    @ApiEndpoint({
        summary: 'Delete a scenario',
        response: { status: 200, type: DeleteScenarioResponseDto, description: 'Scenario deleted' },
        errors: [{ status: 404, description: 'Scenario not found' }],
    })
    async deleteScenario(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'DELETE',
            baseUrl: this.servicesConfig.hydroApiUrl,
            path: `/scenarios/${id}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }
}
