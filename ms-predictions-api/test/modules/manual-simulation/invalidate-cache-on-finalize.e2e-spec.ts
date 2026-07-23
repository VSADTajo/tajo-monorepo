/**
 * ─────────────────────────────────────────────────────────────────────────────
 * REGRESSION TEST — cache invalidation on simulation status change (finalize).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every other e2e in this repo mocks ICacheService with `get -> null`, which makes
 * the cache transparent and therefore BLIND to cache-invalidation bugs (a stale
 * read can never happen when nothing is ever cached). This spec is the exception:
 * it boots a REAL Redis as a Testcontainer and exercises the genuine
 * RedisCacheService, so it can actually reproduce the stale-read bug.
 *
 * The bug: finalizing a MANUAL simulation only cleared the `simulations:*`
 * namespace, leaving `manual-simulation:{id}` serving the pre-finalize status, so
 * GET /simulations/manual/:id kept returning the stale status after finalize.
 *
 * This test fails on the buggy code and passes on the fix. To see it catch the
 * bug, revert the invalidation loop in FinalizeSimulationHandler back to a single
 * `delByPattern(SimulationCacheKeys.pattern())` and re-run.
 *
 * Self-contained: spins up its own Postgres + Redis Testcontainers (needs Docker).
 * Run: npm run test:e2e -- --testPathPattern=invalidate-cache-on-finalize
 */
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

import { Simulation } from '../../../src/app/domain/entities/simulation.entity';
import { Maneuver } from '../../../src/app/domain/entities/maneuver.entity';
import { Prediction } from '../../../src/app/domain/entities/prediction.entity';
import { PredictionType } from '../../../src/app/domain/entities/prediction-type.entity';
import { PredictionResult } from '../../../src/app/domain/entities/prediction-result.entity';

import { ISimulationRepository } from '../../../src/app/domain/ports/simulation-repository.port';
import { IManeuverRepository } from '../../../src/app/domain/ports/maneuver-repository.port';
import { IPredictionRepository } from '../../../src/app/domain/ports/prediction-repository.port';
import { IStationCatalogService } from '../../../src/app/domain/ports/station-catalog-service.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { IMessageBroker } from '../../../src/app/domain/ports/message-broker.port';
import { ISimulationSftpService } from '../../../src/app/domain/ports/simulation-sftp.port';

import { SimulationRepository } from '../../../src/app/infrastructure/persistence/simulation.repository';
import { ManeuverRepository } from '../../../src/app/infrastructure/persistence/maneuver.repository';
import { PredictionRepository } from '../../../src/app/infrastructure/persistence/prediction.repository';
import { RedisCacheService } from '../../../src/app/infrastructure/services/redis-cache.service';
import { RedisConfigService } from '../../../src/configuration/redis/redis-config.service';
import {
    ManualSimulationCacheKeys,
    SimulationCacheKeys,
} from '../../../src/app/infrastructure/cache/cache-config.registry';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { CreateManualSimulationHandler } from '../../../src/app/application/commands/manual-simulation.commands';
import { FinalizeSimulationHandler } from '../../../src/app/application/commands/simulation.commands';
import {
    CreateManeuverHandler,
    UpdateManeuverHandler,
    DeleteManeuverHandler,
} from '../../../src/app/application/commands/maneuver.commands';
import { ManeuverController } from '../../../src/app/api/controllers/maneuver.controller';
import { GetManualSimulationByIdHandler } from '../../../src/app/application/queries/manual-simulation.queries';
import { SimulationController } from '../../../src/app/api/controllers/simulation.controller';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateManualSimulationDto, buildCreateManeuverDto } from '../../factories/manual-simulation.factory';

