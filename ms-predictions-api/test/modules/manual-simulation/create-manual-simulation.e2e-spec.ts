import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { Simulation } from '../../../src/app/domain/entities/simulation.entity';
import { ProviderError } from '../../../src/app/domain/errors/provider.error';
import { Maneuver } from '../../../src/app/domain/entities/maneuver.entity';
import { Prediction } from '../../../src/app/domain/entities/prediction.entity';
import { PredictionType } from '../../../src/app/domain/entities/prediction-type.entity';
import { PredictionResult } from '../../../src/app/domain/entities/prediction-result.entity';

import { ISimulationRepository } from '../../../src/app/domain/ports/simulation-repository.port';
import { IManeuverRepository } from '../../../src/app/domain/ports/maneuver-repository.port';
import { IPredictionRepository } from '../../../src/app/domain/ports/prediction-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { IMessageBroker } from '../../../src/app/domain/ports/message-broker.port';
import { ISimulationSftpService } from '../../../src/app/domain/ports/simulation-sftp.port';

import { SimulationRepository } from '../../../src/app/infrastructure/persistence/simulation.repository';
import { ManeuverRepository } from '../../../src/app/infrastructure/persistence/maneuver.repository';
import { PredictionRepository } from '../../../src/app/infrastructure/persistence/prediction.repository';

import { CreateManualSimulationHandler } from '../../../src/app/application/commands/manual-simulation.commands';
import {
    CreateManeuverHandler,
    UpdateManeuverHandler,
    DeleteManeuverHandler,
} from '../../../src/app/application/commands/maneuver.commands';
import { SimulationController } from '../../../src/app/api/controllers/simulation.controller';
import { ManeuverController } from '../../../src/app/api/controllers/maneuver.controller';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateManualSimulationDto, buildCreateManeuverDto } from '../../factories/manual-simulation.factory';

describe('Create Manual Simulation (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockSftpService = {
        uploadInputFile: jest.fn().mockResolvedValue(undefined),
    };

    const mockMessageBroker = {
        publish: jest.fn().mockResolvedValue(undefined),
        publishToTopic: jest.fn().mockResolvedValue(undefined),
    };

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [Simulation, Maneuver, Prediction, PredictionType, PredictionResult],
            controllers: [SimulationController, ManeuverController],
            providers: [
                CreateManualSimulationHandler,
                CreateManeuverHandler,
                UpdateManeuverHandler,
                DeleteManeuverHandler,
                { provide: ISimulationRepository, useClass: SimulationRepository },
                { provide: IManeuverRepository, useClass: ManeuverRepository },
                { provide: IPredictionRepository, useClass: PredictionRepository },
                { provide: ISimulationSftpService, useValue: mockSftpService },
                { provide: IMessageBroker, useValue: mockMessageBroker },
                { provide: ICacheService, useValue: mockCacheService },
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
        mockSftpService.uploadInputFile.mockResolvedValue(undefined);
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    function createManualSimulation(dto: object) {
        return request(app.getHttpServer()).post('/simulations/manual').send(dto);
    }

    async function createManeuvers(
        count: number,
        override?: Partial<{ reservoirCode: string; outputFlowValue: number }>,
    ): Promise<string[]> {
        const ids: string[] = [];
        for (let i = 0; i < count; i++) {
            const dto = buildCreateManeuverDto({ reservoirCode: `E${100 + i}`, ...override });
            const { body } = await request(app.getHttpServer()).post('/maneuvers').send(dto).expect(HttpStatus.CREATED);
            ids.push(body.id);
        }
        return ids;
    }

    // T020: Happy path
    describe('happy path', () => {
        it('should create a manual simulation referencing existing maneuvers', async () => {
            const maneuverIds = await createManeuvers(2);
            const dto = buildCreateManualSimulationDto({ maneuverIds });

            const { body } = await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(body.id).toBeDefined();
            expect(body.status).toBe('MODEL_PROCESSING');
            expect(body.type).toBe('MANUAL');
            // simulationDate is auto-generated in YYYYMMDDHHMMSS format
            expect(body.simulationDate).toMatch(/^\d{14}$/);
            expect(body.maneuvers).toHaveLength(2);
            expect(body.maneuvers.map((m: { id: string }) => m.id).sort()).toEqual([...maneuverIds].sort());
        });

        it('should call SFTP service to upload input file', async () => {
            const maneuverIds = await createManeuvers(1);
            const dto = buildCreateManualSimulationDto({ maneuverIds, modmeteo: 'HARMONIE' });

            await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(mockSftpService.uploadInputFile).toHaveBeenCalledTimes(1);
            const [simulationId, fileName, content] = mockSftpService.uploadInputFile.mock.calls[0];
            expect(typeof simulationId).toBe('string');
            expect(fileName).toMatch(/^tagus_harmonie_Q_\d{12}\.json$/);
            expect(content).toBeInstanceOf(Buffer);
        });

        it('should call SFTP service once per modmeteo when BOTH is requested', async () => {
            const maneuverIds = await createManeuvers(1);
            const dto = buildCreateManualSimulationDto({ maneuverIds, modmeteo: 'BOTH' });

            await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(mockSftpService.uploadInputFile).toHaveBeenCalledTimes(2);
            const tags = mockSftpService.uploadInputFile.mock.calls.map((call) => call[1]);
            expect(tags).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/^tagus_harmonie_Q_\d{12}\.json$/),
                    expect.stringMatching(/^tagus_eps_Q_\d{12}\.json$/),
                ]),
            );
        });

        it('should publish simulation.manual.dispatched event', async () => {
            const maneuverIds = await createManeuvers(1);
            const dto = buildCreateManualSimulationDto({ maneuverIds });

            const { body } = await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(mockMessageBroker.publishToTopic).toHaveBeenCalledTimes(1);
            const [exchange, routingKey, payload] = mockMessageBroker.publishToTopic.mock.calls[0];
            expect(exchange).toBe('simulation-events');
            expect(routingKey).toBe('simulation.manual.dispatched');
            expect(payload.simulationId).toBe(body.id);
            expect(payload.outputFolder).toContain(body.id);
        });
    });

    // T021: Validation errors
    describe('validation errors', () => {
        it('should return 400 when maneuverIds array is empty', async () => {
            const dto = buildCreateManualSimulationDto({ maneuverIds: [] });

            const { body } = await createManualSimulation(dto).expect(HttpStatus.BAD_REQUEST);
            expect(body).toBeDefined();
        });

        it('should return 400 (not 500) when a maneuverId is not a valid UUID', async () => {
            const dto = buildCreateManualSimulationDto({ maneuverIds: ['not-a-uuid'] });

            await createManualSimulation(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 404 when a referenced maneuverId does not exist', async () => {
            const dto = buildCreateManualSimulationDto({
                maneuverIds: ['00000000-0000-0000-0000-000000000000'],
            });

            await createManualSimulation(dto).expect(HttpStatus.NOT_FOUND);
        });

        it('should return 503 when SFTP upload fails, and simulation remains CREATED', async () => {
            mockSftpService.uploadInputFile.mockRejectedValueOnce(new ProviderError('SFTP connection refused'));
            const maneuverIds = await createManeuvers(1);

            const dto = buildCreateManualSimulationDto({ maneuverIds });

            const { body } = await createManualSimulation(dto).expect(HttpStatus.SERVICE_UNAVAILABLE);
            expect(body).toBeDefined();
        });
    });
});
