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
import { SimulationFileDownloadResult } from '../../../src/app/domain/results/simulation-files.result';

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
import {
    GetSimulationFilesHandler,
    DownloadSimulationFileHandler,
} from '../../../src/app/application/queries/simulation.queries';
import { SimulationController } from '../../../src/app/api/controllers/simulation.controller';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateManualSimulationDto, buildCreateManeuverDto } from '../../factories/manual-simulation.factory';

const VALID_BUT_MISSING_ID = '11111111-1111-4111-8111-111111111111';

describe('Simulation SFTP Files (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockSftpService = {
        uploadInputFile: jest.fn().mockResolvedValue(undefined),
        ensureOutputFolder: jest.fn().mockResolvedValue(undefined),
        listFiles: jest.fn().mockResolvedValue({
            input: [{ name: 'input.json', size: 120, modifiedAt: '2026-06-19T12:00:00.000Z' }],
            output: [{ name: 'result.json', size: 240, modifiedAt: '2026-06-19T13:00:00.000Z' }],
        }),
        downloadFile: jest.fn().mockResolvedValue(
            new SimulationFileDownloadResult({
                content: Buffer.from('{"ok":true}'),
                fileName: 'input.json',
                contentType: 'application/json',
            }),
        ),
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
                GetSimulationFilesHandler,
                DownloadSimulationFileHandler,
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

    async function createSimulation(): Promise<string> {
        const { body: maneuver } = await request(app.getHttpServer())
            .post('/maneuvers')
            .send(buildCreateManeuverDto({ reservoirCode: 'E001' }))
            .expect(HttpStatus.CREATED);
        const dto = buildCreateManualSimulationDto({ maneuverIds: [maneuver.id] });
        const { body: created } = await request(app.getHttpServer())
            .post('/simulations/manual')
            .send(dto)
            .expect(HttpStatus.CREATED);
        return created.id;
    }

    describe('GET /simulations/:id/files', () => {
        it('should list input and output files for an existing simulation', async () => {
            const id = await createSimulation();

            const { body } = await request(app.getHttpServer()).get(`/simulations/${id}/files`).expect(HttpStatus.OK);

            expect(body.input).toHaveLength(1);
            expect(body.output).toHaveLength(1);
            expect(body.input[0].name).toBe('input.json');
            expect(mockSftpService.listFiles).toHaveBeenCalledWith(id);
        });

        it('should return 400 for a non-UUID id', async () => {
            await request(app.getHttpServer()).get('/simulations/not-a-uuid/files').expect(HttpStatus.BAD_REQUEST);
            expect(mockSftpService.listFiles).not.toHaveBeenCalled();
        });

        it('should return 404 for a valid but non-existent simulation', async () => {
            await request(app.getHttpServer())
                .get(`/simulations/${VALID_BUT_MISSING_ID}/files`)
                .expect(HttpStatus.NOT_FOUND);
            expect(mockSftpService.listFiles).not.toHaveBeenCalled();
        });
    });

    describe('GET /simulations/:id/files/download', () => {
        it('should download a file from the input folder', async () => {
            const id = await createSimulation();

            const res = await request(app.getHttpServer())
                .get(`/simulations/${id}/files/download`)
                .query({ folder: 'input', name: 'input.json' })
                .expect(HttpStatus.OK);

            expect(res.headers['content-disposition']).toContain('input.json');
            expect(mockSftpService.downloadFile).toHaveBeenCalledWith(id, 'input', 'input.json');
        });

        it('should return 400 for an invalid folder', async () => {
            await request(app.getHttpServer())
                .get(`/simulations/${VALID_BUT_MISSING_ID}/files/download`)
                .query({ folder: 'etc', name: 'passwd' })
                .expect(HttpStatus.BAD_REQUEST);
            expect(mockSftpService.downloadFile).not.toHaveBeenCalled();
        });

        it('should reject path traversal in the file name (400)', async () => {
            await request(app.getHttpServer())
                .get(`/simulations/${VALID_BUT_MISSING_ID}/files/download`)
                .query({ folder: 'input', name: '../../secret.json' })
                .expect(HttpStatus.BAD_REQUEST);
            expect(mockSftpService.downloadFile).not.toHaveBeenCalled();
        });

        it('should return 400 when the file name is missing', async () => {
            await request(app.getHttpServer())
                .get(`/simulations/${VALID_BUT_MISSING_ID}/files/download`)
                .query({ folder: 'input' })
                .expect(HttpStatus.BAD_REQUEST);
            expect(mockSftpService.downloadFile).not.toHaveBeenCalled();
        });
    });
});
