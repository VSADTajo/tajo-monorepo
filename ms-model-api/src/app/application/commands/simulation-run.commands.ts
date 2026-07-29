import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { ISimulationRunRepository } from '@domain/ports/simulation-run-repository.port';
import { SimulationRun } from '@domain/entities/simulation-run.entity';
import { SimulationRunResult } from '@domain/results/simulation-run.result';
import { SimulationRunStatus } from '@domain/types/simulation-run-status.enum';
import { ModelSource } from '@domain/types/model-source.type';
import { ApiError } from '@domain/errors/api.error';

// ─────────────────────────────────────────────────────────────
// RegisterSimulationRun
// ─────────────────────────────────────────────────────────────

export interface IRegisterSimulationRunCommand {
    simulationId: string;
    outputFolder: string;
    modelSource: ModelSource;
}

export class RegisterSimulationRunCommand {
    constructor(private readonly parameters: IRegisterSimulationRunCommand) {}

    get simulationId(): string {
        return this.parameters.simulationId;
    }

    get outputFolder(): string {
        return this.parameters.outputFolder;
    }

    get modelSource(): ModelSource {
        return this.parameters.modelSource;
    }
}

@CommandHandler(RegisterSimulationRunCommand)
export class RegisterSimulationRunHandler implements ICommandHandler<
    RegisterSimulationRunCommand,
    SimulationRunResult
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly simulationRunRepository: ISimulationRunRepository,
    ) {}

    async execute(command: RegisterSimulationRunCommand): Promise<SimulationRunResult> {
        const existing = await this.simulationRunRepository.findBySimulationId(command.simulationId);

        if (existing) {
            this.logger.log({
                msg: 'SimulationRun already exists — skipping creation (idempotent)',
                entity: 'SimulationRun',
                simulationId: command.simulationId,
            });
            return new SimulationRunResult({
                id: existing.id,
                simulationId: existing.simulationId,
                outputFolder: existing.outputFolder,
                status: existing.status,
                startedAt: existing.startedAt,
                completedAt: existing.completedAt,
                errorMessage: existing.errorMessage,
            });
        }

        const run = new SimulationRun({
            simulationId: command.simulationId,
            outputFolder: command.outputFolder,
            modelSource: command.modelSource,
            status: SimulationRunStatus.WAITING_RESULT,
            startedAt: new Date(),
            completedAt: null,
            errorMessage: null,
        });

        run.validate();

        const persisted = await this.simulationRunRepository.create(run);

        this.logger.log({
            msg: 'SimulationRun created',
            entity: 'SimulationRun',
            simulationId: persisted.simulationId,
            id: persisted.id,
        });

        return new SimulationRunResult({
            id: persisted.id,
            simulationId: persisted.simulationId,
            outputFolder: persisted.outputFolder,
            status: persisted.status,
            startedAt: persisted.startedAt,
            completedAt: persisted.completedAt,
            errorMessage: persisted.errorMessage,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// AttachFewsTask
// ─────────────────────────────────────────────────────────────

export interface IAttachFewsTaskCommand {
    simulationId: string;
    fewsTaskId: string;
}

/** Links a run to the FEWS task that is producing its results. */
export class AttachFewsTaskCommand {
    constructor(private readonly parameters: IAttachFewsTaskCommand) {}

    get simulationId(): string {
        return this.parameters.simulationId;
    }

    get fewsTaskId(): string {
        return this.parameters.fewsTaskId;
    }
}

@CommandHandler(AttachFewsTaskCommand)
export class AttachFewsTaskHandler implements ICommandHandler<AttachFewsTaskCommand, void> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly simulationRunRepository: ISimulationRunRepository,
    ) {}

    async execute(command: AttachFewsTaskCommand): Promise<void> {
        const run = await this.simulationRunRepository.findBySimulationId(command.simulationId);

        if (!run) {
            // The run is created from the same event moments earlier, so this
            // means something is off — losing the task id would leave the run
            // waiting on a folder no one will ever write to.
            throw new ApiError(
                HttpStatus.NOT_FOUND,
                `No simulation run for "${command.simulationId}" — cannot attach FEWS task "${command.fewsTaskId}"`,
            );
        }

        run.fewsTaskId = command.fewsTaskId;
        await this.simulationRunRepository.update(run);

        this.logger.log({
            msg: 'FEWS task attached to simulation run',
            entity: 'SimulationRun',
            simulationId: command.simulationId,
            fewsTaskId: command.fewsTaskId,
        });
    }
}
