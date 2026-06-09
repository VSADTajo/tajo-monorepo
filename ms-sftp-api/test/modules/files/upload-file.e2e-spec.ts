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

describe('Upload File (e2e)', () => {
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

    function uploadFile(filePath: string, content: string, overwrite?: boolean) {
        const req = request(app.getHttpServer())
            .post('/files/upload')
            .attach('file', Buffer.from(content), 'test.csv')
            .field('path', filePath);

        if (overwrite !== undefined) {
            req.field('overwrite', String(overwrite));
        }

        return req;
    }

    // ─── Tests ─────────────────────────────────────────────────────

    it('should upload a file successfully', async () => {
        const { body } = await uploadFile('inbox/report.csv', 'col1,col2\nval1,val2').expect(HttpStatus.CREATED);

        expect(body).toMatchObject({
            path: 'inbox/report.csv',
        });

        // Verify file exists on disk
        const filePath = path.join(tempDir, 'inbox', 'report.csv');
        expect(fs.existsSync(filePath)).toBe(true);

        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toBe('col1,col2\nval1,val2');
    });

    it('should return 400 when file is missing', async () => {
        await request(app.getHttpServer())
            .post('/files/upload')
            .field('path', 'inbox/test.csv')
            .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when path is missing', async () => {
        await request(app.getHttpServer())
            .post('/files/upload')
            .attach('file', Buffer.from('test content'), 'test.csv')
            .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 for path traversal attempt', async () => {
        await uploadFile('../../../etc/passwd', 'malicious content').expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 409 when file already exists without overwrite', async () => {
        createTestFile(tempDir, 'inbox/existing.csv', 'original content');

        await uploadFile('inbox/existing.csv', 'new content').expect(HttpStatus.CONFLICT);

        // Verify original content is preserved
        const content = fs.readFileSync(path.join(tempDir, 'inbox', 'existing.csv'), 'utf-8');
        expect(content).toBe('original content');
    });

    it('should overwrite existing file when overwrite is true', async () => {
        createTestFile(tempDir, 'inbox/overwrite-me.csv', 'old content');

        const { body } = await uploadFile('inbox/overwrite-me.csv', 'new content', true).expect(HttpStatus.CREATED);

        expect(body).toMatchObject({
            path: 'inbox/overwrite-me.csv',
        });

        // Verify content was overwritten
        const content = fs.readFileSync(path.join(tempDir, 'inbox', 'overwrite-me.csv'), 'utf-8');
        expect(content).toBe('new content');
    });
});
