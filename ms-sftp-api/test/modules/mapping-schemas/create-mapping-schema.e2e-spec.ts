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

describe('Create Mapping Schema (e2e)', () => {
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
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    // ─── Helpers ───────────────────────────────────────────────────

    function createSchema(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/mapping-schemas').send(dto);
    }

    function getSchemaById(id: string) {
        return request(app.getHttpServer()).get(`/mapping-schemas/${id}`);
    }

    // ─── Tests ─────────────────────────────────────────────────────

    it('should create a mapping schema and retrieve it by ID', async () => {
        const dto = buildCreateMappingSchemaDto({
            directoryPath: '/data/incoming/forecast',
            name: 'Forecast XML to JSON',
        });

        const { body: created } = await createSchema(dto).expect(HttpStatus.CREATED);

        expect(created.id).toBeDefined();
        expect(created.directoryPath).toBe('/data/incoming/forecast');
        expect(created.name).toBe('Forecast XML to JSON');
        expect(created.inputFormat).toBe('xml');
        expect(created.outputFormat).toBe('json');
        expect(created.isActive).toBe(true);
        expect(created.fieldMappings).toHaveLength(2);

        const { body: fetched } = await getSchemaById(created.id).expect(HttpStatus.OK);
        expect(fetched.id).toBe(created.id);
        expect(fetched.name).toBe('Forecast XML to JSON');
    });

    it('should return 409 when directory path already exists', async () => {
        const dto = buildCreateMappingSchemaDto({ directoryPath: '/data/incoming/duplicate' });

        await createSchema(dto).expect(HttpStatus.CREATED);
        await createSchema(dto).expect(HttpStatus.CONFLICT);
    });

    it('should return 400 when directory path is empty', async () => {
        const dto = buildCreateMappingSchemaDto({ directoryPath: '' });
        await createSchema(dto).expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when name is empty', async () => {
        const dto = buildCreateMappingSchemaDto({ name: '' });
        await createSchema(dto).expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 for invalid input format', async () => {
        const dto = buildCreateMappingSchemaDto({ inputFormat: 'txt' });
        await createSchema(dto).expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 for invalid output format', async () => {
        const dto = buildCreateMappingSchemaDto({ outputFormat: 'xlsx' });
        await createSchema(dto).expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when fieldMappings is empty', async () => {
        const dto = buildCreateMappingSchemaDto({ fieldMappings: [] });
        await createSchema(dto).expect(HttpStatus.BAD_REQUEST);
    });

    it('should create a schema with csv options', async () => {
        const dto = buildCreateMappingSchemaDto({
            directoryPath: '/data/incoming/csv-test',
            inputFormat: 'csv',
            outputFormat: 'json',
            csvOptions: { delimiter: ';', encoding: 'utf-8', metadataRows: 2 },
        });

        const { body } = await createSchema(dto).expect(HttpStatus.CREATED);

        expect(body.inputFormat).toBe('csv');
        expect(body.csvOptions).toMatchObject({
            delimiter: ';',
            encoding: 'utf-8',
            metadataRows: 2,
        });
    });

    it('should update a schema', async () => {
        const dto = buildCreateMappingSchemaDto({ directoryPath: '/data/incoming/update-test' });
        const { body: created } = await createSchema(dto).expect(HttpStatus.CREATED);

        const { body: updated } = await request(app.getHttpServer())
            .put(`/mapping-schemas/${created.id}`)
            .send({
                ...dto,
                name: 'Updated Name',
                outputFormat: 'csv',
            })
            .expect(HttpStatus.OK);

        expect(updated.name).toBe('Updated Name');
        expect(updated.outputFormat).toBe('csv');
    });

    it('should delete a schema', async () => {
        const dto = buildCreateMappingSchemaDto({ directoryPath: '/data/incoming/delete-test' });
        const { body: created } = await createSchema(dto).expect(HttpStatus.CREATED);

        const { body: deleted } = await request(app.getHttpServer())
            .delete(`/mapping-schemas/${created.id}`)
            .expect(HttpStatus.OK);

        expect(deleted.deletedId).toBe(created.id);

        await getSchemaById(created.id).expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 when deleting non-existent schema', async () => {
        await request(app.getHttpServer())
            .delete('/mapping-schemas/00000000-0000-0000-0000-000000000000')
            .expect(HttpStatus.NOT_FOUND);
    });
});
