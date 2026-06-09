import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Entities
import { ProviderConfig } from '../../../src/app/domain/entities/provider-config.entity';
import { IngestionRun } from '../../../src/app/domain/entities/ingestion-run.entity';

// Ports
import { IProviderConfigRepository } from '../../../src/app/domain/ports/provider-config-repository.port';
import { IIngestionRunRepository } from '../../../src/app/domain/ports/ingestion-run-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { IMessageBroker } from '../../../src/app/domain/ports/message-broker.port';

// Infrastructure
import { ProviderConfigRepository } from '../../../src/app/infrastructure/persistence/provider-config.repository';
import { IngestionRunRepository } from '../../../src/app/infrastructure/persistence/ingestion-run.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';
import { ProviderSchedulerService } from '../../../src/app/infrastructure/services/provider-scheduler.service';

// Handlers
import {
    CreateProviderConfigHandler,
    UpdateProviderConfigHandler,
    DeleteProviderConfigHandler,
    ToggleProviderConfigHandler,
} from '../../../src/app/application/commands/provider-config.commands';
import {
    ListProviderConfigsHandler,
    GetProviderConfigByIdHandler,
} from '../../../src/app/application/queries/provider-config.queries';

// Controller
import { ProviderConfigController } from '../../../src/app/api/controllers/provider-config.controller';

// Helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateProviderConfigDto } from '../../factories/provider-config.factory';

describe('Create ProviderConfig (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

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

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [ProviderConfig, IngestionRun],
            controllers: [ProviderConfigController],
            providers: [
                CreateProviderConfigHandler,
                UpdateProviderConfigHandler,
                DeleteProviderConfigHandler,
                ToggleProviderConfigHandler,
                ListProviderConfigsHandler,
                GetProviderConfigByIdHandler,
                { provide: IProviderConfigRepository, useClass: ProviderConfigRepository },
                { provide: IIngestionRunRepository, useClass: IngestionRunRepository },
                { provide: ICacheService, useValue: mockCacheService },
                { provide: IMessageBroker, useValue: mockMessageBroker },
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

    // Helper functions — NOT async, return supertest Test object
    function createProviderConfig(dto: object) {
        return request(app.getHttpServer()).post('/provider-configs').send(dto);
    }

    function getProviderConfigById(id: string) {
        return request(app.getHttpServer()).get(`/provider-configs/${id}`);
    }

    // ─────────────────────────────────────────────────────────────
    // Tests
    // ─────────────────────────────────────────────────────────────

    it('should create a FEWS_API provider (201) and verify via GET', async () => {
        const dto = buildCreateProviderConfigDto({ type: 'FEWS_API' });

        const { body: created } = await createProviderConfig(dto).expect(HttpStatus.CREATED);

        expect(created.id).toBeDefined();
        expect(created.name).toBe(dto.name);
        expect(created.type).toBe('FEWS_API');
        expect(created.baseUrl).toBe(dto.baseUrl);
        expect(created.pollingIntervalMinutes).toBe(dto.pollingIntervalMinutes);
        expect(created.isActive).toBe(false);
        expect(created.settings).toEqual(dto.settings);
        expect(created.createdAt).toBeDefined();
        expect(created.updatedAt).toBeDefined();

        // Verify via GET
        const { body: fetched } = await getProviderConfigById(created.id).expect(HttpStatus.OK);

        expect(fetched.id).toBe(created.id);
        expect(fetched.name).toBe(dto.name);
        expect(fetched.type).toBe('FEWS_API');
    });

    it('should create an SFTP_FILE provider (201)', async () => {
        const dto = buildCreateProviderConfigDto({ type: 'SFTP_FILE' });

        const { body: created } = await createProviderConfig(dto).expect(HttpStatus.CREATED);

        expect(created.id).toBeDefined();
        expect(created.type).toBe('SFTP_FILE');
        expect(created.name).toBe(dto.name);
        expect(created.isActive).toBe(false);
    });

    it('should return 409 when creating with duplicate name', async () => {
        const dto = buildCreateProviderConfigDto();

        await createProviderConfig(dto).expect(HttpStatus.CREATED);

        const duplicateDto = buildCreateProviderConfigDto({ name: dto.name });

        await createProviderConfig(duplicateDto).expect(HttpStatus.CONFLICT);
    });

    it('should return 400 when baseUrl is invalid (non-URL string)', async () => {
        const dto = buildCreateProviderConfigDto({ baseUrl: 'not-a-valid-url' });

        await createProviderConfig(dto).expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when pollingIntervalMinutes < 5', async () => {
        const dto = buildCreateProviderConfigDto({ pollingIntervalMinutes: 3 });

        await createProviderConfig(dto).expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when required fields are missing', async () => {
        await createProviderConfig({}).expect(HttpStatus.BAD_REQUEST);
    });
});
