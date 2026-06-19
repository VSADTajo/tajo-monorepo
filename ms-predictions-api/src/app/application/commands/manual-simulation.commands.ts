import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { Simulation, SimulationStatus, SimulationType, DataOrigin } from '@domain/entities/simulation.entity';
import { Maneuver } from '@domain/entities/maneuver.entity';
import { ISimulationRepository } from '@domain/ports/simulation-repository.port';
import { IManeuverRepository } from '@domain/ports/maneuver-repository.port';
import { IPredictionRepository, ForecastFilters } from '@domain/ports/prediction-repository.port';
import { ISimulationSftpService } from '@domain/ports/simulation-sftp.port';
import { IMessageBroker } from '@domain/ports/message-broker.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { ManualSimulationResult } from '@domain/results/manual-simulation.result';
import { ManualSimulationCacheKeys } from '@infrastructure/cache/cache-config.registry';
import { Topics } from '@infrastructure/messaging/messaging.registry';
import { ApiError } from '@domain/errors/api.error';

// ─────────────────────────────────────────────────────────────
// CreateManualSimulation
// ─────────────────────────────────────────────────────────────

export interface IManeuverInput {
    reservoirCode: string;
    outputFlowValue: number;
}

export interface ICreateManualSimulationCommand {
    simulationDate: string;
    description?: string;
    createdBy?: string | null;
    maneuvers: IManeuverInput[];
}

export class CreateManualSimulationCommand {
    constructor(private readonly parameters: ICreateManualSimulationCommand) {}

    get simulationDate(): string {
        return this.parameters.simulationDate;
    }

    get description(): string | undefined {
        return this.parameters.description;
    }

    get createdBy(): string | null | undefined {
        return this.parameters.createdBy;
    }

    get maneuvers(): IManeuverInput[] {
        return this.parameters.maneuvers;
    }
}

