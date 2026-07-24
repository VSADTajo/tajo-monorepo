import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { IAerialPrecipitationSeriesRepository } from '../../../src/app/domain/ports/aerial-precipitation-series-repository.port';
import {
    GetAerialPrecipitationLatestHandler,
    ListAerialPrecipitationHandler,
    GetAerialPrecipitationByLocationHandler,
} from '../../../src/app/application/queries/aerial-precipitation.queries';
import { AerialPrecipitationController } from '../../../src/app/api/controllers/aerial-precipitation.controller';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';
import { createAerialPrecipTestApp, AerialPrecipTestContext } from '../../helpers/aerial-precipitation-test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildSeriesEntity, buildEventEntity } from '../../factories/aerial-precipitation.factory';

describe('Latest Aerial Precipitation (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let ctx: AerialPrecipTestContext;
    let repo: IAerialPrecipitationSeriesRepository;

    beforeAll(async () => {
        ctx = await createAerialPrecipTestApp({
            extraProviders: [
                GetAerialPrecipitationLatestHandler,
                ListAerialPrecipitationHandler,
                GetAerialPrecipitationByLocationHandler,
                CachingQueryBus,
            ],
            extraControllers: [AerialPrecipitationController],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
        repo = app.get<IAerialPrecipitationSeriesRepository>(IAerialPrecipitationSeriesRepository);
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    function getLatest(query: Record<string, string | boolean>) {
        return request(app.getHttpServer()).get('/aerial-precipitation/latest').query(query);
    }

    // ─────────────────────────────────────────────────────────────
    // T040 — Returns only the max forecastDate series
    // ─────────────────────────────────────────────────────────────

    it('T040: returns only the series with max forecastDate for a given locationId', async () => {
        const locationId = 'Cuenca.NAM.E_08';
        const parameterId = 'P.areal.harmonie.subcNAM.24H';

        // Seed 3 series with increasing forecastDate for same location
        const dates = [
            new Date('2026-07-14T00:00:00Z'),
            new Date('2026-07-15T00:00:00Z'),
            new Date('2026-07-16T00:00:00Z'), // <-- max
        ];

        for (const forecastDate of dates) {
            const series = buildSeriesEntity({
                locationId,
                parameterId,
                forecastDate,
                provider: 'harmonie',
                layer: 'subcNAM',
                stat: null,
                accumulation: '24h',
            });
            await repo.upsertWithEvents(series, []);
        }

        const { body } = await getLatest({ layer: 'subcNAM', provider: 'harmonie', accumulation: '24h' }).expect(
            HttpStatus.OK,
        );

        expect(body.layer).toBe('subcNAM');
        expect(body.provider).toBe('harmonie');
        expect(body.accumulation).toBe('24h');
        expect(Array.isArray(body.series)).toBe(true);

        // Should have exactly 1 entry for this location
        const matching = (body.series as any[]).filter((s: any) => s.locationId === locationId);
        expect(matching.length).toBe(1);
        expect(new Date(matching[0].forecastDate).toISOString()).toBe(dates[2].toISOString());
    });

    // ─────────────────────────────────────────────────────────────
    // T041 — Multiple polygons → one entry per polygon
    // ─────────────────────────────────────────────────────────────

    it('T041: multiple polygons — one entry per locationId', async () => {
        const locations = ['Cuenca.NAM.E_08', 'Cuenca.NAM.E_09', 'Cuenca.NAM.E_10'];
        const forecastDate = new Date('2026-07-14T00:00:00Z');

        for (const locationId of locations) {
            const series = buildSeriesEntity({
                locationId,
                parameterId: 'P.areal.harmonie.subcNAM.24H',
                forecastDate,
                provider: 'harmonie',
                layer: 'subcNAM',
                stat: null,
                accumulation: '24h',
            });
            await repo.upsertWithEvents(series, []);
        }

        const { body } = await getLatest({ layer: 'subcNAM', provider: 'harmonie', accumulation: '24h' }).expect(
            HttpStatus.OK,
        );

        // Each polygon should appear exactly once
        const seriesArr = body.series as any[];
        const locationIds = seriesArr.map((s: any) => s.locationId);
        const unique = new Set(locationIds);
        expect(unique.size).toBe(locationIds.length);
        expect(unique.size).toBe(3);
    });

    // ─────────────────────────────────────────────────────────────
    // T042 — Missing required param → 400
    // ─────────────────────────────────────────────────────────────

    it('T042: missing required param — returns 400', async () => {
        // Missing layer
        await getLatest({ provider: 'harmonie', accumulation: '24h' }).expect(HttpStatus.BAD_REQUEST);

        // Missing provider
        await getLatest({ layer: 'subcNAM', accumulation: '24h' }).expect(HttpStatus.BAD_REQUEST);

        // Missing accumulation
        await getLatest({ layer: 'subcNAM', provider: 'harmonie' }).expect(HttpStatus.BAD_REQUEST);
    });

    // ─────────────────────────────────────────────────────────────
    // T043 — stat=Max with provider=harmonie → 400
    // ─────────────────────────────────────────────────────────────

    it('T043: stat=Max with provider=harmonie — returns 400 (invalid combination)', async () => {
        await getLatest({ layer: 'subcNAM', provider: 'harmonie', accumulation: '24h', stat: 'Max' }).expect(
            HttpStatus.BAD_REQUEST,
        );
    });

    // ─────────────────────────────────────────────────────────────
    // T044 — No data matching filter → 200 with empty series
    // ─────────────────────────────────────────────────────────────

    it('T044: no matching data — returns 200 with series: []', async () => {
        const { body } = await getLatest({ layer: 'subcNAM', provider: 'harmonie', accumulation: '24h' }).expect(
            HttpStatus.OK,
        );

        expect(body.series).toEqual([]);
    });

    // ─────────────────────────────────────────────────────────────
    // T045 — includeEvents=true returns events; default omits events
    // ─────────────────────────────────────────────────────────────

    it('T045: includeEvents=true returns events; default omits events key', async () => {
        const locationId = 'Cuenca.NAM.E_08';
        const forecastDate = new Date('2026-07-14T00:00:00Z');

        const series = buildSeriesEntity({
            locationId,
            parameterId: 'P.areal.harmonie.subcNAM.24H',
            forecastDate,
            provider: 'harmonie',
            layer: 'subcNAM',
            stat: null,
            accumulation: '24h',
        });
        await repo.upsertWithEvents(series, [
            buildEventEntity({
                seriesId: 'placeholder',
                eventDate: new Date('2026-07-14T01:00:00Z'),
                value: 1.5,
                flag: 2,
            }),
        ]);

        // Without events (default)
        const { body: bodyWithout } = await getLatest({
            layer: 'subcNAM',
            provider: 'harmonie',
            accumulation: '24h',
        }).expect(HttpStatus.OK);

        const seriesWithout = (bodyWithout.series as any[]).find((s: any) => s.locationId === locationId);
        expect(seriesWithout).toBeDefined();
        expect(seriesWithout.events).toBeUndefined();
        // max and last should be present since we have events
        expect(seriesWithout.max).toBeDefined();
        expect(seriesWithout.last).toBeDefined();

        // With events
        const { body: bodyWith } = await getLatest({
            layer: 'subcNAM',
            provider: 'harmonie',
            accumulation: '24h',
            includeEvents: 'true',
        }).expect(HttpStatus.OK);

        const seriesWith = (bodyWith.series as any[]).find((s: any) => s.locationId === locationId);
        expect(seriesWith).toBeDefined();
        expect(Array.isArray(seriesWith.events)).toBe(true);
        expect(seriesWith.events.length).toBeGreaterThan(0);
    });
});
