import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Application
import {
    UploadFileHandler,
    MoveFileHandler,
    DeleteFileHandler,
} from '../../../src/app/application/commands/file.commands';
import { ListFilesHandler, DownloadFileHandler } from '../../../src/app/application/queries/file.queries';
import { FileController } from '../../../src/app/api/controllers/file.controller';

// Domain
import { IFileStorageService } from '../../../src/app/domain/ports/file-storage-service.port';

// Infrastructure
import { LocalFileStorageService } from '../../../src/app/infrastructure/services/local-file-storage.service';

// Config
import { StorageConfigService } from '../../../src/configuration/storage/storage-config.service';

// Test helpers
import { createFileTestApp } from '../../helpers/file-test-app.helper';
import { createTempStorageDir, cleanupTempStorageDir, createTestFile } from '../../factories/file.factory';

describe('Delete File (e2e)', () => {
    let app: INestApplication;
    let tempDir: string;

    beforeAll(async () => {
        tempDir = createTempStorageDir();
        const mockStorageConfig = { basePath: tempDir, maxFileSize: 524288000 };

        const ctx = await createFileTestApp({
            controllers: [FileController],
            providers: [
                UploadFileHandler,
                MoveFileHandler,
                DeleteFileHandler,
                ListFilesHandler,
                DownloadFileHandler,
                { provide: IFileStorageService, useClass: LocalFileStorageService },
                { provide: StorageConfigService, useValue: mockStorageConfig },
            ],
        });
        app = ctx.app;
    });

    afterAll(async () => {
        await app.close();
        cleanupTempStorageDir(tempDir);
    });

    // ─── Helpers ───────────────────────────────────────────────────

    function deleteFile(filePath: string) {
        return request(app.getHttpServer()).delete('/files').query({ path: filePath });
    }

    // ─── Tests ─────────────────────────────────────────────────────

    it('should delete a file successfully', async () => {
        createTestFile(tempDir, 'inbox/to-delete.csv', 'delete me');

        // Verify file exists before deletion
        expect(fs.existsSync(path.join(tempDir, 'inbox', 'to-delete.csv'))).toBe(true);

        const { body } = await deleteFile('inbox/to-delete.csv').expect(HttpStatus.OK);

        expect(body).toMatchObject({
            deletedPath: 'inbox/to-delete.csv',
        });

        // Verify file no longer exists
        expect(fs.existsSync(path.join(tempDir, 'inbox', 'to-delete.csv'))).toBe(false);
    });

    it('should return 400 when path param is missing', async () => {
        await request(app.getHttpServer()).delete('/files').expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 404 when file does not exist', async () => {
        await deleteFile('inbox/nonexistent.csv').expect(HttpStatus.NOT_FOUND);
    });
});
