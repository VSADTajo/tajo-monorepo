import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Application — commands
import {
    CreateSftpUserHandler,
    UpdateSftpUserHandler,
    DeleteSftpUserHandler,
    ToggleSftpUserHandler,
} from '../../../src/app/application/commands/sftp-user.commands';
import {
    CreateMappingSchemaHandler,
    UpdateMappingSchemaHandler,
    DeleteMappingSchemaHandler,
    ToggleMappingSchemaHandler,
} from '../../../src/app/application/commands/mapping-schema.commands';
import {
    UploadFileHandler,
    MoveFileHandler,
    DeleteFileHandler,
} from '../../../src/app/application/commands/file.commands';

// Application — queries
import { ListSftpUsersHandler, GetSftpUserByIdHandler } from '../../../src/app/application/queries/sftp-user.queries';
import {
    ListMappingSchemasHandler,
    GetMappingSchemaByIdHandler,
    GetActiveMappingSchemaByPathHandler,
} from '../../../src/app/application/queries/mapping-schema.queries';
import {
    ListFilesHandler,
    DownloadFileHandler,
    ListPathsOverviewHandler,
} from '../../../src/app/application/queries/file.queries';

// Controllers
import { SftpUserController } from '../../../src/app/api/controllers/sftp-user.controller';
import { MappingSchemaController } from '../../../src/app/api/controllers/mapping-schema.controller';
import { FileController } from '../../../src/app/api/controllers/file.controller';

// Domain
import { SftpUser } from '../../../src/app/domain/entities/sftp-user.entity';
import { MappingSchema } from '../../../src/app/domain/entities/mapping-schema.entity';
import { CleanupJob } from '../../../src/app/domain/entities/cleanup-job.entity';
import { ISftpUserRepository } from '../../../src/app/domain/ports/sftp-user-repository.port';
import { IMappingSchemaRepository } from '../../../src/app/domain/ports/mapping-schema-repository.port';
import { ICleanupJobRepository } from '../../../src/app/domain/ports/cleanup-job-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { IFileStorageService } from '../../../src/app/domain/ports/file-storage-service.port';
import { IFileTransformer } from '../../../src/app/domain/ports/file-transformer.port';

// Infrastructure
import { SftpUserRepository } from '../../../src/app/infrastructure/persistence/sftp-user.repository';
import { MappingSchemaRepository } from '../../../src/app/infrastructure/persistence/mapping-schema.repository';
import { CleanupJobRepository } from '../../../src/app/infrastructure/persistence/cleanup-job.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Config
import { StorageConfigService } from '../../../src/configuration/storage/storage-config.service';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildSftpUserWithPath, buildSchemaForPath } from '../../factories/paths-overview.factory';

const BASE_PATH = '/data/files';

const mockCacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
};

const mockFileStorageService = {
    upload: jest.fn(),
    list: jest.fn(),
    download: jest.fn(),
    move: jest.fn(),
    delete: jest.fn(),
};

const mockFileTransformer = {
    transform: jest.fn(),
};

