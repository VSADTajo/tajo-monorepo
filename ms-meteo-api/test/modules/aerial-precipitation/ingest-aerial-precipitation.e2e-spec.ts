import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { CommandBus } from '@nestjs/cqrs';

import { AerialPrecipitationSeries } from '../../../src/app/domain/entities/aerial-precipitation-series.entity';
import { AerialPrecipitationEvent } from '../../../src/app/domain/entities/aerial-precipitation-event.entity';
import { IAerialPrecipitationSeriesRepository } from '../../../src/app/domain/ports/aerial-precipitation-series-repository.port';
import {
    PollAerialPrecipitationCommand,
    PollAerialPrecipitationHandler,
} from '../../../src/app/application/commands/aerial-precipitation.commands';
import { AerialPrecipitationController } from '../../../src/app/api/controllers/aerial-precipitation.controller';
import {
    ListAerialPrecipitationHandler,
    GetAerialPrecipitationLatestHandler,
    GetAerialPrecipitationByLocationHandler,
} from '../../../src/app/application/queries/aerial-precipitation.queries';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';
import { createAerialPrecipTestApp, AerialPrecipTestContext } from '../../helpers/aerial-precipitation-test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildSftpTree } from '../../helpers/sftp-api.mock';

// Fixtures
import epsFixture from './fixtures/eps.sample.json';
import harmonieFixture from './fixtures/harmonie.sample.json';

