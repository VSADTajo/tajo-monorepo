import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';

// Domain
import { ISftpClientService } from '../../../src/app/domain/ports/sftp-client-service.port';
import { SftpDownloadToLocalResult } from '../../../src/app/domain/results/sftp-download-to-local.result';

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
import { buildSftpDownloadToLocalDto } from '../../factories/sftp.factory';

describe('SFTP Download To Local (e2e)', () => {
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

    function downloadToLocal(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/sftp/download-to-local').send(dto);
    }

    // ─── Success ────────────────────────────────────────────────

    describe('POST /sftp/download-to-local - success', () => {
        it('should download remote file to local storage', async () => {
            mockSftpService.downloadToLocal.mockResolvedValue(
                new SftpDownloadToLocalResult({
                    remotePath: '/remote/inbox/report.csv',
                    localPath: '/tmp/test-storage/inbox/report.csv',
                    size: 2048,
                }),
            );

            const dto = buildSftpDownloadToLocalDto();

            const { body } = await downloadToLocal(dto).expect(HttpStatus.CREATED);

            expect(body).toMatchObject({
                remotePath: '/remote/inbox/report.csv',
                localPath: 'inbox/report.csv',
                size: 2048,
            });

            expect(mockSftpService.downloadToLocal).toHaveBeenCalledTimes(1);
        });
    });

    // ─── Validation errors ──────────────────────────────────────

    describe('POST /sftp/download-to-local - validation', () => {
        it('should return 400 when remotePath is missing', async () => {
            const dto = buildSftpDownloadToLocalDto();
            delete (dto as Record<string, unknown>).remotePath;

            await downloadToLocal(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 400 when localPath is missing', async () => {
            const dto = buildSftpDownloadToLocalDto();
            delete (dto as Record<string, unknown>).localPath;

            await downloadToLocal(dto).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
