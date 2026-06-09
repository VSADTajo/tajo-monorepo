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

// Repositories
import { ProviderConfigRepository } from '../../../src/app/infrastructure/persistence/provider-config.repository';
import { IngestionRunRepository } from '../../../src/app/infrastructure/persistence/ingestion-run.repository';

// Handlers
import { CreateProviderConfigHandler } from '../../../src/app/application/commands/provider-config.commands';
import {
    TriggerIngestionHandler,
    ExecuteIngestionHandler,
} from '../../../src/app/application/commands/ingestion.commands';
import {
    ListProviderConfigsHandler,
    GetProviderConfigByIdHandler,
} from '../../../src/app/application/queries/provider-config.queries';

// Infrastructure
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';
import { ProviderSchedulerService } from '../../../src/app/infrastructure/services/provider-scheduler.service';
import { DataProviderFactoryService } from '../../../src/app/infrastructure/services/data-provider-factory.service';

// Controller
import { ProviderConfigController } from '../../../src/app/api/controllers/provider-config.controller';

// Test helpers
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
            events: [
                { date: '2026-03-11', time: '00:00:00', value: 123.45, flag: 0 },
                { date: '2026-03-11', time: '01:00:00', value: 125.67, flag: 0 },
            ],
        },
    ]),
};

const mockDataProviderFactory = {
    getProvider: jest.fn().mockReturnValue(mockDataProvider),
};

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('Trigger Ingestion (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [ProviderConfig, IngestionRun],
            controllers: [ProviderConfigController],
            providers: [
                // Command handlers
                CreateProviderConfigHandler,
                TriggerIngestionHandler,
                ExecuteIngestionHandler,
                // Query handlers
                ListProviderConfigsHandler,
                GetProviderConfigByIdHandler,
                // Repositories (real)
                { provide: IProviderConfigRepository, useClass: ProviderConfigRepository },
                { provide: IIngestionRunRepository, useClass: IngestionRunRepository },
                // Mocked services
                { provide: ICacheService, useValue: mockCacheService },
                { provide: IMessageBroker, useValue: mockMessageBroker },
                { provide: DataProviderFactoryService, useValue: mockDataProviderFactory },
                { provide: ProviderSchedulerService, useValue: { registerJob: jest.fn(), removeJob: jest.fn() } },
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

    // Helper functions (NOT async — return supertest Test object)
    function createProvider(dto: ReturnType<typeof buildCreateProviderConfigDto>) {
        return request(app.getHttpServer()).post('/provider-configs').send(dto);
    }

    function triggerIngestion(id: string) {
        return request(app.getHttpServer()).post(`/provider-configs/${id}/trigger`);
    }

    // ─────────────────────────────────────────────────────────────
    // Test cases
    // ─────────────────────────────────────────────────────────────

    it('should trigger ingestion for an existing provider (201, returns ingestion run with status SUCCESS)', async () => {
        // 1. Create a provider config
        const dto = buildCreateProviderConfigDto();
        const { body: created } = await createProvider(dto).expect(HttpStatus.CREATED);

        // 2. Trigger ingestion
        const { body: ingestionRun } = await triggerIngestion(created.id).expect(HttpStatus.CREATED);

        // 3. Verify response structure and values
        expect(ingestionRun).toMatchObject({
            id: expect.any(String),
            providerConfigId: created.id,
            status: 'SUCCESS',
            seriesCount: 1,
            eventsCount: 2,
        });
        expect(ingestionRun.startedAt).toBeDefined();
        expect(ingestionRun.completedAt).toBeDefined();
        expect(ingestionRun.errorMessage).toBeNull();

        // 4. Verify mockMessageBroker.publishToTopic was called with correct args
        expect(mockMessageBroker.publishToTopic).toHaveBeenCalledWith(
            'model-events',
            'timeseries.ingested',
            expect.objectContaining({
                providerConfigId: created.id,
                providerName: dto.name,
                providerType: dto.type,
                seriesCount: 1,
                eventsCount: 2,
                timeSeries: expect.any(Array),
            }),
        );
    });

    it('should return 404 when triggering non-existent provider', async () => {
        const fakeId = '00000000-0000-4000-a000-000000000000';

        await triggerIngestion(fakeId).expect(HttpStatus.NOT_FOUND);
    });

    it('should trigger ingestion for inactive provider (201, manual override works)', async () => {
        // 1. Create a provider config (isActive defaults to false)
        const dto = buildCreateProviderConfigDto();
        const { body: created } = await createProvider(dto).expect(HttpStatus.CREATED);
        expect(created.isActive).toBe(false);

        // 2. Trigger ingestion — should still work even though provider is inactive
        const { body: ingestionRun } = await triggerIngestion(created.id).expect(HttpStatus.CREATED);

        // 3. Verify ingestion succeeded
        expect(ingestionRun).toMatchObject({
            id: expect.any(String),
            providerConfigId: created.id,
            status: 'SUCCESS',
            seriesCount: 1,
            eventsCount: 2,
        });
    });
});
