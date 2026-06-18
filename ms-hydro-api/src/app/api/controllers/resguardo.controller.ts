import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Inject,
    Param,
    Put,
    Post,
    Query,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';
import { ResguardoImportService } from '@infrastructure/services/resguardo-import.service';
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import {
    ImportResguardosResult,
    GetResguardosByStationResult,
    GetResguardoByDateResult,
    UpdateResguardoResult,
} from '@domain/results/resguardo.results';
import { ImportResguardosCommand, UpdateResguardoCommand } from '@application/commands/resguardo.commands';
import {
    GetResguardosByStationMapper,
    GetResguardoByDateMapper,
    UpdateResguardoMapper,
    ImportResguardosMapper,
} from '@application/mappers/resguardo.mappers';
import {
    GetResguardosByStationRequestDto,
    GetResguardosByStationResponseDto,
    GetResguardoByDateResponseDto,
    UpdateResguardoRequestDto,
    UpdateResguardoResponseDto,
    ImportResguardosResponseDto,
} from '@api/dtos/resguardo.dtos';

@ApiTags('Resguardos')
@Controller('resguardos')
export class ResguardoController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
        private readonly importService: ResguardoImportService,
    ) {}

    @Post('import')
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiEndpoint({
        summary: 'Import resguardos from XLS/XLSX file',
        response: { status: 201, type: ImportResguardosResponseDto, description: 'Import completed' },
        errors: [{ status: 400, description: 'Invalid file or parse error' }],
    })
    async importResguardos(
        @UploadedFile() file: Express.Multer.File,
        @Query('baseYear') baseYearParam?: string,
    ): Promise<ImportResguardosResponseDto> {
        const baseYear = baseYearParam ? parseInt(baseYearParam, 10) : undefined;
        this.logger.log({ msg: 'Import resguardos request', filename: file?.originalname, baseYear });

        if (!file) {
            throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
        }

        try {
            const rows = this.importService.parseXls(file.buffer, file.originalname, baseYear);
            const command = new ImportResguardosCommand({ rows });
            const result = await this.commandBus.execute<ImportResguardosCommand, ImportResguardosResult>(command);
            return ImportResguardosMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error importing resguardos', entity: 'Resguardo', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':stationCode')
    @ApiEndpoint({
        summary: 'Get resguardos by station code',
        response: { status: 200, type: GetResguardosByStationResponseDto, description: 'Resguardo time series' },
        errors: [{ status: 404, description: 'Station not found' }],
    })
    async getByStation(
        @Param('stationCode') stationCode: string,
        @Query() dto: GetResguardosByStationRequestDto,
    ): Promise<GetResguardosByStationResponseDto> {
        this.logger.log({ msg: 'Get resguardos by station', stationCode });

        try {
            const query = GetResguardosByStationMapper.toQuery(stationCode, dto);
            const result = await this.cachingQueryBus.execute<GetResguardosByStationResult>(query);
            return GetResguardosByStationMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error getting resguardos', entity: 'Resguardo', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':stationCode/:date')
    @ApiEndpoint({
        summary: 'Get resguardo for a specific station and date',
        response: { status: 200, type: GetResguardoByDateResponseDto, description: 'Single resguardo entry' },
        errors: [{ status: 404, description: 'Station or date not found' }],
    })
    async getByStationAndDate(
        @Param('stationCode') stationCode: string,
        @Param('date') date: string,
    ): Promise<GetResguardoByDateResponseDto> {
        this.logger.log({ msg: 'Get resguardo by date', stationCode, date });

        try {
            const query = GetResguardoByDateMapper.toQuery(stationCode, date);
            const result = await this.cachingQueryBus.execute<GetResguardoByDateResult>(query);
            return GetResguardoByDateMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error getting resguardo by date', entity: 'Resguardo', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Put(':stationCode/:date')
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
        @Body() dto: UpdateResguardoRequestDto,
    ): Promise<UpdateResguardoResponseDto> {
        this.logger.log({ msg: 'Update resguardo', stationCode, date });

        try {
            const command = UpdateResguardoMapper.toCommand(stationCode, date, dto);
            const result = await this.commandBus.execute<UpdateResguardoCommand, UpdateResguardoResult>(command);
            return UpdateResguardoMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error({ msg: 'Error updating resguardo', entity: 'Resguardo', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
