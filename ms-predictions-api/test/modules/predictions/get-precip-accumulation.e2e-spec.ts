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
import { GetPrecipAccumulationHandler } from '../../../src/app/application/queries/prediction.queries';
import { PredictionController } from '../../../src/app/api/controllers/prediction.controller';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';

const HOUR_MS = 60 * 60 * 1000;

const OBSERVED_TYPE = 'WI__01.historical';
const HARMONIE_TYPE = 'P.harmonie.forecast';
const EPS_TYPE = 'P.ens.forecast';

interface SeedRow {
    date: string;
    value: number;
    createdAt?: string;
}

interface AccumulationItem {
    stationId: string;
    accumulated: number;
    windowStart: string;
    windowEnd: string;
    lastDate: string;
    isStale: boolean;
}

// Observed points sit on whole hours. Anchored once so seeds and assertions agree
// even if the suite runs across an hour boundary.
const TOP_OF_HOUR = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;

/** Top of the current hour minus `hours`, as ISO. */
function hoursAgo(hours: number): string {
    return new Date(TOP_OF_HOUR - hours * HOUR_MS).toISOString();
}

/** Hourly points ending `endHoursAgo` hours ago, oldest first. */
function hourlyRows(values: number[], endHoursAgo = 0): SeedRow[] {
    return values.map((value, i) => ({ date: hoursAgo(endHoursAgo + values.length - 1 - i), value }));
}

function hoursAfter(start: string, hours: number): string {
    return new Date(new Date(start).getTime() + hours * HOUR_MS).toISOString();
}

