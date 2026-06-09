import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { ISimulationRepository } from '@domain/ports/simulation-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { SimulationCacheKeys, PredictionCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// PurgeOldSimulations
// ─────────────────────────────────────────────────────────────

export interface IPurgeOldSimulationsCommand {
    retentionDays: number;
}

export class PurgeOldSimulationsCommand {
    constructor(private readonly parameters: IPurgeOldSimulationsCommand) {}
    get retentionDays(): number {
        return this.parameters.retentionDays;
    }
}

export interface PurgeOldSimulationsResult {
    deletedCount: number;
}

@CommandHandler(PurgeOldSimulationsCommand)
export class PurgeOldSimulationsHandler implements ICommandHandler<
    PurgeOldSimulationsCommand,
    PurgeOldSimulationsResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: PurgeOldSimulationsCommand): Promise<PurgeOldSimulationsResult> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - command.retentionDays);

        this.logger.log(
            `Purging simulations older than ${cutoffDate.toISOString()} (${command.retentionDays} days retention)`,
        );

        const deletedCount = await this.simulationRepository.deleteOlderThan(cutoffDate);

        if (deletedCount > 0) {
            await this.cacheService.delByPattern(SimulationCacheKeys.pattern());
            await this.cacheService.delByPattern(PredictionCacheKeys.pattern());
            this.logger.log(`Purged ${deletedCount} old simulations and invalidated cache`);
        } else {
            this.logger.log('No old simulations to purge');
        }

        return { deletedCount };
    }
}
