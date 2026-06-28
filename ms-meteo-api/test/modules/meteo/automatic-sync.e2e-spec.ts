import { CommandBus } from '@nestjs/cqrs';
import { Logger as PinoLogger } from 'nestjs-pino';

import { SyncMeteoCommand } from '../../../src/app/application/commands/meteo.commands';
import { TriggerSource } from '../../../src/app/domain/types/ingest-status.enum';
import { DatasetMutex } from '../../../src/app/application/services/dataset-mutex';
import { MeteoSyncScheduler } from '../../../src/app/application/services/meteo-sync.scheduler';

describe('DatasetMutex (unit)', () => {
    it('blocks concurrent acquires for the same dataset and releases on call', () => {
        const m = new DatasetMutex();
        const release1 = m.tryAcquire('HARMONIE', 'Precipitacion');
        expect(release1).not.toBeNull();
        const release2 = m.tryAcquire('HARMONIE', 'Precipitacion');
        expect(release2).toBeNull();

        release1!();
        const release3 = m.tryAcquire('HARMONIE', 'Precipitacion');
        expect(release3).not.toBeNull();
        release3!();
    });

    it('keys are independent across (provider, variable)', () => {
        const m = new DatasetMutex();
        expect(m.tryAcquire('HARMONIE', 'Precipitacion')).not.toBeNull();
        expect(m.tryAcquire('HARMONIE', 'Temperatura')).not.toBeNull();
        expect(m.tryAcquire('EPS', null)).not.toBeNull();
    });
});

/**
 * Smoke check that the cron-trigger code path dispatches a SyncMeteoCommand
 * with `triggeredBy: 'cron'`. We do NOT spin up the full Nest app here —
 * the heavy integration is already covered by sync-meteo-variable.e2e-spec.ts.
 */
describe('MeteoSyncScheduler (unit)', () => {
    it('dispatches SyncMeteoCommand with triggeredBy=cron when runIngestCycle() is called', async () => {
        const dispatched: SyncMeteoCommand[] = [];
        const fakeCommandBus = {
            execute: jest.fn(async (cmd: SyncMeteoCommand) => {
                dispatched.push(cmd);
            }),
        } as unknown as CommandBus;

        const fakeRegistry = { addCronJob: jest.fn() } as any;
        const fakeConfig = { meteoSyncCron: '0 */3 * * *', meteoRetentionCron: '0 3 * * *' } as any;
        const logger = { log: jest.fn(), error: jest.fn() } as unknown as PinoLogger;

        const scheduler = new MeteoSyncScheduler(logger, fakeCommandBus, fakeRegistry, fakeConfig);

        await scheduler.runIngestCycle();

        expect(fakeCommandBus.execute).toHaveBeenCalledTimes(1);
        expect(dispatched[0]).toBeInstanceOf(SyncMeteoCommand);
        expect(dispatched[0].triggeredBy).toBe(TriggerSource.CRON);
    });
});
