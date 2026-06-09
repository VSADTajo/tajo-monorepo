import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';

// Domain
import { ISftpClientService } from '../../../src/app/domain/ports/sftp-client-service.port';
import { SftpMoveFileResult } from '../../../src/app/domain/results/sftp-move-file.result';

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
import { buildSftpMoveFileDto } from '../../factories/sftp.factory';

describe('SFTP Move File (e2e)', () => {
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

    function moveFile(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/sftp/move').send(dto);
    }

    // ─── Success ────────────────────────────────────────────────

    describe('POST /sftp/move - success', () => {
        it('should move remote file successfully', async () => {
            mockSftpService.moveFile.mockResolvedValue(
                new SftpMoveFileResult({
                    sourcePath: '/remote/inbox/report.csv',
                    destinationPath: '/remote/processed/report.csv',
                }),
            );

            const dto = buildSftpMoveFileDto();

            const { body } = await moveFile(dto).expect(HttpStatus.OK);

            expect(body).toMatchObject({
                sourcePath: '/remote/inbox/report.csv',
                destinationPath: '/remote/processed/report.csv',
            });

            expect(mockSftpService.moveFile).toHaveBeenCalledTimes(1);
        });
    });

    // ─── Validation errors ──────────────────────────────────────

    describe('POST /sftp/move - validation', () => {
        it('should return 400 when sourcePath is missing', async () => {
            const dto = buildSftpMoveFileDto();
            delete (dto as Record<string, unknown>).sourcePath;

            await moveFile(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 400 when destinationPath is missing', async () => {
            const dto = buildSftpMoveFileDto();
            delete (dto as Record<string, unknown>).destinationPath;

            await moveFile(dto).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
