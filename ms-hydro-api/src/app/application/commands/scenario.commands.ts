import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { Scenario } from '@domain/entities/scenario.entity';
import { IScenarioRepository } from '@domain/ports/scenario-repository.port';
import { ScenarioMetadataResult, DeleteScenarioResult } from '@domain/results/scenario.results';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';

// ─────────────────────────────────────────────────────────────
// CreateScenario
// ─────────────────────────────────────────────────────────────

export interface ICreateScenarioCommand {
    name: string;
    description?: string | null;
    payload: Record<string, unknown>;
}

export class CreateScenarioCommand {
    constructor(private readonly parameters: ICreateScenarioCommand) {}
    get name(): string {
        return this.parameters.name;
    }
    get description(): string | null | undefined {
        return this.parameters.description;
    }
    get payload(): Record<string, unknown> {
        return this.parameters.payload;
    }
}

@CommandHandler(CreateScenarioCommand)
export class CreateScenarioHandler implements ICommandHandler<CreateScenarioCommand, ScenarioMetadataResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly scenarioRepository: IScenarioRepository,
    ) {}

    async execute(command: CreateScenarioCommand): Promise<ScenarioMetadataResult> {
        this.logger.log({ msg: 'Creating scenario', entity: 'Scenarios', name: command.name });

        // Derive metadata from the raw payload before persisting.
        const items = (command.payload as { items?: unknown }).items;
        const itemsCount = Array.isArray(items) ? items.length : 0;
        const sizeBytes = Buffer.byteLength(JSON.stringify(command.payload), 'utf8');

        const scenario = new Scenario({
            name: command.name,
            description: command.description ?? null,
            payload: command.payload,
            itemsCount,
            sizeBytes,
        });
        scenario.validate();

        const persisted = await this.scenarioRepository.create(scenario);

        this.logger.log({ msg: 'Scenario created', entity: 'Scenarios', id: persisted.id, itemsCount, sizeBytes });

        return new ScenarioMetadataResult({
            id: persisted.id,
            name: persisted.name,
            description: persisted.description,
            itemsCount: persisted.itemsCount,
            sizeBytes: persisted.sizeBytes,
            createdAt: persisted.createdAt!,
            updatedAt: persisted.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteScenario (hard delete — test data is disposable)
// ─────────────────────────────────────────────────────────────

export interface IDeleteScenarioCommand {
    id: string;
}

export class DeleteScenarioCommand {
    constructor(private readonly parameters: IDeleteScenarioCommand) {}
    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(DeleteScenarioCommand)
export class DeleteScenarioHandler implements ICommandHandler<DeleteScenarioCommand, DeleteScenarioResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly scenarioRepository: IScenarioRepository,
    ) {}

    async execute(command: DeleteScenarioCommand): Promise<DeleteScenarioResult> {
        this.logger.log({ msg: 'Deleting scenario', entity: 'Scenarios', id: command.id });

        try {
            await this.scenarioRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Scenario with id "${command.id}" not found`);
            }
            throw error;
        }

        await this.scenarioRepository.delete(command.id);

        this.logger.log({ msg: 'Scenario deleted', entity: 'Scenarios', id: command.id });

        return new DeleteScenarioResult({ id: command.id, deleted: true });
    }
}
