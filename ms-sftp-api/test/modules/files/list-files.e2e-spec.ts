import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';

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

describe('List Files (e2e)', () => {
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

    function listFiles(directory: string) {
        return request(app.getHttpServer()).get('/files').query({ directory });
    }

    // ─── Tests ─────────────────────────────────────────────────────

    it('should list files in a directory', async () => {
        createTestFile(tempDir, 'inbox/file-a.csv', 'content a');
        createTestFile(tempDir, 'inbox/file-b.csv', 'content b');
        createTestFile(tempDir, 'inbox/file-c.txt', 'content c');

        const { body } = await listFiles('inbox').expect(HttpStatus.OK);

        expect(body.files).toBeDefined();
        expect(body.files.length).toBe(3);

        const fileNames = body.files.map((f: { name: string }) => f.name);
        expect(fileNames).toContain('file-a.csv');
        expect(fileNames).toContain('file-b.csv');
        expect(fileNames).toContain('file-c.txt');
    });

    it('should return 400 when directory param is missing', async () => {
        await request(app.getHttpServer()).get('/files').expect(HttpStatus.BAD_REQUEST);
    });

    it('should return empty array when directory does not exist', async () => {
        const { body } = await listFiles('nonexistent-directory').expect(HttpStatus.OK);
        expect(body.files).toBeDefined();
        expect(body.files.length).toBe(0);
    });
});
