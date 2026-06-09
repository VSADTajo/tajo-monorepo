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
import { buildCreateCsvProviderConfigDto } from '../../factories/provider-config.factory';

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

const mockCsvDataProvider = {
    fetch: jest.fn().mockResolvedValue([
        {
            locationId: 'AR35',
            parameterId: 'Q.historical',
            moduleInstanceId: 'FlowCast',
            stationName: 'ALAGÓN EN GARCIBUEY',
            lat: 40.501957,
            lon: -5.947684,
            x: 250221.21,
            y: 4487646.9,
            units: 'm3/s',
            timeStep: { unit: 'MINUTE', multiplier: 15 },
            forecastDate: '2026-04-07T18:45:00.000Z',
            startDate: '2026-04-07T18:45:00.000Z',
            endDate: '2026-04-17T18:30:00.000Z',
            events: [
                { timestamp: '2026-04-07T18:45:00.000Z', value: 2.076, flag: 0, isMissing: false },
                { timestamp: '2026-04-07T19:00:00.000Z', value: 2.076, flag: 0, isMissing: false },
                { timestamp: '2026-04-17T18:30:00.000Z', value: 0, flag: 8, isMissing: true },
            ],
        },
        {
            locationId: 'AC07',
            parameterId: 'Precip.historical',
            moduleInstanceId: 'FlowCast',
            stationName: 'CANAL DE LAS AVES',
            lat: 40.042588,
            lon: -3.547373,
            x: 453305.3,
            y: 4432627.56,
            units: 'mm',
            timeStep: { unit: 'MINUTE', multiplier: 60 },
            forecastDate: '2026-04-07T19:00:00.000Z',
            startDate: '2026-04-07T19:00:00.000Z',
            endDate: '2026-04-17T18:00:00.000Z',
            events: [
                { timestamp: '2026-04-07T19:00:00.000Z', value: 0.6, flag: 0, isMissing: false },
                { timestamp: '2026-04-07T20:00:00.000Z', value: 0.2, flag: 0, isMissing: false },
            ],
        },
    ]),
};

const mockDataProviderFactory = {
    getProvider: jest.fn().mockReturnValue(mockCsvDataProvider),
};

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('CSV File Ingestion (e2e)', () => {
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
    function createProvider(dto: ReturnType<typeof buildCreateCsvProviderConfigDto>) {
        return request(app.getHttpServer()).post('/provider-configs').send(dto);
    }

    function triggerIngestion(id: string) {
        return request(app.getHttpServer()).post(`/provider-configs/${id}/trigger`);
    }

    // ─────────────────────────────────────────────────────────────
    // Test cases
    // ─────────────────────────────────────────────────────────────

    it('should create CSV_FILE provider config (201)', async () => {
        const dto = buildCreateCsvProviderConfigDto();

        const { body } = await createProvider(dto).expect(HttpStatus.CREATED);

        expect(body).toMatchObject({
            id: expect.any(String),
            name: dto.name,
            type: 'CSV_FILE',
        });
    });

    it('should trigger CSV ingestion and publish historical time series (201)', async () => {
        // 1. Create a CSV provider config
        const dto = buildCreateCsvProviderConfigDto();
        const { body: created } = await createProvider(dto).expect(HttpStatus.CREATED);

        // 2. Trigger ingestion
        const { body: ingestionRun } = await triggerIngestion(created.id).expect(HttpStatus.CREATED);

        // 3. Verify ingestion run succeeded
        expect(ingestionRun).toMatchObject({
            id: expect.any(String),
            providerConfigId: created.id,
            status: 'SUCCESS',
            seriesCount: 2,
            eventsCount: 5,
        });
        expect(ingestionRun.startedAt).toBeDefined();
        expect(ingestionRun.completedAt).toBeDefined();
        expect(ingestionRun.errorMessage).toBeNull();

        // 4. Verify message published to RabbitMQ
        expect(mockMessageBroker.publishToTopic).toHaveBeenCalledWith(
            'model-events',
            'timeseries.ingested',
            expect.objectContaining({
                providerConfigId: created.id,
                providerName: dto.name,
                providerType: 'CSV_FILE',
                seriesCount: 2,
                eventsCount: 5,
                timeSeries: expect.arrayContaining([
                    expect.objectContaining({
                        locationId: 'AR35',
                        parameterId: 'Q.historical',
                        moduleInstanceId: 'FlowCast',
                        units: 'm3/s',
                    }),
                    expect.objectContaining({
                        locationId: 'AC07',
                        parameterId: 'Precip.historical',
                        moduleInstanceId: 'FlowCast',
                        units: 'mm',
                    }),
                ]),
            }),
        );
    });

    it('should include missing value markers in published events', async () => {
        const dto = buildCreateCsvProviderConfigDto();
        const { body: created } = await createProvider(dto).expect(HttpStatus.CREATED);

        await triggerIngestion(created.id).expect(HttpStatus.CREATED);

        const publishedPayload = mockMessageBroker.publishToTopic.mock.calls[0][2];
        const ar35Series = publishedPayload.timeSeries.find((s: any) => s.locationId === 'AR35');

        // Third event should be marked as missing
        const missingEvent = ar35Series.events[2];
        expect(missingEvent).toMatchObject({
            value: 0,
            flag: 8,
            isMissing: true,
        });

        // First event should be valid
        const validEvent = ar35Series.events[0];
        expect(validEvent).toMatchObject({
            value: 2.076,
            flag: 0,
            isMissing: false,
        });
    });
});
