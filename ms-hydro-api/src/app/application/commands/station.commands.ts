import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { Station } from '@domain/entities/station.entity';
import { StationThreshold } from '@domain/entities/station-threshold.entity';
import { StationType } from '@domain/types/station-type.enum';
import { IStationRepository } from '@domain/ports/station-repository.port';
import { IStationThresholdRepository } from '@domain/ports/station-threshold-repository.port';
import { ISubBasinRepository } from '@domain/ports/sub-basin-repository.port';
import {
    CreateStationResult,
    UpdateStationResult,
    ToggleStationResult,
    UpdateThresholdResult,
    DeleteStationResult,
} from '@domain/results/station.results';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';
import { ICacheService } from '@domain/ports/cache-service.port';
import { StationCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// CreateStation
// ─────────────────────────────────────────────────────────────

export interface ICreateStationCommand {
    name: string;
    subBasinName: string;
    stationCode: string;
    stationType: StationType;
    subBasinId: string;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    description?: string;
}

export class CreateStationCommand {
    constructor(private readonly parameters: ICreateStationCommand) {}

    get name(): string {
        return this.parameters.name;
    }

    get subBasinName(): string {
        return this.parameters.subBasinName;
    }

    get stationCode(): string {
        return this.parameters.stationCode;
    }

    get stationType(): StationType {
        return this.parameters.stationType;
    }

    get subBasinId(): string {
        return this.parameters.subBasinId;
    }

    get latitude(): number | undefined {
        return this.parameters.latitude;
    }

    get longitude(): number | undefined {
        return this.parameters.longitude;
    }

    get altitude(): number | undefined {
        return this.parameters.altitude;
    }

    get description(): string | undefined {
        return this.parameters.description;
    }
}

@CommandHandler(CreateStationCommand)
export class CreateStationHandler implements ICommandHandler<CreateStationCommand, CreateStationResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly stationRepository: IStationRepository,
        private readonly subBasinRepository: ISubBasinRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreateStationCommand): Promise<CreateStationResult> {
        this.logger.log({ msg: 'Creating station', entity: 'Stations', name: command.name });

        // 1. Build entity and validate invariants
        const station = new Station({
            name: command.name,
            subBasinName: command.subBasinName,
            stationCode: command.stationCode,
            stationType: command.stationType,
            subBasinId: command.subBasinId,
            latitude: command.latitude ?? null,
            longitude: command.longitude ?? null,
            altitude: command.altitude ?? null,
            description: command.description ?? null,
        });
        station.validate();

        // 2. Check subBasinId exists
        try {
            await this.subBasinRepository.findById(command.subBasinId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Sub-basin with id "${command.subBasinId}" not found`);
            }
            throw error;
        }

        // 3. Check duplicate stationCode
        const existingByCode = await this.stationRepository.findByStationCode(station.stationCode);
        if (existingByCode) {
            throw new ApiError(HttpStatus.CONFLICT, `Station with stationCode "${station.stationCode}" already exists`);
        }

        // 5. Persist station
        const persistedStation = await this.stationRepository.create(station);

        this.logger.log({
            msg: 'Station created',
            entity: 'Stations',
            id: persistedStation.id,
            name: persistedStation.name,
        });

        await this.cacheService.delByPattern(StationCacheKeys.pattern());

        return new CreateStationResult({
            id: persistedStation.id,
            name: persistedStation.name,
            subBasinName: persistedStation.subBasinName,
            stationCode: persistedStation.stationCode,
            stationType: persistedStation.stationType,
            subBasinId: persistedStation.subBasinId,
            threshold: persistedStation.threshold ?? null,
            latitude: persistedStation.latitude,
            longitude: persistedStation.longitude,
            altitude: persistedStation.altitude,
            municipio: persistedStation.municipio,
            provincia: persistedStation.provincia,
            ccaa: persistedStation.ccaa,
            tipoCod: persistedStation.tipoCod,
            zona: persistedStation.zona,
            zonaExplOgcFid: persistedStation.zonaExplOgcFid,
            zonaExplNombre: persistedStation.zonaExplNombre,
            comarcaName: persistedStation.comarcaName,
            sistemaName: persistedStation.sistemaName,
            meteoalertaZonaCode: persistedStation.meteoalertaZonaCode,
            meteoalertaZonaNombre: persistedStation.meteoalertaZonaNombre,
            hasCaudalNam: persistedStation.hasCaudalNam,
            hasCaudalMike: persistedStation.hasCaudalMike,
            description: persistedStation.description,
            isActive: persistedStation.isActive,
            createdAt: persistedStation.createdAt!,
            updatedAt: persistedStation.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateStationThreshold
// ─────────────────────────────────────────────────────────────

export interface IUpdateStationThresholdCommand {
    stationId: string;
    parametro?: string | null;
    senal?: string | null;
    umbralNivel1?: number | null;
    umbralCaudal1?: number | null;
    umbralNivel2?: number | null;
    umbralCaudal2?: number | null;
    umbralNivel3?: number | null;
    umbralCaudal3?: number | null;
    maxNivelMuro?: number | null;
    maxNivelCaseta?: number | null;
    umbralVolumen1?: number | null;
    umbralVolumen2?: number | null;
    umbralVolumen3?: number | null;
    caudalEntrada?: string | null;
    caudalSalida?: string | null;
    capacidad?: number | null;
}

export class UpdateStationThresholdCommand {
    constructor(private readonly parameters: IUpdateStationThresholdCommand) {}
    get stationId(): string {
        return this.parameters.stationId;
    }
    get parametro(): string | null | undefined {
        return this.parameters.parametro;
    }
    get senal(): string | null | undefined {
        return this.parameters.senal;
    }
    get umbralNivel1(): number | null | undefined {
        return this.parameters.umbralNivel1;
    }
    get umbralCaudal1(): number | null | undefined {
        return this.parameters.umbralCaudal1;
    }
    get umbralNivel2(): number | null | undefined {
        return this.parameters.umbralNivel2;
    }
    get umbralCaudal2(): number | null | undefined {
        return this.parameters.umbralCaudal2;
    }
    get umbralNivel3(): number | null | undefined {
        return this.parameters.umbralNivel3;
    }
    get umbralCaudal3(): number | null | undefined {
        return this.parameters.umbralCaudal3;
    }
    get maxNivelMuro(): number | null | undefined {
        return this.parameters.maxNivelMuro;
    }
    get maxNivelCaseta(): number | null | undefined {
        return this.parameters.maxNivelCaseta;
    }
    get umbralVolumen1(): number | null | undefined {
        return this.parameters.umbralVolumen1;
    }
    get umbralVolumen2(): number | null | undefined {
        return this.parameters.umbralVolumen2;
    }
    get umbralVolumen3(): number | null | undefined {
        return this.parameters.umbralVolumen3;
    }
    get caudalEntrada(): string | null | undefined {
        return this.parameters.caudalEntrada;
    }
    get caudalSalida(): string | null | undefined {
        return this.parameters.caudalSalida;
    }
    get capacidad(): number | null | undefined {
        return this.parameters.capacidad;
    }
}

@CommandHandler(UpdateStationThresholdCommand)
export class UpdateStationThresholdHandler implements ICommandHandler<
    UpdateStationThresholdCommand,
    UpdateThresholdResult
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly stationRepository: IStationRepository,
        private readonly stationThresholdRepository: IStationThresholdRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: UpdateStationThresholdCommand): Promise<UpdateThresholdResult> {
        this.logger.log({ msg: 'Updating threshold', entity: 'Stations', stationId: command.stationId });

        // 1. Verify station exists
        let station;
        try {
            station = await this.stationRepository.findById(command.stationId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Station with id "${command.stationId}" not found`);
            }
            throw error;
        }

        // 2. Find or create threshold
        const existing = await this.stationThresholdRepository.findByStationId(station.id);
        const threshold = new StationThreshold({
            ...(existing ?? {}),
            stationId: station.id,
        });

        // 3. Apply partial updates
        if (command.parametro !== undefined) threshold.parametro = command.parametro;
        if (command.senal !== undefined) threshold.senal = command.senal;
        if (command.umbralNivel1 !== undefined) threshold.umbralNivel1 = command.umbralNivel1;
        if (command.umbralCaudal1 !== undefined) threshold.umbralCaudal1 = command.umbralCaudal1;
        if (command.umbralNivel2 !== undefined) threshold.umbralNivel2 = command.umbralNivel2;
        if (command.umbralCaudal2 !== undefined) threshold.umbralCaudal2 = command.umbralCaudal2;
        if (command.umbralNivel3 !== undefined) threshold.umbralNivel3 = command.umbralNivel3;
        if (command.umbralCaudal3 !== undefined) threshold.umbralCaudal3 = command.umbralCaudal3;
        if (command.maxNivelMuro !== undefined) threshold.maxNivelMuro = command.maxNivelMuro;
        if (command.maxNivelCaseta !== undefined) threshold.maxNivelCaseta = command.maxNivelCaseta;
        if (command.umbralVolumen1 !== undefined) threshold.umbralVolumen1 = command.umbralVolumen1;
        if (command.umbralVolumen2 !== undefined) threshold.umbralVolumen2 = command.umbralVolumen2;
        if (command.umbralVolumen3 !== undefined) threshold.umbralVolumen3 = command.umbralVolumen3;
        if (command.caudalEntrada !== undefined) threshold.caudalEntrada = command.caudalEntrada;
        if (command.caudalSalida !== undefined) threshold.caudalSalida = command.caudalSalida;
        if (command.capacidad !== undefined) threshold.capacidad = command.capacidad;

        threshold.validate();
        const saved = await this.stationThresholdRepository.upsert(threshold);

        this.logger.log({ msg: 'Threshold updated', entity: 'Stations', stationId: station.id });

        // 4. Invalidate cache
        await this.cacheService.del(StationCacheKeys.byId(station.id));
        await this.cacheService.del(StationCacheKeys.bySubBasinName(station.subBasinName));
        await this.cacheService.del(StationCacheKeys.threshold(station.id));
        await this.cacheService.delByPattern(StationCacheKeys.pattern());

        return new UpdateThresholdResult({
            id: saved.id,
            stationId: station.id,
            stationCode: station.stationCode,
            threshold: saved,
            updatedAt: saved.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateStation
// ─────────────────────────────────────────────────────────────

export interface IUpdateStationCommand {
    id: string;
    name?: string;
    subBasinName?: string;
    stationCode?: string;
    stationType?: StationType;
    latitude?: number | null;
    longitude?: number | null;
    altitude?: number | null;
    description?: string | null;
}

export class UpdateStationCommand {
    constructor(private readonly parameters: IUpdateStationCommand) {}

    get id(): string {
        return this.parameters.id;
    }
    get name(): string | undefined {
        return this.parameters.name;
    }
    get subBasinName(): string | undefined {
        return this.parameters.subBasinName;
    }
    get stationCode(): string | undefined {
        return this.parameters.stationCode;
    }
    get stationType(): StationType | undefined {
        return this.parameters.stationType;
    }
    get latitude(): number | null | undefined {
        return this.parameters.latitude;
    }
    get longitude(): number | null | undefined {
        return this.parameters.longitude;
    }
    get altitude(): number | null | undefined {
        return this.parameters.altitude;
    }
    get description(): string | null | undefined {
        return this.parameters.description;
    }
}

@CommandHandler(UpdateStationCommand)
export class UpdateStationHandler implements ICommandHandler<UpdateStationCommand, UpdateStationResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly stationRepository: IStationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: UpdateStationCommand): Promise<UpdateStationResult> {
        this.logger.log({ msg: 'Updating station', entity: 'Stations', id: command.id });

        // 1. Find station
        let station;
        try {
            station = await this.stationRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Station with id "${command.id}" not found`);
            }
            throw error;
        }

        // 2. Apply partial updates
        if (command.name !== undefined) station.name = command.name;
        if (command.subBasinName !== undefined) station.subBasinName = command.subBasinName;
        if (command.stationCode !== undefined) station.stationCode = command.stationCode;
        if (command.stationType !== undefined) station.stationType = command.stationType;
        if (command.latitude !== undefined) station.latitude = command.latitude;
        if (command.longitude !== undefined) station.longitude = command.longitude;
        if (command.altitude !== undefined) station.altitude = command.altitude;
        if (command.description !== undefined) station.description = command.description;

        // 3. Validate updated entity
        station.validate();

        // 4. Check duplicate stationCode (if changed)
        if (command.stationCode !== undefined) {
            const existingByCode = await this.stationRepository.findByStationCode(station.stationCode);
            if (existingByCode && existingByCode.id !== station.id) {
                throw new ApiError(
                    HttpStatus.CONFLICT,
                    `Station with stationCode "${station.stationCode}" already exists`,
                );
            }
        }

        // 6. Persist
        const updatedStation = await this.stationRepository.update(station);

        this.logger.log({ msg: 'Station updated', entity: 'Stations', id: updatedStation.id });

        // 7. Invalidate cache
        await this.cacheService.del(StationCacheKeys.byId(updatedStation.id));
        await this.cacheService.del(StationCacheKeys.bySubBasinName(updatedStation.subBasinName));
        await this.cacheService.del(StationCacheKeys.threshold(updatedStation.id));
        await this.cacheService.delByPattern(StationCacheKeys.pattern());

        return new UpdateStationResult({
            id: updatedStation.id,
            name: updatedStation.name,
            subBasinName: updatedStation.subBasinName,
            stationCode: updatedStation.stationCode,
            stationType: updatedStation.stationType,
            subBasinId: updatedStation.subBasinId,
            threshold: updatedStation.threshold ?? null,
            latitude: updatedStation.latitude,
            longitude: updatedStation.longitude,
            altitude: updatedStation.altitude,
            municipio: updatedStation.municipio,
            provincia: updatedStation.provincia,
            ccaa: updatedStation.ccaa,
            tipoCod: updatedStation.tipoCod,
            zona: updatedStation.zona,
            zonaExplOgcFid: updatedStation.zonaExplOgcFid,
            zonaExplNombre: updatedStation.zonaExplNombre,
            comarcaName: updatedStation.comarcaName,
            sistemaName: updatedStation.sistemaName,
            meteoalertaZonaCode: updatedStation.meteoalertaZonaCode,
            meteoalertaZonaNombre: updatedStation.meteoalertaZonaNombre,
            hasCaudalNam: updatedStation.hasCaudalNam,
            hasCaudalMike: updatedStation.hasCaudalMike,
            description: updatedStation.description,
            isActive: updatedStation.isActive,
            createdAt: updatedStation.createdAt!,
            updatedAt: updatedStation.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleStation
// ─────────────────────────────────────────────────────────────

export interface IToggleStationCommand {
    id: string;
}

export class ToggleStationCommand {
    constructor(private readonly parameters: IToggleStationCommand) {}

    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(ToggleStationCommand)
export class ToggleStationHandler implements ICommandHandler<ToggleStationCommand, ToggleStationResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly stationRepository: IStationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: ToggleStationCommand): Promise<ToggleStationResult> {
        this.logger.log({ msg: 'Toggling station', entity: 'Stations', id: command.id });

        // 1. Find station
        let station;
        try {
            station = await this.stationRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Station with id "${command.id}" not found`);
            }
            throw error;
        }

        // 2. Toggle
        station.toggleActive();
        const updatedStation = await this.stationRepository.update(station);

        this.logger.log({
            msg: 'Station toggled',
            entity: 'Stations',
            id: updatedStation.id,
            isActive: updatedStation.isActive,
        });

        // 3. Invalidate cache
        await this.cacheService.del(StationCacheKeys.byId(updatedStation.id));
        await this.cacheService.del(StationCacheKeys.bySubBasinName(updatedStation.subBasinName));
        await this.cacheService.del(StationCacheKeys.threshold(updatedStation.id));
        await this.cacheService.delByPattern(StationCacheKeys.pattern());

        return new ToggleStationResult({
            id: updatedStation.id,
            name: updatedStation.name,
            stationCode: updatedStation.stationCode,
            isActive: updatedStation.isActive,
            updatedAt: updatedStation.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteStation (soft delete — set isActive=false, idempotent)
// ─────────────────────────────────────────────────────────────

export interface IDeleteStationCommand {
    id: string;
}

export class DeleteStationCommand {
    constructor(private readonly parameters: IDeleteStationCommand) {}
    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(DeleteStationCommand)
export class DeleteStationHandler implements ICommandHandler<DeleteStationCommand, DeleteStationResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly stationRepository: IStationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: DeleteStationCommand): Promise<DeleteStationResult> {
        this.logger.log({ msg: 'Deleting station', entity: 'Stations', id: command.id });

        let station;
        try {
            station = await this.stationRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Station with id "${command.id}" not found`);
            }
            throw error;
        }

        station.isActive = false;
        const updatedStation = await this.stationRepository.update(station);

        this.logger.log({
            msg: 'Station deleted (soft)',
            entity: 'Stations',
            id: updatedStation.id,
            isActive: updatedStation.isActive,
        });
        await this.cacheService.del(StationCacheKeys.byId(updatedStation.id));
        await this.cacheService.del(StationCacheKeys.bySubBasinName(updatedStation.subBasinName));
        await this.cacheService.del(StationCacheKeys.threshold(updatedStation.id));
        await this.cacheService.delByPattern(StationCacheKeys.pattern());

        return new DeleteStationResult({
            id: updatedStation.id,
            name: updatedStation.name,
            stationCode: updatedStation.stationCode,
            isActive: updatedStation.isActive,
            updatedAt: updatedStation.updatedAt!,
        });
    }
}
