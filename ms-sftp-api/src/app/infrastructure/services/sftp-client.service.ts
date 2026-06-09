import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import SftpClient from 'ssh2-sftp-client';

import { ISftpClientService } from '@domain/ports/sftp-client-service.port';
import { SftpConnectionValueObject } from '@domain/value-objects/sftp-connection.value-object';
import { SftpListFilesResult, RemoteFileInfoResult } from '@domain/results/sftp-list-files.result';
import { SftpDownloadFileResult } from '@domain/results/sftp-download-file.result';
import { SftpDownloadToLocalResult } from '@domain/results/sftp-download-to-local.result';
import { SftpMoveFileResult } from '@domain/results/sftp-move-file.result';
import { SftpDeleteFileResult } from '@domain/results/sftp-delete-file.result';
import { ApiError } from '@domain/errors/api.error';
import { ProviderError } from '@domain/errors/provider.error';
import { SftpConfigService } from '@config/sftp/sftp-config.service';

@Injectable()
export class SftpClientServiceImpl extends ISftpClientService {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpConfig: SftpConfigService,
    ) {
        super();
    }

    async listFiles(connection: SftpConnectionValueObject, directoryPath: string): Promise<SftpListFilesResult> {
        this.logger.debug(`SFTP listing files in ${directoryPath} on ${connection.host}`);
        const sftp = await this.connect(connection);

        try {
            const entries = await sftp.list(directoryPath);
            const files: RemoteFileInfoResult[] = entries.map(
                (entry) =>
                    new RemoteFileInfoResult({
                        name: entry.name,
                        path: `${directoryPath}/${entry.name}`,
                        size: entry.size,
                        modifiedAt: new Date(entry.modifyTime).toISOString(),
                        isDirectory: entry.type === 'd',
                    }),
            );

            return new SftpListFilesResult({ directory: directoryPath, files });
        } catch (error: unknown) {
            this.handleSftpError(error, directoryPath);
        } finally {
            await this.disconnect(sftp);
        }
    }

    async downloadFile(connection: SftpConnectionValueObject, filePath: string): Promise<SftpDownloadFileResult> {
        this.logger.debug(`SFTP downloading file ${filePath} from ${connection.host}`);
        const sftp = await this.connect(connection);

        try {
            const stats = await sftp.stat(filePath);
            const stream = sftp.createReadStream(filePath, { autoClose: false });
            const fileName = path.basename(filePath);

            // We need to handle disconnect after stream is consumed
            stream.on('end', () => {
                this.disconnect(sftp).catch(() => {});
            });
            stream.on('error', () => {
                this.disconnect(sftp).catch(() => {});
            });

            return new SftpDownloadFileResult({
                stream: stream as unknown as import('node:stream').Readable,
                fileName,
                size: stats.size,
            });
        } catch (error: unknown) {
            await this.disconnect(sftp);
            this.handleSftpError(error, filePath);
        }
    }

    async downloadToLocal(
        connection: SftpConnectionValueObject,
        remotePath: string,
        localPath: string,
        overwrite: boolean,
    ): Promise<SftpDownloadToLocalResult> {
        this.logger.debug(`SFTP downloading ${remotePath} from ${connection.host} to local ${localPath}`);

        if (!overwrite) {
            try {
                await fs.access(localPath);
                throw new ApiError(409, `File already exists at local path: ${localPath}`);
            } catch (error: unknown) {
                if (error instanceof ApiError) throw error;
                // File doesn't exist — continue
            }
        }

        const sftp = await this.connect(connection);

        try {
            // Ensure local directory exists
            const localDir = path.dirname(localPath);
            await fs.mkdir(localDir, { recursive: true });

            // Download using streaming
            await sftp.fastGet(remotePath, localPath);

            const stats = await fs.stat(localPath);
            return new SftpDownloadToLocalResult({
                remotePath,
                localPath,
                size: stats.size,
            });
        } catch (error: unknown) {
            if (error instanceof ApiError) throw error;
            // Clean up partial file
            try {
                await fs.unlink(localPath);
            } catch {
                // Ignore cleanup errors
            }
            this.handleSftpError(error, remotePath);
        } finally {
            await this.disconnect(sftp);
        }
    }

    async moveFile(
        connection: SftpConnectionValueObject,
        sourcePath: string,
        destPath: string,
    ): Promise<SftpMoveFileResult> {
        this.logger.debug(`SFTP moving ${sourcePath} to ${destPath} on ${connection.host}`);
        const sftp = await this.connect(connection);

        try {
            await sftp.rename(sourcePath, destPath);
            return new SftpMoveFileResult({ sourcePath, destinationPath: destPath });
        } catch (error: unknown) {
            this.handleSftpError(error, sourcePath);
        } finally {
            await this.disconnect(sftp);
        }
    }

    async deleteFile(connection: SftpConnectionValueObject, filePath: string): Promise<SftpDeleteFileResult> {
        this.logger.debug(`SFTP deleting ${filePath} on ${connection.host}`);
        const sftp = await this.connect(connection);

        try {
            await sftp.delete(filePath);
            return new SftpDeleteFileResult({ deletedPath: filePath });
        } catch (error: unknown) {
            this.handleSftpError(error, filePath);
        } finally {
            await this.disconnect(sftp);
        }
    }

    private async connect(connection: SftpConnectionValueObject): Promise<SftpClient> {
        const sftp = new SftpClient();

        try {
            await sftp.connect({
                host: connection.host,
                port: connection.port,
                username: connection.username,
                password: connection.password,
                privateKey: connection.privateKey,
                readyTimeout: this.sftpConfig.connectionTimeout,
                retries: 0,
            });
            return sftp;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('Authentication') || message.includes('auth') || message.includes('password')) {
                throw new ApiError(401, 'SFTP authentication failed: invalid credentials');
            }
            if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT') || message.includes('timeout')) {
                throw new ProviderError(`SFTP connection failed: ${message}`);
            }
            throw new ProviderError(`SFTP connection error: ${message}`);
        }
    }

    private async disconnect(sftp: SftpClient): Promise<void> {
        try {
            await sftp.end();
        } catch {
            // Ignore disconnect errors
        }
    }

    private handleSftpError(error: unknown, remotePath: string): never {
        if (error instanceof ApiError) throw error;
        if (error instanceof ProviderError) throw error;

        const message = error instanceof Error ? error.message : String(error);

        if (message.includes('No such file') || message.includes('not found') || message.includes('ENOENT')) {
            throw new ApiError(404, `Remote file or directory not found: ${remotePath}`);
        }
        if (message.includes('Permission denied') || message.includes('EACCES')) {
            throw new ApiError(403, `Permission denied on remote server: ${remotePath}`);
        }

        this.logger.error({ msg: 'SFTP error', entity: 'SFTP', error: message });
        throw new ProviderError(`SFTP operation failed: ${message}`);
    }
}
