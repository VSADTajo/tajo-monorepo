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

describe('By-Location Aerial Precipitation (e2e)', () => {
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

    function getByLocation(locationId: string, query: Record<string, string | boolean> = {}) {
        return request(app.getHttpServer()).get(`/aerial-precipitation/by-location/${locationId}`).query(query);
    }

    // ─────────────────────────────────────────────────────────────
    // T050 — Returns groups keyed by (provider, accumulation, stat)
    // ─────────────────────────────────────────────────────────────

    it('T050: returns groups keyed by (provider, accumulation, stat)', async () => {
        const locationId = 'Cuenca.NAM.E_08';
        const forecastDate = new Date('2026-07-14T00:00:00Z');

        // obs/1h/null
        await repo.upsertWithEvents(
            buildSeriesEntity({
                locationId,
                parameterId: 'P.areal.obs.subcNAM',
                forecastDate,
                provider: 'obs',
                layer: 'subcNAM',
                stat: null,
                accumulation: '1h',
            }),
            [],
        );

        // harmonie/24h/null
        await repo.upsertWithEvents(
            buildSeriesEntity({
                locationId,
                parameterId: 'P.areal.harmonie.subcNAM.24H',
                forecastDate,
                provider: 'harmonie',
                layer: 'subcNAM',
                stat: null,
                accumulation: '24h',
            }),
            [],
        );

        // ens/24h/Med
        await repo.upsertWithEvents(
            buildSeriesEntity({
                locationId,
                parameterId: 'P.areal.ens.subcNAM.Med.24h',
                forecastDate,
                provider: 'ens',
                layer: 'subcNAM',
                stat: 'Med',
                accumulation: '24h',
            }),
            [],
        );

        const { body } = await getByLocation(locationId).expect(HttpStatus.OK);

        expect(body.locationId).toBe(locationId);
        expect(Array.isArray(body.groups)).toBe(true);
        expect(body.groups.length).toBe(3);

        const providers = (body.groups as any[]).map((g: any) => g.provider);
        expect(providers).toEqual(expect.arrayContaining(['obs', 'harmonie', 'ens']));
    });

    // ─────────────────────────────────────────────────────────────
    // T051 — Invalid locationId format → 400
    // ─────────────────────────────────────────────────────────────

    it('T051: invalid locationId format — returns 400', async () => {
        await getByLocation('InvalidLocation.XYZ.123').expect(HttpStatus.BAD_REQUEST);
        await getByLocation('NotAValidPrefix.1').expect(HttpStatus.BAD_REQUEST);
    });

    // ─────────────────────────────────────────────────────────────
    // T052 — Well-formed locationId with no data → 200 with empty groups
    // ─────────────────────────────────────────────────────────────

    it('T052: well-formed locationId with no data — returns 200 with empty groups', async () => {
        const { body } = await getByLocation('Cuenca.NAM.E_99').expect(HttpStatus.OK);

        expect(body.locationId).toBe('Cuenca.NAM.E_99');
        expect(Array.isArray(body.groups)).toBe(true);
        expect(body.groups.length).toBe(0);
    });

    // ─────────────────────────────────────────────────────────────
    // T053 — Historical fan: ?fromForecastDate returns all matching snapshots
    // ─────────────────────────────────────────────────────────────

    it('T053: historical fan — fromForecastDate returns all matching snapshots', async () => {
        const locationId = 'Cuenca.NAM.E_08';

        // Seed 3 different forecastDates for the same group
        const forecastDates = [
            new Date('2026-07-12T00:00:00Z'),
            new Date('2026-07-13T00:00:00Z'),
            new Date('2026-07-14T00:00:00Z'),
        ];

        for (const forecastDate of forecastDates) {
            await repo.upsertWithEvents(
                buildSeriesEntity({
                    locationId,
                    parameterId: 'P.areal.harmonie.subcNAM.24H',
                    forecastDate,
                    provider: 'harmonie',
                    layer: 'subcNAM',
                    stat: null,
                    accumulation: '24h',
                }),
                [],
            );
        }

        // Without date range → only latest
        const { body: bodyLatest } = await getByLocation(locationId).expect(HttpStatus.OK);
        const harmGroup = (bodyLatest.groups as any[]).find(
            (g: any) => g.provider === 'harmonie' && g.accumulation === '24h',
        );
        expect(harmGroup.series.length).toBe(1);

        // With date range → all 3
        const { body: bodyAll } = await getByLocation(locationId, {
            fromForecastDate: '2026-07-12T00:00:00Z',
            toForecastDate: '2026-07-14T23:59:59Z',
        }).expect(HttpStatus.OK);

        const harmGroupAll = (bodyAll.groups as any[]).find(
            (g: any) => g.provider === 'harmonie' && g.accumulation === '24h',
        );
        expect(harmGroupAll.series.length).toBe(3);
    });

    // ─────────────────────────────────────────────────────────────
    // T054 — includeEvents=true includes events per series
    // ─────────────────────────────────────────────────────────────

    it('T054: includeEvents=true includes events per series', async () => {
        const locationId = 'Cuenca.NAM.E_08';
        const forecastDate = new Date('2026-07-14T00:00:00Z');

        const series = buildSeriesEntity({
            locationId,
            parameterId: 'P.areal.harmonie.subcNAM',
            forecastDate,
            provider: 'harmonie',
            layer: 'subcNAM',
            stat: null,
            accumulation: '1h',
        });

        await repo.upsertWithEvents(series, [
            buildEventEntity({
                seriesId: 'placeholder',
                eventDate: new Date('2026-07-14T01:00:00Z'),
                value: 0.5,
                flag: 2,
            }),
            buildEventEntity({
                seriesId: 'placeholder',
                eventDate: new Date('2026-07-14T02:00:00Z'),
                value: 0.8,
                flag: 2,
            }),
        ]);

        // Without includeEvents
        const { body: bodyWithout } = await getByLocation(locationId).expect(HttpStatus.OK);
        const groupWithout = (bodyWithout.groups as any[])[0];
        expect(groupWithout.series[0].events).toBeUndefined();

        // With includeEvents
        const { body: bodyWith } = await getByLocation(locationId, { includeEvents: 'true' }).expect(HttpStatus.OK);
        const groupWith = (bodyWith.groups as any[])[0];
        expect(Array.isArray(groupWith.series[0].events)).toBe(true);
        expect(groupWith.series[0].events.length).toBe(2);
    });
});
