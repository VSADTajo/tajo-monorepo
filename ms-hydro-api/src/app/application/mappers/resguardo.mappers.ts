import {
    GetResguardosByStationRequestDto,
    GetResguardosByStationResponseDto,
    GetResguardoByDateResponseDto,
    UpdateResguardoRequestDto,
    UpdateResguardoResponseDto,
    ImportResguardosResponseDto,
} from '@api/dtos/resguardo.dtos';
import { GetResguardosByStationQuery } from '@application/queries/resguardo.queries';
import { GetResguardoByDateQuery } from '@application/queries/resguardo.queries';
import { UpdateResguardoCommand } from '@application/commands/resguardo.commands';
import {
    GetResguardosByStationResult,
    GetResguardoByDateResult,
    UpdateResguardoResult,
    ImportResguardosResult,
} from '@domain/results/resguardo.results';

// ─────────────────────────────────────────────────────────────
// GetResguardosByStation
// ─────────────────────────────────────────────────────────────

export class GetResguardosByStationMapper {
    static toQuery(stationCode: string, dto: GetResguardosByStationRequestDto): GetResguardosByStationQuery {
        return new GetResguardosByStationQuery({
            stationCode,
            year: dto.year,
            from: dto.from,
            to: dto.to,
        });
    }

    static toResponseDto(result: GetResguardosByStationResult): GetResguardosByStationResponseDto {
        return {
            stationCode: result.stationCode,
            stationName: result.stationName,
            entries: result.entries,
            total: result.total,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetResguardoByDate
// ─────────────────────────────────────────────────────────────

export class GetResguardoByDateMapper {
    static toQuery(stationCode: string, date: string): GetResguardoByDateQuery {
        return new GetResguardoByDateQuery({ stationCode, date });
    }

    static toResponseDto(result: GetResguardoByDateResult): GetResguardoByDateResponseDto {
        return {
            stationCode: result.stationCode,
            stationName: result.stationName,
            date: result.date,
            original: result.original,
            edited: result.edited,
            resolved: result.resolved,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateResguardo
// ─────────────────────────────────────────────────────────────

export class UpdateResguardoMapper {
    static toCommand(stationCode: string, date: string, dto: UpdateResguardoRequestDto): UpdateResguardoCommand {
        return new UpdateResguardoCommand({
            stationCode,
            date,
            reserveVolume: dto.reserveVolume,
            reserveLevel: dto.reserveLevel,
            minimumVolume: dto.minimumVolume,
        });
    }

    static toResponseDto(result: UpdateResguardoResult): UpdateResguardoResponseDto {
        return {
            entry: result.entry,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ImportResguardos
// ─────────────────────────────────────────────────────────────

export class ImportResguardosMapper {
    static toResponseDto(result: ImportResguardosResult): ImportResguardosResponseDto {
        return {
            totalImported: result.totalImported,
            stationsProcessed: result.stationsProcessed,
        };
    }
}
