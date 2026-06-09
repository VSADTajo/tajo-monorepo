import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { Readable } from 'node:stream';

// Domain
import { ISftpClientService } from '../../../src/app/domain/ports/sftp-client-service.port';
import { SftpDownloadFileResult } from '../../../src/app/domain/results/sftp-download-file.result';

// Application
import { SftpListFilesHandler, SftpDownloadFileHandler } from '../../../src/app/application/queries/sftp.queries';
import {
    SftpDownloadToLocalHandler,
    SftpMoveFileHandler,
    SftpDeleteFileHandler,
} from '../../../src/app/application/commands/sftp.commands';

// API
import { SftpController } from '../../../src/app/api/controllers/sftp.controller';

// Config
import { StorageConfigService } from '../../../src/configuration/storage/storage-config.service';

// Test helpers
import { createFileTestApp, FileTestContext } from '../../helpers/file-test-app.helper';
import { buildSftpDownloadFileDto } from '../../factories/sftp.factory';

describe('SFTP Download File (e2e)', () => {
    let app: INestApplication;

    const mockSftpService = {
        listFiles: jest.fn(),
        downloadFile: jest.fn(),
        downloadToLocal: jest.fn(),
        moveFile: jest.fn(),
        deleteFile: jest.fn(),
    };

    const mockStorageConfig = { basePath: '/tmp/test-storage', maxFileSize: 524288000 };

    beforeAll(async () => {
        const ctx: FileTestContext = await createFileTestApp({
            controllers: [SftpController],
            providers: [
                SftpDownloadToLocalHandler,
                SftpMoveFileHandler,
                SftpDeleteFileHandler,
                SftpListFilesHandler,
                SftpDownloadFileHandler,
                { provide: ISftpClientService, useValue: mockSftpService },
                { provide: StorageConfigService, useValue: mockStorageConfig },
            ],
        });
        app = ctx.app;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
    });

    // ─── Helpers ────────────────────────────────────────────────

    function downloadFile(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/sftp/download').send(dto);
    }

    // ─── Success ────────────────────────────────────────────────

    describe('POST /sftp/download - success', () => {
        it('should download remote file as binary stream', async () => {
            const content = 'file content here';

            mockSftpService.downloadFile.mockResolvedValue(
                new SftpDownloadFileResult({
                    stream: Readable.from(Buffer.from(content)),
                    fileName: 'report.csv',
                    size: Buffer.byteLength(content),
                }),
            );

            const dto = buildSftpDownloadFileDto();

            const response = await downloadFile(dto)
                .buffer(true)
                .parse((res, callback) => {
                    const chunks: Buffer[] = [];
                    res.on('data', (chunk: Buffer) => chunks.push(chunk));
                    res.on('end', () => callback(null, Buffer.concat(chunks)));
                })
                .expect(HttpStatus.OK);

            expect(response.body.toString()).toBe(content);
            expect(response.headers['content-type']).toContain('application/octet-stream');
            expect(response.headers['content-disposition']).toContain('report.csv');

            expect(mockSftpService.downloadFile).toHaveBeenCalledTimes(1);
        });
    });

    // ─── Validation errors ──────────────────────────────────────

    describe('POST /sftp/download - validation', () => {
        it('should return 400 when path is missing', async () => {
            const dto = buildSftpDownloadFileDto();
            delete (dto as Record<string, unknown>).path;

            await downloadFile(dto).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
