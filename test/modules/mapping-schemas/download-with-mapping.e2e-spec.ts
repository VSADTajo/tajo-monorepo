import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Application — Mapping Schema
import {
    CreateMappingSchemaHandler,
    UpdateMappingSchemaHandler,
    DeleteMappingSchemaHandler,
    ToggleMappingSchemaHandler,
} from '../../../src/app/application/commands/mapping-schema.commands';
import {
    ListMappingSchemasHandler,
    GetMappingSchemaByIdHandler,
    GetActiveMappingSchemaByPathHandler,
} from '../../../src/app/application/queries/mapping-schema.queries';

// Application — File
import {
    UploadFileHandler,
    MoveFileHandler,
    DeleteFileHandler,
} from '../../../src/app/application/commands/file.commands';
import { ListFilesHandler, DownloadFileHandler } from '../../../src/app/application/queries/file.queries';
import { FileController } from '../../../src/app/api/controllers/file.controller';
import { MappingSchemaController } from '../../../src/app/api/controllers/mapping-schema.controller';

// Domain
import { MappingSchema } from '../../../src/app/domain/entities/mapping-schema.entity';
import { IMappingSchemaRepository } from '../../../src/app/domain/ports/mapping-schema-repository.port';
import { IFileStorageService } from '../../../src/app/domain/ports/file-storage-service.port';
import { IFileTransformer } from '../../../src/app/domain/ports/file-transformer.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { MappingSchemaRepository } from '../../../src/app/infrastructure/persistence/mapping-schema.repository';
import { LocalFileStorageService } from '../../../src/app/infrastructure/services/local-file-storage.service';
import { FileTransformerService } from '../../../src/app/infrastructure/services/file-transformer.service';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Config
import { StorageConfigService } from '../../../src/configuration/storage/storage-config.service';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { createTempStorageDir, cleanupTempStorageDir, createTestFile } from '../../factories/file.factory';
import { buildCreateMappingSchemaDto, buildXmlContent } from '../../factories/mapping-schema.factory';

const mockCacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
};

describe('Download with Mapping (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let tempDir: string;

    beforeAll(async () => {
        tempDir = createTempStorageDir();
        const mockStorageConfig = { basePath: tempDir, maxFileSize: 524288000 };

        const ctx: TestContext = await createTestApp({
            entities: [MappingSchema],
            controllers: [FileController, MappingSchemaController],
            providers: [
                // File handlers
                UploadFileHandler,
                MoveFileHandler,
                DeleteFileHandler,
                ListFilesHandler,
                DownloadFileHandler,
                { provide: IFileStorageService, useClass: LocalFileStorageService },
                { provide: StorageConfigService, useValue: mockStorageConfig },
                // Mapping schema handlers
                CreateMappingSchemaHandler,
                UpdateMappingSchemaHandler,
                DeleteMappingSchemaHandler,
                ToggleMappingSchemaHandler,
                ListMappingSchemasHandler,
                GetMappingSchemaByIdHandler,
                GetActiveMappingSchemaByPathHandler,
                { provide: IMappingSchemaRepository, useClass: MappingSchemaRepository },
                { provide: ICacheService, useValue: mockCacheService },
                CachingQueryBus,
                // Transformer
                { provide: IFileTransformer, useClass: FileTransformerService },
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
        cleanupTempStorageDir(tempDir);
    });

    // ─── Helpers ───────────────────────────────────────────────────

    function createSchema(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/mapping-schemas').send(dto);
    }

    function toggleSchema(id: string, isActive: boolean) {
        return request(app.getHttpServer()).patch(`/mapping-schemas/${id}/toggle`).send({ isActive });
    }

    function downloadFile(filePath: string) {
        return request(app.getHttpServer())
            .get('/files/download')
            .query({ path: filePath })
            .buffer(true)
            .parse((res: NodeJS.ReadableStream, callback: (err: Error | null, body: Buffer) => void) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => callback(null, Buffer.concat(chunks)));
            });
    }

    // ─── Tests ─────────────────────────────────────────────────────

    it('should transform XML to JSON when active schema exists', async () => {
        // 1. Create an XML file in local storage
        const xmlContent = buildXmlContent();
        createTestFile(tempDir, 'forecast/data.xml', xmlContent);

        // 2. Create a mapping schema for that directory
        const schemaDto = buildCreateMappingSchemaDto({
            directoryPath: `${tempDir}/forecast`,
            name: 'Forecast Transform',
            inputFormat: 'xml',
            outputFormat: 'json',
            fieldMappings: [
                { sourceField: 'locationId', targetField: 'station', dataType: 'string' },
                { sourceField: 'value', targetField: 'measurement', dataType: 'number' },
                { sourceField: 'date', targetField: 'date', dataType: 'string' },
            ],
        });
        await createSchema(schemaDto).expect(HttpStatus.CREATED);

        // 3. Download — should get transformed JSON
        const response = await downloadFile('forecast/data.xml').expect(HttpStatus.OK);

        const json = JSON.parse(response.body.toString());
        expect(Array.isArray(json)).toBe(true);
        expect(json.length).toBe(3); // 3 events in test XML

        expect(json[0]).toMatchObject({
            station: 'ST01',
            measurement: 10.5,
            date: '2026-01-01',
        });

        expect(response.headers['content-type']).toContain('application/json');
        expect(response.headers['content-disposition']).toContain('.json');
    });

    it('should return raw file when no schema exists for the path', async () => {
        const fileContent = 'raw file content here';
        createTestFile(tempDir, 'no-schema/raw.txt', fileContent);

        const response = await downloadFile('no-schema/raw.txt').expect(HttpStatus.OK);

        expect(response.body.toString()).toBe(fileContent);
        expect(response.headers['content-type']).toContain('application/octet-stream');
    });

    it('should return raw file when schema is inactive', async () => {
        const xmlContent = buildXmlContent();
        createTestFile(tempDir, 'inactive/data.xml', xmlContent);

        // Create schema and deactivate it
        const schemaDto = buildCreateMappingSchemaDto({
            directoryPath: `${tempDir}/inactive`,
            name: 'Inactive Schema',
        });
        const { body: schema } = await createSchema(schemaDto).expect(HttpStatus.CREATED);
        await toggleSchema(schema.id, false).expect(HttpStatus.OK);

        // Download — should get raw XML since schema is inactive
        const response = await downloadFile('inactive/data.xml').expect(HttpStatus.OK);

        const body = response.body.toString();
        expect(body).toContain('<?xml');
        expect(body).toContain('TimeSeries');
        expect(response.headers['content-type']).toContain('application/octet-stream');
    });

    it('should apply field transforms (lowercase, number casting)', async () => {
        const xmlContent = buildXmlContent();
        createTestFile(tempDir, 'transforms/data.xml', xmlContent);

        const schemaDto = buildCreateMappingSchemaDto({
            directoryPath: `${tempDir}/transforms`,
            name: 'Transform Test',
            inputFormat: 'xml',
            outputFormat: 'json',
            fieldMappings: [
                { sourceField: 'stationName', targetField: 'name', dataType: 'string', transform: 'uppercase' },
                { sourceField: 'value', targetField: 'val', dataType: 'number' },
            ],
        });
        await createSchema(schemaDto).expect(HttpStatus.CREATED);

        const response = await downloadFile('transforms/data.xml').expect(HttpStatus.OK);

        const json = JSON.parse(response.body.toString());
        expect(json[0].name).toBe('STATION ONE');
        expect(typeof json[0].val).toBe('number');
    });
});
