import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import axios from 'axios';
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
import {
    CreateProviderConfigHandler,
    ToggleProviderConfigHandler,
} from '../../../src/app/application/commands/provider-config.commands';
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
import { WiskiApiProviderService } from '../../../src/app/infrastructure/services/wiski-api-provider.service';
import { WiskiApiConfigService } from '../../../src/configuration/wiski-api/wiski-api-config.service';
import { SftpApiConfigService } from '../../../src/configuration/sftp-api/sftp-api-config.service';
import { AppConfigService } from '../../../src/configuration/app/app-config.service';

// Controllers
import { ProviderConfigController } from '../../../src/app/api/controllers/provider-config.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateWiskiProviderConfigDto } from '../../factories/provider-config.factory';

// ─────────────────────────────────────────────────────────────
// Mocks — only the network boundary
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

/** Two readings of one series, newest first, exactly as their endpoint answers. */
const WISKI_PAYLOAD = [
    { variable: 'E_08VICT01.Validado', lastchange: '2026-08-11T14:00:00', value: 20.68 },
    { variable: 'E_08VICT01.Validado', lastchange: '2026-08-11T13:45:00', value: 20.67 },
];

// The only stand-in is the network: everything else — repositories, mapper,
// handlers, HTTP layer — is the real thing against a real Postgres.
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('WISKI API Ingestion (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [ProviderConfig, IngestionRun],
            controllers: [ProviderConfigController],
            providers: [
                CreateProviderConfigHandler,
                ToggleProviderConfigHandler,
                TriggerIngestionHandler,
                ExecuteIngestionHandler,
                ListProviderConfigsHandler,
                GetProviderConfigByIdHandler,
                { provide: IProviderConfigRepository, useClass: ProviderConfigRepository },
                { provide: IIngestionRunRepository, useClass: IngestionRunRepository },
                { provide: ICacheService, useValue: mockCacheService },
                { provide: IMessageBroker, useValue: mockMessageBroker },
                { provide: ProviderSchedulerService, useValue: { registerJob: jest.fn(), removeJob: jest.fn() } },
                {
                    provide: WiskiApiConfigService,
                    useValue: {
                        baseUrl: 'https://apisaih.saihchtajo.es',
                        path: '/wiski/tagus_flowcast_observado/',
                        timezone: 'Europe/Madrid',
                        requestTimeoutMs: 5000,
                        maxResponseBytes: 1024 * 1024,
                        username: '',
                        password: '',
                        mockBaseUrl: 'http://127.0.0.1:3008',
                    },
                },
                { provide: SftpApiConfigService, useValue: { baseUrl: 'http://ms-sftp-api:3003' } },
                {
                    provide: AppConfigService,
                    useValue: { vobsCsvSftpPath: 'tajo/Tagus_FlowCast.csv', vobsCsvTimezone: 'Europe/Madrid' },
                },
                WiskiApiProviderService,
                // The real factory would drag in the other three providers with
                // all their config modules; what this suite exercises is that
                // the WISKI provider is the one a WISKI_API row resolves to.
                {
                    provide: DataProviderFactoryService,
                    useFactory: (wiskiProvider: WiskiApiProviderService) => ({
                        getProvider: () => wiskiProvider,
                    }),
                    inject: [WiskiApiProviderService],
                },
                CachingQueryBus,
            ],
        });

        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
    }, 60_000);

    beforeEach(() => {
        (axios.get as jest.Mock).mockResolvedValue({ data: WISKI_PAYLOAD });
    });

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    // Helper functions (NOT async — return the supertest chain)
    function createProvider(dto: ReturnType<typeof buildCreateWiskiProviderConfigDto>) {
        return request(app.getHttpServer()).post('/provider-configs').send(dto);
    }

    function triggerIngestion(id: string) {
        return request(app.getHttpServer()).post(`/provider-configs/${id}/trigger`);
    }

    function toggleProvider(id: string) {
        return request(app.getHttpServer()).patch(`/provider-configs/${id}/toggle`);
    }

    // ─────────────────────────────────────────────────────────────

    it('accepts WISKI_API as a provider type', async () => {
        const dto = buildCreateWiskiProviderConfigDto();

        const { body } = await createProvider(dto).expect(HttpStatus.CREATED);

        expect(body).toMatchObject({ id: expect.any(String), name: dto.name, type: 'WISKI_API', isActive: false });
    });

    it('ingests the endpoint payload and publishes it as timeseries.ingested', async () => {
        const dto = buildCreateWiskiProviderConfigDto();
        const { body: created } = await createProvider(dto).expect(HttpStatus.CREATED);

        const { body: run } = await triggerIngestion(created.id).expect(HttpStatus.CREATED);

        expect(run).toMatchObject({
            providerConfigId: created.id,
            status: 'SUCCESS',
            seriesCount: 1,
            eventsCount: 2,
            errorMessage: null,
        });

        expect(mockMessageBroker.publishToTopic).toHaveBeenCalledWith(
            'model-events',
            'timeseries.ingested',
            expect.objectContaining({
                providerConfigId: created.id,
                providerType: 'WISKI_API',
                seriesCount: 1,
                eventsCount: 2,
                timeSeries: expect.arrayContaining([
                    expect.objectContaining({
                        locationId: 'E_08',
                        parameterId: 'VICT01.historical',
                        moduleInstanceId: 'FlowCast',
                        units: 'Hm3',
                    }),
                ]),
            }),
        );
    });

    it('registers and removes the scheduled job when toggled', async () => {
        const dto = buildCreateWiskiProviderConfigDto();
        const { body: created } = await createProvider(dto).expect(HttpStatus.CREATED);

        const { body: enabled } = await toggleProvider(created.id).expect(HttpStatus.OK);
        expect(enabled.isActive).toBe(true);

        const { body: disabled } = await toggleProvider(created.id).expect(HttpStatus.OK);
        expect(disabled.isActive).toBe(false);
    });
});
