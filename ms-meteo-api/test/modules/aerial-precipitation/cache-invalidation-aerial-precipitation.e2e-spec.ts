import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { CommandBus } from '@nestjs/cqrs';

import { IAerialPrecipitationSeriesRepository } from '../../../src/app/domain/ports/aerial-precipitation-series-repository.port';
import {
    PollAerialPrecipitationCommand,
    PollAerialPrecipitationHandler,
} from '../../../src/app/application/commands/aerial-precipitation.commands';
import {
    GetAerialPrecipitationLatestHandler,
    ListAerialPrecipitationHandler,
    GetAerialPrecipitationByLocationHandler,
} from '../../../src/app/application/queries/aerial-precipitation.queries';
import { AerialPrecipitationController } from '../../../src/app/api/controllers/aerial-precipitation.controller';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';
import { AerialPrecipitationCacheKeys } from '../../../src/app/infrastructure/cache/cache-config.registry';
import { createAerialPrecipTestApp, AerialPrecipTestContext } from '../../helpers/aerial-precipitation-test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildSftpTree } from '../../helpers/sftp-api.mock';
import { buildSeriesEntity } from '../../factories/aerial-precipitation.factory';

import epsFixture from './fixtures/eps.sample.json';

describe('Cache Invalidation Aerial Precipitation (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let ctx: AerialPrecipTestContext;
    let commandBus: CommandBus;
    let repo: IAerialPrecipitationSeriesRepository;

    const SFTP_DIR = '/tagus/pareal';
    const EPS_FILENAME = 'tagus_eps_Pareal_202607140000.json';

    beforeAll(async () => {
        ctx = await createAerialPrecipTestApp({
            sftpRoot: buildSftpTree(SFTP_DIR, {}),
            extraProviders: [
                PollAerialPrecipitationHandler,
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
        commandBus = app.get(CommandBus);
        repo = app.get<IAerialPrecipitationSeriesRepository>(IAerialPrecipitationSeriesRepository);
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        ctx.sftpClient.setRoot(buildSftpTree(SFTP_DIR, {}));
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    function getLatest(query: Record<string, string | boolean> = {}) {
        return request(app.getHttpServer()).get('/aerial-precipitation/latest').query(query);
    }

    // ─────────────────────────────────────────────────────────────
    // T075 — Cache HIT survives JSON roundtrip
    // ─────────────────────────────────────────────────────────────

    it('T075: cache hit — controller returns 200 with correct shape when cache returns JSON-roundtripped result', async () => {
        // Seed one series so we have something to return
        const series = buildSeriesEntity({
            locationId: 'Cuenca.NAM.E_08',
            parameterId: 'P.areal.harmonie.subcNAM.24H',
            forecastDate: new Date('2026-07-14T00:00:00Z'),
            provider: 'harmonie',
            layer: 'subcNAM',
            stat: null,
            accumulation: '24h',
        });
        await repo.upsertWithEvents(series, []);

        // First call — populates cache mock (cacheService.get returns null → goes to DB)
        const { body: firstBody } = await getLatest({
            layer: 'subcNAM',
            provider: 'harmonie',
            accumulation: '24h',
        }).expect(HttpStatus.OK);

        expect(firstBody.series.length).toBe(1);

        // Now simulate a cache HIT by mocking get to return the JSON-roundtripped result
        // (this guards the "Map → {}" regression)
        const cachedPayload = JSON.parse(JSON.stringify(firstBody));
        ctx.cacheService.get.mockResolvedValueOnce(cachedPayload);

        const { body: cachedBody } = await getLatest({
            layer: 'subcNAM',
            provider: 'harmonie',
            accumulation: '24h',
        }).expect(HttpStatus.OK);

        // The cached result should have the same shape
        expect(cachedBody.series).toBeDefined();
        expect(Array.isArray(cachedBody.series)).toBe(true);
        expect(cachedBody.series.length).toBe(1);
        expect(cachedBody.series[0].locationId).toBe('Cuenca.NAM.E_08');
    });

    // ─────────────────────────────────────────────────────────────
    // T076 — Cache invalidated after successful poll
    // ─────────────────────────────────────────────────────────────

    it('T076: cache invalidation — delByPattern called after poll that persists ≥1 series', async () => {
        ctx.sftpClient.setRoot(
            buildSftpTree(SFTP_DIR, {
                [EPS_FILENAME]: JSON.stringify(epsFixture),
            }),
        );

        await commandBus.execute(new PollAerialPrecipitationCommand({ sftpDirectory: SFTP_DIR }));

        // delByPattern must have been called with the aerial-precipitation pattern
        expect(ctx.cacheService.delByPattern).toHaveBeenCalledWith(AerialPrecipitationCacheKeys.pattern());
    });
});
