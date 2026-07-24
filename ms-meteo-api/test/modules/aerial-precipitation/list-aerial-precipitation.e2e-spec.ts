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

describe('List Aerial Precipitation (e2e)', () => {
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

    function listSeries(query: Record<string, string | number | boolean | string[]> = {}) {
        return request(app.getHttpServer()).get('/aerial-precipitation').query(query);
    }

    // ─────────────────────────────────────────────────────────────
    // T060 — Combined filters return expected subset
    // ─────────────────────────────────────────────────────────────

    it('T060: combined filters — returns expected subset', async () => {
        // Seed 3 series: 2 harmonie/subcNAM/24h, 1 ens/subcNAM/Med/24h
        const loc1 = 'Cuenca.NAM.E_08';
        const loc2 = 'Cuenca.NAM.E_09';
        const loc3 = 'Cuenca.NAM.E_10';
        const fd = new Date('2026-07-14T00:00:00Z');

        await repo.upsertWithEvents(
            buildSeriesEntity({
                locationId: loc1,
                parameterId: 'P.areal.harmonie.subcNAM.24H',
                forecastDate: fd,
                provider: 'harmonie',
                layer: 'subcNAM',
                stat: null,
                accumulation: '24h',
            }),
            [],
        );
        await repo.upsertWithEvents(
            buildSeriesEntity({
                locationId: loc2,
                parameterId: 'P.areal.harmonie.subcNAM.24H',
                forecastDate: fd,
                provider: 'harmonie',
                layer: 'subcNAM',
                stat: null,
                accumulation: '24h',
            }),
            [],
        );
        await repo.upsertWithEvents(
            buildSeriesEntity({
                locationId: loc3,
                parameterId: 'P.areal.ens.subcNAM.Med.24h',
                forecastDate: fd,
                provider: 'ens',
                layer: 'subcNAM',
                stat: 'Med',
                accumulation: '24h',
            }),
            [],
        );

        // Filter by provider=harmonie → 2 results
        const { body: harmonieResults } = await listSeries({ provider: 'harmonie' }).expect(HttpStatus.OK);
        expect(harmonieResults.total).toBe(2);
        expect(harmonieResults.data.length).toBe(2);
        expect(harmonieResults.page).toBe(1);
        expect(harmonieResults.limit).toBe(50);

        // Filter by locationId (repeated) → loc1 + loc2 only
        const { body: locFilter } = await listSeries({ locationId: [loc1, loc2] }).expect(HttpStatus.OK);
        expect(locFilter.total).toBe(2);

        // Filter by layer=subcNAM + provider=ens → 1 result
        const { body: ensResults } = await listSeries({ layer: 'subcNAM', provider: 'ens' }).expect(HttpStatus.OK);
        expect(ensResults.total).toBe(1);

        // Pagination: page=1, limit=2 → first 2
        const { body: paged } = await listSeries({ limit: 2, page: 1 }).expect(HttpStatus.OK);
        expect(paged.data.length).toBe(2);
        expect(paged.total).toBe(3);
        expect(paged.limit).toBe(2);
    });

    // ─────────────────────────────────────────────────────────────
    // T061 — Pagination bounds validation
    // ─────────────────────────────────────────────────────────────

    it('T061: pagination bounds — limit=0 → 400, limit=501 → 400, page=0 → 400', async () => {
        await listSeries({ limit: 0, page: 1 }).expect(HttpStatus.BAD_REQUEST);
        await listSeries({ limit: 501, page: 1 }).expect(HttpStatus.BAD_REQUEST);
        await listSeries({ limit: 50, page: 0 }).expect(HttpStatus.BAD_REQUEST);
    });

    // ─────────────────────────────────────────────────────────────
    // T062 — Unknown query param → 400
    // ─────────────────────────────────────────────────────────────

    it('T062: unknown query param — returns 400 with property name', async () => {
        const { body } = await listSeries({ unknownParam: 'foo' }).expect(HttpStatus.BAD_REQUEST);
        expect(JSON.stringify(body)).toContain('unknownParam');
    });

    // ─────────────────────────────────────────────────────────────
    // T063 — includeEvents toggle payload size
    // ─────────────────────────────────────────────────────────────

    it('T063: includeEvents toggle — with true has events, without omits events key', async () => {
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
                value: 1.5,
                flag: 2,
            }),
        ]);

        // Without includeEvents
        const { body: bodyWithout } = await listSeries({}).expect(HttpStatus.OK);
        expect(bodyWithout.total).toBe(1);
        expect(bodyWithout.data[0].events).toBeUndefined();

        // With includeEvents=true
        const { body: bodyWith } = await listSeries({ includeEvents: 'true' }).expect(HttpStatus.OK);
        expect(bodyWith.total).toBe(1);
        expect(Array.isArray(bodyWith.data[0].events)).toBe(true);
        expect(bodyWith.data[0].events.length).toBe(1);
    });
});
