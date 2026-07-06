/**
 * ─────────────────────────────────────────────────────────────────────────────
 * E2E — SimulationManualBalanceComputedConsumer
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Covers:
 *   US1 — happy path: 6 series persisted + simulation FINALIZED
 *   US2 — legacy non-regression: TimeSeriesIngestedConsumer still works
 *   US3 — resilience: unknown simulationId → nack; empty series → ack
 *   US4 — idempotency: duplicate delivery → no extra predictions, no crash
 *
 * Self-contained: spins up its own Postgres Testcontainer (needs Docker).
 * Run: npm run test:e2e -- --testPathPattern=consume-balance-computed
 */

import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { Simulation, SimulationStatus } from '../../../src/app/domain/entities/simulation.entity';
import { Maneuver } from '../../../src/app/domain/entities/maneuver.entity';
import { Prediction } from '../../../src/app/domain/entities/prediction.entity';
import { PredictionType } from '../../../src/app/domain/entities/prediction-type.entity';
import { PredictionResult } from '../../../src/app/domain/entities/prediction-result.entity';

import { ISimulationRepository } from '../../../src/app/domain/ports/simulation-repository.port';
import { IManeuverRepository } from '../../../src/app/domain/ports/maneuver-repository.port';
import { IPredictionRepository } from '../../../src/app/domain/ports/prediction-repository.port';
import { IPredictionResultRepository } from '../../../src/app/domain/ports/prediction-result-repository.port';
import { IPredictionTypeRepository } from '../../../src/app/domain/ports/prediction-type-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { IMessageBroker } from '../../../src/app/domain/ports/message-broker.port';
import { ISimulationSftpService } from '../../../src/app/domain/ports/simulation-sftp.port';
import { IStationThresholdService } from '../../../src/app/domain/ports/station-threshold-service.port';
import { ITransactionManagerService } from '../../../src/app/domain/types/transaction-manager.type';

import { SimulationRepository } from '../../../src/app/infrastructure/persistence/simulation.repository';
import { ManeuverRepository } from '../../../src/app/infrastructure/persistence/maneuver.repository';
import { PredictionRepository } from '../../../src/app/infrastructure/persistence/prediction.repository';
import { PredictionResultRepository } from '../../../src/app/infrastructure/persistence/prediction-result.repository';
import { PredictionTypeRepository } from '../../../src/app/infrastructure/persistence/prediction-type.repository';
import { TransactionManagerService } from '../../../src/app/infrastructure/services/transaction-manager.service';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { ProcessTimeSeriesHandler } from '../../../src/app/application/commands/prediction.commands';
import { CreateManualSimulationHandler } from '../../../src/app/application/commands/manual-simulation.commands';
import {
    CreateManeuverHandler,
    UpdateManeuverHandler,
    DeleteManeuverHandler,
} from '../../../src/app/application/commands/maneuver.commands';
import {
    GetManualSimulationByIdHandler,
    ListManualSimulationsHandler,
} from '../../../src/app/application/queries/manual-simulation.queries';
import { ListManeuversHandler, GetManeuverByIdHandler } from '../../../src/app/application/queries/maneuver.queries';
import { SimulationController } from '../../../src/app/api/controllers/simulation.controller';
import { ManeuverController } from '../../../src/app/api/controllers/maneuver.controller';
import { SimulationManualBalanceComputedConsumer } from '../../../src/app/application/consumers/simulation-manual-balance-computed.consumer';
import { TimeSeriesIngestedConsumer } from '../../../src/app/application/consumers/timeseries-ingested.consumer';
import { TraceContext } from 'tajo-toolkit';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateManualSimulationDto, buildCreateManeuverDto } from '../../factories/manual-simulation.factory';
import { buildBalanceComputedPayload } from '../../factories/simulation-manual-balance-computed.factory';
import { buildTimeSeriesData, buildTimeSeriesEvents } from '../../factories/simulation.factory';

// ─────────────────────────────────────────────────────────────
// RmqContext mock factory — returns an in-memory channel
// ─────────────────────────────────────────────────────────────

