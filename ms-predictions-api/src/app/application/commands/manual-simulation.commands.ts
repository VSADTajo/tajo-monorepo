import { HttpStatus, Inject, Optional } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import {
    Simulation,
    SimulationStatus,
    SimulationType,
    DataOrigin,
    ModelSource,
} from '@domain/entities/simulation.entity';
import { Maneuver } from '@domain/entities/maneuver.entity';
import { ISimulationRepository } from '@domain/ports/simulation-repository.port';
import { IManeuverRepository } from '@domain/ports/maneuver-repository.port';
import { IStationCatalogService, FullStationCatalogItem } from '@domain/ports/station-catalog-service.port';
import { ISimulationSftpService } from '@domain/ports/simulation-sftp.port';
import { IMessageBroker } from '@domain/ports/message-broker.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { ManualSimulationResult } from '@domain/results/manual-simulation.result';
import { SIMULATION_STATE_CACHE_PATTERNS } from '@infrastructure/cache/cache-config.registry';
import { Topics } from '@infrastructure/messaging/messaging.registry';
import { ApiError } from '@domain/errors/api.error';
import { AppConfigService } from '@config/app/app-config.service';
import {
    buildManualSimulationFile,
    FileManeuverInput,
    SeriesPoint,
    StationMeta,
    DEFAULT_HORIZON_DAYS,
    MAX_EVENTS_PER_SERIES,
} from '@application/builders/manual-simulation-file.builder';

// ─────────────────────────────────────────────────────────────
// CreateManualSimulation
// ─────────────────────────────────────────────────────────────

export type ModmeteoChoice = 'HARMONIE' | 'EPS' | 'BOTH';

export interface IManeuverInput {
    reservoirCode: string;
    outputFlowValue: number;
    startDate?: string;
    endDate?: string;
    /** Optional full 15-minute series (CURVE mode). Transient: used only to build the input file. */
    series?: SeriesPoint[];
}

export interface ICreateManualSimulationCommand {
    simulationDate: string;
    description?: string;
    createdBy?: string | null;
    modmeteo: ModmeteoChoice;
    modelSource: ModelSource;
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

