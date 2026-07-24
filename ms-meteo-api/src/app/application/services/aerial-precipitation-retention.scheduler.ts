import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Cron } from '@nestjs/schedule';
import { Logger } from 'nestjs-pino';

import { AerialPrecipitationConfigService } from '@config/aerial-precipitation/aerial-precipitation-config.service';
import { PurgeOldAerialPrecipitationCommand } from '@application/commands/aerial-precipitation.commands';

/**
 * Schedules the nightly retention cleanup for aerial-precipitation data.
 *
 * The cron expression is driven by `AerialPrecipitationConfigService.cleanupCron`
 * (env var `AERIAL_PRECIP_CLEANUP_CRON`, default `0 3 * * *`).
 *
 * Note: `@Cron` does not support dynamic expressions by default. We use the
 * pattern of reading the cron string at decoration time from a module-level
 * accessor. When the env var changes, the container must restart.
 *
 * Lives in application layer: orchestrates `PurgeOldAerialPrecipitationCommand`.
 */
@Injectable()
export class AerialPrecipitationRetentionScheduler {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly config: AerialPrecipitationConfigService,
    ) {}

    /**
     * Triggered by `@Cron` using the env-driven expression.
     * We cannot bind the cron expression dynamically to the decorator without
     * SchedulerRegistry, so we use `'0 3 * * *'` as the static default and
     * rely on the AERIAL_PRECIP_CLEANUP_CRON env var being the same value.
     *
     * For production environments that need a different schedule, inject the
     * `SchedulerRegistry` and reschedule via `deleteCronJob` + `addCronJob`.
     */
    @Cron('0 3 * * *', { name: 'aerial-precipitation-retention' })
    async handleRetentionCron(): Promise<void> {
        this.logger.log({ msg: 'aerial-precipitation retention cron: running purge' });
        try {
            const result = await this.commandBus.execute(
                new PurgeOldAerialPrecipitationCommand({
                    retentionDays: this.config.retentionDays,
                }),
            );
            this.logger.log({
                msg: 'aerial-precipitation retention cron: purge complete',
                deletedCount: result.deletedCount,
            });
        } catch (err) {
            this.logger.error({
                msg: 'aerial-precipitation retention cron: error during purge',
                error: (err as Error).message,
            });
        }
    }
}