describe('Get Precipitation Accumulation (e2e)', () => {
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
                GetPrecipAccumulationHandler,
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
    // Seeding helpers — direct SQL inserts to control createdAt and status
    // ─────────────────────────────────────────────────────────────

    async function seedPredictionType(name: string): Promise<string> {
        const id = uuidv4();
        await dataSource.query('INSERT INTO prediction_types (id, name, unit) VALUES ($1, $2, $3)', [id, name, 'mm']);
        return id;
    }

    async function seedSimulation(date: string, status = 'FINALIZED'): Promise<string> {
        const id = uuidv4();
        await dataSource.query(
            `INSERT INTO simulations (id, "simulationDate", status, type, "createdBy")
             VALUES ($1, $2, $3, 'AUTOMATIC', 'test')`,
            [id, date, status],
        );
        return id;
    }

    async function seedPrediction(params: {
        stationId: string;
        predictionTypeId: string;
        simulationId: string;
        percentile?: number;
        createdAt?: string;
        rows: SeedRow[];
    }): Promise<void> {
        const id = uuidv4();
        await dataSource.query(
            `INSERT INTO predictions (id, "stationId", "stationName", "predictionTypeId", "simulationId", percentile, "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamp, now()))`,
            [
                id,
                params.stationId,
                `${params.stationId} PLUVIO`,
                params.predictionTypeId,
                params.simulationId,
                params.percentile ?? null,
                params.createdAt ?? null,
            ],
        );
        for (const row of params.rows) {
            await dataSource.query(
                `INSERT INTO prediction_results ("predictionId", date, value, flag, "createdAt")
                 VALUES ($1, $2, $3, 0, COALESCE($4::timestamp, now()))`,
                [id, row.date, row.value, row.createdAt ?? null],
            );
        }
    }

    function getAccumulation(query: Record<string, string | number>) {
        return request(app.getHttpServer()).get('/predictions/precip-accumulated').query(query);
    }

    function itemOf(body: { items: AccumulationItem[] }, stationId: string): AccumulationItem | undefined {
        return body.items.find((item) => item.stationId === stationId);
    }

    // ─────────────────────────────────────────────────────────────
    // Observed
    // ─────────────────────────────────────────────────────────────

    describe('source=observed', () => {
        it('sums the rain of the last N hours up to the last measurement', async () => {
            const typeId = await seedPredictionType(OBSERVED_TYPE);
            const simId = await seedSimulation('20261012170000');
            // 30 hourly points: 18 older hours of 5 mm, then the 12 most recent of 1..12 mm
            const values = [...Array(18).fill(5), ...Array.from({ length: 12 }, (_, i) => i + 1)];
            await seedPrediction({
                stationId: 'P_30',
                predictionTypeId: typeId,
                simulationId: simId,
                rows: hourlyRows(values),
            });

            const { body } = await getAccumulation({ source: 'observed', hours: 12 }).expect(HttpStatus.OK);

            expect(body).toMatchObject({
                source: 'observed',
                hours: 12,
                predictionType: OBSERVED_TYPE,
                simulationDate: null,
            });
            expect(typeof body.referenceDate).toBe('string');
            expect(itemOf(body, 'P_30')).toEqual({
                stationId: 'P_30',
                stationName: 'P_30 PLUVIO',
                accumulated: 78, // 1 + 2 + ... + 12
                windowStart: hoursAgo(12),
                windowEnd: hoursAgo(0),
                lastDate: hoursAgo(0),
                isStale: false,
            });
        });

        it('keeps the latest ingestion of a point that was re-ingested with a corrected value', async () => {
            const typeId = await seedPredictionType(OBSERVED_TYPE);
            const firstSim = await seedSimulation('20261012160000');
            const secondSim = await seedSimulation('20261012170000');
            await seedPrediction({
                stationId: 'P_30',
                predictionTypeId: typeId,
                simulationId: firstSim,
                rows: [{ date: hoursAgo(0), value: 2, createdAt: hoursAgo(1) }],
            });
            await seedPrediction({
                stationId: 'P_30',
                predictionTypeId: typeId,
                simulationId: secondSim,
                rows: [{ date: hoursAgo(0), value: 9 }],
            });

            const { body } = await getAccumulation({ source: 'observed', hours: 1 }).expect(HttpStatus.OK);

            expect(itemOf(body, 'P_30')?.accumulated).toBe(9);
        });

        it('flags a station whose last measurement is more than 3 hours old as stale', async () => {
            const typeId = await seedPredictionType(OBSERVED_TYPE);
            const simId = await seedSimulation('20261012170000');
            await seedPrediction({
                stationId: 'P_LIVE',
                predictionTypeId: typeId,
                simulationId: simId,
                rows: hourlyRows([1, 1]),
            });
            await seedPrediction({
                stationId: 'P_SILENT',
                predictionTypeId: typeId,
                simulationId: simId,
                rows: hourlyRows([1, 1], 5),
            });

            const { body } = await getAccumulation({ source: 'observed', hours: 1 }).expect(HttpStatus.OK);

            expect(itemOf(body, 'P_LIVE')?.isStale).toBe(false);
            expect(itemOf(body, 'P_SILENT')).toMatchObject({ isStale: true, lastDate: hoursAgo(5) });
        });

        it('leaves out stations only present in ingestions older than 48 hours', async () => {
            const typeId = await seedPredictionType(OBSERVED_TYPE);
            const simId = await seedSimulation('20261009170000');
            await seedPrediction({
                stationId: 'P_OLD',
                predictionTypeId: typeId,
                simulationId: simId,
                createdAt: hoursAgo(72),
                rows: hourlyRows([3, 3], 72),
            });

            const { body } = await getAccumulation({ source: 'observed', hours: 24 }).expect(HttpStatus.OK);

            expect(body.items).toEqual([]);
        });

        it('only reads the observed rain series', async () => {
            const observedTypeId = await seedPredictionType(OBSERVED_TYPE);
            const otherTypeId = await seedPredictionType('FICT98.historical');
            const simId = await seedSimulation('20261012170000');
            await seedPrediction({
                stationId: 'P_30',
                predictionTypeId: observedTypeId,
                simulationId: simId,
                rows: hourlyRows([4]),
            });
            await seedPrediction({
                stationId: 'AR35',
                predictionTypeId: otherTypeId,
                simulationId: simId,
                rows: hourlyRows([500]),
            });

            const { body } = await getAccumulation({ source: 'observed', hours: 1 }).expect(HttpStatus.OK);

            expect(body.items.map((item: AccumulationItem) => item.stationId)).toEqual(['P_30']);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // Forecast
    // ─────────────────────────────────────────────────────────────

    describe('source=harmonie | eps', () => {
        const start = '2026-10-12T00:00:00.000Z';

        function forecastRows(values: number[], stepHours = 1, from = start): SeedRow[] {
            return values.map((value, i) => ({ date: hoursAfter(from, (i + 1) * stepHours), value }));
        }

        it('returns the wettest window of N consecutive hours and when it happens', async () => {
            const typeId = await seedPredictionType(HARMONIE_TYPE);
            const simId = await seedSimulation('20261012000000');
            await seedPrediction({
                stationId: 'AC01',
                predictionTypeId: typeId,
                simulationId: simId,
                rows: forecastRows([0, 2, 5, 10, 1, 0, 8, 0]),
            });

            const { body } = await getAccumulation({ source: 'harmonie', hours: 2 }).expect(HttpStatus.OK);

            expect(body).toMatchObject({
                source: 'harmonie',
                hours: 2,
                predictionType: HARMONIE_TYPE,
                simulationDate: '20261012000000',
            });
            expect(itemOf(body, 'AC01')).toEqual({
                stationId: 'AC01',
                stationName: 'AC01 PLUVIO',
                accumulated: 15, // hours 3 and 4: 5 + 10
                windowStart: hoursAfter(start, 2),
                windowEnd: hoursAfter(start, 4),
                lastDate: hoursAfter(start, 8),
                isStale: false,
            });
        });

        it('reads only the latest finalized simulation', async () => {
            const typeId = await seedPredictionType(HARMONIE_TYPE);
            const olderSim = await seedSimulation('20261011120000');
            const latestSim = await seedSimulation('20261012000000');
            const runningSim = await seedSimulation('20261012060000', 'IN_PROGRESS');
            await seedPrediction({
                stationId: 'AC01',
                predictionTypeId: typeId,
                simulationId: olderSim,
                rows: forecastRows([50]),
            });
            await seedPrediction({
                stationId: 'AC01',
                predictionTypeId: typeId,
                simulationId: latestSim,
                rows: forecastRows([3]),
            });
            await seedPrediction({
                stationId: 'AC01',
                predictionTypeId: typeId,
                simulationId: runningSim,
                rows: forecastRows([90]),
            });

            const { body } = await getAccumulation({ source: 'harmonie', hours: 1 }).expect(HttpStatus.OK);

            expect(body.simulationDate).toBe('20261012000000');
            expect(itemOf(body, 'AC01')?.accumulated).toBe(3);
        });

        it('spreads a 6-hour EPS step evenly over its hours', async () => {
            const typeId = await seedPredictionType(EPS_TYPE);
            const simId = await seedSimulation('20261012000000');
            // Three hourly points of 1 mm, then one 6-hour step of 12 mm (2 mm per hour)
            await seedPrediction({
                stationId: 'AC01',
                predictionTypeId: typeId,
                simulationId: simId,
                rows: [...forecastRows([1, 1, 1]), { date: hoursAfter(start, 9), value: 12 }],
            });

            const oneHour = await getAccumulation({ source: 'eps', hours: 1 }).expect(HttpStatus.OK);
            const eightHours = await getAccumulation({ source: 'eps', hours: 8 }).expect(HttpStatus.OK);

            expect(itemOf(oneHour.body, 'AC01')?.accumulated).toBe(2);
            // Hours 2..9: 1 + 1 + 6 × 2
            expect(itemOf(eightHours.body, 'AC01')?.accumulated).toBe(14);
        });

        it('ignores the percentile members and keeps the deterministic one', async () => {
            const typeId = await seedPredictionType(EPS_TYPE);
            const simId = await seedSimulation('20261012000000');
            await seedPrediction({
                stationId: 'AC01',
                predictionTypeId: typeId,
                simulationId: simId,
                rows: forecastRows([4]),
            });
            await seedPrediction({
                stationId: 'AC01',
                predictionTypeId: typeId,
                simulationId: simId,
                percentile: 90,
                rows: forecastRows([40]),
            });

            const { body } = await getAccumulation({ source: 'eps', hours: 1 }).expect(HttpStatus.OK);

            expect(body.items).toHaveLength(1);
            expect(itemOf(body, 'AC01')?.accumulated).toBe(4);
        });

        it('returns no items and no simulationDate when there is no finalized forecast', async () => {
            await seedPredictionType(HARMONIE_TYPE);

            const { body } = await getAccumulation({ source: 'harmonie', hours: 24 }).expect(HttpStatus.OK);

            expect(body).toMatchObject({ simulationDate: null, items: [] });
        });
    });

    // ─────────────────────────────────────────────────────────────
    // Validation
    // ─────────────────────────────────────────────────────────────

    describe('validation', () => {
        it('rejects an hours value without an AEMET threshold', () => {
            return getAccumulation({ source: 'observed', hours: 3 }).expect(HttpStatus.BAD_REQUEST);
        });

        it('rejects an unknown source', () => {
            return getAccumulation({ source: 'wrf', hours: 12 }).expect(HttpStatus.BAD_REQUEST);
        });

        it('rejects a request without hours', () => {
            return getAccumulation({ source: 'observed' }).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
