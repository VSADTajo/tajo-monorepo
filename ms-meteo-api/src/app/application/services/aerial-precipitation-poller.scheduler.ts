import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Logger } from 'nestjs-pino';

import { AerialPrecipitationConfigService } from '@config/aerial-precipitation/aerial-precipitation-config.service';
import { PollAerialPrecipitationCommand } from '@application/commands/aerial-precipitation.commands';

const POLLER_INTERVAL_NAME = 'aerial-precipitation-poll';

/**
 * Schedules the SFTP poll for FEWS aerial-precipitation JSON files.
 *
 * Uses `@nestjs/schedule` SchedulerRegistry (interval-based) so the interval
 * is driven by `AerialPrecipitationConfigService.pollIntervalMs` (env var
 * `AERIAL_PRECIP_POLL_INTERVAL_MS`, default 5 min).
 *
 * Lives in application layer: orchestrates `PollAerialPrecipitationCommand`.
 */
@Injectable()
export class AerialPrecipitationPollerScheduler implements OnModuleInit {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly schedulerRegistry: SchedulerRegistry,
        private readonly config: AerialPrecipitationConfigService,
    ) {}

    onModuleInit(): void {
        const intervalMs = this.config.pollIntervalMs;

        const callback = async () => {
            this.logger.log({ msg: 'aerial-precipitation poller: interval tick fired', intervalMs });
            try {
                const result = await this.commandBus.execute(
                    new PollAerialPrecipitationCommand({
                        sftpDirectory: this.config.sftpDirectory,
                        filePrefixes: this.config.filePrefixes,
                    }),
                );
                this.logger.log({
                    msg: 'aerial-precipitation poller: poll complete',
                    filesProcessed: result.filesProcessed,
                    seriesPersisted: result.seriesPersisted,
                });
            } catch (err) {
                this.logger.error({
                    msg: 'aerial-precipitation poller: unhandled error in poll cycle',
                    error: (err as Error).message,
                });
            }
        };

        const intervalRef = setInterval(callback, intervalMs);
        this.schedulerRegistry.addInterval(POLLER_INTERVAL_NAME, intervalRef);

        this.logger.log({
            msg: 'aerial-precipitation poller registered',
            intervalMs,
            directory: this.config.sftpDirectory,
        });
    }
}
