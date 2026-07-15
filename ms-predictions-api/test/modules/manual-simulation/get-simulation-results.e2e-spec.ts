import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { CommandBus } from '@nestjs/cqrs';
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
import { IPredictionResultRepository } from '../../../src/app/domain/ports/prediction-result-repository.port';
import { IPredictionTypeRepository } from '../../../src/app/domain/ports/prediction-type-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { IMessageBroker } from '../../../src/app/domain/ports/message-broker.port';
import { ISimulationSftpService } from '../../../src/app/domain/ports/simulation-sftp.port';
import { IStationThresholdService } from '../../../src/app/domain/ports/station-threshold-service.port';
import { IStationCatalogService } from '../../../src/app/domain/ports/station-catalog-service.port';

import { SimulationRepository } from '../../../src/app/infrastructure/persistence/simulation.repository';
import { ManeuverRepository } from '../../../src/app/infrastructure/persistence/maneuver.repository';
import { PredictionRepository } from '../../../src/app/infrastructure/persistence/prediction.repository';
import { PredictionResultRepository } from '../../../src/app/infrastructure/persistence/prediction-result.repository';
import { PredictionTypeRepository } from '../../../src/app/infrastructure/persistence/prediction-type.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { CreateManualSimulationHandler } from '../../../src/app/application/commands/manual-simulation.commands';
import {
    ProcessTimeSeriesCommand,
    ProcessTimeSeriesHandler,
} from '../../../src/app/application/commands/prediction.commands';
import { GetSimulationResultsHandler } from '../../../src/app/application/queries/manual-simulation.queries';
import { SimulationController } from '../../../src/app/api/controllers/simulation.controller';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateManualSimulationDto } from '../../factories/manual-simulation.factory';
import { buildTimeSeriesData, buildTimeSeriesEvents } from '../../factories/simulation.factory';