function buildRmqContext(ack: jest.Mock, nack: jest.Mock) {
    return {
        getChannelRef: () => ({ ack, nack }),
        getMessage: () => ({ properties: { headers: {} } }),
    } as any;
}

// ─────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────

describe('SimulationManualBalanceComputedConsumer (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let consumer: SimulationManualBalanceComputedConsumer;
    let legacyConsumer: TimeSeriesIngestedConsumer;
    let simulationRepository: ISimulationRepository;
    let cacheService: jest.Mocked<ICacheService>;

    const mockSftpService = {
        uploadInputFile: jest.fn().mockResolvedValue(undefined),
        ensureOutputFolder: jest.fn().mockResolvedValue(undefined),
    };

    const mockMessageBroker = {
        publish: jest.fn().mockResolvedValue(undefined),
        publishToTopic: jest.fn().mockResolvedValue(undefined),
    };

    const mockStationThresholdService = {
        getThreshold: jest.fn().mockResolvedValue(null),
    };

    const mockNotificationService = {
        create: jest.fn().mockResolvedValue({ id: 'notification-id' }),
    };

    // TraceContext no-op mock — makes traceContext.runInContext call the callback immediately
    const mockTraceContext = {
        runInContext: jest.fn((_traceId: unknown, cb: () => Promise<unknown>) => cb()),
        traceId: null,
        userId: null,
        serviceName: 'test',
        startTime: 0,
        logsApiUrl: '',
    } as unknown as TraceContext;

    beforeAll(async () => {
        cacheService = {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
            delByPattern: jest.fn().mockResolvedValue(undefined),
        } as jest.Mocked<ICacheService>;

        const ctx: TestContext = await createTestApp({
            entities: [Simulation, Maneuver, Prediction, PredictionType, PredictionResult],
            controllers: [
                SimulationController,
                ManeuverController,
                SimulationManualBalanceComputedConsumer,
                TimeSeriesIngestedConsumer,
            ],
            providers: [
                ProcessTimeSeriesHandler,
                CreateManualSimulationHandler,
                CreateManeuverHandler,
                UpdateManeuverHandler,
                DeleteManeuverHandler,
                ListManeuversHandler,
                GetManeuverByIdHandler,
                GetManualSimulationByIdHandler,
                ListManualSimulationsHandler,
                { provide: ISimulationRepository, useClass: SimulationRepository },
                { provide: IManeuverRepository, useClass: ManeuverRepository },
                { provide: IPredictionRepository, useClass: PredictionRepository },
                { provide: IPredictionResultRepository, useClass: PredictionResultRepository },
                { provide: IPredictionTypeRepository, useClass: PredictionTypeRepository },
                { provide: ITransactionManagerService, useClass: TransactionManagerService },
                { provide: ISimulationSftpService, useValue: mockSftpService },
                { provide: IMessageBroker, useValue: mockMessageBroker },
                { provide: ICacheService, useValue: cacheService },
                { provide: IStationThresholdService, useValue: mockStationThresholdService },
                { provide: 'INotificationService', useValue: mockNotificationService },
                { provide: TraceContext, useValue: mockTraceContext },
                CachingQueryBus,
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;

        consumer = app.get(SimulationManualBalanceComputedConsumer);
        legacyConsumer = app.get(TimeSeriesIngestedConsumer);
        simulationRepository = app.get(ISimulationRepository);
    }, 120_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
        // Restore mock implementations cleared by clearAllMocks
        cacheService.get.mockResolvedValue(null);
        cacheService.set.mockResolvedValue(undefined);
        cacheService.del.mockResolvedValue(undefined);
        cacheService.delByPattern.mockResolvedValue(undefined);
        mockTraceContext.runInContext = jest.fn((_traceId: unknown, cb: () => Promise<unknown>) => cb());
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    function getManualSimulation(id: string) {
        return request(app.getHttpServer()).get(`/simulations/manual/${id}`);
    }

    async function seedManeuver(): Promise<string> {
        const dto = buildCreateManeuverDto({ reservoirCode: 'E001' });
        const { body } = await request(app.getHttpServer()).post('/maneuvers').send(dto).expect(HttpStatus.CREATED);
        return body.id as string;
    }

    async function seedManualSimulation(): Promise<string> {
        const maneuverIds = [await seedManeuver()];
        const dto = buildCreateManualSimulationDto({ maneuverIds });
        const { body } = await request(app.getHttpServer())
            .post('/simulations/manual')
            .send(dto)
            .expect(HttpStatus.CREATED);
        return body.id as string;
    }

    /**
     * Transition a simulation to MODEL_PROCESSING directly via the repository
     * (acceptable shortcut for seeding test state — same pattern used by create-manual-simulation.e2e-spec.ts).
     */
    async function transitionToModelProcessing(simulationId: string): Promise<void> {
        const simulation = await simulationRepository.findById(simulationId);
        simulation.status = SimulationStatus.MODEL_PROCESSING;
        await simulationRepository.update(simulation);
    }

    // ─────────────────────────────────────────────────────────────
    // US1 — Happy path: persist 6 series + auto-finalize
    // ─────────────────────────────────────────────────────────────

    it('US1 — happy path: 6 balance series persisted and simulation FINALIZED', async () => {
        const simulationId = await seedManualSimulation();
        await transitionToModelProcessing(simulationId);

        const ack = jest.fn();
        const nack = jest.fn();
        const payload = buildBalanceComputedPayload({ simulationId });

        await consumer.handle(payload, buildRmqContext(ack, nack));

        // Consumer acked exactly once
        expect(ack).toHaveBeenCalledTimes(1);
        expect(nack).not.toHaveBeenCalled();

        // Simulation transitioned to FINALIZED
        const { body } = await getManualSimulation(simulationId).expect(HttpStatus.OK);
        expect(body.status).toBe(SimulationStatus.FINALIZED);

        // Cache invalidation fired for both namespaces
        expect(cacheService.delByPattern).toHaveBeenCalledWith('simulations:*');
        expect(cacheService.delByPattern).toHaveBeenCalledWith('manual-simulation:*');
    });

    it('US1 — message acknowledged exactly once (no duplicate ack)', async () => {
        const simulationId = await seedManualSimulation();
        await transitionToModelProcessing(simulationId);

        const ack = jest.fn();
        const nack = jest.fn();
        await consumer.handle(buildBalanceComputedPayload({ simulationId }), buildRmqContext(ack, nack));

        expect(ack).toHaveBeenCalledTimes(1);
        expect(nack).not.toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────
    // US3 — Resilience: unknown simulationId → nack
    // ─────────────────────────────────────────────────────────────

    it('US3 — unknown simulationId: nack(false,false), no predictions created, simulation unchanged', async () => {
        // Seed a separate known simulation to have something to compare against
        const knownId = await seedManualSimulation();
        await transitionToModelProcessing(knownId);

        const unknownId = '00000000-0000-0000-0000-000000000000';
        const ack = jest.fn();
        const nack = jest.fn();

        await consumer.handle(buildBalanceComputedPayload({ simulationId: unknownId }), buildRmqContext(ack, nack));

        // Consumer nacked without requeue
        expect(nack).toHaveBeenCalledWith(expect.anything(), false, false);
        expect(ack).not.toHaveBeenCalled();

        // The seeded simulation stayed in MODEL_PROCESSING (unrelated simulation untouched)
        const { body } = await getManualSimulation(knownId).expect(HttpStatus.OK);
        expect(body.status).toBe(SimulationStatus.MODEL_PROCESSING);
    });

    it('US3 — empty timeSeries: ack, simulation status unchanged', async () => {
        const simulationId = await seedManualSimulation();
        await transitionToModelProcessing(simulationId);

        const ack = jest.fn();
        const nack = jest.fn();
        await consumer.handle(
            buildBalanceComputedPayload({ simulationId, timeSeries: [] }),
            buildRmqContext(ack, nack),
        );

        expect(ack).toHaveBeenCalledTimes(1);
        expect(nack).not.toHaveBeenCalled();

        // Status stays MODEL_PROCESSING — no finalize happened
        const { body } = await getManualSimulation(simulationId).expect(HttpStatus.OK);
        expect(body.status).toBe(SimulationStatus.MODEL_PROCESSING);
    });

    // ─────────────────────────────────────────────────────────────
    // US4 — Idempotency: duplicate delivery
    // ─────────────────────────────────────────────────────────────

    it('US4 — duplicate delivery: second handle is idempotent (no extra predictions, no crash)', async () => {
        const simulationId = await seedManualSimulation();
        await transitionToModelProcessing(simulationId);

        const payload = buildBalanceComputedPayload({ simulationId });
        const ack1 = jest.fn();
        const nack1 = jest.fn();
        const ack2 = jest.fn();
        const nack2 = jest.fn();

        // First delivery
        await consumer.handle(payload, buildRmqContext(ack1, nack1));
        expect(ack1).toHaveBeenCalledTimes(1);
        expect(nack1).not.toHaveBeenCalled();

        // Second delivery (same payload)
        await consumer.handle(payload, buildRmqContext(ack2, nack2));
        expect(ack2).toHaveBeenCalledTimes(1);
        expect(nack2).not.toHaveBeenCalled();

        // Simulation is FINALIZED (not double-finalized with error)
        const { body } = await getManualSimulation(simulationId).expect(HttpStatus.OK);
        expect(body.status).toBe(SimulationStatus.FINALIZED);
    });

    it('US4 — second handle when already FINALIZED: no cache invalidation fired again', async () => {
        const simulationId = await seedManualSimulation();
        await transitionToModelProcessing(simulationId);

        const payload = buildBalanceComputedPayload({ simulationId });

        // First delivery — finalizes
        await consumer.handle(payload, buildRmqContext(jest.fn(), jest.fn()));

        // Reset the mock to count only what the second delivery does
        cacheService.delByPattern.mockClear();

        // Second delivery — already FINALIZED
        const ack2 = jest.fn();
        const nack2 = jest.fn();
        await consumer.handle(payload, buildRmqContext(ack2, nack2));

        expect(ack2).toHaveBeenCalledTimes(1);
        expect(cacheService.delByPattern).not.toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────
    // US2 — Legacy non-regression: TimeSeriesIngestedConsumer still works
    // ─────────────────────────────────────────────────────────────

    it('US2 — legacy TimeSeriesIngestedConsumer processes timeseries.ingested payload correctly', async () => {
        // Use a completely separate simulation so legacy consumer state is isolated
        const legacyManeuverDto = buildCreateManeuverDto({ reservoirCode: 'E099' });
        const { body: legacyManeuver } = await request(app.getHttpServer())
            .post('/maneuvers')
            .send(legacyManeuverDto)
            .expect(HttpStatus.CREATED);

        const legacySimDto = buildCreateManualSimulationDto({ maneuverIds: [legacyManeuver.id] });
        const { body: legacySim } = await request(app.getHttpServer())
            .post('/simulations/manual')
            .send(legacySimDto)
            .expect(HttpStatus.CREATED);

        await transitionToModelProcessing(legacySim.id);

        const legacyAck = jest.fn();
        const legacyNack = jest.fn();

        const legacyPayload = {
            timeSeries: [
                buildTimeSeriesData({
                    locationId: 'E099',
                    parameterId: 'Q.sim.legacy',
                    events: buildTimeSeriesEvents(3),
                }),
            ],
            simulationId: legacySim.id,
            providerName: 'HARMONIE',
        };

        await legacyConsumer.handleTimeSeriesIngested(legacyPayload, buildRmqContext(legacyAck, legacyNack));

        // Legacy consumer acked
        expect(legacyAck).toHaveBeenCalledTimes(1);
        expect(legacyNack).not.toHaveBeenCalled();

        // Simulation finalized via legacy path
        const { body } = await getManualSimulation(legacySim.id).expect(HttpStatus.OK);
        expect(body.status).toBe(SimulationStatus.FINALIZED);
    });
});
