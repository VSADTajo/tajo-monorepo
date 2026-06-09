import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';
import { IStationResguardoRepository } from '@domain/ports/station-resguardo-repository.port';
import { IStationRepository } from '@domain/ports/station-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { StationResguardo } from '@domain/entities/station-resguardo.entity';
import { Organismo } from '@domain/types/organismo.enum';
import { StationType } from '@domain/types/station-type.enum';
import { ApiError } from '@domain/errors/api.error';
import {
    ImportResguardosResult,
    ResolvedResguardoEntry,
    UpdateResguardoResult,
} from '@domain/results/resguardo.results';
import { ResguardoCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// ImportResguardos
// ─────────────────────────────────────────────────────────────

export interface ResguardoImportRow {
    stationCode: string;
    date: string;
    organismo: Organismo;
    originalReserveVolume: number | null;
    originalReserveLevel: number | null;
    originalMinimumVolume: number | null;
}

export interface IImportResguardosCommand {
    rows: ResguardoImportRow[];
}

export class ImportResguardosCommand {
    constructor(private readonly parameters: IImportResguardosCommand) {}
    get rows(): ResguardoImportRow[] {
        return this.parameters.rows;
    }
}

@CommandHandler(ImportResguardosCommand)
export class ImportResguardosHandler implements ICommandHandler<ImportResguardosCommand, ImportResguardosResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly resguardoRepository: IStationResguardoRepository,
        private readonly stationRepository: IStationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: ImportResguardosCommand): Promise<ImportResguardosResult> {
        this.logger.log({ msg: 'Importing resguardos', totalRows: command.rows.length });

        const uniqueCodes = [...new Set(command.rows.map((r) => r.stationCode))];

        const stationMap = new Map<string, string>();
        for (const code of uniqueCodes) {
            const station = await this.stationRepository.findByStationCode(code);
            if (!station) {
                this.logger.warn({ msg: `Station not found for code: ${code}, skipping` });
                continue;
            }
            if (station.stationType !== StationType.EMBALSE_SAIH) {
                this.logger.warn({ msg: `Station ${code} is not EMBALSE_SAIH, skipping` });
                continue;
            }
            stationMap.set(code, station.id);
        }

        // Deduplicate by (stationId, date) — keep last occurrence (later sheets override)
        const deduped = new Map<string, StationResguardo>();
        for (const row of command.rows) {
            const stationId = stationMap.get(row.stationCode);
            if (!stationId) continue;

            const entity = new StationResguardo({
                stationId,
                date: row.date,
                organismo: row.organismo,
                originalReserveVolume: row.originalReserveVolume,
                originalReserveLevel: row.originalReserveLevel,
                originalMinimumVolume: row.originalMinimumVolume,
                reserveVolume: null,
                reserveLevel: null,
                minimumVolume: null,
            });
            entity.validate();
            deduped.set(`${stationId}:${row.date}`, entity);
        }
        const entities = Array.from(deduped.values());

        const totalImported = await this.resguardoRepository.bulkUpsert(entities);

        await this.cacheService.delByPattern(ResguardoCacheKeys.pattern());

        this.logger.log({
            msg: 'Resguardos imported',
            totalImported,
            stationsProcessed: stationMap.size,
        });

        return new ImportResguardosResult({
            totalImported,
            stationsProcessed: stationMap.size,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateResguardo
// ─────────────────────────────────────────────────────────────

export interface IUpdateResguardoCommand {
    stationCode: string;
    date: string;
    reserveVolume?: number | null;
    reserveLevel?: number | null;
    minimumVolume?: number | null;
}

export class UpdateResguardoCommand {
    constructor(private readonly parameters: IUpdateResguardoCommand) {}
    get stationCode(): string {
        return this.parameters.stationCode;
    }
    get date(): string {
        return this.parameters.date;
    }
    get reserveVolume(): number | null | undefined {
        return this.parameters.reserveVolume;
    }
    get reserveLevel(): number | null | undefined {
        return this.parameters.reserveLevel;
    }
    get minimumVolume(): number | null | undefined {
        return this.parameters.minimumVolume;
    }
}

@CommandHandler(UpdateResguardoCommand)
export class UpdateResguardoHandler implements ICommandHandler<UpdateResguardoCommand, UpdateResguardoResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly resguardoRepository: IStationResguardoRepository,
        private readonly stationRepository: IStationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: UpdateResguardoCommand): Promise<UpdateResguardoResult> {
        this.logger.log({ msg: 'Updating resguardo', stationCode: command.stationCode, date: command.date });

        const station = await this.stationRepository.findByStationCode(command.stationCode);
        if (!station) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Station with code "${command.stationCode}" not found`);
        }

        const resguardo = await this.resguardoRepository.findByStationIdAndDate(station.id, command.date);
        if (!resguardo) {
            throw new ApiError(
                HttpStatus.NOT_FOUND,
                `Resguardo not found for station "${command.stationCode}" on date "${command.date}"`,
            );
        }

        if (command.reserveVolume !== undefined) resguardo.reserveVolume = command.reserveVolume;
        if (command.reserveLevel !== undefined) resguardo.reserveLevel = command.reserveLevel;
        if (command.minimumVolume !== undefined) resguardo.minimumVolume = command.minimumVolume;

        const updated = await this.resguardoRepository.update(resguardo);

        await this.cacheService.delByPattern(ResguardoCacheKeys.byStation(command.stationCode));
        await this.cacheService.delByPattern(ResguardoCacheKeys.pattern());

        const entry: ResolvedResguardoEntry = {
            minimumVolume: updated.minimumVolume ?? updated.originalMinimumVolume,
            reserveVolume: updated.reserveVolume ?? updated.originalReserveVolume,
            reserveLevel: updated.reserveLevel ?? updated.originalReserveLevel,
        };

        return new UpdateResguardoResult({ entry });
    }
}
