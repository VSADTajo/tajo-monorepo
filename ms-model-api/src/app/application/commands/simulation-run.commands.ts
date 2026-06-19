import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { ISimulationRunRepository } from '@domain/ports/simulation-run-repository.port';
import { SimulationRun } from '@domain/entities/simulation-run.entity';
import { SimulationRunResult } from '@domain/results/simulation-run.result';
import { SimulationRunStatus } from '@domain/types/simulation-run-status.enum';

// ─────────────────────────────────────────────────────────────
// RegisterSimulationRun
// ─────────────────────────────────────────────────────────────

export interface IRegisterSimulationRunCommand {
    simulationId: string;
    outputFolder: string;
}

export class RegisterSimulationRunCommand {
    constructor(private readonly parameters: IRegisterSimulationRunCommand) {}

    get simulationId(): string {
        return this.parameters.simulationId;
    }

    get outputFolder(): string {
        return this.parameters.outputFolder;
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
