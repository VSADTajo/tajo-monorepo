import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { Scenario } from '../../../src/app/domain/entities/scenario.entity';
import { IScenarioRepository } from '../../../src/app/domain/ports/scenario-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { ScenarioRepository } from '../../../src/app/infrastructure/persistence/scenario.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { CreateScenarioHandler, DeleteScenarioHandler } from '../../../src/app/application/commands/scenario.commands';
import { GetScenarioByIdHandler, ListScenariosHandler } from '../../../src/app/application/queries/scenario.queries';
import { ScenarioController } from '../../../src/app/api/controllers/scenario.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateScenarioDto } from '../../factories/scenario.factory';

describe('Scenario CRUD (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [Scenario],
            controllers: [ScenarioController],
            providers: [
                CreateScenarioHandler,
                DeleteScenarioHandler,
                GetScenarioByIdHandler,
                ListScenariosHandler,
                CachingQueryBus,
                { provide: IScenarioRepository, useClass: ScenarioRepository },
                { provide: ICacheService, useValue: mockCacheService },
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

    // ─── Helpers ──────────────────────────────────────────────
    function createScenario(body: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/scenarios').send(body);
    }

    function listScenarios() {
        return request(app.getHttpServer()).get('/scenarios');
    }

    function getScenario(id: string) {
        return request(app.getHttpServer()).get(`/scenarios/${id}`);
    }

    function deleteScenario(id: string) {
        return request(app.getHttpServer()).delete(`/scenarios/${id}`);
    }

    it('creates a scenario and returns metadata (no payload echoed)', async () => {
        const dto = buildCreateScenarioDto();

        const { body: created } = await createScenario(dto).expect(HttpStatus.CREATED);

        expect(created.id).toBeDefined();
        expect(created.name).toBe(dto.name);
        expect(created.description).toBe(dto.description);
        expect(created.itemsCount).toBe(1);
        expect(created.sizeBytes).toBeGreaterThan(0);
        expect(created.payload).toBeUndefined();
    });

    it('retrieves a scenario by id WITH the full payload', async () => {
        const dto = buildCreateScenarioDto();
        const { body: created } = await createScenario(dto).expect(HttpStatus.CREATED);

        const { body: fetched } = await getScenario(created.id).expect(HttpStatus.OK);

        expect(fetched.id).toBe(created.id);
        expect(fetched.payload).toEqual(dto.payload);
        expect(fetched.itemsCount).toBe(1);
    });

    it('lists scenarios as metadata only (no payload)', async () => {
        await createScenario(buildCreateScenarioDto()).expect(HttpStatus.CREATED);
        await createScenario(buildCreateScenarioDto()).expect(HttpStatus.CREATED);

        const { body } = await listScenarios().expect(HttpStatus.OK);

        expect(body.total).toBe(2);
        expect(body.items).toHaveLength(2);
        expect(body.items[0].payload).toBeUndefined();
        expect(body.items[0].name).toBeDefined();
    });

    it('deletes a scenario and then returns 404 on fetch', async () => {
        const { body: created } = await createScenario(buildCreateScenarioDto()).expect(HttpStatus.CREATED);

        const { body: deleted } = await deleteScenario(created.id).expect(HttpStatus.OK);
        expect(deleted).toEqual({ id: created.id, deleted: true });

        await getScenario(created.id).expect(HttpStatus.NOT_FOUND);
    });

    it('returns 404 when fetching a non-existent scenario', async () => {
        await getScenario('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
    });

    it('returns 404 when deleting a non-existent scenario', async () => {
        await deleteScenario('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
    });

    it('rejects a payload that is not an object (400)', async () => {
        await createScenario({ name: 'bad', payload: 'not-an-object' }).expect(HttpStatus.BAD_REQUEST);
    });

    it('rejects a missing name (400)', async () => {
        await createScenario({ payload: { items: [] } }).expect(HttpStatus.BAD_REQUEST);
    });
});
