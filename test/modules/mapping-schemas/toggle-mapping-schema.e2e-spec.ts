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

describe('Toggle Mapping Schema (e2e)', () => {
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

    function createSchema(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/mapping-schemas').send(dto);
    }

    function toggleSchema(id: string, isActive: boolean) {
        return request(app.getHttpServer()).patch(`/mapping-schemas/${id}/toggle`).send({ isActive });
    }

    function getSchemaById(id: string) {
        return request(app.getHttpServer()).get(`/mapping-schemas/${id}`);
    }

    // ─── Tests ─────────────────────────────────────────────────────

    it('should deactivate an active schema', async () => {
        const dto = buildCreateMappingSchemaDto({ directoryPath: '/data/toggle/deactivate' });
        const { body: created } = await createSchema(dto).expect(HttpStatus.CREATED);
        expect(created.isActive).toBe(true);

        const { body: toggled } = await toggleSchema(created.id, false).expect(HttpStatus.OK);
        expect(toggled.isActive).toBe(false);

        // Verify persistence
        const { body: fetched } = await getSchemaById(created.id).expect(HttpStatus.OK);
        expect(fetched.isActive).toBe(false);
    });

    it('should activate an inactive schema', async () => {
        const dto = buildCreateMappingSchemaDto({ directoryPath: '/data/toggle/activate' });
        const { body: created } = await createSchema(dto).expect(HttpStatus.CREATED);

        // Deactivate first
        await toggleSchema(created.id, false).expect(HttpStatus.OK);

        // Activate
        const { body: toggled } = await toggleSchema(created.id, true).expect(HttpStatus.OK);
        expect(toggled.isActive).toBe(true);
    });

    it('should return 404 when toggling non-existent schema', async () => {
        await toggleSchema('00000000-0000-0000-0000-000000000000', false).expect(HttpStatus.NOT_FOUND);
    });

    it('should preserve all other fields when toggling', async () => {
        const dto = buildCreateMappingSchemaDto({
            directoryPath: '/data/toggle/preserve',
            name: 'Preserve Fields',
            inputFormat: 'xml',
            outputFormat: 'csv',
        });
        const { body: created } = await createSchema(dto).expect(HttpStatus.CREATED);

        const { body: toggled } = await toggleSchema(created.id, false).expect(HttpStatus.OK);

        expect(toggled.directoryPath).toBe('/data/toggle/preserve');
        expect(toggled.name).toBe('Preserve Fields');
        expect(toggled.inputFormat).toBe('xml');
        expect(toggled.outputFormat).toBe('csv');
        expect(toggled.fieldMappings).toHaveLength(2);
        expect(toggled.isActive).toBe(false);
    });
});
