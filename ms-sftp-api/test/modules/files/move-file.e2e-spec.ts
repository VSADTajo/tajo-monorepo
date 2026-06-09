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
import { buildMoveFileDto } from '../../factories/file.factory';

describe('Move File (e2e)', () => {
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

    function moveFile(dto: { sourcePath: string; destinationPath: string; overwrite?: boolean }) {
        return request(app.getHttpServer()).post('/files/move').send(dto);
    }

    // ─── Tests ─────────────────────────────────────────────────────

    it('should move a file successfully', async () => {
        createTestFile(tempDir, 'inbox/to-move.csv', 'move me');

        const dto = buildMoveFileDto({
            sourcePath: 'inbox/to-move.csv',
            destinationPath: 'processed/to-move.csv',
        });

        const { body } = await moveFile(dto).expect(HttpStatus.OK);

        expect(body).toMatchObject({
            sourcePath: 'inbox/to-move.csv',
            destinationPath: 'processed/to-move.csv',
        });

        // Verify source no longer exists
        expect(fs.existsSync(path.join(tempDir, 'inbox', 'to-move.csv'))).toBe(false);

        // Verify destination exists with correct content
        const content = fs.readFileSync(path.join(tempDir, 'processed', 'to-move.csv'), 'utf-8');
        expect(content).toBe('move me');
    });

    it('should return 404 when source file does not exist', async () => {
        const dto = buildMoveFileDto({
            sourcePath: 'inbox/nonexistent.csv',
            destinationPath: 'processed/nonexistent.csv',
        });

        await moveFile(dto).expect(HttpStatus.NOT_FOUND);
    });

    it('should return 400 for path traversal in sourcePath', async () => {
        const dto = buildMoveFileDto({
            sourcePath: '../../../etc/passwd',
            destinationPath: 'processed/stolen.txt',
        });

        await moveFile(dto).expect(HttpStatus.BAD_REQUEST);
    });
});
