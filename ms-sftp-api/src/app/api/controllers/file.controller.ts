import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpException,
    HttpStatus,
    Inject,
    Post,
    Query,
    Res,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import type { Response } from 'express';
import { StreamableFile } from '@nestjs/common';
import { diskStorage } from 'multer';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { Readable } from 'node:stream';

// DTOs
import {
    UploadFileResponseDto,
    ListFilesResponseDto,
    ListPathsOverviewResponseDto,
    MoveFileRequestDto,
    MoveFileResponseDto,
    DeleteFileResponseDto,
    ReadFileTextResponseDto,
} from '@api/dtos/file.dtos';

// Mappers
import {
    UploadFileMapper,
    ListFilesMapper,
    ListPathsOverviewMapper,
    DownloadFileMapper,
    ReadFileTextMapper,
    MoveFileMapper,
    DeleteFileMapper,
} from '@application/mappers/file.mappers';
import { IListPathsOverviewResult, IReadFileTextResult } from '@application/queries/file.queries';

// Domain
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { DownloadFileResult } from '@domain/results/download-file.result';
import { ListFilesResult } from '@domain/results/list-files.result';
import { IFileTransformer } from '@domain/ports/file-transformer.port';
import { MappingSchema } from '@domain/entities/mapping-schema.entity';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// Mapping Schema integration
import { GetActiveMappingSchemaByPathQuery } from '@application/queries/mapping-schema.queries';
import { StorageConfigService } from '@config/storage/storage-config.service';
import { FilePathValueObject } from '@domain/value-objects/file-path.value-object';
import * as path from 'node:path';

