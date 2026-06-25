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
import { DeleteSimulationHandler } from '../../../src/app/application/commands/simulation.commands';
import { CreateManeuverHandler } from '../../../src/app/application/commands/maneuver.commands';
import { GetManualSimulationByIdHandler } from '../../../src/app/application/queries/manual-simulation.queries';
import { GetManeuverByIdHandler } from '../../../src/app/application/queries/maneuver.queries';
import { SimulationController } from '../../../src/app/api/controllers/simulation.controller';
import { ManeuverController } from '../../../src/app/api/controllers/maneuver.controller';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateManualSimulationDto, buildCreateManeuverDto } from '../../factories/manual-simulation.factory';

describe('Delete Simulation — soft delete + exclusive maneuvers (e2e)', () => {
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
                DeleteSimulationHandler,
                CreateManeuverHandler,
                GetManualSimulationByIdHandler,
                GetManeuverByIdHandler,
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

    function createManeuver(reservoirCode: string) {
        return request(app.getHttpServer()).post('/maneuvers').send(buildCreateManeuverDto({ reservoirCode }));
    }

    function createManualSimulation(maneuverIds: string[]) {
        return request(app.getHttpServer())
            .post('/simulations/manual')
            .send(buildCreateManualSimulationDto({ maneuverIds }));
    }

    function deleteSimulation(id: string) {
        return request(app.getHttpServer()).delete(`/simulations/${id}`);
    }

    function getManualById(id: string) {
        return request(app.getHttpServer()).get(`/simulations/manual/${id}`);
    }

    function getManeuverById(id: string) {
        return request(app.getHttpServer()).get(`/maneuvers/${id}`);
    }

    it('soft-deletes the simulation and its exclusive maneuver, hiding both from GET', async () => {
        const { body: maneuver } = await createManeuver('E001').expect(HttpStatus.CREATED);
        const { body: sim } = await createManualSimulation([maneuver.id]).expect(HttpStatus.CREATED);

        const { body: deleted } = await deleteSimulation(sim.id).expect(HttpStatus.OK);
        expect(deleted).toEqual({ id: sim.id, deleted: true, deletedManeuvers: 1 });

        // The simulation no longer surfaces…
        await getManualById(sim.id).expect(HttpStatus.NOT_FOUND);
        // …and neither does the maneuver that belonged only to it.
        await getManeuverById(maneuver.id).expect(HttpStatus.NOT_FOUND);
    });

    it('keeps a maneuver that is still shared with another live simulation', async () => {
        const { body: shared } = await createManeuver('E002').expect(HttpStatus.CREATED);
        const { body: simA } = await createManualSimulation([shared.id]).expect(HttpStatus.CREATED);
        const { body: simB } = await createManualSimulation([shared.id]).expect(HttpStatus.CREATED);

        const { body: deleted } = await deleteSimulation(simA.id).expect(HttpStatus.OK);
        expect(deleted.deletedManeuvers).toBe(0);

        // simA is gone, simB stays, and the shared maneuver is untouched.
        await getManualById(simA.id).expect(HttpStatus.NOT_FOUND);
        await getManualById(simB.id).expect(HttpStatus.OK);
        await getManeuverById(shared.id).expect(HttpStatus.OK);
    });

    it('returns 404 when deleting a simulation that does not exist', async () => {
        await deleteSimulation('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
    });

    it('returns 404 when deleting an already-deleted simulation', async () => {
        const { body: maneuver } = await createManeuver('E003').expect(HttpStatus.CREATED);
        const { body: sim } = await createManualSimulation([maneuver.id]).expect(HttpStatus.CREATED);

        await deleteSimulation(sim.id).expect(HttpStatus.OK);
        await deleteSimulation(sim.id).expect(HttpStatus.NOT_FOUND);
    });
});
