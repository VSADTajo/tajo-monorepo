import { HttpStatus, Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { Simulation, SimulationStatus, SimulationType } from '@domain/entities/simulation.entity';
import { SimulationDateValueObject } from '@domain/value-objects/simulation-date.value-object';
import { ISimulationRepository } from '@domain/ports/simulation-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { SimulationCacheKeys } from '@infrastructure/cache/cache-config.registry';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';
import { ProcessTimeSeriesCommand } from '@application/commands/prediction.commands';

// ─────────────────────────────────────────────────────────────
// FinalizeSimulation
// ─────────────────────────────────────────────────────────────

export interface IFinalizeSimulationCommand {
    id: string;
}

export class FinalizeSimulationCommand {
    constructor(private readonly parameters: IFinalizeSimulationCommand) {}

    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(FinalizeSimulationCommand)
export class FinalizeSimulationHandler implements ICommandHandler<FinalizeSimulationCommand, Simulation> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: FinalizeSimulationCommand): Promise<Simulation> {
        this.logger.log({ msg: 'Finalizing simulation', entity: 'Simulations', simulationId: command.id });

        // 1. Find simulation by id
        let simulation: Simulation;
        try {
            simulation = await this.simulationRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Simulation with id "${command.id}" not found`);
            }
            throw error;
        }

        // 2. Validate status and finalize (throws ApiError if not IN_PROGRESS)
        simulation.finalize();

        // 3. Save updated simulation
        const updated = await this.simulationRepository.update(simulation);

        // 4. Invalidate cache
        await this.cacheService.delByPattern(SimulationCacheKeys.pattern());

        this.logger.log({ msg: 'Simulation finalized', simulationId: updated.id });

        return updated;
    }
}

// ─────────────────────────────────────────────────────────────
// BatchIngest
// ─────────────────────────────────────────────────────────────

export interface IBatchIngestPrediction {
    stationId: string;
    stationName?: string;
    typeName: string;
    units?: string;
    percentile?: number;
    predictionProvider?: string;
    predictedBy?: string;
    events: Array<{ timestamp: string; value: number; flag?: number }>;
}

export interface IBatchIngestCommand {
    simulationDate: string;
    modmeteo?: string;
    environment?: string;
    type?: string;
    createdBy?: string;
    predictions: IBatchIngestPrediction[];
}

export class BatchIngestCommand {
    constructor(private readonly parameters: IBatchIngestCommand) {}

    get simulationDate(): string {
        return this.parameters.simulationDate;
    }
    get modmeteo(): string | undefined {
        return this.parameters.modmeteo;
    }
    get environment(): string | undefined {
        return this.parameters.environment;
    }
    get type(): string | undefined {
        return this.parameters.type;
    }
    get createdBy(): string | undefined {
        return this.parameters.createdBy;
    }
    get predictions(): IBatchIngestPrediction[] {
        return this.parameters.predictions;
    }
}

export interface BatchIngestResult {
    simulationId: string;
    processedCount: number;
    errors: string[];
}

@CommandHandler(BatchIngestCommand)
export class BatchIngestHandler implements ICommandHandler<BatchIngestCommand, BatchIngestResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly simulationRepository: ISimulationRepository,
    ) {}

    async execute(command: BatchIngestCommand): Promise<BatchIngestResult> {
        const startTime = Date.now();
        this.logger.log({
            msg: 'Batch ingest started',
            entity: 'Simulations',
            simulationDate: command.simulationDate,
            totalPredictions: command.predictions.length,
        });

        // 1. Validate simulation date
        const simDateVO = new SimulationDateValueObject(command.simulationDate);

        // 2. Find or create simulation
        let simulation = await this.simulationRepository.findByDateAndEnvAndModmeteo(
            simDateVO.value,
            command.environment || null,
            command.modmeteo || null,
        );

        if (!simulation) {
            simulation = new Simulation({
                simulationDate: simDateVO.value,
                modmeteo: command.modmeteo || null,
                environment: command.environment || null,
                status: SimulationStatus.IN_PROGRESS,
                type: (command.type as SimulationType) || SimulationType.MANUAL,
                createdBy: command.createdBy || 'batch',
            });
            simulation.validate();
            simulation = await this.simulationRepository.create(simulation);
        }

        // 3. Process each prediction via ProcessTimeSeriesCommand
        const errors: string[] = [];
        let processedCount = 0;

        for (const pred of command.predictions) {
            try {
                const tsCommand = new ProcessTimeSeriesCommand({
                    series: {
                        locationId: pred.stationId,
                        parameterId: pred.typeName,
                        moduleInstanceId: command.environment || '',
                        stationName: pred.stationName,
                        units: pred.units,
                        forecastDate: simDateVO.value,
                        startDate: simDateVO.value,
                        events: pred.events.map((e) => ({
                            timestamp: e.timestamp,
                            value: e.value,
                            flag: e.flag,
                            isMissing: false,
                        })),
                    },
                    providerName: command.modmeteo,
                });
                await this.commandBus.execute(tsCommand);
                processedCount++;
            } catch (error) {
                const msg = `Failed prediction for station=${pred.stationId}: ${(error as Error).message}`;
                this.logger.error({
                    msg: 'Batch ingest prediction failed',
                    simulationId: simulation.id,
                    stationId: pred.stationId,
                    parameterId: pred.typeName,
                    error: (error as Error).message,
                    stack: error instanceof Error ? error.stack : undefined,
                });
                errors.push(msg);
            }
        }

        const eventsCount = command.predictions.reduce((sum, p) => sum + p.events.length, 0);
        this.logger.log({
            msg: 'Batch ingest complete',
            simulationId: simulation.id,
            simulationDate: command.simulationDate,
            totalPredictions: command.predictions.length,
            processedCount,
            errorCount: errors.length,
            eventsCount,
            durationMs: Date.now() - startTime,
        });

        return { simulationId: simulation.id, processedCount, errors };
    }
}
