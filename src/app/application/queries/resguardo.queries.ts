import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';
import { IStationResguardoRepository } from '@domain/ports/station-resguardo-repository.port';
import { IStationRepository } from '@domain/ports/station-repository.port';
import { ApiError } from '@domain/errors/api.error';
import { StationResguardo } from '@domain/entities/station-resguardo.entity';
import {
    GetResguardoByDateResult,
    GetResguardosByStationResult,
    ResolvedResguardoEntry,
} from '@domain/results/resguardo.results';

// ─────────────────────────────────────────────────────────────
// Helper: resolve edited ?? original
// ─────────────────────────────────────────────────────────────

function resolveEntry(r: StationResguardo): ResolvedResguardoEntry {
    return {
        minimumVolume: r.minimumVolume ?? r.originalMinimumVolume,
        reserveVolume: r.reserveVolume ?? r.originalReserveVolume,
        reserveLevel: r.reserveLevel ?? r.originalReserveLevel,
    };
}

// ─────────────────────────────────────────────────────────────
// GetResguardosByStation
// ─────────────────────────────────────────────────────────────

export interface IGetResguardosByStationQuery {
    stationCode: string;
    year?: number;
    from?: string;
    to?: string;
}

export class GetResguardosByStationQuery {
    constructor(private readonly parameters: IGetResguardosByStationQuery) {}
    get stationCode(): string {
        return this.parameters.stationCode;
    }
    get year(): number | undefined {
        return this.parameters.year;
    }
    get from(): string | undefined {
        return this.parameters.from;
    }
    get to(): string | undefined {
        return this.parameters.to;
    }
}

@QueryHandler(GetResguardosByStationQuery)
export class GetResguardosByStationHandler implements IQueryHandler<
    GetResguardosByStationQuery,
    GetResguardosByStationResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly resguardoRepository: IStationResguardoRepository,
        private readonly stationRepository: IStationRepository,
    ) {}

    async execute(query: GetResguardosByStationQuery): Promise<GetResguardosByStationResult> {
        this.logger.debug({ msg: 'Getting resguardos by station', stationCode: query.stationCode });

        const station = await this.stationRepository.findByStationCode(query.stationCode);
        if (!station) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Station with code "${query.stationCode}" not found`);
        }

        const items = await this.resguardoRepository.findByStationId({
            stationId: station.id,
            year: query.year,
            from: query.from,
            to: query.to,
        });

        const entries: Record<string, ResolvedResguardoEntry> = {};
        for (const r of items) {
            entries[r.date] = resolveEntry(r);
        }

        return new GetResguardosByStationResult({
            stationCode: station.stationCode,
            stationName: station.name,
            entries,
            total: items.length,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// GetResguardoByDate
// ─────────────────────────────────────────────────────────────

export interface IGetResguardoByDateQuery {
    stationCode: string;
    date: string;
}

export class GetResguardoByDateQuery {
    constructor(private readonly parameters: IGetResguardoByDateQuery) {}
    get stationCode(): string {
        return this.parameters.stationCode;
    }
    get date(): string {
        return this.parameters.date;
    }
}

@QueryHandler(GetResguardoByDateQuery)
export class GetResguardoByDateHandler implements IQueryHandler<GetResguardoByDateQuery, GetResguardoByDateResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly resguardoRepository: IStationResguardoRepository,
        private readonly stationRepository: IStationRepository,
    ) {}

    async execute(query: GetResguardoByDateQuery): Promise<GetResguardoByDateResult> {
        this.logger.debug({ msg: 'Getting resguardo by date', stationCode: query.stationCode, date: query.date });

        const station = await this.stationRepository.findByStationCode(query.stationCode);
        if (!station) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Station with code "${query.stationCode}" not found`);
        }

        const resguardo = await this.resguardoRepository.findByStationIdAndDate(station.id, query.date);
        if (!resguardo) {
            throw new ApiError(
                HttpStatus.NOT_FOUND,
                `Resguardo not found for station "${query.stationCode}" on date "${query.date}"`,
            );
        }

        return new GetResguardoByDateResult({
            stationCode: station.stationCode,
            stationName: station.name,
            entry: resolveEntry(resguardo),
        });
    }
}
