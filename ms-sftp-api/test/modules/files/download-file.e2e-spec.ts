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

describe('Download File (e2e)', () => {
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

    function downloadFile(filePath: string) {
        return request(app.getHttpServer()).get('/files/download').query({ path: filePath });
    }

    // ─── Tests ─────────────────────────────────────────────────────

    it('should download a file successfully', async () => {
        const fileContent = 'id,name,email\n1,Alice,alice@test.com\n2,Bob,bob@test.com';
        createTestFile(tempDir, 'reports/data.csv', fileContent);

        const response = await downloadFile('reports/data.csv')
            .buffer(true)
            .parse((res, callback) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => callback(null, Buffer.concat(chunks)));
            })
            .expect(HttpStatus.OK);

        expect(response.body.toString()).toBe(fileContent);
        expect(response.headers['content-disposition']).toContain('data.csv');
        expect(response.headers['content-type']).toContain('application/octet-stream');
    });

    it('should return 400 when path param is missing', async () => {
        await request(app.getHttpServer()).get('/files/download').expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 404 when file does not exist', async () => {
        await downloadFile('reports/nonexistent.csv').expect(HttpStatus.NOT_FOUND);
    });
});
