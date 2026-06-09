import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Entities
import { ProviderConfig } from '../../../src/app/domain/entities/provider-config.entity';
import { IngestionRun } from '../../../src/app/domain/entities/ingestion-run.entity';

// Ports
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { IMessageBroker } from '../../../src/app/domain/ports/message-broker.port';
import { IProviderConfigRepository } from '../../../src/app/domain/ports/provider-config-repository.port';
import { IIngestionRunRepository } from '../../../src/app/domain/ports/ingestion-run-repository.port';

// Implementations
import { ProviderConfigRepository } from '../../../src/app/infrastructure/persistence/provider-config.repository';
import { IngestionRunRepository } from '../../../src/app/infrastructure/persistence/ingestion-run.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';
import { ProviderSchedulerService } from '../../../src/app/infrastructure/services/provider-scheduler.service';
import { DataProviderFactoryService } from '../../../src/app/infrastructure/services/data-provider-factory.service';

// Handlers — provider-config commands
import {
    CreateProviderConfigHandler,
    UpdateProviderConfigHandler,
    DeleteProviderConfigHandler,
    ToggleProviderConfigHandler,
} from '../../../src/app/application/commands/provider-config.commands';

// Handlers — ingestion commands
import {
    TriggerIngestionHandler,
    ExecuteIngestionHandler,
} from '../../../src/app/application/commands/ingestion.commands';

// Handlers — ingestion-run queries
import {
    ListIngestionRunsHandler,
    GetIngestionRunByIdHandler,
} from '../../../src/app/application/queries/ingestion-run.queries';

// Handlers — provider-config queries
import {
    ListProviderConfigsHandler,
    GetProviderConfigByIdHandler,
} from '../../../src/app/application/queries/provider-config.queries';

// Controllers
import { ProviderConfigController } from '../../../src/app/api/controllers/provider-config.controller';
import { IngestionRunController } from '../../../src/app/api/controllers/ingestion-run.controller';

// Helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateProviderConfigDto } from '../../factories/provider-config.factory';

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const mockCacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
};

const mockMessageBroker = {
    publish: jest.fn().mockResolvedValue(undefined),
    publishToTopic: jest.fn().mockResolvedValue(undefined),
};

const mockDataProvider = {
    fetch: jest.fn().mockResolvedValue([
        {
            locationId: 'AR01',
            parameterId: 'Q.NAM.ens.Med',
            moduleInstanceId: 'NAM_EPS',
            stationName: 'Station AR01',
            lat: -34.5,
            lon: -58.5,
            units: 'm3/s',
            timeStep: { unit: 'hour', multiplier: 1 },
            forecastDate: '2026-03-11T00:00:00.000Z',
            startDate: '2026-03-11T00:00:00.000Z',
            endDate: '2026-03-12T00:00:00.000Z',
            events: [{ date: '2026-03-11', time: '00:00:00', value: 123.45, flag: 0 }],
        },
    ]),
};

