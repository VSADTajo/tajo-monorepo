import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Application
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
import { MappingSchemaController } from '../../../src/app/api/controllers/mapping-schema.controller';

// Domain
import { MappingSchema } from '../../../src/app/domain/entities/mapping-schema.entity';
import { IMappingSchemaRepository } from '../../../src/app/domain/ports/mapping-schema-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { MappingSchemaRepository } from '../../../src/app/infrastructure/persistence/mapping-schema.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateMappingSchemaDto } from '../../factories/mapping-schema.factory';

const mockCacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
};

describe('List Mapping Schemas (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [MappingSchema],
            controllers: [MappingSchemaController],
            providers: [
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
    });

    // ─── Helpers ───────────────────────────────────────────────────

    function listSchemas() {
        return request(app.getHttpServer()).get('/mapping-schemas');
    }

    function createSchema(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/mapping-schemas').send(dto);
    }

    // ─── Tests ─────────────────────────────────────────────────────

    it('should return empty list when no schemas exist', async () => {
        const { body } = await listSchemas().expect(HttpStatus.OK);

        expect(body.schemas).toEqual([]);
    });

    it('should return all schemas', async () => {
        const dto1 = buildCreateMappingSchemaDto({ directoryPath: '/data/list/path-a', name: 'Schema A' });
        const dto2 = buildCreateMappingSchemaDto({ directoryPath: '/data/list/path-b', name: 'Schema B' });

        await createSchema(dto1).expect(HttpStatus.CREATED);
        await createSchema(dto2).expect(HttpStatus.CREATED);

        const { body } = await listSchemas().expect(HttpStatus.OK);

        expect(body.schemas).toHaveLength(2);
        const names = body.schemas.map((s: { name: string }) => s.name);
        expect(names).toContain('Schema A');
        expect(names).toContain('Schema B');
    });

    it('should return schema with all fields populated', async () => {
        const dto = buildCreateMappingSchemaDto({
            directoryPath: '/data/list/detailed',
            name: 'Detailed Schema',
            inputFormat: 'xml',
            outputFormat: 'csv',
        });

        await createSchema(dto).expect(HttpStatus.CREATED);

        const { body } = await listSchemas().expect(HttpStatus.OK);

        expect(body.schemas).toHaveLength(1);
        const schema = body.schemas[0];
        expect(schema.directoryPath).toBe('/data/list/detailed');
        expect(schema.name).toBe('Detailed Schema');
        expect(schema.inputFormat).toBe('xml');
        expect(schema.outputFormat).toBe('csv');
        expect(schema.isActive).toBe(true);
        expect(schema.fieldMappings).toHaveLength(2);
        expect(schema.createdAt).toBeDefined();
        expect(schema.updatedAt).toBeDefined();
    });

    it('should get schema by ID', async () => {
        const dto = buildCreateMappingSchemaDto({ directoryPath: '/data/list/by-id' });
        const { body: created } = await createSchema(dto).expect(HttpStatus.CREATED);

        const { body } = await request(app.getHttpServer()).get(`/mapping-schemas/${created.id}`).expect(HttpStatus.OK);

        expect(body.id).toBe(created.id);
        expect(body.directoryPath).toBe('/data/list/by-id');
    });

    it('should return 404 for non-existent schema ID', async () => {
        await request(app.getHttpServer())
            .get('/mapping-schemas/00000000-0000-0000-0000-000000000000')
            .expect(HttpStatus.NOT_FOUND);
    });
});
