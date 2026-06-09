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

describe('Update / Delete / Read ProviderConfig (e2e)', () => {
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

    function updateProviderConfig(id: string, dto: object) {
        return request(app.getHttpServer()).put(`/provider-configs/${id}`).send(dto);
    }

    function toggleProviderConfig(id: string) {
        return request(app.getHttpServer()).patch(`/provider-configs/${id}/toggle`);
    }

    function deleteProviderConfig(id: string) {
        return request(app.getHttpServer()).delete(`/provider-configs/${id}`);
    }

    function listProviderConfigs() {
        return request(app.getHttpServer()).get('/provider-configs');
    }

    function getProviderConfigById(id: string) {
        return request(app.getHttpServer()).get(`/provider-configs/${id}`);
    }

    // ─────────────────────────────────────────────────────────────
    // Update
    // ─────────────────────────────────────────────────────────────

    it('should update polling interval (200)', async () => {
        const dto = buildCreateProviderConfigDto();
        const { body: created } = await createProviderConfig(dto).expect(HttpStatus.CREATED);

        const { body: updated } = await updateProviderConfig(created.id, {
            pollingIntervalMinutes: 120,
        }).expect(HttpStatus.OK);

        expect(updated.pollingIntervalMinutes).toBe(120);
        expect(updated.name).toBe(created.name);
        expect(updated.id).toBe(created.id);
    });

    it('should return 409 when updating name to existing name', async () => {
        const dto1 = buildCreateProviderConfigDto();
        const dto2 = buildCreateProviderConfigDto();

        await createProviderConfig(dto1).expect(HttpStatus.CREATED);
        const { body: second } = await createProviderConfig(dto2).expect(HttpStatus.CREATED);

        await updateProviderConfig(second.id, { name: dto1.name }).expect(HttpStatus.CONFLICT);
    });

    it('should return 404 when updating non-existent provider', async () => {
        await updateProviderConfig('00000000-0000-0000-0000-000000000000', {
            pollingIntervalMinutes: 120,
        }).expect(HttpStatus.NOT_FOUND);
    });

    // ─────────────────────────────────────────────────────────────
    // Toggle
    // ─────────────────────────────────────────────────────────────

    it('should toggle active/inactive (200, verify isActive flipped)', async () => {
        const dto = buildCreateProviderConfigDto();
        const { body: created } = await createProviderConfig(dto).expect(HttpStatus.CREATED);

        expect(created.isActive).toBe(false);

        const { body: toggled } = await toggleProviderConfig(created.id).expect(HttpStatus.OK);

        expect(toggled.isActive).toBe(true);
        expect(toggled.id).toBe(created.id);

        // Toggle back
        const { body: toggledBack } = await toggleProviderConfig(created.id).expect(HttpStatus.OK);

        expect(toggledBack.isActive).toBe(false);
    });

    // ─────────────────────────────────────────────────────────────
    // Delete
    // ─────────────────────────────────────────────────────────────

    it('should delete provider (200) and confirm GET returns 404', async () => {
        const dto = buildCreateProviderConfigDto();
        const { body: created } = await createProviderConfig(dto).expect(HttpStatus.CREATED);

        const { body: deleteResult } = await deleteProviderConfig(created.id).expect(HttpStatus.OK);

        expect(deleteResult.message).toBeDefined();

        await getProviderConfigById(created.id).expect(HttpStatus.NOT_FOUND);
    });

    // ─────────────────────────────────────────────────────────────
    // List
    // ─────────────────────────────────────────────────────────────

    it('should list providers (200, correct count)', async () => {
        const dto1 = buildCreateProviderConfigDto();
        const dto2 = buildCreateProviderConfigDto();

        await createProviderConfig(dto1).expect(HttpStatus.CREATED);
        await createProviderConfig(dto2).expect(HttpStatus.CREATED);

        const { body } = await listProviderConfigs().expect(HttpStatus.OK);

        expect(body.providerConfigs).toHaveLength(2);
    });

    // ─────────────────────────────────────────────────────────────
    // Get by ID
    // ─────────────────────────────────────────────────────────────

    it('should get by id (200)', async () => {
        const dto = buildCreateProviderConfigDto();
        const { body: created } = await createProviderConfig(dto).expect(HttpStatus.CREATED);

        const { body: fetched } = await getProviderConfigById(created.id).expect(HttpStatus.OK);

        expect(fetched.id).toBe(created.id);
        expect(fetched.name).toBe(dto.name);
        expect(fetched.type).toBe(dto.type);
        expect(fetched.baseUrl).toBe(dto.baseUrl);
        expect(fetched.pollingIntervalMinutes).toBe(dto.pollingIntervalMinutes);
    });

    it('should return 404 for non-existent id', async () => {
        await getProviderConfigById('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
    });
});