describe('Ingest Aerial Precipitation (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let ctx: AerialPrecipTestContext;
    let commandBus: CommandBus;
    let seriesRepo: Repository<AerialPrecipitationSeries>;
    let eventRepo: Repository<AerialPrecipitationEvent>;

    const EPS_FILENAME = 'tagus_eps_Pareal_202607140000.json';
    const HARMONIE_FILENAME = 'tagus_harmonie_Pareal_202607140000.json';
    const SFTP_DIR = '/tagus/pareal';

    beforeAll(async () => {
        ctx = await createAerialPrecipTestApp({
            sftpRoot: buildSftpTree(SFTP_DIR, {}),
            extraProviders: [
                PollAerialPrecipitationHandler,
                ListAerialPrecipitationHandler,
                GetAerialPrecipitationLatestHandler,
                GetAerialPrecipitationByLocationHandler,
                CachingQueryBus,
            ],
            extraControllers: [AerialPrecipitationController],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
        commandBus = app.get(CommandBus);
        seriesRepo = ctx.seriesRepo;
        eventRepo = ctx.eventRepo;
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        // Reset SFTP to empty directory and clear accumulated call counters
        ctx.sftpClient.setRoot(buildSftpTree(SFTP_DIR, {}));
        ctx.sftpClient.moveCalls = 0;
        ctx.sftpClient.moveLog = [];
        ctx.sftpClient.listCalls = 0;
        ctx.sftpClient.readCalls = 0;
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    // ─────────────────────────────────────────────────────────────
    // T030 — Happy path
    // ─────────────────────────────────────────────────────────────

    it('T030: happy path — persists series+events and moves file to historial/', async () => {
        // Arrange: put one EPS file in the SFTP dir
        ctx.sftpClient.setRoot(
            buildSftpTree(SFTP_DIR, {
                [EPS_FILENAME]: JSON.stringify(epsFixture),
            }),
        );

        // Act: dispatch the poll command
        const result = await commandBus.execute(new PollAerialPrecipitationCommand({ sftpDirectory: SFTP_DIR }));

        // Assert: result has counts > 0
        expect(result.seriesPersisted).toBeGreaterThan(0);
        expect(result.eventsPersisted).toBeGreaterThan(0);
        expect(result.filesProcessed).toBe(1);
        expect(result.filesFailed).toBe(0);

        // Assert: series are in DB
        const seriesInDb = await seriesRepo.find();
        expect(seriesInDb.length).toBeGreaterThan(0);

        // Assert: events are in DB
        const eventsInDb = await eventRepo.find();
        expect(eventsInDb.length).toBeGreaterThan(0);

        // Assert: file moved to historial/
        expect(ctx.sftpClient.moveCalls).toBe(1);
        expect(ctx.sftpClient.moveLog[0].sourcePath).toContain(EPS_FILENAME);
        expect(ctx.sftpClient.moveLog[0].destinationPath).toContain('historial/');
    });

    // ─────────────────────────────────────────────────────────────
    // T031 — Idempotence: same file again → no duplicate rows
    // ─────────────────────────────────────────────────────────────

    it('T031: idempotence — reprocessing same file leaves counts identical', async () => {
        // First run
        ctx.sftpClient.setRoot(
            buildSftpTree(SFTP_DIR, {
                [EPS_FILENAME]: JSON.stringify(epsFixture),
            }),
        );
        await commandBus.execute(new PollAerialPrecipitationCommand({ sftpDirectory: SFTP_DIR }));

        const seriesCount1 = await seriesRepo.count();
        const eventCount1 = await eventRepo.count();

        // Second run — put the file back
        ctx.sftpClient.setRoot(
            buildSftpTree(SFTP_DIR, {
                [EPS_FILENAME]: JSON.stringify(epsFixture),
            }),
        );
        await commandBus.execute(new PollAerialPrecipitationCommand({ sftpDirectory: SFTP_DIR }));

        const seriesCount2 = await seriesRepo.count();
        const eventCount2 = await eventRepo.count();

        // Counts must be identical
        expect(seriesCount2).toBe(seriesCount1);
        expect(eventCount2).toBe(eventCount1);
    });

    // ─────────────────────────────────────────────────────────────
    // T032 — Same natural key, new event values → REPLACE
    // ─────────────────────────────────────────────────────────────

    it('T032: replace — same natural key with new event values replaces old events', async () => {
        // First run with original EPS fixture
        ctx.sftpClient.setRoot(
            buildSftpTree(SFTP_DIR, {
                [EPS_FILENAME]: JSON.stringify(epsFixture),
            }),
        );
        await commandBus.execute(new PollAerialPrecipitationCommand({ sftpDirectory: SFTP_DIR }));

        // Grab the first series' events to compare later
        const seriesAfterFirstRun = await seriesRepo.findOne({ where: { sourceFileName: EPS_FILENAME } });
        expect(seriesAfterFirstRun).not.toBeNull();
        const eventsAfterFirstRun = await eventRepo.find({ where: { seriesId: seriesAfterFirstRun!.id } });
        const oldValues = eventsAfterFirstRun.map((e) => e.value);

        // Build modified fixture: same natural key, different values
        const modifiedFixture = JSON.parse(JSON.stringify(epsFixture)) as typeof epsFixture;
        // Change all event values by adding 100 to approved-flag events
        for (const ts of modifiedFixture.timeSeries) {
            for (const ev of ts.events) {
                if (ev.flag === '2' && parseFloat(ev.value) !== -999) {
                    (ev as { value: string }).value = String(parseFloat(ev.value) + 100);
                }
            }
        }

        // Second run with modified fixture
        ctx.sftpClient.setRoot(
            buildSftpTree(SFTP_DIR, {
                [EPS_FILENAME]: JSON.stringify(modifiedFixture),
            }),
        );
        await commandBus.execute(new PollAerialPrecipitationCommand({ sftpDirectory: SFTP_DIR }));

        // Verify values changed
        const eventsAfterSecondRun = await eventRepo.find({ where: { seriesId: seriesAfterFirstRun!.id } });
        const newValues = eventsAfterSecondRun.map((e) => e.value);

        // At least one value should differ (all approved ones were incremented by 100)
        const atLeastOneDiffers = newValues.some((v, i) => {
            if (i >= oldValues.length) return true;
            return v !== oldValues[i];
        });
        expect(atLeastOneDiffers).toBe(true);
    });

    // ─────────────────────────────────────────────────────────────
    // T033 — Malformed JSON → moved to historial/<name>.failed.<ts>
    // ─────────────────────────────────────────────────────────────

    it('T033: malformed JSON — moves to historial with .failed suffix, continues with other files', async () => {
        const MALFORMED = 'tagus_eps_Pareal_malformed.json';
        ctx.sftpClient.setRoot(
            buildSftpTree(SFTP_DIR, {
                [MALFORMED]: '{ this is not valid json !!!',
                [EPS_FILENAME]: JSON.stringify(epsFixture),
            }),
        );

        const result = await commandBus.execute(new PollAerialPrecipitationCommand({ sftpDirectory: SFTP_DIR }));

        // 2 files total: 1 malformed + 1 valid
        expect(result.filesProcessed).toBe(2);
        expect(result.filesFailed).toBe(1);
        expect(result.seriesPersisted).toBeGreaterThan(0);

        // The failed file must be moved to historial/ with .failed. in the name
        const failedMove = ctx.sftpClient.moveLog.find((m) => m.destinationPath.includes('.failed.'));
        expect(failedMove).toBeDefined();
        expect(failedMove!.sourcePath).toContain(MALFORMED);

        // The valid file was also moved (to plain historial/)
        const successMove = ctx.sftpClient.moveLog.find((m) => !m.destinationPath.includes('.failed.'));
        expect(successMove).toBeDefined();
    });

    // ─────────────────────────────────────────────────────────────
    // T034 — Unknown parameterId → series skipped, others persisted
    // ─────────────────────────────────────────────────────────────

    it('T034: unknown parameterId — series skipped with warning, others in same file persisted', async () => {
        // Build a fixture with one invalid + one valid series
        const mixedFixture = {
            version: '1.34',
            timeZone: '0.0',
            timeSeries: [
                {
                    // Invalid parameterId
                    header: {
                        ...epsFixture.timeSeries[0].header,
                        locationId: 'Sistema.Tajo.1',
                        parameterId: 'P.areal.foo.bar',
                    },
                    events: epsFixture.timeSeries[0].events,
                },
                {
                    // Valid parameterId
                    header: {
                        ...epsFixture.timeSeries[1].header,
                        locationId: 'Sistema.Tajo.1',
                        parameterId: 'P.areal.ens.sis10.Max',
                    },
                    events: epsFixture.timeSeries[1].events,
                },
            ],
        };

        ctx.sftpClient.setRoot(
            buildSftpTree(SFTP_DIR, {
                [EPS_FILENAME]: JSON.stringify(mixedFixture),
            }),
        );

        const result = await commandBus.execute(new PollAerialPrecipitationCommand({ sftpDirectory: SFTP_DIR }));

        // The valid series was persisted
        expect(result.seriesPersisted).toBe(1);
        // The invalid series was skipped
        expect(result.seriesSkipped).toBeGreaterThan(0);

        // Events from the valid series are in DB
        const eventsInDb = await eventRepo.find();
        expect(eventsInDb.length).toBeGreaterThan(0);
    });

    // ─────────────────────────────────────────────────────────────
    // T035 — missVal and flag != '2' events filtered at ingest
    // ─────────────────────────────────────────────────────────────

    it('T035: event filtering — missVal and non-approved flags are not persisted', async () => {
        // The harmonie fixture has events with value="-999.0" and flag="8"
        // They should be filtered out
        ctx.sftpClient.setRoot(
            buildSftpTree(SFTP_DIR, {
                [HARMONIE_FILENAME]: JSON.stringify(harmonieFixture),
            }),
        );

        await commandBus.execute(new PollAerialPrecipitationCommand({ sftpDirectory: SFTP_DIR }));

        // Check that no event has value of -999 or flag != 2
        const allEvents = await eventRepo.find();
        expect(allEvents.every((e) => e.value !== -999)).toBe(true);
        expect(allEvents.every((e) => e.flag === 2)).toBe(true);
        expect(allEvents.length).toBeGreaterThan(0);
    });

    // ─────────────────────────────────────────────────────────────
    // T036 — Advisory lock: concurrent polls → only one runs
    // ─────────────────────────────────────────────────────────────

    it('T036: advisory lock — second poll is skipped when lock is held', async () => {
        // Mock acquirePollAdvisoryLock to return false (lock held by another)
        const repo = app.get<IAerialPrecipitationSeriesRepository>(IAerialPrecipitationSeriesRepository);
        const acquireSpy = jest.spyOn(repo, 'acquirePollAdvisoryLock').mockResolvedValueOnce(false);

        ctx.sftpClient.setRoot(
            buildSftpTree(SFTP_DIR, {
                [EPS_FILENAME]: JSON.stringify(epsFixture),
            }),
        );

        const result = await commandBus.execute(new PollAerialPrecipitationCommand({ sftpDirectory: SFTP_DIR }));

        // When lock not acquired → no-op result
        expect(result.filesProcessed).toBe(0);
        expect(result.seriesPersisted).toBe(0);

        // No files moved
        expect(ctx.sftpClient.moveCalls).toBe(0);

        // DB should be empty
        const seriesInDb = await seriesRepo.count();
        expect(seriesInDb).toBe(0);

        acquireSpy.mockRestore();
    });
});
