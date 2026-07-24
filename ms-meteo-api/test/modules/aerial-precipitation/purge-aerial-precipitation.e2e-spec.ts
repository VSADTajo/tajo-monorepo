import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { CommandBus } from '@nestjs/cqrs';

import { AerialPrecipitationSeries } from '../../../src/app/domain/entities/aerial-precipitation-series.entity';
import { AerialPrecipitationEvent } from '../../../src/app/domain/entities/aerial-precipitation-event.entity';
import { IAerialPrecipitationSeriesRepository } from '../../../src/app/domain/ports/aerial-precipitation-series-repository.port';
import {
    PurgeOldAerialPrecipitationCommand,
    PurgeOldAerialPrecipitationHandler,
} from '../../../src/app/application/commands/aerial-precipitation.commands';
import { AerialPrecipitationCacheKeys } from '../../../src/app/infrastructure/cache/cache-config.registry';
import { createAerialPrecipTestApp, AerialPrecipTestContext } from '../../helpers/aerial-precipitation-test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildSeriesEntity, buildEventEntity } from '../../factories/aerial-precipitation.factory';

describe('Purge Aerial Precipitation (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let ctx: AerialPrecipTestContext;
    let commandBus: CommandBus;
    let repo: IAerialPrecipitationSeriesRepository;
    let seriesRepo: Repository<AerialPrecipitationSeries>;
    let eventRepo: Repository<AerialPrecipitationEvent>;

    beforeAll(async () => {
        ctx = await createAerialPrecipTestApp({
            extraProviders: [PurgeOldAerialPrecipitationHandler],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
        commandBus = app.get(CommandBus);
        repo = app.get<IAerialPrecipitationSeriesRepository>(IAerialPrecipitationSeriesRepository);
        seriesRepo = ctx.seriesRepo;
        eventRepo = ctx.eventRepo;
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
    // T080 — Purge deletes old series but keeps recent ones
    // ─────────────────────────────────────────────────────────────

    it('T080: purge — deletes series older than cutoff, keeps recent ones intact', async () => {
        const now = new Date();
        const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
        const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

        // Seed old series with events
        const oldSeries = buildSeriesEntity({
            locationId: 'Cuenca.NAM.E_08',
            parameterId: 'P.areal.harmonie.subcNAM.24H',
            forecastDate: oldDate,
            provider: 'harmonie',
            layer: 'subcNAM',
            stat: null,
            accumulation: '24h',
        });
        await repo.upsertWithEvents(oldSeries, [
            buildEventEntity({
                seriesId: 'placeholder',
                eventDate: new Date(oldDate.getTime() + 3600000),
                value: 1.5,
                flag: 2,
            }),
        ]);

        // Seed recent series with events
        const recentSeries = buildSeriesEntity({
            locationId: 'Cuenca.NAM.E_09',
            parameterId: 'P.areal.harmonie.subcNAM.24H',
            forecastDate: recentDate,
            provider: 'harmonie',
            layer: 'subcNAM',
            stat: null,
            accumulation: '24h',
        });
        await repo.upsertWithEvents(recentSeries, [
            buildEventEntity({
                seriesId: 'placeholder',
                eventDate: new Date(recentDate.getTime() + 3600000),
                value: 2.0,
                flag: 2,
            }),
        ]);

        // Verify both seeded
        expect(await seriesRepo.count()).toBe(2);
        expect(await eventRepo.count()).toBe(2);

        // Run purge with retentionDays=30 (cutoff = 30 days ago → old series is 60 days old, should be deleted)
        const result = await commandBus.execute(new PurgeOldAerialPrecipitationCommand({ retentionDays: 30 }));

        expect(result.deletedCount).toBe(1);

        // Only recent series should remain
        const remainingSeries = await seriesRepo.find();
        expect(remainingSeries.length).toBe(1);
        expect(remainingSeries[0].locationId).toBe('Cuenca.NAM.E_09');

        // Cascaded events of old series should be gone too
        const remainingEvents = await eventRepo.find();
        expect(remainingEvents.length).toBe(1); // only recent series's event
    });

    // ─────────────────────────────────────────────────────────────
    // T081 — Purge invalidates cache when it deletes ≥1 series
    // ─────────────────────────────────────────────────────────────

    it('T081: purge cache invalidation — delByPattern called when purge deletes ≥1 series', async () => {
        const now = new Date();
        const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const oldSeries = buildSeriesEntity({
            locationId: 'Cuenca.NAM.E_08',
            parameterId: 'P.areal.harmonie.subcNAM.24H',
            forecastDate: oldDate,
            provider: 'harmonie',
            layer: 'subcNAM',
            stat: null,
            accumulation: '24h',
        });
        await repo.upsertWithEvents(oldSeries, []);

        // Run purge
        await commandBus.execute(new PurgeOldAerialPrecipitationCommand({ retentionDays: 30 }));

        // Cache should have been invalidated
        expect(ctx.cacheService.delByPattern).toHaveBeenCalledWith(AerialPrecipitationCacheKeys.pattern());
    });
});
