import { Body, Controller, HttpCode, HttpException, HttpStatus, Inject, Post, Res } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import type { Response } from 'express';
import { StreamableFile } from '@nestjs/common';

// DTOs
import {
    SftpListFilesRequestDto,
    SftpListFilesResponseDto,
    SftpDownloadFileRequestDto,
    SftpDownloadToLocalRequestDto,
    SftpDownloadToLocalResponseDto,
    SftpMoveFileRequestDto,
    SftpMoveFileResponseDto,
    SftpDeleteFileRequestDto,
    SftpDeleteFileResponseDto,
} from '@api/dtos/sftp.dtos';

// Mappers
import {
    SftpListFilesMapper,
    SftpDownloadFileMapper,
    SftpDownloadToLocalMapper,
    SftpMoveFileMapper,
    SftpDeleteFileMapper,
} from '@application/mappers/sftp.mappers';

// Domain
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ProviderError } from '@domain/errors/provider.error';
import { SftpDownloadFileResult } from '@domain/results/sftp-download-file.result';
import { IFileTransformer } from '@domain/ports/file-transformer.port';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';
import { StorageConfigService } from '@config/storage/storage-config.service';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// Mapping Schema integration
import { GetActiveMappingSchemaByPathQuery } from '@application/queries/mapping-schema.queries';
import { MappingSchema } from '@domain/entities/mapping-schema.entity';
import { Readable } from 'node:stream';
import * as path from 'node:path';

@ApiTags('SFTP')
@Controller('sftp')
export class SftpController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
        private readonly cachingQueryBus: CachingQueryBus,
        private readonly storageConfig: StorageConfigService,
        private readonly fileTransformer: IFileTransformer,
    ) {}

    // ─────────────────────────────────────────────────────────────
    // List Files
    // ─────────────────────────────────────────────────────────────

    @Post('list')
    @HttpCode(HttpStatus.OK)
    @ApiEndpoint({
        summary: 'List files on external SFTP server',
        body: SftpListFilesRequestDto,
        response: { status: 200, type: SftpListFilesResponseDto, description: 'Remote directory listing' },
        errors: [
            { status: 401, description: 'Invalid SFTP credentials' },
            { status: 404, description: 'Remote directory not found' },
            { status: 500, description: 'SFTP connection error' },
        ],
    })
    async listFiles(@Body() dto: SftpListFilesRequestDto): Promise<SftpListFilesResponseDto> {
        this.logger.log(`SFTP list request: ${dto.connection.host}:${dto.directory}`);

        try {
            const query = SftpListFilesMapper.toQuery(dto);
            const result = await this.queryBus.execute(query);
            return SftpListFilesMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Download File
    // ─────────────────────────────────────────────────────────────

    @Post('download')
    @HttpCode(HttpStatus.OK)
    @ApiEndpoint({
        summary: 'Download file from external SFTP server',
        body: SftpDownloadFileRequestDto,
        response: { status: 200, description: 'File binary stream' },
        errors: [
            { status: 401, description: 'Invalid SFTP credentials' },
            { status: 404, description: 'Remote file not found' },
            { status: 500, description: 'SFTP connection error' },
        ],
    })
    async downloadFile(
        @Body() dto: SftpDownloadFileRequestDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        this.logger.log(`SFTP download request: ${dto.connection.host}:${dto.path}`);

        try {
            const query = SftpDownloadFileMapper.toQuery(dto);
            const result: SftpDownloadFileResult = await this.queryBus.execute(query);

            // Check for active mapping schema for this path (cached)
            const schema: MappingSchema | null = await this.cachingQueryBus.execute(
                new GetActiveMappingSchemaByPathQuery({ filePath: dto.path }),
            );

            if (schema) {
                this.logger.log(
                    `Active mapping schema found: "${schema.name}" — transforming ${schema.inputFormat} -> ${schema.outputFormat}`,
                );

                // Buffer the stream for transformation
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

    private async streamToBuffer(stream: Readable): Promise<Buffer> {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }

    // ─────────────────────────────────────────────────────────────
    // Download to Local
    // ─────────────────────────────────────────────────────────────

    @Post('download-to-local')
    @ApiEndpoint({
        summary: 'Download from external SFTP and save to local storage',
        body: SftpDownloadToLocalRequestDto,
        response: {
            status: 201,
            type: SftpDownloadToLocalResponseDto,
            description: 'File transferred to local storage',
        },
        errors: [
            { status: 401, description: 'Invalid SFTP credentials' },
            { status: 404, description: 'Remote file not found' },
            { status: 409, description: 'Local file already exists' },
            { status: 500, description: 'SFTP connection error' },
        ],
    })
    async downloadToLocal(@Body() dto: SftpDownloadToLocalRequestDto): Promise<SftpDownloadToLocalResponseDto> {
        this.logger.log(`SFTP download-to-local request: ${dto.connection.host}:${dto.remotePath} -> ${dto.localPath}`);

        try {
            const command = SftpDownloadToLocalMapper.toCommand(dto);
            const result = await this.commandBus.execute(command);
            return SftpDownloadToLocalMapper.toResponseDto(result, this.storageConfig);
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
        summary: 'Move file on external SFTP server',
        body: SftpMoveFileRequestDto,
        response: { status: 200, type: SftpMoveFileResponseDto, description: 'File moved on remote server' },
        errors: [
            { status: 401, description: 'Invalid SFTP credentials' },
            { status: 404, description: 'Remote file not found' },
            { status: 500, description: 'SFTP connection error' },
        ],
    })
    async moveFile(@Body() dto: SftpMoveFileRequestDto): Promise<SftpMoveFileResponseDto> {
        this.logger.log(`SFTP move request: ${dto.sourcePath} -> ${dto.destinationPath}`);

        try {
            const command = SftpMoveFileMapper.toCommand(dto);
            const result = await this.commandBus.execute(command);
            return SftpMoveFileMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Delete File
    // ─────────────────────────────────────────────────────────────

    @Post('delete')
    @HttpCode(HttpStatus.OK)
    @ApiEndpoint({
        summary: 'Delete file on external SFTP server',
        body: SftpDeleteFileRequestDto,
        response: { status: 200, type: SftpDeleteFileResponseDto, description: 'File deleted from remote server' },
        errors: [
            { status: 401, description: 'Invalid SFTP credentials' },
            { status: 404, description: 'Remote file not found' },
            { status: 500, description: 'SFTP connection error' },
        ],
    })
    async deleteFile(@Body() dto: SftpDeleteFileRequestDto): Promise<SftpDeleteFileResponseDto> {
        this.logger.log(`SFTP delete request: ${dto.path}`);

        try {
            const command = SftpDeleteFileMapper.toCommand(dto);
            const result = await this.commandBus.execute(command);
            return SftpDeleteFileMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
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
        if (error instanceof ProviderError) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        this.logger.error({ msg: 'SFTP operation error', entity: 'SFTP', error: String(error) });
        throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