    get modelSource(): ModelSource {
        return this.parameters.modelSource;
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
        private readonly stationCatalogService: IStationCatalogService,
        private readonly sftpService: ISimulationSftpService,
        private readonly messageBroker: IMessageBroker,
        private readonly cacheService: ICacheService,
        // Optional so the e2e suites, which compose this handler without the
        // configuration module, keep running on the builder's defaults.
        @Optional() private readonly appConfigService?: AppConfigService,
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

        // 1a-bis. Validate the file inputs (series timestamps + window size) BEFORE any write,
        // so malformed input returns 400 without persisting an orphan simulation.
        this.validateFileInputs(inlineManeuvers, referenced, this.parseForecastDate(command.simulationDate));

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
            modelSource: command.modelSource,
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
            modelSource: command.modelSource,
        });

        // 3. Build + upload the SINGLE SFTP input file with the modified station series.
        //    The file contains one timeSeries per modified station (FLAT value or CURVE passthrough).
        const stationsByCode = await this.loadStationMetadata();
        const fileManeuvers: FileManeuverInput[] = [
            ...referenced.map((m) => ({
                reservoirCode: m.reservoirCode,
                outputFlowValue: Number(m.outputFlowValue),
                startDate: m.startDate,
                endDate: m.endDate,
            })),
            ...inlineManeuvers.map((input) => ({
                reservoirCode: input.reservoirCode,
                outputFlowValue: input.outputFlowValue,
                startDate: input.startDate ?? null,
                endDate: input.endDate ?? null,
                series: input.series,
            })),
        ];

        const now = new Date();
        const { fileName, content } = buildManualSimulationFile({
            maneuvers: fileManeuvers,
            stationsByCode,
            forecastDate: this.parseForecastDate(command.simulationDate),
            now,
            moduleInstanceId: this.appConfigService?.manualSimulationModuleInstanceId,
            parameterId: this.appConfigService?.manualSimulationParameterId,
        });
        const buffer = Buffer.from(JSON.stringify(content, null, 2), 'utf-8');
        await this.sftpService.uploadInputFile(persistedSimulation.id, fileName, buffer);
        this.logger.log({
            msg: 'Manual simulation input file uploaded',
            entity: 'Simulations',
            simulationId: persistedSimulation.id,
            fileName,
            seriesCount: content.timeSeries.length,
        });

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
                modelSource: command.modelSource,
            },
        );

        // 6. Invalidate every simulation cache namespace (general + manual)
        for (const pattern of SIMULATION_STATE_CACHE_PATTERNS) {
            await this.cacheService.delByPattern(pattern);
        }

        this.logger.log({
            msg: 'Manual simulation dispatched successfully',
            entity: 'Simulations',
            simulationId: persistedSimulation.id,
            outputFolder,
            modmeteo: command.modmeteo,
            modelSource: command.modelSource,
        });

        return new ManualSimulationResult({
            simulation: updatedSimulation,
            maneuvers,
        });
    }

    /**
     * Validates the timestamps and window sizes that feed the file builder, BEFORE persisting anything.
     * Guards against: malformed curve timestamps (would crash the builder with an Invalid Date), and
     * absurdly large FLAT windows (would generate millions of points / block the event loop).
     * Throws ApiError(400) so the controller returns a 400 instead of a 500 + orphaned simulation.
     */
    private validateFileInputs(inline: IManeuverInput[], referenced: Maneuver[], forecastDate: Date): void {
        const FIFTEEN_MIN_MS = 15 * 60 * 1000;
        const HORIZON_MS = DEFAULT_HORIZON_DAYS * 24 * 60 * 60 * 1000;

        const assertWindow = (
            code: string,
            startRaw: Date | string | null | undefined,
            endRaw: Date | string | null | undefined,
        ): void => {
            const start = startRaw ? new Date(startRaw) : forecastDate;
            const end = endRaw ? new Date(endRaw) : new Date(start.getTime() + HORIZON_MS);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                throw new ApiError(HttpStatus.BAD_REQUEST, `Invalid maneuver window for reservoir ${code}`);
            }
            if (end.getTime() < start.getTime()) {
                throw new ApiError(HttpStatus.BAD_REQUEST, `endDate is before startDate for reservoir ${code}`);
            }
            const points = Math.floor((end.getTime() - start.getTime()) / FIFTEEN_MIN_MS) + 1;
            if (points > MAX_EVENTS_PER_SERIES) {
                throw new ApiError(
                    HttpStatus.BAD_REQUEST,
                    `Maneuver window for reservoir ${code} is too large (${points} points, max ${MAX_EVENTS_PER_SERIES})`,
                );
            }
        };

        for (const m of inline) {
            if (m.series && m.series.length > 0) {
                for (const p of m.series) {
                    const d = new Date(`${p.date}T${p.time}Z`);
                    if (Number.isNaN(d.getTime())) {
                        throw new ApiError(
                            HttpStatus.BAD_REQUEST,
                            `Invalid series timestamp for reservoir ${m.reservoirCode}: "${p.date} ${p.time}"`,
                        );
                    }
                }
                continue;
            }
            assertWindow(m.reservoirCode, m.startDate ?? null, m.endDate ?? null);
        }

        for (const m of referenced) {
            assertWindow(m.reservoirCode, m.startDate, m.endDate);
        }
    }

    /**
     * Loads the full station catalog from ms-hydro-api and indexes it by lowercased station code,
     * so the file builder can enrich each series header with name/lat/lon/altitude.
     * A catalog failure must not abort the dispatch — the file is still valid with placeholders
     * (parameterId + locationId are the import-critical fields).
     */
    private async loadStationMetadata(): Promise<Record<string, StationMeta>> {
        try {
            const stations = await this.stationCatalogService.listFullStations();
            return stations.reduce<Record<string, StationMeta>>((acc, station: FullStationCatalogItem) => {
                acc[station.stationCode.toLowerCase()] = {
                    code: station.stationCode,
                    name: station.name ?? null,
                    latitude: station.latitude,
                    longitude: station.longitude,
                    altitude: station.altitude,
                };
                return acc;
            }, {});
        } catch (error) {
            this.logger.warn({
                msg: 'Could not load station catalog for manual simulation file (using placeholders)',
                entity: 'Simulations',
                error: String(error),
            });
            return {};
        }
    }

    /**
     * Parse the simulationDate (YYYYMMDDHHMMSS) into a UTC Date used as forecastDate and as the
     * FLAT-window start when a maneuver has no explicit startDate. Falls back to now if malformed.
     */
    private parseForecastDate(simulationDate: string): Date {
        if (simulationDate && /^\d{14}$/.test(simulationDate)) {
            const yyyy = simulationDate.substring(0, 4);
            const mm = simulationDate.substring(4, 6);
            const dd = simulationDate.substring(6, 8);
            const hh = simulationDate.substring(8, 10);
            const mi = simulationDate.substring(10, 12);
            const ss = simulationDate.substring(12, 14);
            return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`);
        }
        return new Date();
    }
}
