import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { v4 as uuidv4 } from 'uuid';

import { PredictionType } from '../../../src/app/domain/entities/prediction-type.entity';
import { Simulation } from '../../../src/app/domain/entities/simulation.entity';
import { Maneuver } from '../../../src/app/domain/entities/maneuver.entity';
import { Prediction } from '../../../src/app/domain/entities/prediction.entity';
import { PredictionResult as PredictionResultEntity } from '../../../src/app/domain/entities/prediction-result.entity';

import { IPredictionRepository } from '../../../src/app/domain/ports/prediction-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

import { PredictionRepository } from '../../../src/app/infrastructure/persistence/prediction.repository';
import { GetHistoricalPredictionsHandler } from '../../../src/app/application/queries/prediction.queries';
import { PredictionController } from '../../../src/app/api/controllers/prediction.controller';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';

interface SeedRow {
    date: string;
    value: number;
    flag?: number;
    createdAt?: string;
}

describe('Get Historical Timeline (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [PredictionType, Simulation, Prediction, PredictionResultEntity, Maneuver],
            controllers: [PredictionController],
            providers: [
                GetHistoricalPredictionsHandler,
                { provide: IPredictionRepository, useClass: PredictionRepository },
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

    // ─────────────────────────────────────────────────────────────
    // Seeding helpers — direct SQL inserts to control createdAt
    // ─────────────────────────────────────────────────────────────

    async function seedPredictionType(name: string, unit = 'unknown'): Promise<string> {
        const id = uuidv4();
        await dataSource.query('INSERT INTO prediction_types (id, name, unit) VALUES ($1, $2, $3)', [id, name, unit]);
        return id;
    }

    async function seedSimulation(date: string): Promise<string> {
        const id = uuidv4();
        await dataSource.query(
            `INSERT INTO simulations (id, "simulationDate", status, type, "createdBy")
             VALUES ($1, $2, 'FINALIZED', 'AUTOMATIC', 'test')`,
            [id, date],
        );
        return id;
    }

    async function seedPrediction(params: {
        stationId: string;
        predictionTypeId: string;
        simulationId: string;
    }): Promise<string> {
        const id = uuidv4();
        await dataSource.query(
            `INSERT INTO predictions (id, "stationId", "predictionTypeId", "simulationId")
             VALUES ($1, $2, $3, $4)`,
            [id, params.stationId, params.predictionTypeId, params.simulationId],
        );
        return id;
    }

    async function seedResults(predictionId: string, rows: SeedRow[]): Promise<void> {
        for (const row of rows) {
            if (row.createdAt) {
                await dataSource.query(
                    `INSERT INTO prediction_results ("predictionId", date, value, flag, "createdAt")
                     VALUES ($1, $2, $3, $4, $5)`,
                    [predictionId, row.date, row.value, row.flag ?? 0, row.createdAt],
                );
            } else {
                await dataSource.query(
                    `INSERT INTO prediction_results ("predictionId", date, value, flag)
                     VALUES ($1, $2, $3, $4)`,
                    [predictionId, row.date, row.value, row.flag ?? 0],
                );
            }
        }
    }

    function getTimeline(query: Record<string, string>) {
        return request(app.getHttpServer()).get('/predictions/historical').query(query);
    }

    // ─────────────────────────────────────────────────────────────
    // Happy path
    // ─────────────────────────────────────────────────────────────

    it('returns the ordered observed series for a single prediction', async () => {
        const stationId = 'AR35';
        const typeName = 'Q.historical';
        const ptId = await seedPredictionType(typeName, 'm3/s');
        const simId = await seedSimulation('20260301000000');
        const predId = await seedPrediction({ stationId, predictionTypeId: ptId, simulationId: simId });
        await seedResults(predId, [
            { date: '2026-03-10T00:00:00Z', value: 10 },
            { date: '2026-03-11T00:00:00Z', value: 11 },
            { date: '2026-03-12T00:00:00Z', value: 12 },
        ]);

        const { body } = await getTimeline({
            stationId,
            predictionType: typeName,
            startDate: '2026-03-01T00:00:00Z',
            endDate: '2026-03-31T23:59:59Z',
        }).expect(HttpStatus.OK);

        expect(body.stationId).toBe(stationId);
        expect(body.predictionType).toBe(typeName);
        expect(body.results).toHaveLength(3);
        expect(body.results.map((r: { value: number }) => r.value)).toEqual([10, 11, 12]);
        expect(body.results[0]).toMatchObject({ value: 10, flag: 0 });
        expect(typeof body.results[0].date).toBe('string');
        // Dates are returned in ascending order
        expect(new Date(body.results[0].date).getTime()).toBeLessThan(new Date(body.results[2].date).getTime());
    });

    // ─────────────────────────────────────────────────────────────
    // Dedup
    // ─────────────────────────────────────────────────────────────

    it('dedups across two predictions and keeps the latest createdAt per timestamp', async () => {
        const stationId = 'AR35';
        const typeName = 'Q.historical';
        const ptId = await seedPredictionType(typeName);
        const simA = await seedSimulation('20260301000000');
        const simB = await seedSimulation('20260302000000');
        const predA = await seedPrediction({ stationId, predictionTypeId: ptId, simulationId: simA });
        const predB = await seedPrediction({ stationId, predictionTypeId: ptId, simulationId: simB });

        await seedResults(predA, [{ date: '2026-03-10T00:00:00Z', value: 100, createdAt: '2026-03-10T01:00:00Z' }]);
        await seedResults(predB, [{ date: '2026-03-10T00:00:00Z', value: 999, createdAt: '2026-03-10T02:00:00Z' }]);

        const { body } = await getTimeline({
            stationId,
            predictionType: typeName,
            startDate: '2026-03-10T00:00:00Z',
            endDate: '2026-03-10T00:00:00Z',
        }).expect(HttpStatus.OK);

        expect(body.results).toHaveLength(1);
        expect(body.results[0].value).toBe(999);
    });

    it('dedups within a single prediction by latest createdAt', async () => {
        const stationId = 'AR35';
        const typeName = 'Q.historical';
        const ptId = await seedPredictionType(typeName);
        const simId = await seedSimulation('20260301000000');
        const predId = await seedPrediction({ stationId, predictionTypeId: ptId, simulationId: simId });

        await seedResults(predId, [
            { date: '2026-03-10T00:00:00Z', value: 100, createdAt: '2026-03-10T01:00:00Z' },
            { date: '2026-03-10T00:00:00Z', value: 999, createdAt: '2026-03-10T02:00:00Z' },
        ]);

        const { body } = await getTimeline({
            stationId,
            predictionType: typeName,
            startDate: '2026-03-10T00:00:00Z',
            endDate: '2026-03-10T00:00:00Z',
        }).expect(HttpStatus.OK);

        expect(body.results).toHaveLength(1);
        expect(body.results[0].value).toBe(999);
    });

    it('breaks createdAt ties by higher id (more recent insertion)', async () => {
        const stationId = 'AR35';
        const typeName = 'Q.historical';
        const ptId = await seedPredictionType(typeName);
        const simId = await seedSimulation('20260301000000');
        const predId = await seedPrediction({ stationId, predictionTypeId: ptId, simulationId: simId });

        const sameTs = '2026-03-10T05:00:00Z';
        await seedResults(predId, [
            { date: '2026-03-10T00:00:00Z', value: 100, createdAt: sameTs },
            { date: '2026-03-10T00:00:00Z', value: 200, createdAt: sameTs },
        ]);

        const { body } = await getTimeline({
            stationId,
            predictionType: typeName,
            startDate: '2026-03-10T00:00:00Z',
            endDate: '2026-03-10T00:00:00Z',
        }).expect(HttpStatus.OK);

        expect(body.results).toHaveLength(1);
        expect(body.results[0].value).toBe(200);
    });

    // ─────────────────────────────────────────────────────────────
    // Boundaries and ordering
    // ─────────────────────────────────────────────────────────────

    it('includes points whose date matches startDate or endDate exactly', async () => {
        const stationId = 'AR35';
        const typeName = 'Q.historical';
        const ptId = await seedPredictionType(typeName);
        const simId = await seedSimulation('20260301000000');
        const predId = await seedPrediction({ stationId, predictionTypeId: ptId, simulationId: simId });

        await seedResults(predId, [
            { date: '2026-03-01T00:00:00Z', value: 1 },
            { date: '2026-03-15T12:00:00Z', value: 2 },
            { date: '2026-03-31T23:59:59Z', value: 3 },
        ]);

        const { body } = await getTimeline({
            stationId,
            predictionType: typeName,
            startDate: '2026-03-01T00:00:00Z',
            endDate: '2026-03-31T23:59:59Z',
        }).expect(HttpStatus.OK);

        expect(body.results).toHaveLength(3);
        expect(body.results[0].value).toBe(1);
        expect(body.results[2].value).toBe(3);
    });

    // ─────────────────────────────────────────────────────────────
    // Empty results
    // ─────────────────────────────────────────────────────────────

    it('returns 200 with empty results when the station has no matching data', async () => {
        const ptId = await seedPredictionType('Q.historical');
        const simId = await seedSimulation('20260301000000');
        await seedPrediction({ stationId: 'OTHER', predictionTypeId: ptId, simulationId: simId });

        const { body } = await getTimeline({
            stationId: 'NOT_EXISTS',
            predictionType: 'Q.historical',
            startDate: '2026-03-01T00:00:00Z',
            endDate: '2026-03-31T23:59:59Z',
        }).expect(HttpStatus.OK);

        expect(body).toEqual({ stationId: 'NOT_EXISTS', predictionType: 'Q.historical', results: [] });
    });

    it('returns 200 with empty results for an unknown prediction type', async () => {
        const { body } = await getTimeline({
            stationId: 'AR35',
            predictionType: 'Unknown.historical',
            startDate: '2026-03-01T00:00:00Z',
            endDate: '2026-03-31T23:59:59Z',
        }).expect(HttpStatus.OK);

        expect(body.results).toEqual([]);
    });

    it('returns 200 with empty results when startDate is after endDate', async () => {
        const stationId = 'AR35';
        const typeName = 'Q.historical';
        const ptId = await seedPredictionType(typeName);
        const simId = await seedSimulation('20260301000000');
        const predId = await seedPrediction({ stationId, predictionTypeId: ptId, simulationId: simId });
        await seedResults(predId, [{ date: '2026-03-10T00:00:00Z', value: 10 }]);

        const { body } = await getTimeline({
            stationId,
            predictionType: typeName,
            startDate: '2026-03-31T00:00:00Z',
            endDate: '2026-03-01T00:00:00Z',
        }).expect(HttpStatus.OK);

        expect(body.results).toEqual([]);
    });

    // ─────────────────────────────────────────────────────────────
    // Validation
    // ─────────────────────────────────────────────────────────────

    it.each(['stationId', 'predictionType', 'startDate', 'endDate'])(
        'returns 400 when %s is missing',
        async (missing) => {
            const base: Record<string, string> = {
                stationId: 'AR35',
                predictionType: 'Q.historical',
                startDate: '2026-03-01T00:00:00Z',
                endDate: '2026-03-31T23:59:59Z',
            };
            delete base[missing];
            await getTimeline(base).expect(HttpStatus.BAD_REQUEST);
        },
    );

    it.each([
        ['startDate', 'notadate'],
        ['endDate', '2026-13-99'],
    ])('returns 400 when %s is not a valid ISO date (%s)', async (field, badValue) => {
        const base: Record<string, string> = {
            stationId: 'AR35',
            predictionType: 'Q.historical',
            startDate: '2026-03-01T00:00:00Z',
            endDate: '2026-03-31T23:59:59Z',
            [field]: badValue,
        };
        await getTimeline(base).expect(HttpStatus.BAD_REQUEST);
    });

    // ─────────────────────────────────────────────────────────────
    // Arbitrary type support
    // ─────────────────────────────────────────────────────────────

    it('supports any historical type name (e.g., synthetic series)', async () => {
        const stationId = 'I_10';
        const typeName = 'WI__01.historical';
        const ptId = await seedPredictionType(typeName);
        const simId = await seedSimulation('20260301000000');
        const predId = await seedPrediction({ stationId, predictionTypeId: ptId, simulationId: simId });
        await seedResults(predId, [
            { date: '2026-03-10T00:00:00Z', value: 5 },
            { date: '2026-03-10T01:00:00Z', value: 6 },
        ]);

        const { body } = await getTimeline({
            stationId,
            predictionType: typeName,
            startDate: '2026-03-10T00:00:00Z',
            endDate: '2026-03-10T23:59:59Z',
        }).expect(HttpStatus.OK);

        expect(body.predictionType).toBe(typeName);
        expect(body.results).toHaveLength(2);
    });
});
