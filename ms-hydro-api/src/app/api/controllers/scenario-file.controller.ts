import {
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpException,
    HttpStatus,
    Inject,
    Param,
    Patch,
    Post,
    StreamableFile,
    UploadedFile,
    UploadedFiles,
    UseInterceptors,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

// Errors
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';

// Results
import {
    AddFilesToScenarioResult,
    ScenarioFileMetadataResult,
    DeleteScenarioFileResult,
    DownloadScenarioFileResult,
} from '@domain/results/scenario-file.results';

// DTOs
import {
    AddFilesToScenarioResponseDto,
    ScenarioFileMetadataResponseDto,
    DeleteScenarioFileResponseDto,
} from '@api/dtos/scenario-file.dtos';

// Mappers
import {
    AddFilesToScenarioMapper,
    ReplaceScenarioFileMapper,
    DeleteScenarioFileMapper,
    DownloadScenarioFileMapper,
} from '@application/mappers/scenario-file.mappers';

/**
 * Upload limits. `fileSize` is capped at 1 GB — the hard ceiling of a PostgreSQL
 * `bytea` field, so a bigger file could not be persisted anyway. This is the
 * practical "no size limit" for scenario datasets while still failing fast
 * (multer buffers each file in memory before it reaches Postgres, so an
 * unbounded size would expose the service to OOM).
 */
const MAX_FILE_SIZE = 1024 * 1024 * 1024;
const MAX_FILES = 500;

@ApiTags('Scenarios')
@Controller('scenarios/:scenarioId/files')
export class ScenarioFileController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Post()
    @UseInterceptors(FilesInterceptor('files', MAX_FILES, { limits: { fileSize: MAX_FILE_SIZE } }))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'One or more files of any type. Repeat the `files` field once per file.',
        required: true,
        schema: {
            type: 'object',
            required: ['files'],
            properties: {
                files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                },
            },
        },
    })
    @ApiEndpoint({
        summary: 'Upload 1..N files (any type) to a scenario',
        response: { status: 201, type: AddFilesToScenarioResponseDto, description: 'Files added' },
        errors: [
            { status: 400, description: 'No files or invalid file' },
            { status: 404, description: 'Scenario not found' },
        ],
    })
    async addFiles(
        @Param('scenarioId') scenarioId: string,
        @UploadedFiles() files: Express.Multer.File[],
    ): Promise<AddFilesToScenarioResponseDto> {
        this.logger.log({ msg: 'Add files request', scenarioId, count: files?.length ?? 0 });

        if (!files || files.length === 0) {
            throw new HttpException('At least one file is required', HttpStatus.BAD_REQUEST);
        }

        const command = AddFilesToScenarioMapper.toCommand(scenarioId, files);
        try {
            const result = await this.commandBus.execute<typeof command, AddFilesToScenarioResult>(command);
            return AddFilesToScenarioMapper.toResponseDto(result);
        } catch (error) {
            throw this.mapError(error, 'adding files');
        }
    }

    @Patch(':fileId')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'The replacement file (single). Field name must be `file`.',
        required: true,
        schema: {
            type: 'object',
            required: ['file'],
            properties: {
                file: { type: 'string', format: 'binary' },
            },
        },
    })
    @ApiEndpoint({
        summary: 'Replace a single file of a scenario',
        response: { status: 200, type: ScenarioFileMetadataResponseDto, description: 'File replaced' },
        errors: [
            { status: 400, description: 'No file or invalid file' },
            { status: 404, description: 'Scenario or file not found' },
        ],
    })
    async replaceFile(
        @Param('scenarioId') scenarioId: string,
        @Param('fileId') fileId: string,
        @UploadedFile() file: Express.Multer.File,
    ): Promise<ScenarioFileMetadataResponseDto> {
        this.logger.log({ msg: 'Replace file request', scenarioId, fileId, filename: file?.originalname });

        if (!file) {
            throw new HttpException('A file is required', HttpStatus.BAD_REQUEST);
        }

        const command = ReplaceScenarioFileMapper.toCommand(scenarioId, fileId, file);
        try {
            const result = await this.commandBus.execute<typeof command, ScenarioFileMetadataResult>(command);
            return ReplaceScenarioFileMapper.toResponseDto(result);
        } catch (error) {
            throw this.mapError(error, 'replacing file');
        }
    }

    @Delete(':fileId')
    @HttpCode(HttpStatus.OK)
    @ApiEndpoint({
        summary: 'Delete a single file of a scenario',
        response: { status: 200, type: DeleteScenarioFileResponseDto, description: 'File deleted' },
        errors: [{ status: 404, description: 'Scenario or file not found' }],
    })
    async deleteFile(
        @Param('scenarioId') scenarioId: string,
        @Param('fileId') fileId: string,
    ): Promise<DeleteScenarioFileResponseDto> {
        this.logger.log({ msg: 'Delete file request', scenarioId, fileId });

        const command = DeleteScenarioFileMapper.toCommand(scenarioId, fileId);
        try {
            const result = await this.commandBus.execute<typeof command, DeleteScenarioFileResult>(command);
            return DeleteScenarioFileMapper.toResponseDto(result);
        } catch (error) {
            throw this.mapError(error, 'deleting file');
        }
    }

    @Get(':fileId/download')
    @ApiOperation({ summary: 'Download a single file (raw bytes with its content type)' })
    @ApiResponse({ status: 200, description: 'File stream' })
    @ApiResponse({ status: 404, description: 'Scenario or file not found' })
    async downloadFile(
        @Param('scenarioId') scenarioId: string,
        @Param('fileId') fileId: string,
    ): Promise<StreamableFile> {
        this.logger.log({ msg: 'Download file request', scenarioId, fileId });

        const query = DownloadScenarioFileMapper.toQuery(scenarioId, fileId);
        try {
            const result = await this.cachingQueryBus.execute<DownloadScenarioFileResult>(query);
            return new StreamableFile(result.content, {
                type: result.contentType,
                disposition: `attachment; filename="${encodeURIComponent(result.filename)}"`,
                length: result.content.length,
            });
        } catch (error) {
            throw this.mapError(error, 'downloading file');
        }
    }

    private mapError(error: unknown, action: string): HttpException {
        if (error instanceof EntityError) {
            return new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        if (error instanceof ApiError) {
            return new HttpException(error.message, error.statusCode);
        }
        this.logger.error(`Error ${action}: ${error}`);
        return new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
