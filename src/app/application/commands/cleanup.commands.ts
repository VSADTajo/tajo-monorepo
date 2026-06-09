import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IIngestionRunRepository } from '@domain/ports/ingestion-run-repository.port';

// ─────────────────────────────────────────────────────────────
// PurgeOldIngestionRuns
// ─────────────────────────────────────────────────────────────

export interface IPurgeOldIngestionRunsCommand {
    retentionDays: number;
}

export class PurgeOldIngestionRunsCommand {
    constructor(private readonly parameters: IPurgeOldIngestionRunsCommand) {}
    get retentionDays(): number {
        return this.parameters.retentionDays;
    }
}

export interface PurgeOldIngestionRunsResult {
    deletedCount: number;
}

@CommandHandler(PurgeOldIngestionRunsCommand)
export class PurgeOldIngestionRunsHandler implements ICommandHandler<
    PurgeOldIngestionRunsCommand,
    PurgeOldIngestionRunsResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly ingestionRunRepository: IIngestionRunRepository,
    ) {}

    async execute(command: PurgeOldIngestionRunsCommand): Promise<PurgeOldIngestionRunsResult> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - command.retentionDays);

        this.logger.log(
            `Purging ingestion runs older than ${cutoffDate.toISOString()} (${command.retentionDays} days retention)`,
        );

        const deletedCount = await this.ingestionRunRepository.deleteOlderThan(cutoffDate);

        if (deletedCount > 0) {
            this.logger.log(`Purged ${deletedCount} old ingestion runs`);
        } else {
            this.logger.log('No old ingestion runs to purge');
        }

        return { deletedCount };
    }
}
