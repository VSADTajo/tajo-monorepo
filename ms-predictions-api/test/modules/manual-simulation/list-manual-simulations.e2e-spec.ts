import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { Simulation } from '../../../src/app/domain/entities/simulation.entity';
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
import { ListManualSimulationsHandler } from '../../../src/app/application/queries/manual-simulation.queries';
import { SimulationController } from '../../../src/app/api/controllers/simulation.controller';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateManualSimulationDto } from '../../factories/manual-simulation.factory';

describe('List Manual Simulations (e2e)', () => {
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
                ListManualSimulationsHandler,
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
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    function createManualSimulation(dto: object) {
        return request(app.getHttpServer()).post('/simulations/manual').send(dto);
    }

    function listManualSimulations(query?: object) {
        return request(app.getHttpServer())
            .get('/simulations/manual')
            .query(query || {});
    }

    it('should list only MANUAL simulations', async () => {
        const dto1 = buildCreateManualSimulationDto({ simulationDate: '20260619120000' });
        const dto2 = buildCreateManualSimulationDto({ simulationDate: '20260619130000' });

        await createManualSimulation(dto1).expect(HttpStatus.CREATED);
        await createManualSimulation(dto2).expect(HttpStatus.CREATED);

        const { body } = await listManualSimulations().expect(HttpStatus.OK);

        expect(body.data).toHaveLength(2);
        expect(body.total).toBe(2);
        body.data.forEach((sim: { type: string }) => {
            expect(sim.type).toBe('MANUAL');
        });
    });

    it('should filter by status', async () => {
        await createManualSimulation(buildCreateManualSimulationDto({ simulationDate: '20260619120000' })).expect(
            HttpStatus.CREATED,
        );

        // MODEL_PROCESSING simulations (the default after SFTP upload)
        const { body } = await listManualSimulations({ status: 'MODEL_PROCESSING' }).expect(HttpStatus.OK);

        expect(body.data.length).toBeGreaterThanOrEqual(1);
        body.data.forEach((sim: { status: string }) => {
            expect(sim.status).toBe('MODEL_PROCESSING');
        });
    });

    it('should return empty list when no MANUAL simulations exist', async () => {
        const { body } = await listManualSimulations().expect(HttpStatus.OK);

        expect(body.data).toHaveLength(0);
        expect(body.total).toBe(0);
        expect(body.page).toBe(1);
        expect(body.limit).toBe(20);
    });

    it('should support pagination', async () => {
        await createManualSimulation(buildCreateManualSimulationDto({ simulationDate: '20260619120000' })).expect(
            HttpStatus.CREATED,
        );
        await createManualSimulation(buildCreateManualSimulationDto({ simulationDate: '20260619130000' })).expect(
            HttpStatus.CREATED,
        );
        await createManualSimulation(buildCreateManualSimulationDto({ simulationDate: '20260619140000' })).expect(
            HttpStatus.CREATED,
        );

        const { body } = await listManualSimulations({ page: 1, limit: 2 }).expect(HttpStatus.OK);

        expect(body.data).toHaveLength(2);
        expect(body.total).toBe(3);
        expect(body.page).toBe(1);
        expect(body.limit).toBe(2);
    });
});
