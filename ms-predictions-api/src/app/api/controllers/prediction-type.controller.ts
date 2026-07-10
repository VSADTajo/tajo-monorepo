import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Inject,
    Param,
    Post,
    Res,
    StreamableFile,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Logger } from 'nestjs-pino';
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// DTOs
import {
    CreatePredictionTypeRequestDto,
    CreatePredictionTypeResponseDto,
    ListPredictionTypesResponseDto,
    StationPredictionTypesResponseDto,
    CoverageMatrixResponseDto,
} from '@api/dtos/prediction-type.dtos';

// Mappers
import {
    ListPredictionTypesMapper,
    CreatePredictionTypeMapper,
    ListStationPredictionTypesMapper,
    CoverageMatrixMapper,
} from '@application/mappers/prediction-type.mappers';

// Queries
import { GetTypeCoverageMatrixQuery } from '@application/queries/prediction-type.queries';

// Results
import { ListPredictionTypesResult } from '@domain/results/prediction-type.result';
import { PredictionTypeResult } from '@domain/results/prediction-type.result';
import { StationTypeCoverageResult, CoverageMatrixResult } from '@domain/results/prediction-type.result';

// Services
import { CoverageReportService } from '@infrastructure/services/coverage-report.service';

// Errors
import { EntityError } from '@domain/errors/entity.error';
import { ApiError } from '@domain/errors/api.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('PredictionTypes')
@Controller('prediction-types')
export class PredictionTypeController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly cachingQueryBus: CachingQueryBus,
        private readonly commandBus: CommandBus,
        private readonly coverageReportService: CoverageReportService,
    ) {}

    @Get()
    @ApiEndpoint({
        summary: 'List all prediction types',
        response: { status: 200, type: ListPredictionTypesResponseDto, description: 'List of prediction types' },
    })
    async list(): Promise<ListPredictionTypesResponseDto> {
        this.logger.log('List prediction types request');
        try {
            const query = ListPredictionTypesMapper.toQuery();
            const result = await this.cachingQueryBus.execute<ListPredictionTypesResult>(query);
            return ListPredictionTypesMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error listing prediction types: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('coverage')
    @ApiEndpoint({
        summary: 'Coverage matrix of all stations × all prediction types (last ingestion per cell)',
        response: {
            status: 200,
            type: CoverageMatrixResponseDto,
            description: 'Every station with, per catalog type, the last ingested result or null (never)',
        },
    })
    async getCoverageMatrix(): Promise<CoverageMatrixResponseDto> {
        this.logger.log('Get prediction type coverage matrix');
        try {
            const result = await this.cachingQueryBus.execute<CoverageMatrixResult>(new GetTypeCoverageMatrixQuery());
            return CoverageMatrixMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error building coverage matrix: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('coverage/report.xlsx')
    @ApiOperation({ summary: 'Download the full stations × types coverage matrix as an Excel file' })
    @ApiProduces(XLSX_CONTENT_TYPE)
    @ApiResponse({ status: 200, description: 'Excel workbook (binary stream)' })
    async downloadCoverageMatrixReport(@Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
        this.logger.log('Download coverage matrix report (xlsx)');
        try {
            const result = await this.cachingQueryBus.execute<CoverageMatrixResult>(new GetTypeCoverageMatrixQuery());
            const buffer = await this.coverageReportService.buildMatrixWorkbook(result);
            res.set({
                'Content-Type': XLSX_CONTENT_TYPE,
                'Content-Disposition': 'attachment; filename="cobertura-todas-las-estaciones.xlsx"',
                'Content-Length': buffer.length.toString(),
            });
            return new StreamableFile(buffer);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error building coverage matrix report: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('by-station/:stationCode')
    @ApiEndpoint({
        summary: 'Coverage of ALL catalog prediction types for a station (with data / never + last ingestion)',
        response: {
            status: 200,
            type: StationPredictionTypesResponseDto,
            description: 'Every catalog type with its coverage status for the given station code',
        },
    })
    async listByStation(@Param('stationCode') stationCode: string): Promise<StationPredictionTypesResponseDto> {
        this.logger.log(`Get prediction type coverage for station: ${stationCode}`);
        try {
            const query = ListStationPredictionTypesMapper.toQuery(stationCode);
            const result = await this.cachingQueryBus.execute<StationTypeCoverageResult>(query);
            return ListStationPredictionTypesMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error listing prediction type coverage by station: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('by-station/:stationCode/report.xlsx')
    @ApiOperation({ summary: 'Download the prediction type coverage of a station as an Excel file' })
    @ApiProduces(XLSX_CONTENT_TYPE)
    @ApiResponse({ status: 200, description: 'Excel workbook (binary stream)' })
    async downloadStationReport(
        @Param('stationCode') stationCode: string,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        this.logger.log(`Download station coverage report (xlsx): ${stationCode}`);
        try {
            const query = ListStationPredictionTypesMapper.toQuery(stationCode);
            const result = await this.cachingQueryBus.execute<StationTypeCoverageResult>(query);
            const buffer = await this.coverageReportService.buildStationWorkbook(result);
            const safeCode = stationCode.replace(/[^a-zA-Z0-9._-]/g, '_');
            res.set({
                'Content-Type': XLSX_CONTENT_TYPE,
                'Content-Disposition': `attachment; filename="cobertura-${safeCode}.xlsx"`,
                'Content-Length': buffer.length.toString(),
            });
            return new StreamableFile(buffer);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error building station coverage report: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post()
    @ApiEndpoint({
        summary: 'Create a prediction type',
        body: CreatePredictionTypeRequestDto,
        response: { status: 201, type: CreatePredictionTypeResponseDto, description: 'Prediction type created' },
        errors: [
            { status: 400, description: 'Invalid payload' },
            { status: 409, description: 'Prediction type with this name already exists' },
        ],
    })
    async create(@Body() dto: CreatePredictionTypeRequestDto): Promise<CreatePredictionTypeResponseDto> {
        this.logger.log(`Create prediction type request: name=${dto.name}, unit=${dto.unit}`);
        try {
            const command = CreatePredictionTypeMapper.toCommand(dto);
            const result = await this.commandBus.execute<typeof command, PredictionTypeResult>(command);
            return CreatePredictionTypeMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error creating prediction type: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