describe('List Paths Overview (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [SftpUser, MappingSchema, CleanupJob],
            controllers: [SftpUserController, MappingSchemaController, FileController],
            providers: [
                // SFTP User
                CreateSftpUserHandler,
                UpdateSftpUserHandler,
                DeleteSftpUserHandler,
                ToggleSftpUserHandler,
                ListSftpUsersHandler,
                GetSftpUserByIdHandler,
                { provide: ISftpUserRepository, useClass: SftpUserRepository },
                // Mapping Schema
                CreateMappingSchemaHandler,
                UpdateMappingSchemaHandler,
                DeleteMappingSchemaHandler,
                ToggleMappingSchemaHandler,
                ListMappingSchemasHandler,
                GetMappingSchemaByIdHandler,
                GetActiveMappingSchemaByPathHandler,
                { provide: IMappingSchemaRepository, useClass: MappingSchemaRepository },
                // File handlers
                UploadFileHandler,
                MoveFileHandler,
                DeleteFileHandler,
                ListFilesHandler,
                DownloadFileHandler,
                ListPathsOverviewHandler,
                { provide: ICleanupJobRepository, useClass: CleanupJobRepository },
                { provide: IFileStorageService, useValue: mockFileStorageService },
                { provide: IFileTransformer, useValue: mockFileTransformer },
                { provide: StorageConfigService, useValue: { basePath: BASE_PATH, maxFileSize: 524288000 } },
                // Cache
                { provide: ICacheService, useValue: mockCacheService },
                CachingQueryBus,
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    // ─── Helpers ───────────────────────────────────────────────────

    function getPathsOverview() {
        return request(app.getHttpServer()).get('/files/paths-overview');
    }

    function createSftpUser(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/sftp-users').send(dto);
    }

    function createSchema(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/mapping-schemas').send(dto);
    }

    // ─── Tests ─────────────────────────────────────────────────────

    it('should return empty list when no users or schemas exist', async () => {
        const { body } = await getPathsOverview().expect(HttpStatus.OK);

        expect(body.paths).toEqual([]);
    });

    it('should return path from SFTP user rootDirectory', async () => {
        const userDto = buildSftpUserWithPath({ rootDirectory: `${BASE_PATH}/incoming` });
        await createSftpUser(userDto).expect(HttpStatus.CREATED);

        const { body } = await getPathsOverview().expect(HttpStatus.OK);

        expect(body.paths).toHaveLength(1);
        expect(body.paths[0].displayPath).toBe(`${BASE_PATH}/incoming`);
        expect(body.paths[0].canListFiles).toBe(true);
        expect(body.paths[0].schema).toBeNull();
    });

    it('should return path from schema directoryPath with schema info attached', async () => {
        const dirPath = `${BASE_PATH}/forecast`;
        const schemaDto = buildSchemaForPath(dirPath, { name: 'Forecast Schema' });
        await createSchema(schemaDto).expect(HttpStatus.CREATED);

        const { body } = await getPathsOverview().expect(HttpStatus.OK);

        expect(body.paths).toHaveLength(1);
        const entry = body.paths[0];
        expect(entry.displayPath).toBe(dirPath);
        expect(entry.canListFiles).toBe(true);
        expect(entry.schema).not.toBeNull();
        expect(entry.schema.name).toBe('Forecast Schema');
        expect(entry.schema.isActive).toBe(true);
        expect(entry.schema.inputFormat).toBe('xml');
        expect(entry.schema.outputFormat).toBe('json');
    });

    it('should deduplicate when SFTP user and schema share the same path', async () => {
        const sharedPath = `${BASE_PATH}/shared`;
        const userDto = buildSftpUserWithPath({ rootDirectory: sharedPath });
        const schemaDto = buildSchemaForPath(sharedPath, { name: 'Shared Schema' });

        await createSftpUser(userDto).expect(HttpStatus.CREATED);
        await createSchema(schemaDto).expect(HttpStatus.CREATED);

        const { body } = await getPathsOverview().expect(HttpStatus.OK);

        expect(body.paths).toHaveLength(1);
        expect(body.paths[0].displayPath).toBe(sharedPath);
        expect(body.paths[0].schema).not.toBeNull();
        expect(body.paths[0].schema.name).toBe('Shared Schema');
    });

    it('should mark paths outside basePath as canListFiles=false', async () => {
        const outsidePath = '/tmp/external';
        const userDto = buildSftpUserWithPath({ rootDirectory: outsidePath });
        await createSftpUser(userDto).expect(HttpStatus.CREATED);

        const { body } = await getPathsOverview().expect(HttpStatus.OK);

        expect(body.paths).toHaveLength(1);
        expect(body.paths[0].displayPath).toBe(outsidePath);
        expect(body.paths[0].canListFiles).toBe(false);
    });

    it('should sort paths alphabetically by displayPath', async () => {
        await createSftpUser(buildSftpUserWithPath({ rootDirectory: `${BASE_PATH}/zebra` })).expect(HttpStatus.CREATED);
        await createSftpUser(buildSftpUserWithPath({ rootDirectory: `${BASE_PATH}/alpha` })).expect(HttpStatus.CREATED);
        await createSftpUser(buildSftpUserWithPath({ rootDirectory: `${BASE_PATH}/middle` })).expect(
            HttpStatus.CREATED,
        );

        const { body } = await getPathsOverview().expect(HttpStatus.OK);

        const displayPaths = body.paths.map((p: { displayPath: string }) => p.displayPath);
        expect(displayPaths).toEqual([...displayPaths].sort());
    });
});
