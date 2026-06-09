import { HttpStatus, Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { IProviderConfigRepository } from '@domain/ports/provider-config-repository.port';
import { IIngestionRunRepository } from '@domain/ports/ingestion-run-repository.port';
import { IMessageBroker } from '@domain/ports/message-broker.port';
import { IngestionRun } from '@domain/entities/ingestion-run.entity';
import { IngestionRunResult } from '@domain/results/ingestion-run.result';
import { IngestionStatus } from '@domain/types/ingestion-status.enum';
import { ProviderType } from '@domain/types/provider-type.enum';
import { ApiError } from '@domain/errors/api.error';

// Infrastructure
import { Topics } from '@infrastructure/messaging/messaging.registry';
import { DataProviderFactoryService } from '@infrastructure/services/data-provider-factory.service';

// ─────────────────────────────────────────────────────────────
// TriggerIngestion
// ─────────────────────────────────────────────────────────────

export interface ITriggerIngestionCommand {
    providerConfigId: string;
}

export class TriggerIngestionCommand {
    constructor(private readonly parameters: ITriggerIngestionCommand) {}

    get providerConfigId(): string {
        return this.parameters.providerConfigId;
    }
}

@CommandHandler(TriggerIngestionCommand)
export class TriggerIngestionHandler implements ICommandHandler<TriggerIngestionCommand, IngestionRunResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly providerConfigRepository: IProviderConfigRepository,
        private readonly commandBus: CommandBus,
    ) {}

    async execute(command: TriggerIngestionCommand): Promise<IngestionRunResult> {
        this.logger.log(`Manual trigger ingestion for provider config: ${command.providerConfigId}`);

        // 1. Find ProviderConfig or throw 404
        const config = await this.providerConfigRepository.findById(command.providerConfigId);
        if (!config) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Provider config with id "${command.providerConfigId}" not found`);
        }

        // 2. Dispatch ExecuteIngestionCommand (works for both active and inactive providers)
        const result = await this.commandBus.execute<ExecuteIngestionCommand, IngestionRunResult>(
            new ExecuteIngestionCommand({ providerConfigId: command.providerConfigId }),
        );

        return result;
    }
}

// ─────────────────────────────────────────────────────────────
// ExecuteIngestion
// ─────────────────────────────────────────────────────────────

export interface IExecuteIngestionCommand {
    providerConfigId: string;
}

export class ExecuteIngestionCommand {
    constructor(private readonly parameters: IExecuteIngestionCommand) {}

    get providerConfigId(): string {
        return this.parameters.providerConfigId;
    }
}

@CommandHandler(ExecuteIngestionCommand)
export class ExecuteIngestionHandler implements ICommandHandler<ExecuteIngestionCommand, IngestionRunResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly providerConfigRepository: IProviderConfigRepository,
        private readonly ingestionRunRepository: IIngestionRunRepository,
        private readonly messageBroker: IMessageBroker,
        private readonly dataProviderFactory: DataProviderFactoryService,
    ) {}

    async execute(command: ExecuteIngestionCommand): Promise<IngestionRunResult> {
        this.logger.log(`Executing ingestion for provider config: ${command.providerConfigId}`);

        // 1. Find ProviderConfig or throw 404
        const config = await this.providerConfigRepository.findById(command.providerConfigId);
        if (!config) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Provider config with id "${command.providerConfigId}" not found`);
        }

        // 2. Concurrency guard — check for running ingestion
        const runningRun = await this.ingestionRunRepository.findRunningByProviderConfigId(command.providerConfigId);
        if (runningRun) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                `Ingestion is already running for provider config "${command.providerConfigId}"`,
            );
        }

        // 3. Create IngestionRun with status=RUNNING
        const ingestionRun = new IngestionRun({
            providerConfigId: command.providerConfigId,
            status: IngestionStatus.RUNNING,
            startedAt: new Date(),
            seriesCount: 0,
            eventsCount: 0,
            completedAt: null,
            errorMessage: null,
        });
        ingestionRun.validate();
        const createdRun = await this.ingestionRunRepository.create(ingestionRun);
        const startTime = Date.now();

        try {
            // 4. Resolve provider via factory
            const provider = this.dataProviderFactory.getProvider(config.type as ProviderType);

            // 5. Fetch data
            const results = await provider.fetch(config);

            // 6. Calculate counts
            const seriesCount = results.length;
            const eventsCount = results.reduce((sum, series) => sum + series.events.length, 0);

            // 7. Publish to RabbitMQ topic
            await this.messageBroker.publishToTopic(
                Topics.MODEL_EVENTS.exchange,
                Topics.MODEL_EVENTS.routingKeys.TIMESERIES_INGESTED,
                {
                    providerConfigId: command.providerConfigId,
                    providerName: config.name,
                    providerType: config.type,
                    seriesCount,
                    eventsCount,
                    timeSeries: results,
                },
            );

            // 8. Update run with SUCCESS
            createdRun.status = IngestionStatus.SUCCESS;
            createdRun.seriesCount = seriesCount;
            createdRun.eventsCount = eventsCount;
            createdRun.completedAt = new Date();

            const updatedRun = await this.ingestionRunRepository.update(createdRun);

            this.logger.log({
                msg: 'Ingestion completed',
                runId: updatedRun.id,
                providerConfigId: command.providerConfigId,
                providerName: config.name,
                providerType: config.type,
                seriesCount,
                eventsCount,
                durationMs: Date.now() - startTime,
            });

            return new IngestionRunResult({
                id: updatedRun.id,
                providerConfigId: updatedRun.providerConfigId,
                status: updatedRun.status,
                startedAt: updatedRun.startedAt,
                completedAt: updatedRun.completedAt,
                seriesCount: updatedRun.seriesCount,
                eventsCount: updatedRun.eventsCount,
                errorMessage: updatedRun.errorMessage,
                createdAt: updatedRun.createdAt!,
                updatedAt: updatedRun.updatedAt!,
            });
        } catch (error) {
            // Update run with FAILED
            const message = error instanceof Error ? error.message : String(error);
            createdRun.status = IngestionStatus.FAILED;
            createdRun.errorMessage = message;
            createdRun.completedAt = new Date();

            const updatedRun = await this.ingestionRunRepository.update(createdRun);

            this.logger.error({
                msg: 'Ingestion failed',
                runId: updatedRun.id,
                providerConfigId: command.providerConfigId,
                providerName: config.name,
                providerType: config.type,
                error: message,
                stack: error instanceof Error ? error.stack : undefined,
                durationMs: Date.now() - startTime,
            });

            return new IngestionRunResult({
                id: updatedRun.id,
                providerConfigId: updatedRun.providerConfigId,
                status: updatedRun.status,
                startedAt: updatedRun.startedAt,
                completedAt: updatedRun.completedAt,
                seriesCount: updatedRun.seriesCount,
                eventsCount: updatedRun.eventsCount,
                errorMessage: updatedRun.errorMessage,
                createdAt: updatedRun.createdAt!,
                updatedAt: updatedRun.updatedAt!,
            });
        }
    }
}
