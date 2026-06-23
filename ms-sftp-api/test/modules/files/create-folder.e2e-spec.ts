import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Application
import {
    UploadFileHandler,
    MoveFileHandler,
    DeleteFileHandler,
    CreateFolderHandler,
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
import { createTempStorageDir, cleanupTempStorageDir } from '../../factories/file.factory';

describe('Create Folder (e2e)', () => {
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
                CreateFolderHandler,
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

    function createFolder(folderPath: unknown) {
        return request(app.getHttpServer()).post('/files/folder').send({ path: folderPath });
    }

    // ─── Tests ─────────────────────────────────────────────────────

    it('should create a folder recursively', async () => {
        const target = 'tajo/SIMULATIONS/sim-123/output';
        expect(fs.existsSync(path.join(tempDir, target))).toBe(false);

        const { body } = await createFolder(target).expect(HttpStatus.CREATED);

        expect(body).toMatchObject({ path: target });
        expect(fs.existsSync(path.join(tempDir, target))).toBe(true);
        expect(fs.statSync(path.join(tempDir, target)).isDirectory()).toBe(true);
    });

    it('should be idempotent (no error if the folder already exists)', async () => {
        const target = 'tajo/SIMULATIONS/sim-456/output';

        await createFolder(target).expect(HttpStatus.CREATED);
        await createFolder(target).expect(HttpStatus.CREATED);

        expect(fs.existsSync(path.join(tempDir, target))).toBe(true);
    });

    it('should return 400 when path is missing', async () => {
        await createFolder(undefined).expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 on path traversal outside the base directory', async () => {
        await createFolder('../escape').expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 on a sibling path that shares the base prefix (no prefix-overlap bypass)', async () => {
        // e.g. basePath="/tmp/abc" must NOT accept "/tmp/abc-evil/hack"
        await createFolder(`${tempDir}-evil/hack`).expect(HttpStatus.BAD_REQUEST);
        expect(fs.existsSync(`${tempDir}-evil`)).toBe(false);
    });
});
