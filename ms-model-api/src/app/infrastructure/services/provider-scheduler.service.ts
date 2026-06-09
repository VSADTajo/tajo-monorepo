import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';
import { CronJob } from 'cron';
import { Logger } from 'nestjs-pino';

import { IProviderConfigRepository } from '@domain/ports/provider-config-repository.port';
import { ProviderConfig } from '@domain/entities/provider-config.entity';
import { ExecuteIngestionCommand } from '@application/commands/ingestion.commands';
import { PurgeOldIngestionRunsCommand } from '@application/commands/cleanup.commands';

const DEFAULT_CLEANUP_CRON = '0 4 * * *';
const DEFAULT_RETENTION_DAYS = 90;

@Injectable()
export class ProviderSchedulerService implements OnModuleInit {
    private readonly retentionDays: number;

    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly schedulerRegistry: SchedulerRegistry,
        private readonly providerConfigRepository: IProviderConfigRepository,
        private readonly commandBus: CommandBus,
    ) {
        const raw = parseInt(process.env.RETENTION_DAYS || '', 10);
        this.retentionDays = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RETENTION_DAYS;
    }

    async onModuleInit(): Promise<void> {
        this.logger.log('Initializing provider scheduler...');

        const activeProviders = await this.providerConfigRepository.findActive();

        for (const config of activeProviders) {
            this.registerJob(config);
        }

        this.logger.log(`Registered ${activeProviders.length} provider scheduling jobs`);

        try {
            this.registerCleanupJob();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error({
                msg: 'Failed to register cleanup cron job',
                entity: 'ProviderScheduler',
                error: message,
            });
        }
    }

    private registerCleanupJob(): void {
        const expression = process.env.CLEANUP_CRON || DEFAULT_CLEANUP_CRON;
        const job = new CronJob(expression, () => {
            void this.runCleanup();
        });
        this.schedulerRegistry.addCronJob('ingestion-runs-cleanup', job);
        job.start();
        this.logger.log(
            `Registered ingestion runs cleanup cron: ${expression} (retention: ${this.retentionDays} days)`,
        );
    }

    private async runCleanup(): Promise<void> {
        try {
            this.logger.log('Cleanup cron tick: purging old ingestion runs');
            await this.commandBus.execute(new PurgeOldIngestionRunsCommand({ retentionDays: this.retentionDays }));
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error({ msg: 'Cleanup cron tick failed', entity: 'ProviderScheduler', error: message });
        }
    }

    registerJob(config: ProviderConfig): void {
        const key = `provider-${config.id}`;
        const intervalMs = config.pollingIntervalMinutes * 60 * 1000;

        this.logger.log(`Registering scheduled job "${key}" with interval ${config.pollingIntervalMinutes} minutes`);

        const interval = setInterval(async () => {
            try {
                this.logger.log(`Executing scheduled ingestion for provider: ${config.id}`);
                await this.commandBus.execute(new ExecuteIngestionCommand({ providerConfigId: config.id }));
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error({
                    msg: 'Scheduled ingestion failed',
                    entity: 'ProviderScheduler',
                    providerConfigId: config.id,
                    error: message,
                });
            }
        }, intervalMs);

        this.schedulerRegistry.addInterval(key, interval);
    }

    removeJob(configId: string): void {
        const key = `provider-${configId}`;

        try {
            this.schedulerRegistry.deleteInterval(key);
            this.logger.log(`Removed scheduled job "${key}"`);
        } catch (error) {
            this.logger.warn(`No scheduled job found for key "${key}"`);
        }
    }
}
