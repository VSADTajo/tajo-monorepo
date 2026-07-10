import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { PredictionType } from '../../../src/app/domain/entities/prediction-type.entity';
import { Simulation } from '../../../src/app/domain/entities/simulation.entity';
import { Maneuver } from '../../../src/app/domain/entities/maneuver.entity';
import { Prediction } from '../../../src/app/domain/entities/prediction.entity';
import { PredictionResult as PredictionResultEntity } from '../../../src/app/domain/entities/prediction-result.entity';

import { IPredictionTypeRepository } from '../../../src/app/domain/ports/prediction-type-repository.port';
import { ISimulationRepository } from '../../../src/app/domain/ports/simulation-repository.port';
import { IPredictionRepository } from '../../../src/app/domain/ports/prediction-repository.port';
import { IPredictionResultRepository } from '../../../src/app/domain/ports/prediction-result-repository.port';
import { IStationThresholdService } from '../../../src/app/domain/ports/station-threshold-service.port';
import { IStationCatalogService } from '../../../src/app/domain/ports/station-catalog-service.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { IMessageBroker } from '../../../src/app/domain/ports/message-broker.port';

import { PredictionTypeRepository } from '../../../src/app/infrastructure/persistence/prediction-type.repository';
import { SimulationRepository } from '../../../src/app/infrastructure/persistence/simulation.repository';
import { PredictionRepository } from '../../../src/app/infrastructure/persistence/prediction.repository';
import { PredictionResultRepository } from '../../../src/app/infrastructure/persistence/prediction-result.repository';
import {
    ProcessTimeSeriesCommand,
    ProcessTimeSeriesHandler,
} from '../../../src/app/application/commands/prediction.commands';
import { GetTypeCoverageMatrixHandler } from '../../../src/app/application/queries/prediction-type.queries';
import { PredictionTypeController } from '../../../src/app/api/controllers/prediction-type.controller';

import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';
import { CoverageReportService } from '../../../src/app/infrastructure/services/coverage-report.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildProcessTimeSeriesCommand, buildTimeSeriesData } from '../../factories/simulation.factory';

describe('Prediction Type Coverage Matrix (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let commandBus: CommandBus;

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
    const mockStationThresholdService = { getThreshold: jest.fn().mockResolvedValue(null) };
    // Catalog includes a station (E_EMPTY) that never received data.
    const mockStationCatalog = {
        listStations: jest.fn().mockResolvedValue([
            { code: 'E_01', name: 'Bolarque' },
            { code: 'E_EMPTY', name: 'Zorita' },
        ]),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [PredictionType, Simulation, Prediction, PredictionResultEntity, Maneuver],
            controllers: [PredictionTypeController],
            providers: [
                ProcessTimeSeriesHandler,
                GetTypeCoverageMatrixHandler,
                { provide: IPredictionTypeRepository, useClass: PredictionTypeRepository },
                { provide: ISimulationRepository, useClass: SimulationRepository },
                { provide: IPredictionRepository, useClass: PredictionRepository },
                { provide: IPredictionResultRepository, useClass: PredictionResultRepository },
                { provide: IStationThresholdService, useValue: mockStationThresholdService },
                { provide: IStationCatalogService, useValue: mockStationCatalog },
                { provide: ICacheService, useValue: mockCacheService },
                { provide: IMessageBroker, useValue: mockMessageBroker },
                CoverageReportService,
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

    async function seedFinalizedType(stationId: string, typeName: string, forecastDate: string) {
        const cmdData = buildProcessTimeSeriesCommand({
            series: buildTimeSeriesData({
                locationId: stationId,
                parameterId: typeName,
                startDate: `${forecastDate}T00:00:00.000Z`,
                forecastDate: `${forecastDate}T00:00:00.000Z`,
                endDate: `${forecastDate}T05:00:00.000Z`,
            }),
            providerName: `WRF_${typeName}`,
        });
        const result = await commandBus.execute(new ProcessTimeSeriesCommand(cmdData));
        await dataSource.query('UPDATE simulations SET status = $1 WHERE id = $2', ['FINALIZED', result.simulationId]);
        return result;
    }

    function getMatrix() {
        return request(app.getHttpServer()).get('/prediction-types/coverage');
    }

    it('builds a matrix of all catalog stations × types, filling nulls for missing pairs', async () => {
        await seedFinalizedType('E_01', 'Discharge_forecast', '2026-03-10');
        await seedFinalizedType('E_01', 'P.ens.forecast', '2026-03-11');

        const { body } = await getMatrix().expect(HttpStatus.OK);

        expect(body.types).toHaveLength(2);
        const typeNames = body.types.map((t: { name: string }) => t.name);

        const e01 = body.stations.find((s: { stationCode: string }) => s.stationCode === 'E_01');
        const empty = body.stations.find((s: { stationCode: string }) => s.stationCode === 'E_EMPTY');

        // E_01 has data for both types
        expect(e01.withData).toBe(2);
        e01.cells.forEach((cell: string | null) => expect(cell).not.toBeNull());

        // E_EMPTY is in the catalog but never received data → all cells null
        expect(empty).toBeDefined();
        expect(empty.withData).toBe(0);
        expect(empty.cells).toEqual([null, null]);

        // cells align by index with the types column order
        expect(e01.cells).toHaveLength(typeNames.length);
    });

    it('includes stations that have data even if absent from the hydro catalog', async () => {
        // E_GHOST is NOT returned by the mocked catalog, but it has finalized data.
        await seedFinalizedType('E_GHOST', 'Discharge_forecast', '2026-04-01');

        const { body } = await getMatrix().expect(HttpStatus.OK);

        const ghost = body.stations.find((s: { stationCode: string }) => s.stationCode === 'E_GHOST');
        expect(ghost).toBeDefined();
        expect(ghost.stationName).toBeNull();
        expect(ghost.withData).toBe(1);
    });
});
