import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as express from 'express';

import { ProxyService } from '@infrastructure/services/proxy.service';
import { ServicesConfigService } from '@config/services/services-config.service';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';
import {
    LatestSimulationResponseDto,
    SimulationAvailableDatesResponseDto,
    HistoricalSimulationsResponseDto,
    ListSimulationsResponseDto,
    GetSimulationByDateResponseDto,
    FinalizeSimulationResponseDto,
    PredictionAvailableDatesResponseDto,
    MaxAndLatestValuesResponseDto,
    HistoricalPredictionsResponseDto,
    ForecastPredictionsResponseDto,
    ListPredictionTypesResponseDto,
    StationPredictionTypesResponseDto,
    CreatePredictionTypeResponseDto,
    DeleteSimulationGwResponseDto,
    CreateManualSimulationRequestDto,
    CreateManualSimulationResponseDto,
    GetManualSimulationByIdResponseDto,
    ListManualSimulationsResponseDto,
    CreateManeuverGwRequestDto,
    UpdateManeuverGwRequestDto,
    ManeuverGwResponseDto,
    ListManeuversGwResponseDto,
    DeleteManeuverGwResponseDto,
    SimulationFilesGwResponseDto,
} from '@api/dtos/predictions-proxy.dtos';

const INTERNAL_CALLER_HEADER_VALUE = 'ms-gateway-api';

@ApiTags('Predictions')
@ApiBearerAuth('JWTAuthorization')
@Controller()
export class PredictionsProxyController {
    constructor(
        private readonly proxyService: ProxyService,
        private readonly servicesConfig: ServicesConfigService,
    ) {}

    // ─────────────────────────────────────────────────────────────
    // Simulations
    // ─────────────────────────────────────────────────────────────

