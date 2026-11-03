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
import { buildIngestionRunData } from '../../factories/ingestion-run.factory';

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

describe('Stale RUNNING ingestion run (e2e)', () => {
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

    function getIngestionRunById(id: string) {
        return request(app.getHttpServer()).get(`/ingestion-runs/${id}`);
    }

    // Seeds a RUNNING row the way a process killed mid-ingestion leaves it.
    // There is no endpoint that creates a RUNNING run, so this is setup only;
    // every assertion below goes through the API.
    function seedRunningRun(providerConfigId: string, startedAt: Date) {
        return dataSource.getRepository(IngestionRun).save(
            new IngestionRun(
                buildIngestionRunData({
                    providerConfigId,
                    status: 'RUNNING',
                    startedAt,
                    completedAt: null,
                    seriesCount: 0,
                    eventsCount: 0,
                }),
            ),
        );
    }

    // ── Tests ───────────────────────────────────────────────────

    it('should release a stale RUNNING run and execute the new ingestion', async () => {
        const { body: provider } = await createProvider(buildCreateProviderConfigDto()).expect(HttpStatus.CREATED);
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const stale = await seedRunningRun(provider.id, twoHoursAgo);

        const { body: run } = await triggerIngestion(provider.id).expect(HttpStatus.CREATED);
        expect(run.status).toBe('SUCCESS');

        const { body: released } = await getIngestionRunById(stale.id).expect(HttpStatus.OK);
        expect(released.status).toBe('FAILED');
        expect(released.completedAt).not.toBeNull();
        expect(released.errorMessage).toMatch(/interrupted/i);
    });

    it('should keep rejecting with 409 while a recent run is still RUNNING', async () => {
        const { body: provider } = await createProvider(buildCreateProviderConfigDto()).expect(HttpStatus.CREATED);
        const running = await seedRunningRun(provider.id, new Date());

        await triggerIngestion(provider.id).expect(HttpStatus.CONFLICT);

        const { body: untouched } = await getIngestionRunById(running.id).expect(HttpStatus.OK);
        expect(untouched.status).toBe('RUNNING');
        expect(untouched.errorMessage).toBeNull();
    });
});