@CommandHandler(CreateManualSimulationCommand)
export class CreateManualSimulationHandler implements ICommandHandler<
    CreateManualSimulationCommand,
    ManualSimulationResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
        private readonly maneuverRepository: IManeuverRepository,
        private readonly predictionRepository: IPredictionRepository,
        private readonly sftpService: ISimulationSftpService,
        private readonly messageBroker: IMessageBroker,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreateManualSimulationCommand): Promise<ManualSimulationResult> {
        if (!command.maneuvers || command.maneuvers.length === 0) {
            throw new ApiError(HttpStatus.BAD_REQUEST, 'At least one maneuver is required');
        }

        // 1. Create Simulation (MANUAL, CREATED)
        const simulation = new Simulation({
            simulationDate: command.simulationDate,
            description: command.description || null,
            status: SimulationStatus.CREATED,
            type: SimulationType.MANUAL,
            dataOrigin: DataOrigin.FORECAST,
            jobType: null,
            modmeteo: null,
            environment: null,
            createdBy: command.createdBy ?? 'operator',
        });
        simulation.validate();
        const persistedSimulation = await this.simulationRepository.create(simulation);

        // 2. Create Maneuver[] entities
        const maneuverEntities: Maneuver[] = command.maneuvers.map(
            (m) =>
                new Maneuver({
                    simulationId: persistedSimulation.id,
                    reservoirCode: m.reservoirCode,
                    outputFlowValue: m.outputFlowValue,
                }),
        );

        for (const m of maneuverEntities) {
            m.validate();
        }

        const persistedManeuvers = await this.maneuverRepository.createMany(maneuverEntities);

        this.logger.log({
            msg: 'Manual simulation and maneuvers created',
            entity: 'Simulations',
            simulationId: persistedSimulation.id,
            maneuverCount: persistedManeuvers.length,
        });

        // 3. Query FORECAST predictions for each reservoir code
        const reservoirCodes = command.maneuvers.map((m) => m.reservoirCode);
        const allPredictions = await Promise.all(
            reservoirCodes.map(async (reservoirCode) => {
                const filters: ForecastFilters = { stationId: reservoirCode };
                return this.predictionRepository.findForecast(filters);
            }),
        );
        const predictions = allPredictions.flat();

        // 4. Build input file buffer (JSON time-series format)
        const inputFileContent = this.buildInputFile(persistedSimulation.id, command.maneuvers, predictions);
        const contentBuffer = Buffer.from(JSON.stringify(inputFileContent, null, 2), 'utf-8');

        // 5. Upload to ms-sftp-api (ProviderError propagates if it fails)
        await this.sftpService.uploadInputFile(persistedSimulation.id, contentBuffer);

        // 6. Transition simulation to MODEL_PROCESSING
        persistedSimulation.advanceStatus();
        const updatedSimulation = await this.simulationRepository.update(persistedSimulation);

        // 7. Publish simulation.manual.dispatched event
        const outputFolder = `simulations/${persistedSimulation.id}/output`;
        await this.messageBroker.publishToTopic(
            Topics.SIMULATION_EVENTS.exchange,
            Topics.SIMULATION_EVENTS.routingKeys.MANUAL_DISPATCHED,
            {
                simulationId: persistedSimulation.id,
                outputFolder,
            },
        );

        // 8. Invalidate cache
        await this.cacheService.delByPattern(ManualSimulationCacheKeys.pattern());

        this.logger.log({
            msg: 'Manual simulation dispatched successfully',
            entity: 'Simulations',
            simulationId: persistedSimulation.id,
            outputFolder,
        });

        return new ManualSimulationResult({
            simulation: updatedSimulation,
            maneuvers: persistedManeuvers,
        });
    }

    private buildInputFile(
        simulationId: string,
        maneuvers: IManeuverInput[],
        predictions: Array<{
            stationId: string;
            stationName: string | null;
            predictionDate: Date | null;
            predictionStartDate: Date | null;
            predictionEndDate: Date | null;
            results?: Array<{ date: Date; value: number; flag: number }>;
        }>,
    ): object {
        const now = new Date();
        const forecastDate = now.toISOString().split('T')[0];
        const forecastTime = now.toISOString().split('T')[1].substring(0, 8);

        const timeSeries = maneuvers.map((maneuver) => {
            const maneuverPredictions = predictions.filter((p) => p.stationId === maneuver.reservoirCode);

            const events =
                maneuverPredictions.length > 0 && maneuverPredictions[0].results
                    ? maneuverPredictions[0].results.map((r) => {
                          const d = r.date instanceof Date ? r.date : new Date(r.date);
                          return {
                              date: d.toISOString().split('T')[0],
                              time: d.toISOString().split('T')[1].substring(0, 8),
                              value: String(r.value),
                              flag: String(r.flag ?? 0),
                          };
                      })
                    : [
                          {
                              date: forecastDate,
                              time: forecastTime,
                              value: String(maneuver.outputFlowValue),
                              flag: '0',
                          },
                      ];

            const startDate =
                maneuverPredictions.length > 0 && maneuverPredictions[0].predictionStartDate
                    ? (maneuverPredictions[0].predictionStartDate instanceof Date
                          ? maneuverPredictions[0].predictionStartDate
                          : new Date(maneuverPredictions[0].predictionStartDate)
                      )
                          .toISOString()
                          .split('T')[0]
                    : forecastDate;

            const endDate =
                maneuverPredictions.length > 0 && maneuverPredictions[0].predictionEndDate
                    ? (maneuverPredictions[0].predictionEndDate instanceof Date
                          ? maneuverPredictions[0].predictionEndDate
                          : new Date(maneuverPredictions[0].predictionEndDate)
                      )
                          .toISOString()
                          .split('T')[0]
                    : forecastDate;

            const stationName =
                maneuverPredictions.length > 0 ? maneuverPredictions[0].stationName : maneuver.reservoirCode;

            return {
                header: {
                    locationId: maneuver.reservoirCode,
                    parameterId: 'Q.sim.forecast',
                    forecastDate: { date: forecastDate, time: forecastTime },
                    startDate: { date: startDate, time: '00:00:00' },
                    endDate: { date: endDate, time: '23:59:59' },
                    missVal: '-999',
                    stationName: stationName || maneuver.reservoirCode,
                    units: 'm3/s',
                    simulationId,
                    outputFlowValue: maneuver.outputFlowValue,
                },
                events,
            };
        });

        return { timeSeries };
    }
}