describe('Cache invalidation on simulation status change — REAL Redis (regression)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let redisContainer: StartedTestContainer;
    let redisCache: ICacheService;

    const mockSftpService = {
        uploadInputFile: jest.fn().mockResolvedValue(undefined),
        ensureOutputFolder: jest.fn().mockResolvedValue(undefined),
    };

    const mockMessageBroker = {
        publish: jest.fn().mockResolvedValue(undefined),
        publishToTopic: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        // 1. Boot a real Redis next to the Postgres container the helper starts.
        redisContainer = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();

        const redisConfigStub = {
            host: redisContainer.getHost(),
            port: redisContainer.getMappedPort(6379),
            defaultTtl: 300,
        };

        const ctx: TestContext = await createTestApp({
            entities: [Simulation, Maneuver, Prediction, PredictionType, PredictionResult],
            controllers: [SimulationController, ManeuverController],
            providers: [
                CreateManualSimulationHandler,
                FinalizeSimulationHandler,
                CreateManeuverHandler,
                UpdateManeuverHandler,
                DeleteManeuverHandler,
                GetManualSimulationByIdHandler,
                { provide: ISimulationRepository, useClass: SimulationRepository },
                { provide: IManeuverRepository, useClass: ManeuverRepository },
                { provide: IPredictionRepository, useClass: PredictionRepository },
                {
                    provide: IStationCatalogService,
                    useValue: { listStations: async () => [], listFullStations: async () => [] },
                },
                { provide: ISimulationSftpService, useValue: mockSftpService },
                { provide: IMessageBroker, useValue: mockMessageBroker },
                // REAL cache backed by the Redis container (not the no-op mock).
                { provide: RedisConfigService, useValue: redisConfigStub },
                { provide: ICacheService, useClass: RedisCacheService },
                CachingQueryBus,
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
        redisCache = app.get(ICacheService);
    }, 120_000);

    afterEach(async () => {
        await redisCache.delByPattern(SimulationCacheKeys.pattern());
        await redisCache.delByPattern(ManualSimulationCacheKeys.pattern());
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
        await redisContainer.stop();
    });

    function createManeuver(reservoirCode: string) {
        return request(app.getHttpServer()).post('/maneuvers').send(buildCreateManeuverDto({ reservoirCode }));
    }

    function createManualSimulation(dto: object) {
        return request(app.getHttpServer()).post('/simulations/manual').send(dto);
    }

    function getManualById(id: string) {
        return request(app.getHttpServer()).get(`/simulations/manual/${id}`);
    }

    function finalize(id: string) {
        return request(app.getHttpServer()).patch(`/simulations/${id}/finalize`);
    }

    it('serves a fresh status from GET /simulations/manual/:id after finalize (no stale cache)', async () => {
        // Arrange: a MANUAL simulation lands in MODEL_PROCESSING.
        const { body: m1 } = await createManeuver('E001').expect(HttpStatus.CREATED);
        const dto = buildCreateManualSimulationDto({ maneuverIds: [m1.id] });
        const { body: created } = await createManualSimulation(dto).expect(HttpStatus.CREATED);

        // Prime the manual-simulation:{id} cache namespace.
        const before = await getManualById(created.id).expect(HttpStatus.OK);
        expect(before.body.status).toBe('MODEL_PROCESSING');

        // Sanity: the real cache actually retained the entry (otherwise this whole
        // test would be a false green — a transparent cache can never go stale).
        const cachedRaw = await redisCache.get(ManualSimulationCacheKeys.byId(created.id));
        expect(cachedRaw).not.toBeNull();

        // Act: finalize. This is the exact flow the reporter ran.
        await finalize(created.id).expect(HttpStatus.OK);

        // Assert (direct): the manual namespace key was invalidated in Redis.
        const afterInvalidation = await redisCache.get(ManualSimulationCacheKeys.byId(created.id));
        expect(afterInvalidation).toBeNull();

        // Assert (end-to-end via HTTP): the GET now reflects FINALIZED, not the
        // pre-finalize MODEL_PROCESSING the buggy code kept serving.
        const after = await getManualById(created.id).expect(HttpStatus.OK);
        expect(after.body.status).toBe('FINALIZED');
    });
});