describe('Get Simulation Results (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let commandBus: CommandBus;

    const mockSftpService = {
        uploadInputFile: jest.fn().mockResolvedValue(undefined),
        ensureOutputFolder: jest.fn().mockResolvedValue(undefined),
        listFolder: jest.fn().mockResolvedValue([]),
        downloadFile: jest.fn().mockResolvedValue(Buffer.from('')),
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

    const mockStationThresholdService = {
        getThreshold: jest.fn().mockResolvedValue(null),
    };

    // Full station snapshots injected via the station catalog (would come from hydro-api in real deployment).
    const buildFullStation = (stationCode: string, overrides: Record<string, unknown> = {}) => ({
        id: `station-uuid-${stationCode}`,
        name: `Station ${stationCode}`,
        subBasinName: 'Tajo Alto',
        stationCode,
        stationType: 'AFORO_EN_RIO',
        subBasinId: 'sub-basin-uuid',
        threshold: null,
        latitude: 40.5,
        longitude: -4.5,
        altitude: 550.0,
        municipio: 'Sacedón',
        provincia: 'Guadalajara',
        ccaa: 'Castilla La Mancha',
        tipoCod: 'AC',
        zona: 'CABECERA',
        zonaExplOgcFid: 2,
        zonaExplNombre: 'ZONA 2',
        comarcaName: 'TALAVERA DE LA REINA',
        sistemaName: 'CABECERA',
        meteoalertaZonaCode: '670502',
        meteoalertaZonaNombre: 'Sistema Central de Ávila',
        description: null,
        isActive: true,
        createdAt: '2026-03-12T00:00:00.000Z',
        updatedAt: '2026-06-01T09:30:00.000Z',
        ...overrides,
    });

    const mockStationCatalog = {
        listStations: jest.fn().mockResolvedValue([]),
        listFullStations: jest
            .fn()
            .mockResolvedValue([
                buildFullStation('AR71'),
                buildFullStation('AR72', { latitude: 41.0, longitude: -5.0, meteoalertaZonaCode: '670999' }),
            ]),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [Simulation, Maneuver, Prediction, PredictionType, PredictionResult],
            controllers: [SimulationController],
            providers: [
                CreateManualSimulationHandler,
                ProcessTimeSeriesHandler,
                GetSimulationResultsHandler,
                { provide: ISimulationRepository, useClass: SimulationRepository },
                { provide: IManeuverRepository, useClass: ManeuverRepository },
                { provide: IPredictionRepository, useClass: PredictionRepository },
                { provide: IPredictionResultRepository, useClass: PredictionResultRepository },
                { provide: IPredictionTypeRepository, useClass: PredictionTypeRepository },
                { provide: ISimulationSftpService, useValue: mockSftpService },
                { provide: IMessageBroker, useValue: mockMessageBroker },
                { provide: ICacheService, useValue: mockCacheService },
                { provide: IStationThresholdService, useValue: mockStationThresholdService },
                { provide: IStationCatalogService, useValue: mockStationCatalog },
                CachingQueryBus,
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
        commandBus = app.get(CommandBus);
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

    function getSimulationResults(id: string, query?: Record<string, string>) {
        const req = request(app.getHttpServer()).get(`/simulations/manual/${id}/results`);
        return query ? req.query(query) : req;
    }

    // Deterministic events builder for max/last assertions.
    function buildEventsWithValues(values: number[]) {
        const baseDate = new Date('2026-07-10T00:00:00Z').getTime();
        return values.map((v, i) => ({
            timestamp: new Date(baseDate + i * 3600000).toISOString(),
            value: v,
            flag: 0,
            isMissing: false,
        }));
    }

    it('should return 200 with sorted predictions and results for a manual simulation', async () => {
        // 1. Create a manual simulation
        const { body: sim } = await createManualSimulation(
            buildCreateManualSimulationDto({ maneuvers: [{ reservoirCode: 'E001', outputFlowValue: 10 }] }),
        ).expect(HttpStatus.CREATED);

        // 2. Seed two predictions with time-series (different stations to verify ordering)
        const stationBEvents = buildTimeSeriesEvents(3, {});
        const stationAEvents = buildTimeSeriesEvents(3, {});

        await commandBus.execute(
            new ProcessTimeSeriesCommand({
                series: buildTimeSeriesData({
                    locationId: 'AR72',
                    parameterId: 'Q.NAM.forecast',
                    moduleInstanceId: 'MOD-1',
                    stationName: 'Station AR72',
                    forecastDate: '2026-07-10T00:00:00.000Z',
                    events: stationBEvents,
                }),
                simulationId: sim.id,
            }),
        );

        await commandBus.execute(
            new ProcessTimeSeriesCommand({
                series: buildTimeSeriesData({
                    locationId: 'AR71',
                    parameterId: 'Q.NAM.forecast',
                    moduleInstanceId: 'MOD-1',
                    stationName: 'Station AR71',
                    forecastDate: '2026-07-10T00:00:00.000Z',
                    events: stationAEvents,
                }),
                simulationId: sim.id,
            }),
        );

        // 3. GET the results endpoint
        const { body } = await getSimulationResults(sim.id).expect(HttpStatus.OK);

        // Assert simulation identity
        expect(body.simulation).toBeDefined();
        expect(body.simulation.id).toBe(sim.id);
        expect(body.simulation.type).toBe('MANUAL');
        expect(body.simulation.status).toBeDefined();

        // Assert predictions are returned
        expect(Array.isArray(body.predictions)).toBe(true);
        expect(body.predictions.length).toBe(2);

        // Assert predictions are ordered by stationId ASC
        expect(body.predictions[0].stationId).toBe('AR71');
        expect(body.predictions[1].stationId).toBe('AR72');

        // Assert results are present within each prediction
        const firstPrediction = body.predictions[0];
        expect(Array.isArray(firstPrediction.results)).toBe(true);
        expect(firstPrediction.results.length).toBe(3);

        // Assert results are ordered by date ASC
        const dates = firstPrediction.results.map((r: { date: string }) => new Date(r.date).getTime());
        for (let i = 1; i < dates.length; i++) {
            expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
        }

        // Assert result shape
        const firstResult = firstPrediction.results[0];
        expect(firstResult).toHaveProperty('date');
        expect(firstResult).toHaveProperty('value');
        expect(firstResult).toHaveProperty('flag');
        expect(typeof firstResult.value).toBe('number');

        // Assert full station snapshot is attached from the catalog
        expect(firstPrediction.station).toBeDefined();
        expect(firstPrediction.station.stationCode).toBe('AR71');
        expect(firstPrediction.station.meteoalertaZonaCode).toBe('670502');
        expect(firstPrediction.station.provincia).toBe('Guadalajara');
        expect(body.predictions[1].station.stationCode).toBe('AR72');
        expect(body.predictions[1].station.meteoalertaZonaCode).toBe('670999');
    });

    it('should return 200 with empty predictions when nothing has been ingested yet', async () => {
        const { body: sim } = await createManualSimulation(
            buildCreateManualSimulationDto({ maneuvers: [{ reservoirCode: 'E001', outputFlowValue: 5 }] }),
        ).expect(HttpStatus.CREATED);

        const { body } = await getSimulationResults(sim.id).expect(HttpStatus.OK);

        expect(body.simulation.id).toBe(sim.id);
        expect(body.simulation.type).toBe('MANUAL');
        expect(Array.isArray(body.predictions)).toBe(true);
        expect(body.predictions).toHaveLength(0);
    });

    it('should return 404 when the simulation is not MANUAL', async () => {
        // Insert an AUTOMATIC simulation directly via repository
        const simulationRepo = dataSource.getRepository(Simulation);
        const automaticSim = simulationRepo.create({
            simulationDate: '20260710120000',
            type: 'AUTOMATIC' as any,
            status: 'FINALIZED' as any,
        });
        const saved = await simulationRepo.save(automaticSim);

        await getSimulationResults(saved.id).expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 when the simulation does not exist', async () => {
        await getSimulationResults('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
    });

    it('should return 400 when the id is not a valid UUID', async () => {
        await getSimulationResults('not-a-uuid').expect(HttpStatus.BAD_REQUEST);
    });

    // ─────────────────────────────────────────────────────────────
    // Query params + max/last
    // ─────────────────────────────────────────────────────────────

    // Seeds a manual simulation with two stations and two prediction types,
    // returning the created simulation id.
    async function seedTwoStationsTwoTypes(): Promise<string> {
        const { body: sim } = await createManualSimulation(
            buildCreateManualSimulationDto({ maneuvers: [{ reservoirCode: 'E001', outputFlowValue: 10 }] }),
        ).expect(HttpStatus.CREATED);

        // Station AR71 / Q.NAM.forecast — values [10, 30, 20] → max=30, last=20
        await commandBus.execute(
            new ProcessTimeSeriesCommand({
                series: buildTimeSeriesData({
                    locationId: 'AR71',
                    parameterId: 'Q.NAM.forecast',
                    moduleInstanceId: 'MOD-1',
                    stationName: 'Station AR71',
                    forecastDate: '2026-07-10T00:00:00.000Z',
                    events: buildEventsWithValues([10, 30, 20]),
                }),
                simulationId: sim.id,
            }),
        );

        // Station AR71 / P.harmonie.forecast — values [1, 2, 3] → max=3, last=3
        await commandBus.execute(
            new ProcessTimeSeriesCommand({
                series: buildTimeSeriesData({
                    locationId: 'AR71',
                    parameterId: 'P.harmonie.forecast',
                    moduleInstanceId: 'MOD-1',
                    stationName: 'Station AR71',
                    forecastDate: '2026-07-10T00:00:00.000Z',
                    events: buildEventsWithValues([1, 2, 3]),
                }),
                simulationId: sim.id,
            }),
        );

        // Station AR72 / Q.NAM.forecast — values [5, 5, 5] → max=5 (first), last=5 (last)
        await commandBus.execute(
            new ProcessTimeSeriesCommand({
                series: buildTimeSeriesData({
                    locationId: 'AR72',
                    parameterId: 'Q.NAM.forecast',
                    moduleInstanceId: 'MOD-1',
                    stationName: 'Station AR72',
                    forecastDate: '2026-07-10T00:00:00.000Z',
                    events: buildEventsWithValues([5, 5, 5]),
                }),
                simulationId: sim.id,
            }),
        );

        return sim.id;
    }

    it('should compute max and last per prediction from its results', async () => {
        const simId = await seedTwoStationsTwoTypes();

        const { body } = await getSimulationResults(simId).expect(HttpStatus.OK);

        expect(body.predictions).toHaveLength(3);

        const ar71Q = body.predictions.find(
            (p: any) => p.stationId === 'AR71' && p.predictionTypeName === 'Q.NAM.forecast',
        );
        expect(ar71Q).toBeDefined();
        expect(ar71Q.max).toEqual(expect.objectContaining({ value: 30, flag: 0 }));
        expect(ar71Q.last).toEqual(expect.objectContaining({ value: 20, flag: 0 }));

        const ar71P = body.predictions.find(
            (p: any) => p.stationId === 'AR71' && p.predictionTypeName === 'P.harmonie.forecast',
        );
        expect(ar71P.max).toEqual(expect.objectContaining({ value: 3 }));
        expect(ar71P.last).toEqual(expect.objectContaining({ value: 3 }));

        const ar72Q = body.predictions.find((p: any) => p.stationId === 'AR72');
        expect(ar72Q.max).toEqual(expect.objectContaining({ value: 5 }));
        expect(ar72Q.last).toEqual(expect.objectContaining({ value: 5 }));
        // Ties: max resolves to the first occurrence chronologically (results are date ASC).
        expect(new Date(ar72Q.max.date).getTime()).toBeLessThanOrEqual(new Date(ar72Q.last.date).getTime());
    });

    it('should return max and last as null when a prediction has no results', async () => {
        const { body: sim } = await createManualSimulation(
            buildCreateManualSimulationDto({ maneuvers: [{ reservoirCode: 'E001', outputFlowValue: 5 }] }),
        ).expect(HttpStatus.CREATED);

        // Seed one prediction WITHOUT time-series events (no ingestion) — insert directly.
        const predictionTypeRepo = dataSource.getRepository(PredictionType);
        const savedType = await predictionTypeRepo.save(
            predictionTypeRepo.create({ name: 'Q.empty.forecast', unit: 'm3/s' }),
        );

        const predictionRepo = dataSource.getRepository(Prediction);
        await predictionRepo.save(
            predictionRepo.create({
                simulationId: sim.id,
                stationId: 'AR99',
                stationName: 'Station AR99',
                predictionTypeId: savedType.id,
                percentile: null,
                predictionProvider: 'test',
                predictedBy: 'mod-test',
            }),
        );

        const { body } = await getSimulationResults(sim.id).expect(HttpStatus.OK);
        expect(body.predictions).toHaveLength(1);
        expect(body.predictions[0].results).toEqual([]);
        expect(body.predictions[0].max).toBeNull();
        expect(body.predictions[0].last).toBeNull();
        // AR99 is not in the mock hydro-api catalog → station is null
        expect(body.predictions[0].station).toBeNull();
    });

    it('should filter predictions by stationCode (case-insensitive)', async () => {
        const simId = await seedTwoStationsTwoTypes();

        const { body } = await getSimulationResults(simId, { stationCode: 'ar72' }).expect(HttpStatus.OK);

        expect(body.predictions).toHaveLength(1);
        expect(body.predictions[0].stationId).toBe('AR72');
    });

    it('should filter predictions by type (case-insensitive) matching prediction type name', async () => {
        const simId = await seedTwoStationsTwoTypes();

        const { body } = await getSimulationResults(simId, { type: 'q.nam.FORECAST' }).expect(HttpStatus.OK);

        expect(body.predictions).toHaveLength(2);
        expect(body.predictions.every((p: any) => p.predictionTypeName === 'Q.NAM.forecast')).toBe(true);
    });

    it('should combine stationCode and type filters', async () => {
        const simId = await seedTwoStationsTwoTypes();

        const { body } = await getSimulationResults(simId, {
            stationCode: 'AR71',
            type: 'Q.NAM.forecast',
        }).expect(HttpStatus.OK);

        expect(body.predictions).toHaveLength(1);
        expect(body.predictions[0].stationId).toBe('AR71');
        expect(body.predictions[0].predictionTypeName).toBe('Q.NAM.forecast');
    });

    it('should return empty predictions array when filters match nothing', async () => {
        const simId = await seedTwoStationsTwoTypes();

        const { body } = await getSimulationResults(simId, { stationCode: 'AR99' }).expect(HttpStatus.OK);

        expect(body.predictions).toEqual([]);
    });

    it('should reject unknown query params (whitelist enforced)', async () => {
        const simId = await seedTwoStationsTwoTypes();
        await getSimulationResults(simId, { unknownParam: 'anything' }).expect(HttpStatus.BAD_REQUEST);
    });
});
