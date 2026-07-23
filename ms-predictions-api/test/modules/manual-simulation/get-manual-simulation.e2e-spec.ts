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
import { IStationCatalogService } from '../../../src/app/domain/ports/station-catalog-service.port';
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
import { ManeuverController } from '../../../src/app/api/controllers/maneuver.controller';
import { GetManualSimulationByIdHandler } from '../../../src/app/application/queries/manual-simulation.queries';
import { SimulationController } from '../../../src/app/api/controllers/simulation.controller';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateManualSimulationDto, buildCreateManeuverDto } from '../../factories/manual-simulation.factory';

describe('Get Manual Simulation By ID (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockSftpService = {
        uploadInputFile: jest.fn().mockResolvedValue(undefined),
        ensureOutputFolder: jest.fn().mockResolvedValue(undefined),
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

    function getManualById(id: string) {
        return request(app.getHttpServer()).get(`/simulations/manual/${id}`);
    }

    it('should return 200 with maneuvers for an existing MANUAL simulation', async () => {
        const { body: m1 } = await request(app.getHttpServer())
            .post('/maneuvers')
            .send(buildCreateManeuverDto({ reservoirCode: 'E001' }))
            .expect(HttpStatus.CREATED);
        const { body: m2 } = await request(app.getHttpServer())
            .post('/maneuvers')
            .send(buildCreateManeuverDto({ reservoirCode: 'E002' }))
            .expect(HttpStatus.CREATED);

        const dto = buildCreateManualSimulationDto({ maneuverIds: [m1.id, m2.id] });
        const { body: created } = await createManualSimulation(dto).expect(HttpStatus.CREATED);

        const { body } = await getManualById(created.id).expect(HttpStatus.OK);

        expect(body.id).toBe(created.id);
        expect(body.type).toBe('MANUAL');
        expect(body.maneuvers).toHaveLength(2);
        const codes = body.maneuvers.map((m: { reservoirCode: string }) => m.reservoirCode).sort();
        expect(codes).toEqual(['E001', 'E002']);
    });

    it('should return 404 for a non-existent ID', async () => {
        await getManualById('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
    });
});
