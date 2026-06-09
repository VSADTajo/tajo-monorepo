import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';

// Domain
import { ISftpClientService } from '../../../src/app/domain/ports/sftp-client-service.port';
import { SftpListFilesResult, RemoteFileInfoResult } from '../../../src/app/domain/results/sftp-list-files.result';

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
import { buildSftpListFilesDto } from '../../factories/sftp.factory';

describe('SFTP List Files (e2e)', () => {
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

    function listFiles(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/sftp/list').send(dto);
    }

    // ─── Success ────────────────────────────────────────────────

    describe('POST /sftp/list - success', () => {
        it('should list remote files successfully', async () => {
            mockSftpService.listFiles.mockResolvedValue(
                new SftpListFilesResult({
                    directory: '/remote/inbox',
                    files: [
                        new RemoteFileInfoResult({
                            name: 'report.csv',
                            path: '/remote/inbox/report.csv',
                            size: 1024,
                            modifiedAt: '2026-03-04T10:00:00Z',
                            isDirectory: false,
                        }),
                    ],
                }),
            );

            const dto = buildSftpListFilesDto();

            const { body } = await listFiles(dto).expect(HttpStatus.OK);

            expect(body).toMatchObject({
                directory: '/remote/inbox',
                files: [
                    {
                        name: 'report.csv',
                        path: '/remote/inbox/report.csv',
                        size: 1024,
                        modifiedAt: '2026-03-04T10:00:00Z',
                        isDirectory: false,
                    },
                ],
            });

            expect(mockSftpService.listFiles).toHaveBeenCalledTimes(1);
        });
    });

    // ─── Validation errors ──────────────────────────────────────

    describe('POST /sftp/list - validation', () => {
        it('should return 400 when connection info is missing', async () => {
            const dto = { directory: '/remote/inbox' };

            await listFiles(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 400 when directory is missing', async () => {
            const dto = buildSftpListFilesDto();
            delete (dto as Record<string, unknown>).directory;

            await listFiles(dto).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
