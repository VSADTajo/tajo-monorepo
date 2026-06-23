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

export type ModmeteoChoice = 'HARMONIE' | 'EPS' | 'BOTH';

export interface IManeuverInput {
    reservoirCode: string;
    outputFlowValue: number;
    startDate?: string;
    endDate?: string;
}

export interface ICreateManualSimulationCommand {
    simulationDate: string;
    description?: string;
    createdBy?: string | null;
    modmeteo: ModmeteoChoice;
    maneuverIds?: string[];
    maneuvers?: IManeuverInput[];
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

    get modmeteo(): ModmeteoChoice {
        return this.parameters.modmeteo;
    }

    get maneuverIds(): string[] {
        return this.parameters.maneuverIds ?? [];
    }

    get maneuvers(): IManeuverInput[] {
        return this.parameters.maneuvers ?? [];
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
        const referencedIds = command.maneuverIds;
        const inlineManeuvers = command.maneuvers;
        if (referencedIds.length === 0 && inlineManeuvers.length === 0) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                'At least one maneuver is required (provide maneuverIds and/or maneuvers)',
            );
        }

        // 1a. Load and validate the referenced (existing) maneuvers
        let referenced: Maneuver[] = [];
        if (referencedIds.length > 0) {
            referenced = await this.maneuverRepository.findByIds(referencedIds);
            if (referenced.length !== referencedIds.length) {
                const foundIds = new Set(referenced.map((m) => m.id));
                const missing = referencedIds.filter((id) => !foundIds.has(id));
                throw new ApiError(HttpStatus.NOT_FOUND, `Maneuver(s) not found: ${missing.join(', ')}`);
            }
        }

        // 1b. Create the inline maneuvers (validated as domain entities first)
        let created: Maneuver[] = [];
        if (inlineManeuvers.length > 0) {
            const toCreate = inlineManeuvers.map((input) => {
                const maneuver = new Maneuver({
                    reservoirCode: input.reservoirCode,
                    outputFlowValue: input.outputFlowValue,
                    startDate: input.startDate ? new Date(input.startDate) : null,
                    endDate: input.endDate ? new Date(input.endDate) : null,
                });
                maneuver.validate();
                return maneuver;
            });
            created = await this.maneuverRepository.createMany(toCreate);
        }

        const maneuvers = [...referenced, ...created];

        // 2. Create Simulation (MANUAL, CREATED) with the referenced maneuvers attached
        const simulation = new Simulation({
            simulationDate: command.simulationDate,
            description: command.description || null,
            status: SimulationStatus.CREATED,
            type: SimulationType.MANUAL,
            dataOrigin: DataOrigin.FORECAST,
            jobType: null,
            modmeteo: command.modmeteo,
            environment: null,
            createdBy: command.createdBy ?? 'operator',
            maneuvers,
        });
        simulation.validate();
        const persistedSimulation = await this.simulationRepository.create(simulation);

        this.logger.log({
            msg: 'Manual simulation created with referenced maneuvers',
            entity: 'Simulations',
            simulationId: persistedSimulation.id,
            maneuverCount: maneuvers.length,
            modmeteo: command.modmeteo,
        });

        // 3. Build + upload one SFTP file per requested modmeteo
        const modmeteoSpecs = this.resolveModmeteoSpecs(command.modmeteo);
        for (const spec of modmeteoSpecs) {
            const reservoirSeries = await this.buildReservoirTimeSeries(command, maneuvers, spec);
            const fileContent = { version: '1.34', timeZone: '0.0', timeSeries: reservoirSeries };
            const buffer = Buffer.from(JSON.stringify(fileContent, null, 2), 'utf-8');
            const fileName = this.buildFileName(spec.fileTag, command.simulationDate);
            await this.sftpService.uploadInputFile(persistedSimulation.id, fileName, buffer);
            this.logger.log({
                msg: 'Manual simulation input file uploaded',
                entity: 'Simulations',
                simulationId: persistedSimulation.id,
                fileName,
                modmeteo: spec.fileTag,
                seriesCount: reservoirSeries.length,
            });
        }

        // 3b. Pre-create the output folder so the model can drop its response file there.
        // Best-effort: a failure must not abort the dispatch (the SFTP server also creates
        // parent directories on write).
        try {
            await this.sftpService.ensureOutputFolder(persistedSimulation.id);
        } catch (error) {
            this.logger.warn({
                msg: 'Could not pre-create manual simulation output folder (non-blocking)',
                entity: 'Simulations',
                simulationId: persistedSimulation.id,
                error: String(error),
            });
        }

        // 4. Transition simulation to MODEL_PROCESSING
        persistedSimulation.advanceStatus();
        const updatedSimulation = await this.simulationRepository.update(persistedSimulation);

        // 5. Publish simulation.manual.dispatched event
        const outputFolder = `tajo/SIMULATIONS/${persistedSimulation.id}/output`;
        await this.messageBroker.publishToTopic(
            Topics.SIMULATION_EVENTS.exchange,
            Topics.SIMULATION_EVENTS.routingKeys.MANUAL_DISPATCHED,
            {
                simulationId: persistedSimulation.id,
                outputFolder,
                modmeteo: command.modmeteo,
            },
        );

        // 6. Invalidate cache
        await this.cacheService.delByPattern(ManualSimulationCacheKeys.pattern());

        this.logger.log({
            msg: 'Manual simulation dispatched successfully',
            entity: 'Simulations',
            simulationId: persistedSimulation.id,
            outputFolder,
            modmeteo: command.modmeteo,
        });

        return new ManualSimulationResult({
            simulation: updatedSimulation,
            maneuvers,
        });
    }

    private resolveModmeteoSpecs(choice: ModmeteoChoice): Array<{ fileTag: string; predictionTypeName: string }> {
        const harmonie = { fileTag: 'harmonie', predictionTypeName: 'Q.NAM.harmonie' };
        const eps = { fileTag: 'eps', predictionTypeName: 'Q.NAM.ens' };
        if (choice === 'HARMONIE') return [harmonie];
        if (choice === 'EPS') return [eps];
        return [harmonie, eps];
    }

    private buildFileName(fileTag: string, simulationDate: string): string {
        // simulationDate format YYYYMMDDHHMMSS → output uses YYYYMMDDHHMM (no seconds)
        const stamp = simulationDate.length >= 12 ? simulationDate.substring(0, 12) : simulationDate;
        return `tagus_${fileTag}_Q_${stamp}.json`;
    }

    /**
     * For each maneuver's reservoir, fetch the latest Q.NAM.<modmeteo> prediction and emit
     * one timeSeries with the natural events plus the maneuver metadata in the header.
     */
    private async buildReservoirTimeSeries(
        command: CreateManualSimulationCommand,
        maneuvers: Maneuver[],
        spec: { fileTag: string; predictionTypeName: string },
    ): Promise<object[]> {
        const series: object[] = [];

        for (const maneuver of maneuvers) {
            const filters: ForecastFilters = {
                stationId: maneuver.reservoirCode,
                predictionType: spec.predictionTypeName,
            };
            const predictions = await this.predictionRepository.findForecast(filters);
            const prediction = predictions[0];

            const events =
                prediction?.results?.map((r) => {
                    const d = r.date instanceof Date ? r.date : new Date(r.date as unknown as string);
                    return {
                        date: d.toISOString().split('T')[0],
                        time: d.toISOString().split('T')[1].substring(0, 8),
                        value: String(r.value),
                        flag: String(r.flag ?? 0),
                    };
                }) ?? [];

            const stationName = prediction?.stationName ?? maneuver.reservoirCode;
            const moduleInstanceId = prediction?.predictedBy ?? `Manual_${spec.fileTag}`;
            const forecastIso = this.parseSimulationDate(command.simulationDate);
            const startIso = prediction?.predictionStartDate ? this.toIso(prediction.predictionStartDate) : forecastIso;
            const endIso = prediction?.predictionEndDate ? this.toIso(prediction.predictionEndDate) : forecastIso;

            series.push({
                header: {
                    type: 'instantaneous',
                    moduleInstanceId,
                    locationId: maneuver.reservoirCode,
                    parameterId: spec.predictionTypeName,
                    timeStep: { unit: 'second', multiplier: '900' },
                    startDate: { date: startIso.date, time: startIso.time },
                    endDate: { date: endIso.date, time: endIso.time },
                    forecastDate: { date: forecastIso.date, time: forecastIso.time },
                    missVal: '-999.0',
                    stationName,
                    units: 'm3/s',
                    maneuver: {
                        date: forecastIso.date,
                        time: forecastIso.time,
                        outputFlowValue: maneuver.outputFlowValue,
                    },
                },
                events,
            });
        }

        return series;
    }

    private toIso(d: Date | string): { date: string; time: string } {
        const date = d instanceof Date ? d : new Date(d);
        return {
            date: date.toISOString().split('T')[0],
            time: date.toISOString().split('T')[1].substring(0, 8),
        };
    }

    /**
     * Parse YYYYMMDDHHMMSS into { date: YYYY-MM-DD, time: HH:MM:SS }.
     * Falls back to the current UTC time when the input is malformed.
     */
    private parseSimulationDate(simulationDate: string): { date: string; time: string } {
        if (simulationDate && /^\d{14}$/.test(simulationDate)) {
            const yyyy = simulationDate.substring(0, 4);
            const mm = simulationDate.substring(4, 6);
            const dd = simulationDate.substring(6, 8);
            const hh = simulationDate.substring(8, 10);
            const mi = simulationDate.substring(10, 12);
            const ss = simulationDate.substring(12, 14);
            return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}:${ss}` };
        }
        const now = new Date();
        return {
            date: now.toISOString().split('T')[0],
            time: now.toISOString().split('T')[1].substring(0, 8),
        };
    }
}