const mockDataProviderFactory = {
    getProvider: jest.fn().mockReturnValue(mockDataProvider),
};

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('Ingestion Runs — List / Get (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [ProviderConfig, IngestionRun],
            controllers: [ProviderConfigController, IngestionRunController],
            providers: [
                // Command handlers
                CreateProviderConfigHandler,
                UpdateProviderConfigHandler,
                DeleteProviderConfigHandler,
                ToggleProviderConfigHandler,
                TriggerIngestionHandler,
                ExecuteIngestionHandler,

                // Query handlers
                ListIngestionRunsHandler,
                GetIngestionRunByIdHandler,
                ListProviderConfigsHandler,
                GetProviderConfigByIdHandler,

                // Repository bindings
                { provide: IProviderConfigRepository, useClass: ProviderConfigRepository },
                { provide: IIngestionRunRepository, useClass: IngestionRunRepository },

                // Mock services
                { provide: ICacheService, useValue: mockCacheService },
                { provide: IMessageBroker, useValue: mockMessageBroker },
                { provide: ProviderSchedulerService, useValue: { registerJob: jest.fn(), removeJob: jest.fn() } },
                { provide: DataProviderFactoryService, useValue: mockDataProviderFactory },

                // CachingQueryBus (real, backed by mock cache)
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

    // ── Helper functions (NOT async) ────────────────────────────

    function createProvider(dto: ReturnType<typeof buildCreateProviderConfigDto>) {
        return request(app.getHttpServer()).post('/provider-configs').send(dto);
    }

    function triggerIngestion(providerConfigId: string) {
        return request(app.getHttpServer()).post(`/provider-configs/${providerConfigId}/trigger`);
    }

    function listIngestionRuns(query?: Record<string, string>) {
        return request(app.getHttpServer())
            .get('/ingestion-runs')
            .query(query ?? {});
    }

    function getIngestionRunById(id: string) {
        return request(app.getHttpServer()).get(`/ingestion-runs/${id}`);
    }

    // ── Tests ───────────────────────────────────────────────────

    it('should list empty ingestion runs', async () => {
        const { body } = await listIngestionRuns().expect(HttpStatus.OK);

        expect(body).toEqual({ runs: [] });
    });

    it('should list ingestion runs after triggering ingestion', async () => {
        // 1. Create a provider config
        const dto = buildCreateProviderConfigDto();
        const { body: provider } = await createProvider(dto).expect(HttpStatus.CREATED);

        // 2. Trigger ingestion
        await triggerIngestion(provider.id).expect(HttpStatus.CREATED);

        // 3. List ingestion runs
        const { body } = await listIngestionRuns().expect(HttpStatus.OK);

        expect(body.runs.length).toBeGreaterThanOrEqual(1);
        expect(body.runs[0]).toMatchObject({
            providerConfigId: provider.id,
            seriesCount: 1,
            eventsCount: 1,
        });
        expect(body.runs[0].id).toBeDefined();
        expect(body.runs[0].startedAt).toBeDefined();
    });

    it('should filter by providerConfigId', async () => {
        // 1. Create two providers
        const dto1 = buildCreateProviderConfigDto();
        const dto2 = buildCreateProviderConfigDto();
        const { body: provider1 } = await createProvider(dto1).expect(HttpStatus.CREATED);
        const { body: provider2 } = await createProvider(dto2).expect(HttpStatus.CREATED);

        // 2. Trigger ingestion for each
        await triggerIngestion(provider1.id).expect(HttpStatus.CREATED);
        await triggerIngestion(provider2.id).expect(HttpStatus.CREATED);

        // 3. Filter by provider1
        const { body: filtered } = await listIngestionRuns({ providerConfigId: provider1.id }).expect(HttpStatus.OK);

        expect(filtered.runs.length).toBe(1);
        expect(filtered.runs[0].providerConfigId).toBe(provider1.id);

        // 4. Verify the unfiltered list has both
        const { body: all } = await listIngestionRuns().expect(HttpStatus.OK);
        expect(all.runs.length).toBe(2);
    });

    it('should get ingestion run by id', async () => {
        // 1. Create a provider and trigger ingestion
        const dto = buildCreateProviderConfigDto();
        const { body: provider } = await createProvider(dto).expect(HttpStatus.CREATED);
        await triggerIngestion(provider.id).expect(HttpStatus.CREATED);

        // 2. Get the run id from the list
        const { body: list } = await listIngestionRuns().expect(HttpStatus.OK);
        const runId = list.runs[0].id;

        // 3. Get by id
        const { body: run } = await getIngestionRunById(runId).expect(HttpStatus.OK);

        expect(run.id).toBe(runId);
        expect(run.providerConfigId).toBe(provider.id);
        expect(run.seriesCount).toBe(1);
        expect(run.eventsCount).toBe(1);
        expect(run.startedAt).toBeDefined();
        expect(run.completedAt).toBeDefined();
    });

    it('should return 404 for non-existent id', async () => {
        const nonExistentUuid = '00000000-0000-4000-a000-000000000000';

        await getIngestionRunById(nonExistentUuid).expect(HttpStatus.NOT_FOUND);
    });
});
