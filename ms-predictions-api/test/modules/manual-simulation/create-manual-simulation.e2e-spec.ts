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
import { SimulationController } from '../../../src/app/api/controllers/simulation.controller';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateManualSimulationDto } from '../../factories/manual-simulation.factory';

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
            controllers: [SimulationController],
            providers: [
                CreateManualSimulationHandler,
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

    // T020: Happy path
    describe('happy path', () => {
        it('should create a manual simulation with maneuvers and return MODEL_PROCESSING status', async () => {
            const dto = buildCreateManualSimulationDto();

            const { body } = await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(body.id).toBeDefined();
            expect(body.status).toBe('MODEL_PROCESSING');
            expect(body.type).toBe('MANUAL');
            expect(body.simulationDate).toBe(dto.simulationDate);
            expect(body.maneuvers).toHaveLength(2);
            expect(body.maneuvers[0].reservoirCode).toBe('E001');
            expect(body.maneuvers[0].outputFlowValue).toBeDefined();
            expect(body.maneuvers[1].reservoirCode).toBe('E002');
        });

        it('should call SFTP service to upload input file', async () => {
            const dto = buildCreateManualSimulationDto();

            await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(mockSftpService.uploadInputFile).toHaveBeenCalledTimes(1);
            const [simulationId, content] = mockSftpService.uploadInputFile.mock.calls[0];
            expect(typeof simulationId).toBe('string');
            expect(content).toBeInstanceOf(Buffer);
        });

        it('should publish simulation.manual.dispatched event', async () => {
            const dto = buildCreateManualSimulationDto();

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
        it('should return 400 when maneuvers array is empty', async () => {
            const dto = buildCreateManualSimulationDto({ maneuvers: [] });

            const { body } = await createManualSimulation(dto).expect(HttpStatus.BAD_REQUEST);
            expect(body).toBeDefined();
        });

        it('should return 400 when outputFlowValue is negative', async () => {
            const dto = buildCreateManualSimulationDto({
                maneuvers: [{ reservoirCode: 'E001', outputFlowValue: -5 }],
            });

            await createManualSimulation(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 400 when simulationDate is missing', async () => {
            const dto = buildCreateManualSimulationDto();
            const { simulationDate: _, ...dtoWithoutDate } = dto;
            void _;

            await createManualSimulation(dtoWithoutDate).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 503 when SFTP upload fails, and simulation remains CREATED', async () => {
            mockSftpService.uploadInputFile.mockRejectedValueOnce(new ProviderError('SFTP connection refused'));

            const dto = buildCreateManualSimulationDto();

            const { body } = await createManualSimulation(dto).expect(HttpStatus.SERVICE_UNAVAILABLE);
            expect(body).toBeDefined();
        });
    });
});