    @Get('simulations/latest')
    @ApiEndpoint({
        summary: 'Get the latest finalized simulation',
        response: { status: 200, type: LatestSimulationResponseDto, description: 'Latest finalized simulation' },
        errors: [{ status: 404, description: 'No finalized simulation found' }],
    })
    async getLatestSimulation(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/simulations/latest',
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('simulations/available-dates')
    @ApiEndpoint({
        summary: 'Get available simulation dates',
        response: { status: 200, type: SimulationAvailableDatesResponseDto, description: 'List of available dates' },
    })
    @ApiQuery({
        name: 'dataOrigin',
        required: false,
        enum: ['HISTORICAL', 'FORECAST'],
        description: 'Filter by data origin',
    })
    async getSimulationAvailableDates(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/simulations/available-dates',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('simulations/historical')
    @ApiEndpoint({
        summary: 'Get historical finalized simulations',
        response: {
            status: 200,
            type: HistoricalSimulationsResponseDto,
            description: 'Paginated list of historical simulations',
        },
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
    @ApiQuery({
        name: 'dataOrigin',
        required: false,
        enum: ['HISTORICAL', 'FORECAST'],
        description: 'Filter by data origin',
    })
    async getHistoricalSimulations(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/simulations/historical',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('simulations')
    @ApiEndpoint({
        summary: 'List simulations with optional filters, station-code filter and sorting',
        response: { status: 200, type: ListSimulationsResponseDto, description: 'Paginated list of simulations' },
    })
    @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
    @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (YYYYMMDDHHMMSS or ISO)' })
    @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (YYYYMMDDHHMMSS or ISO)' })
    @ApiQuery({ name: 'modmeteo', required: false, type: String, description: 'Filter by modmeteo' })
    @ApiQuery({ name: 'environment', required: false, type: String, description: 'Filter by environment' })
    @ApiQuery({
        name: 'dataOrigin',
        required: false,
        enum: ['HISTORICAL', 'FORECAST'],
        description: 'Filter by data origin',
    })
    @ApiQuery({
        name: 'stationCode',
        required: false,
        type: String,
        description: 'Keep only simulations with a prediction for this station code',
    })
    @ApiQuery({
        name: 'sortBy',
        required: false,
        enum: ['createdAt', 'updatedAt', 'simulationDate', 'status'],
        description: 'Field to sort by (default createdAt)',
    })
    @ApiQuery({
        name: 'sortOrder',
        required: false,
        enum: ['ASC', 'DESC'],
        description: 'Sort direction (default DESC)',
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
    async listSimulations(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/simulations',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    // ─────────────────────────────────────────────────────────────
    // Manual Simulations
    // ─────────────────────────────────────────────────────────────

    @Post('simulations/manual')
    @ApiEndpoint({
        summary: 'Execute a manual simulation with reservoir maneuvers',
        body: CreateManualSimulationRequestDto,
        response: {
            status: 201,
            type: CreateManualSimulationResponseDto,
            description: 'Manual simulation created and dispatched',
        },
        errors: [
            { status: 400, description: 'Invalid payload (empty maneuverIds, non-UUID id, or invalid modmeteo)' },
            { status: 503, description: 'SFTP upload failed; simulation remains in CREATED' },
        ],
    })
    async createManualSimulation(
        @Body() dto: CreateManualSimulationRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/simulations/manual',
            body: dto,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('simulations/manual')
    @ApiEndpoint({
        summary: 'List manual simulations with their status, maneuver count, station-code filter and sorting',
        response: {
            status: 200,
            type: ListManualSimulationsResponseDto,
            description: 'Paginated list of manual simulations',
        },
    })
    @ApiQuery({ name: 'status', required: false, description: 'Filter by SimulationStatus (e.g. MODEL_PROCESSING)' })
    @ApiQuery({
        name: 'stationCode',
        required: false,
        type: String,
        description: 'Keep only manual simulations with a prediction for this station code',
    })
    @ApiQuery({
        name: 'sortBy',
        required: false,
        enum: ['createdAt', 'updatedAt', 'simulationDate', 'status'],
        description: 'Field to sort by (default createdAt)',
    })
    @ApiQuery({
        name: 'sortOrder',
        required: false,
        enum: ['ASC', 'DESC'],
        description: 'Sort direction (default DESC)',
    })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async listManualSimulations(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/simulations/manual',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('simulations/manual/:id')
    @ApiEndpoint({
        summary: 'Get a manual simulation by ID including its maneuvers',
        response: {
            status: 200,
            type: GetManualSimulationByIdResponseDto,
            description: 'Manual simulation with maneuvers',
        },
        errors: [{ status: 404, description: 'Manual simulation not found' }],
    })
    async getManualSimulationById(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: `/simulations/manual/${id}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('simulations/:id/files')
    @ApiEndpoint({
        summary: 'List the SFTP input and output files of a simulation (read-only)',
        response: {
            status: 200,
            type: SimulationFilesGwResponseDto,
            description: 'Input and output files for the simulation',
        },
        errors: [
            { status: 400, description: 'Invalid simulation id' },
            { status: 404, description: 'Simulation not found' },
        ],
    })
    async listSimulationFiles(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: `/simulations/${id}/files`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('simulations/:id/files/download')
    @ApiOperation({ summary: 'Download a single SFTP file of a simulation (read-only)' })
    @ApiProduces('application/octet-stream')
    @ApiResponse({ status: 200, description: 'File binary stream' })
    @ApiResponse({ status: 400, description: 'Invalid simulation id, folder or file name' })
    @ApiResponse({ status: 404, description: 'Simulation or file not found' })
    @ApiQuery({ name: 'folder', required: true, enum: ['input', 'output'], description: 'Which simulation folder' })
    @ApiQuery({ name: 'name', required: true, type: String, description: 'File name inside the folder' })
    async downloadSimulationFile(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: `/simulations/${id}/files/download`,
            query: req.query as Record<string, string | string[]>,
            responseType: 'arraybuffer',
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });

        const body = Buffer.from(result.data as ArrayBuffer);

        // On error the upstream returns a JSON body (still as arraybuffer) — forward it as-is.
        if (result.status >= 400) {
            res.status(result.status);
            if (result.contentType) res.setHeader('Content-Type', result.contentType);
            res.send(body);
            return;
        }

        const rawName = req.query.name;
        const fileName = typeof rawName === 'string' && rawName.length > 0 ? rawName : 'download';
        res.status(result.status);
        res.setHeader('Content-Type', result.contentType ?? 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '')}"`);
        res.send(body);
    }

    @Get('simulations/:simulationDate')
    @ApiEndpoint({
        summary: 'Get simulation by date (YYYYMMDDHHMMSS)',
        response: { status: 200, type: GetSimulationByDateResponseDto, description: 'Simulation for the given date' },
        errors: [{ status: 404, description: 'Simulation not found' }],
    })
    async getSimulationByDate(
        @Param('simulationDate') simulationDate: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: `/simulations/${simulationDate}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Patch('simulations/:id/finalize')
    @ApiEndpoint({
        summary: 'Finalize a simulation',
        response: {
            status: 200,
            type: FinalizeSimulationResponseDto,
            description: 'Simulation finalized successfully',
        },
        errors: [
            { status: 404, description: 'Simulation not found' },
            { status: 409, description: 'Cannot finalize from current status' },
        ],
    })
    async finalizeSimulation(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'PATCH',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: `/simulations/${id}/finalize`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Delete('simulations/:id')
    @ApiEndpoint({
        summary: 'Delete a simulation (soft delete + removes its exclusive maneuvers)',
        response: {
            status: 200,
            type: DeleteSimulationGwResponseDto,
            description: 'Simulation deleted',
        },
        errors: [{ status: 404, description: 'Simulation not found' }],
    })
    async deleteSimulation(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'DELETE',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: `/simulations/${id}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    // ─────────────────────────────────────────────────────────────
    // Predictions
    // ─────────────────────────────────────────────────────────────

    @Get('predictions/available-dates')
    @ApiEndpoint({
        summary: 'Get available prediction dates, optionally filtered by station with type details',
        response: {
            status: 200,
            type: PredictionAvailableDatesResponseDto,
            description: 'List of available dates or detailed simulation dates by station',
        },
    })
    @ApiQuery({
        name: 'dataOrigin',
        required: false,
        enum: ['HISTORICAL', 'FORECAST'],
        description: 'Filter by data origin',
    })
    @ApiQuery({
        name: 'stationId',
        required: false,
        type: String,
        description: 'Filter by station ID — returns detailed info with prediction types per date',
        example: 'AR35',
    })
    @ApiQuery({
        name: 'predictionType',
        required: false,
        type: String,
        description: 'Filter by prediction type name (repeat param for multiple: &predictionType=B)',
        example: 'Q.NAM.harmonie',
    })
    async getPredictionAvailableDates(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/predictions/available-dates',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('predictions/max-and-latest-values')
    @ApiEndpoint({
        summary: 'Get max and latest prediction values per station',
        response: {
            status: 200,
            type: MaxAndLatestValuesResponseDto,
            description: 'Max and latest values per station',
        },
    })
    @ApiQuery({
        name: 'simulationDate',
        required: false,
        type: String,
        description:
            'Filter by simulation date. If omitted, defaults to the latest finalized simulation matching the given typeName and modmeteo filters',
        example: '20260129000000',
    })
    @ApiQuery({
        name: 'typeName',
        required: false,
        type: String,
        description: 'Filter by prediction type name',
        example: 'P.harmonie.forecast',
    })
    @ApiQuery({ name: 'percentile', required: false, type: Number, description: 'Filter by percentile', example: 75 })
    @ApiQuery({
        name: 'modmeteo',
        required: false,
        type: String,
        description: 'Filter by modmeteo',
        example: 'EPS Pluviometría',
    })
    async getMaxAndLatestValues(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/predictions/max-and-latest-values',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('predictions/historical')
    @ApiEndpoint({
        summary: 'Reconstruct the deduplicated observed timeline for a station, prediction type and date window',
        response: {
            status: 200,
            type: HistoricalPredictionsResponseDto,
            description:
                'Observed points ordered ascending by date. For each timestamp the row with the latest createdAt wins.',
        },
    })
    @ApiQuery({
        name: 'stationId',
        required: true,
        type: String,
        description: 'Station ID to reconstruct the observed timeline for',
        example: 'AR35',
    })
    @ApiQuery({
        name: 'predictionType',
        required: true,
        type: String,
        description: 'Prediction type name (exact match, e.g. Q.historical, Precip.historical, WI__01.historical)',
        example: 'Q.historical',
    })
    @ApiQuery({
        name: 'startDate',
        required: true,
        type: String,
        description: 'Inclusive lower bound of the date window (ISO 8601, UTC)',
        example: '2026-03-01T00:00:00Z',
    })
    @ApiQuery({
        name: 'endDate',
        required: true,
        type: String,
        description: 'Inclusive upper bound of the date window (ISO 8601, UTC)',
        example: '2026-03-31T23:59:59Z',
    })
    async getHistoricalPredictions(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/predictions/historical',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    // ─────────────────────────────────────────────────────────────
    // Forecast
    // ─────────────────────────────────────────────────────────────

    @Get('predictions/forecast')
    @ApiEndpoint({
        summary: 'Get forecast predictions with optional filters',
        response: { status: 200, type: ForecastPredictionsResponseDto, description: 'Forecast predictions' },
    })
    @ApiQuery({
        name: 'stationId',
        required: false,
        type: String,
        description: 'Filter by station ID',
        example: 'AC01',
    })
    @ApiQuery({
        name: 'simulationDate',
        required: false,
        type: String,
        description: 'Filter by simulation date',
        example: '20260129000000',
    })
    @ApiQuery({
        name: 'predictionType',
        required: false,
        type: String,
        description: 'Filter by prediction type name',
        example: 'P.ens.forecast',
    })
    @ApiQuery({
        name: 'percentile',
        required: false,
        type: Number,
        description: 'Filter by percentile (omit for IS NULL)',
        example: 75,
    })
    @ApiQuery({
        name: 'startDate',
        required: false,
        type: String,
        description: 'Inclusive lower bound of the result date window (ISO 8601, UTC)',
        example: '2026-03-01T00:00:00Z',
    })
    @ApiQuery({
        name: 'endDate',
        required: false,
        type: String,
        description: 'Inclusive upper bound of the result date window (ISO 8601, UTC)',
        example: '2026-03-31T23:59:59Z',
    })
    async getForecastPredictions(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/predictions/forecast',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    // ─────────────────────────────────────────────────────────────
    // Prediction Types
    // ─────────────────────────────────────────────────────────────

    @Get('prediction-types')
    @ApiEndpoint({
        summary: 'List all prediction types',
        response: { status: 200, type: ListPredictionTypesResponseDto, description: 'List of prediction types' },
    })
    async listPredictionTypes(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/prediction-types',
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('prediction-types/by-station/:stationCode')
    @ApiEndpoint({
        summary: 'List prediction types that have data for a station',
        response: {
            status: 200,
            type: StationPredictionTypesResponseDto,
            description: 'Prediction types with data (results) for the given station code',
        },
    })
    async listPredictionTypesByStation(
        @Param('stationCode') stationCode: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: `/prediction-types/by-station/${stationCode}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Post('prediction-types')
    @ApiEndpoint({
        summary: 'Create a prediction type',
        response: { status: 201, type: CreatePredictionTypeResponseDto, description: 'Prediction type created' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 409, description: 'Prediction type with this name already exists' },
        ],
    })
    async createPredictionType(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/prediction-types',
            body: req.body,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    // ─────────────────────────────────────────────────────────────
    // Maneuvers (reusable, standalone)
    // ─────────────────────────────────────────────────────────────

    @Post('maneuvers')
    @ApiEndpoint({
        summary: 'Create a reusable maneuver (reservoirCode + outputFlowValue)',
        body: CreateManeuverGwRequestDto,
        response: { status: 201, type: ManeuverGwResponseDto, description: 'Maneuver created' },
        errors: [{ status: 400, description: 'Invalid payload' }],
    })
    async createManeuver(
        @Body() dto: CreateManeuverGwRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'POST',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/maneuvers',
            body: dto,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('maneuvers')
    @ApiEndpoint({
        summary: 'List maneuvers (paginated, optional reservoirCode filter)',
        response: { status: 200, type: ListManeuversGwResponseDto, description: 'Paginated maneuvers' },
    })
    @ApiQuery({ name: 'reservoirCode', required: false, type: String })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async listManeuvers(@Req() req: express.Request, @Res() res: express.Response): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: '/maneuvers',
            query: req.query as Record<string, string | string[]>,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Get('maneuvers/:id')
    @ApiEndpoint({
        summary: 'Get a maneuver by ID',
        response: { status: 200, type: ManeuverGwResponseDto, description: 'Maneuver detail' },
        errors: [{ status: 404, description: 'Maneuver not found' }],
    })
    async getManeuverById(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'GET',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: `/maneuvers/${id}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Patch('maneuvers/:id')
    @ApiEndpoint({
        summary: 'Update a maneuver (affects every simulation referencing it)',
        body: UpdateManeuverGwRequestDto,
        response: { status: 200, type: ManeuverGwResponseDto, description: 'Maneuver updated' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 404, description: 'Maneuver not found' },
        ],
    })
    async updateManeuver(
        @Param('id') id: string,
        @Body() dto: UpdateManeuverGwRequestDto,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'PATCH',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: `/maneuvers/${id}`,
            body: dto,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }

    @Delete('maneuvers/:id')
    @ApiEndpoint({
        summary: 'Delete a maneuver (cascade: removes its link from all simulations referencing it)',
        response: { status: 200, type: DeleteManeuverGwResponseDto, description: 'Maneuver deleted' },
        errors: [{ status: 404, description: 'Maneuver not found' }],
    })
    async deleteManeuver(
        @Param('id') id: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ): Promise<void> {
        const result = await this.proxyService.forward({
            method: 'DELETE',
            baseUrl: this.servicesConfig.predictionsApiUrl,
            path: `/maneuvers/${id}`,
            headers: { 'x-internal-caller': INTERNAL_CALLER_HEADER_VALUE },
            user: (req as any).user,
            traceId: (req as any).id,
        });
        res.status(result.status).json(result.data);
    }
}
