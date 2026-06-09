import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Logger } from 'nestjs-pino';

import { PurgeMeteoGranulesCommand, SyncMeteoCommand } from '@application/commands/meteo.commands';
import { TriggerSource } from '@domain/types/ingest-status.enum';
import { MeteoConfigService } from '@config/meteo/meteo-config.service';

const SYNC_JOB_NAME = 'meteo-sync';
const RETENTION_JOB_NAME = 'meteo-retention';

/**
 * Schedules the periodic ingest cycle. The cron expression and concurrency
 * come from `MeteoConfigService` (env-driven). Failures inside the worker
 * never escape — the next tick retries automatically because GeoServer is
 * the source of truth for "what is published".
 *
 * The retention cron is registered too (purges granules older than the
 * configured retention window). Both jobs share the same lifecycle.
 *
 * NOTE: This scheduler lives in application layer because it orchestrates
 * use cases (commands). It's an "input adapter" similar to controllers.
 */
@Injectable()
export class MeteoSyncScheduler implements OnModuleInit {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly schedulerRegistry: SchedulerRegistry,
        private readonly config: MeteoConfigService,
    ) {}

    onModuleInit(): void {
        this.registerSyncJob();
        this.registerRetentionJob();
    }

    private registerSyncJob(): void {
        const expression = this.config.meteoSyncCron;
        const job = new CronJob(expression, () => {
            void this.runIngestCycle();
        });
        this.schedulerRegistry.addCronJob(SYNC_JOB_NAME, job);
        job.start();
        this.logger.log(`Registered meteo sync cron: ${expression}`);
    }

    /**
     * Public so tests can invoke it directly without waiting for a cron tick.
     */
    async runIngestCycle(): Promise<void> {
        try {
            this.logger.log('Meteo sync cron tick: dispatching SyncMeteoCommand');
            await this.commandBus.execute(new SyncMeteoCommand({ triggeredBy: TriggerSource.CRON }));
        } catch (err) {
            this.logger.error({ msg: 'Meteo sync cron failed', entity: 'MeteoSync', error: String(err) });
        }
    }

    private registerRetentionJob(): void {
        const expression = this.config.meteoRetentionCron;
        const job = new CronJob(expression, () => {
            void this.runRetentionCycle();
        });
        this.schedulerRegistry.addCronJob(RETENTION_JOB_NAME, job);
        job.start();
        this.logger.log(`Registered meteo retention cron: ${expression}`);
    }

    /** Public so tests can invoke retention directly. */
    async runRetentionCycle(): Promise<void> {
        try {
            this.logger.log('Meteo retention cron tick: dispatching PurgeMeteoGranulesCommand');
            await this.commandBus.execute(new PurgeMeteoGranulesCommand());
        } catch (err) {
            this.logger.error({ msg: 'Meteo sync cron failed', entity: 'MeteoSync', error: String(err) });
        }
    }
}