@ApiTags('Files')
@Controller('files')
export class FileController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
        private readonly fileTransformer: IFileTransformer,
        private readonly storageConfig: StorageConfigService,
    ) {}

    // ─────────────────────────────────────────────────────────────
    // Upload File
    // ─────────────────────────────────────────────────────────────

    @Post('upload')
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: os.tmpdir(),
                filename: (_req, file, cb) => {
                    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
                    cb(null, `upload-${uniqueSuffix}-${file.originalname}`);
                },
            }),
            limits: {
                fileSize: Number(process.env.STORAGE_MAX_FILE_SIZE) || 524288000,
            },
        }),
    )
    @ApiEndpoint({
        summary: 'Upload a file to storage',
        response: { status: 201, type: UploadFileResponseDto, description: 'File uploaded successfully' },
        errors: [
            { status: 400, description: 'Invalid path or path traversal detected' },
            { status: 409, description: 'File already exists at destination' },
            { status: 500, description: 'Internal server error' },
        ],
    })
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Body('path') filePath: string,
        @Body('overwrite') overwrite?: string | boolean,
    ): Promise<UploadFileResponseDto> {
        this.logger.log(`Upload file request: path=${filePath}`);

        if (!file) {
            throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
        }
        if (!filePath) {
            throw new HttpException('Path is required', HttpStatus.BAD_REQUEST);
        }

        try {
            const fileBuffer = fs.readFileSync(file.path);
            const fileStream = Readable.from(fileBuffer);
            const shouldOverwrite = overwrite === 'true' || overwrite === true;
            const command = UploadFileMapper.toCommand(filePath, fileStream, shouldOverwrite);
            const result = await this.commandBus.execute(command);
            return UploadFileMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        } finally {
            try {
                fs.unlinkSync(file.path);
            } catch {
                // Ignore cleanup errors
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // List Files
    // ─────────────────────────────────────────────────────────────

    @Get()
    @ApiEndpoint({
        summary: 'List files in a directory',
        response: { status: 200, type: ListFilesResponseDto, description: 'Directory listing' },
        errors: [
            { status: 400, description: 'Invalid path' },
            { status: 404, description: 'Directory not found' },
        ],
    })
    async listFiles(@Query('directory') directory: string): Promise<ListFilesResponseDto> {
        this.logger.log(`List files request: directory=${directory}`);

        if (!directory) {
            throw new HttpException('Directory query parameter is required', HttpStatus.BAD_REQUEST);
        }

        try {
            const query = ListFilesMapper.toQuery(directory);
            const result = await this.cachingQueryBus.execute<ListFilesResult>(query);
            return ListFilesMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // List Paths Overview
    // ─────────────────────────────────────────────────────────────

    @Get('paths-overview')
    @ApiEndpoint({
        summary: 'List all configured paths with schema assignments',
        response: { status: 200, type: ListPathsOverviewResponseDto, description: 'Paths with optional schema info' },
        errors: [{ status: 500, description: 'Internal server error' }],
    })
    async listPathsOverview(): Promise<ListPathsOverviewResponseDto> {
        this.logger.log('List paths overview request');
        try {
            const query = ListPathsOverviewMapper.toQuery();
            const result = await this.cachingQueryBus.execute<IListPathsOverviewResult>(query);
            return ListPathsOverviewMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Read File Text (small text files like info.json)
    // ─────────────────────────────────────────────────────────────

    @Get('read')
    @ApiEndpoint({
        summary: 'Read a small text file as JSON-wrapped string',
        response: { status: 200, type: ReadFileTextResponseDto, description: 'File text content' },
        errors: [
            { status: 400, description: 'Invalid path or path is a directory' },
            { status: 404, description: 'File not found' },
            { status: 413, description: 'File too large for text read (max 1 MB)' },
        ],
    })
    async readFileText(@Query('path') filePath: string): Promise<ReadFileTextResponseDto> {
        this.logger.log(`Read file text request: path=${filePath}`);

        if (!filePath) {
            throw new HttpException('Path query parameter is required', HttpStatus.BAD_REQUEST);
        }

        try {
            const query = ReadFileTextMapper.toQuery(filePath);
            const result: IReadFileTextResult = await this.cachingQueryBus.execute(query);
            return ReadFileTextMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Read file text error: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Download File
    // ─────────────────────────────────────────────────────────────

    @Get('download')
    @ApiEndpoint({
        summary: 'Download a file',
        response: { status: 200, description: 'File binary stream' },
        errors: [
            { status: 400, description: 'Invalid path' },
            { status: 404, description: 'File not found' },
        ],
    })
    async downloadFile(
        @Query('path') filePath: string,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        this.logger.log(`Download file request: path=${filePath}`);

        if (!filePath) {
            throw new HttpException('Path query parameter is required', HttpStatus.BAD_REQUEST);
        }

        try {
            const query = DownloadFileMapper.toQuery(filePath);
            const result: DownloadFileResult = await this.cachingQueryBus.execute(query);

            // Resolve to absolute path for schema lookup (e.g., forecast/file.xml -> /data/files/forecast/file.xml)
            const resolvedPath = new FilePathValueObject(filePath, this.storageConfig.basePath);
            const schema: MappingSchema | null = await this.cachingQueryBus.execute(
                new GetActiveMappingSchemaByPathQuery({ filePath: resolvedPath.absolutePath }),
            );

            if (schema) {
                this.logger.log(
                    `Active mapping schema found: "${schema.name}" — transforming ${schema.inputFormat} -> ${schema.outputFormat}`,
                );

                const rawBuffer = await this.streamToBuffer(result.stream);
                const transformed = await this.fileTransformer.transform(rawBuffer, schema);

                const baseName = path.basename(result.fileName, path.extname(result.fileName));
                const transformedFileName = `${baseName}${transformed.fileExtension}`;

                res.set({
                    'Content-Type': transformed.contentType,
                    'Content-Disposition': `attachment; filename="${transformedFileName}"`,
                    'Content-Length': transformed.buffer.length.toString(),
                });

                return new StreamableFile(transformed.buffer);
            }

            // No active schema — return raw file as-is
            res.set({
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${result.fileName}"`,
                'Content-Length': result.size.toString(),
            });

            return new StreamableFile(result.stream);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Move File
    // ─────────────────────────────────────────────────────────────

    @Post('move')
    @HttpCode(HttpStatus.OK)
    @ApiEndpoint({
        summary: 'Move a file to another path',
        body: MoveFileRequestDto,
        response: { status: 200, type: MoveFileResponseDto, description: 'File moved successfully' },
        errors: [
            { status: 400, description: 'Invalid path' },
            { status: 404, description: 'Source file not found' },
            { status: 409, description: 'File already exists at destination' },
        ],
    })
    async moveFile(@Body() dto: MoveFileRequestDto): Promise<MoveFileResponseDto> {
        this.logger.log(`Move file request: ${dto.sourcePath} -> ${dto.destinationPath}`);

        try {
            const command = MoveFileMapper.toCommand(dto);
            const result = await this.commandBus.execute(command);
            return MoveFileMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Delete File
    // ─────────────────────────────────────────────────────────────

    @Delete()
    @ApiEndpoint({
        summary: 'Delete a file',
        response: { status: 200, type: DeleteFileResponseDto, description: 'File deleted successfully' },
        errors: [
            { status: 400, description: 'Invalid path' },
            { status: 404, description: 'File not found' },
        ],
    })
    async deleteFile(@Query('path') filePath: string): Promise<DeleteFileResponseDto> {
        this.logger.log(`Delete file request: path=${filePath}`);

        if (!filePath) {
            throw new HttpException('Path query parameter is required', HttpStatus.BAD_REQUEST);
        }

        try {
            const command = DeleteFileMapper.toCommand(filePath);
            const result = await this.commandBus.execute(command);
            return DeleteFileMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    private async streamToBuffer(stream: Readable): Promise<Buffer> {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }

    // ─────────────────────────────────────────────────────────────
    // Error Handler
    // ─────────────────────────────────────────────────────────────

    private handleError(error: unknown): never {
        if (error instanceof EntityError) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        if (error instanceof ApiError) {
            throw new HttpException(error.message, error.statusCode);
        }
        this.logger.error(`File operation error: ${error}`);
        throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
