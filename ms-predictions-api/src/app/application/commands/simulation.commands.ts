import { HttpStatus, Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { Simulation, SimulationStatus, SimulationType } from '@domain/entities/simulation.entity';
import { SimulationDateValueObject } from '@domain/value-objects/simulation-date.value-object';
import { ISimulationRepository } from '@domain/ports/simulation-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import {
    SIMULATION_STATE_CACHE_PATTERNS,
    ManeuverCacheKeys,
    PredictionTypeCacheKeys,
    PredictionCacheKeys,
} from '@infrastructure/cache/cache-config.registry';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';
import { DeleteSimulationResult } from '@domain/results/delete-simulation.result';
import { ProcessTimeSeriesCommand } from '@application/commands/prediction.commands';

// Inverse of SimulationDateValueObject (which converts ISO → 14-digit).
// 'YYYYMMDDHHMMSS' → 'YYYY-MM-DDTHH:MM:SS.000Z'. Assumes the VO already validated the shape.
function isoFromSimulationDate14(value: string): string {
    return (
        `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T` +
        `${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}.000Z`
    );
}

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
        this.logger.log(`Finalizing simulation: ${command.id}`);

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

        // 4. Invalidate every simulation cache namespace (general + manual)
        for (const pattern of SIMULATION_STATE_CACHE_PATTERNS) {
            await this.cacheService.delByPattern(pattern);
        }

        this.logger.log({ msg: 'Simulation finalized', simulationId: updated.id });

        return updated;
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteSimulation
// ─────────────────────────────────────────────────────────────

export interface IDeleteSimulationCommand {
    id: string;
}

export class DeleteSimulationCommand {
    constructor(private readonly parameters: IDeleteSimulationCommand) {}

    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(DeleteSimulationCommand)
export class DeleteSimulationHandler implements ICommandHandler<DeleteSimulationCommand, DeleteSimulationResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: DeleteSimulationCommand): Promise<DeleteSimulationResult> {
        this.logger.log(`Deleting simulation: ${command.id}`);

        // 1. Ensure the simulation exists (findById excludes soft-deleted rows → 404 if already gone)
        try {
            await this.simulationRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Simulation with id "${command.id}" not found`);
            }
            throw error;
        }

        // 2. Soft-delete the simulation + its exclusively-associated maneuvers
        const deletedManeuvers = await this.simulationRepository.softDelete(command.id);

        // 3. Invalidate every read-model that depends on the deleted simulation:
        //    simulation + maneuver namespaces, plus prediction and prediction-type
        //    namespaces (e.g. prediction-types by-station no longer reflects this
        //    simulation's types once it is gone).
        for (const pattern of SIMULATION_STATE_CACHE_PATTERNS) {
            await this.cacheService.delByPattern(pattern);
        }
        await this.cacheService.delByPattern(ManeuverCacheKeys.pattern());
        await this.cacheService.delByPattern(PredictionCacheKeys.pattern());
        await this.cacheService.delByPattern(PredictionTypeCacheKeys.pattern());

        this.logger.log({ msg: 'Simulation soft-deleted', simulationId: command.id, deletedManeuvers });

        return new DeleteSimulationResult({ id: command.id, deletedManeuvers });
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
        this.logger.log(
            `Batch ingest: simulationDate=${command.simulationDate}, predictions=${command.predictions.length}`,
        );

        // 1. Validate simulation date
        const simDateVO = new SimulationDateValueObject(command.simulationDate);
        // ISO form is needed downstream because ProcessTimeSeriesHandler calls
        // `new Date(series.startDate)` on the prediction date columns. The 14-digit
        // value would parse to Invalid Date and Postgres would reject the insert.
        const simDateIso = isoFromSimulationDate14(simDateVO.value);

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
                        forecastDate: simDateIso,
                        startDate: simDateIso,
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
