import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Logger } from 'nestjs-pino';

import { PurgeOldSimulationsCommand } from '@application/commands/cleanup.commands';

const CLEANUP_JOB_NAME = 'simulations-cleanup';
const DEFAULT_CRON = '0 2 * * *';
const DEFAULT_RETENTION_DAYS = 20;

@Injectable()
export class CleanupScheduler implements OnModuleInit {
    private readonly retentionDays: number;

    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly schedulerRegistry: SchedulerRegistry,
    ) {
        const raw = parseInt(process.env.RETENTION_DAYS || '', 10);
        this.retentionDays = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RETENTION_DAYS;
    }

    onModuleInit(): void {
        try {
            this.registerCleanupJob();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to register cleanup cron job: ${message}`);
        }
    }

    private registerCleanupJob(): void {
        const expression = process.env.CLEANUP_CRON || DEFAULT_CRON;
        const job = new CronJob(expression, () => {
            void this.runCleanup();
        });
        this.schedulerRegistry.addCronJob(CLEANUP_JOB_NAME, job);
        job.start();
        this.logger.log(`Registered simulations cleanup cron: ${expression} (retention: ${this.retentionDays} days)`);
    }

    async runCleanup(): Promise<void> {
        try {
            this.logger.log('Cleanup cron tick: purging old simulations');
            await this.commandBus.execute(new PurgeOldSimulationsCommand({ retentionDays: this.retentionDays }));
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Cleanup cron tick failed: ${message}`);
        }
    }
}
