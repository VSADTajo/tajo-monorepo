import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';

// Domain
import { ISftpClientService } from '../../../src/app/domain/ports/sftp-client-service.port';
import { SftpDeleteFileResult } from '../../../src/app/domain/results/sftp-delete-file.result';

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
import { buildSftpDeleteFileDto } from '../../factories/sftp.factory';

describe('SFTP Delete File (e2e)', () => {
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

    function deleteFile(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/sftp/delete').send(dto);
    }

    // ─── Success ────────────────────────────────────────────────

    describe('POST /sftp/delete - success', () => {
        it('should delete remote file successfully', async () => {
            mockSftpService.deleteFile.mockResolvedValue(
                new SftpDeleteFileResult({
                    deletedPath: '/remote/processed/old-report.csv',
                }),
            );

            const dto = buildSftpDeleteFileDto();

            const { body } = await deleteFile(dto).expect(HttpStatus.OK);

            expect(body).toMatchObject({
                deletedPath: '/remote/processed/old-report.csv',
            });

            expect(mockSftpService.deleteFile).toHaveBeenCalledTimes(1);
        });
    });

    // ─── Validation errors ──────────────────────────────────────

    describe('POST /sftp/delete - validation', () => {
        it('should return 400 when path is missing', async () => {
            const dto = buildSftpDeleteFileDto();
            delete (dto as Record<string, unknown>).path;

            await deleteFile(dto).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
