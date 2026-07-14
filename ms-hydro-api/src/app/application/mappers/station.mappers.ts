import {
    CreateStationRequestDto,
    CreateStationResponseDto,
    StationThresholdDto,
    GetStationResponseDto,
    GetStationBySubBasinNameResponseDto,
    GetStationByCodeResponseDto,
    UpdateThresholdRequestDto,
    UpdateThresholdResponseDto,
    GetThresholdResponseDto,
    ListStationsRequestDto,
    ListStationsResponseDto,
    UpdateStationRequestDto,
    UpdateStationResponseDto,
    ToggleStationResponseDto,
    DeleteStationResponseDto,
    GetDownstreamStationsRequestDto,
    GetDownstreamStationsResponseDto,
} from '@api/dtos/station.dtos';
import { StationThresholdData } from '@domain/types/station-threshold-data.type';
import {
    CreateStationCommand,
    UpdateStationCommand,
    ToggleStationCommand,
    DeleteStationCommand,
} from '@application/commands/station.commands';
import {
    GetStationByIdQuery,
    GetStationBySubBasinNameQuery,
    GetStationByCodeQuery,
    GetStationThresholdQuery,
    ListStationsQuery,
    GetDownstreamStationsQuery,
} from '@application/queries/station.queries';
import { UpdateStationThresholdCommand } from '@application/commands/station.commands';
import {
    CreateStationResult,
    ListStationsResult,
    UpdateStationResult,
    ToggleStationResult,
    DeleteStationResult,
} from '@domain/results/station.results';
import {
    GetStationResult,
    GetStationBySubBasinNameResult,
    UpdateThresholdResult,
    GetThresholdResult,
} from '@domain/results/station.results';
import { DownstreamStationsResult } from '@domain/results/downstream-stations.result';

// Re-export GetStationResult as GetStationByCodeResult (same shape)
type GetStationByCodeResult = GetStationResult;

// ─────────────────────────────────────────────────────────────
// Threshold entity → DTO
// ─────────────────────────────────────────────────────────────

export function toThresholdDto(t: StationThresholdData | null | undefined): StationThresholdDto | null {
    if (!t) return null;
    return {
        id: t.id,
        stationId: t.stationId,
        parametro: t.parametro,
        senal: t.senal,
        umbralNivel1: t.umbralNivel1,
        umbralCaudal1: t.umbralCaudal1,
        umbralNivel2: t.umbralNivel2,
        umbralCaudal2: t.umbralCaudal2,
        umbralNivel3: t.umbralNivel3,
        umbralCaudal3: t.umbralCaudal3,
        maxNivelMuro: t.maxNivelMuro,
        maxNivelCaseta: t.maxNivelCaseta,
        umbralVolumen1: t.umbralVolumen1,
        umbralVolumen2: t.umbralVolumen2,
        umbralVolumen3: t.umbralVolumen3,
        caudalEntrada: t.caudalEntrada,
        caudalSalida: t.caudalSalida,
        capacidad: t.capacidad,
    };
}

// ─────────────────────────────────────────────────────────────
// CreateStation
// ─────────────────────────────────────────────────────────────

export class CreateStationMapper {
    static toCommand(dto: CreateStationRequestDto): CreateStationCommand {
        return new CreateStationCommand(dto);
    }

    static toResponseDto(result: CreateStationResult): CreateStationResponseDto {
        return {
            id: result.id,
            name: result.name,
            subBasinName: result.subBasinName,
            stationCode: result.stationCode,
            stationType: result.stationType,
            subBasinId: result.subBasinId,
            threshold: toThresholdDto(result.threshold),
            latitude: result.latitude,
            longitude: result.longitude,
            altitude: result.altitude,
            municipio: result.municipio,
            provincia: result.provincia,
            ccaa: result.ccaa,
            tipoCod: result.tipoCod,
            zona: result.zona,
            zonaExplOgcFid: result.zonaExplOgcFid,
            zonaExplNombre: result.zonaExplNombre,
            comarcaName: result.comarcaName,
            sistemaName: result.sistemaName,
            meteoalertaZonaCode: result.meteoalertaZonaCode,
            meteoalertaZonaNombre: result.meteoalertaZonaNombre,
            description: result.description,
            isActive: result.isActive,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetStationById
// ─────────────────────────────────────────────────────────────

export class GetStationByIdMapper {
    static toQuery(id: string): GetStationByIdQuery {
        return new GetStationByIdQuery({ id });
    }

    static toResponseDto(result: GetStationResult): GetStationResponseDto {
        return {
            id: result.id,
            name: result.name,
            subBasinName: result.subBasinName,
            stationCode: result.stationCode,
            stationType: result.stationType,
            subBasinId: result.subBasinId,
            threshold: toThresholdDto(result.threshold),
            latitude: result.latitude,
            longitude: result.longitude,
            altitude: result.altitude,
            municipio: result.municipio,
            provincia: result.provincia,
            ccaa: result.ccaa,
            tipoCod: result.tipoCod,
            zona: result.zona,
            zonaExplOgcFid: result.zonaExplOgcFid,
            zonaExplNombre: result.zonaExplNombre,
            comarcaName: result.comarcaName,
            sistemaName: result.sistemaName,
            meteoalertaZonaCode: result.meteoalertaZonaCode,
            meteoalertaZonaNombre: result.meteoalertaZonaNombre,
            description: result.description,
            isActive: result.isActive,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetStationBySubBasinName
// ─────────────────────────────────────────────────────────────

export class GetStationBySubBasinNameMapper {
    static toQuery(subBasinName: string): GetStationBySubBasinNameQuery {
        return new GetStationBySubBasinNameQuery({ subBasinName });
    }

    static toResponseDto(result: GetStationBySubBasinNameResult): GetStationBySubBasinNameResponseDto {
        return {
            id: result.id,
            name: result.name,
            subBasinName: result.subBasinName,
            stationCode: result.stationCode,
            stationType: result.stationType,
            subBasinId: result.subBasinId,
            threshold: toThresholdDto(result.threshold),
            latitude: result.latitude,
            longitude: result.longitude,
            altitude: result.altitude,
            municipio: result.municipio,
            provincia: result.provincia,
            ccaa: result.ccaa,
            tipoCod: result.tipoCod,
            zona: result.zona,
            zonaExplOgcFid: result.zonaExplOgcFid,
            zonaExplNombre: result.zonaExplNombre,
            comarcaName: result.comarcaName,
            sistemaName: result.sistemaName,
            meteoalertaZonaCode: result.meteoalertaZonaCode,
            meteoalertaZonaNombre: result.meteoalertaZonaNombre,
            description: result.description,
            isActive: result.isActive,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateThreshold
// ─────────────────────────────────────────────────────────────

export class UpdateThresholdMapper {
    static toCommand(stationId: string, dto: UpdateThresholdRequestDto): UpdateStationThresholdCommand {
        return new UpdateStationThresholdCommand({ stationId, ...dto });
    }

    static toResponseDto(result: UpdateThresholdResult): UpdateThresholdResponseDto {
        return {
            id: result.id,
            stationId: result.stationId,
            stationCode: result.stationCode,
            threshold: toThresholdDto(result.threshold)!,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetThreshold
// ─────────────────────────────────────────────────────────────

export class GetThresholdMapper {
    static toQuery(id: string): GetStationThresholdQuery {
        return new GetStationThresholdQuery({ id });
    }

    static toResponseDto(result: GetThresholdResult): GetThresholdResponseDto {
        return {
            stationId: result.stationId,
            stationCode: result.stationCode,
            threshold: toThresholdDto(result.threshold),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ListStations
// ─────────────────────────────────────────────────────────────

export class ListStationsMapper {
    static toQuery(dto: ListStationsRequestDto): ListStationsQuery {
        return new ListStationsQuery({
            page: dto.page,
            limit: dto.limit,
            subBasinId: dto.subBasinId,
            stationType: dto.stationType,
            isActive: dto.isActive,
            zona: dto.zona,
            zonaExplOgcFid: dto.zonaExplOgcFid,
            zonaExplNombre: dto.zonaExplNombre,
            subBasinName: dto.subBasinName,
            comarcaName: dto.comarcaName,
            sistemaName: dto.sistemaName,
            meteoalertaZonaCode: dto.meteoalertaZonaCode,
            meteoalertaZonaNombre: dto.meteoalertaZonaNombre,
            stationCode: dto.stationCode,
        });
    }

    static toResponseDto(result: ListStationsResult): ListStationsResponseDto {
        return {
            items: result.items.map((item) => ({
                id: item.id,
                name: item.name,
                subBasinName: item.subBasinName,
                stationCode: item.stationCode,
                stationType: item.stationType,
                subBasinId: item.subBasinId,
                threshold: toThresholdDto(item.threshold),
                latitude: item.latitude,
                longitude: item.longitude,
                altitude: item.altitude,
                municipio: item.municipio,
                provincia: item.provincia,
                ccaa: item.ccaa,
                tipoCod: item.tipoCod,
                zona: item.zona,
                zonaExplOgcFid: item.zonaExplOgcFid,
                zonaExplNombre: item.zonaExplNombre,
                comarcaName: item.comarcaName,
                sistemaName: item.sistemaName,
                meteoalertaZonaCode: item.meteoalertaZonaCode,
                meteoalertaZonaNombre: item.meteoalertaZonaNombre,
                description: item.description,
                isActive: item.isActive,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            })),
            total: result.total,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateStation
// ─────────────────────────────────────────────────────────────

export class UpdateStationMapper {
    static toCommand(id: string, dto: UpdateStationRequestDto): UpdateStationCommand {
        return new UpdateStationCommand({ id, ...dto });
    }

    static toResponseDto(result: UpdateStationResult): UpdateStationResponseDto {
        return {
            id: result.id,
            name: result.name,
            subBasinName: result.subBasinName,
            stationCode: result.stationCode,
            stationType: result.stationType,
            subBasinId: result.subBasinId,
            threshold: toThresholdDto(result.threshold),
            latitude: result.latitude,
            longitude: result.longitude,
            altitude: result.altitude,
            municipio: result.municipio,
            provincia: result.provincia,
            ccaa: result.ccaa,
            tipoCod: result.tipoCod,
            zona: result.zona,
            zonaExplOgcFid: result.zonaExplOgcFid,
            zonaExplNombre: result.zonaExplNombre,
            comarcaName: result.comarcaName,
            sistemaName: result.sistemaName,
            meteoalertaZonaCode: result.meteoalertaZonaCode,
            meteoalertaZonaNombre: result.meteoalertaZonaNombre,
            description: result.description,
            isActive: result.isActive,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleStation
// ─────────────────────────────────────────────────────────────

export class ToggleStationMapper {
    static toCommand(id: string): ToggleStationCommand {
        return new ToggleStationCommand({ id });
    }

    static toResponseDto(result: ToggleStationResult): ToggleStationResponseDto {
        return {
            id: result.id,
            name: result.name,
            stationCode: result.stationCode,
            isActive: result.isActive,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteStation
// ─────────────────────────────────────────────────────────────

export class DeleteStationMapper {
    static toCommand(id: string): DeleteStationCommand {
        return new DeleteStationCommand({ id });
    }

    static toResponseDto(result: DeleteStationResult): DeleteStationResponseDto {
        return {
            id: result.id,
            name: result.name,
            stationCode: result.stationCode,
            isActive: result.isActive,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetStationByCode
// ─────────────────────────────────────────────────────────────

export class GetStationByCodeMapper {
    static toQuery(stationCode: string): GetStationByCodeQuery {
        return new GetStationByCodeQuery({ stationCode });
    }

    static toResponseDto(result: GetStationByCodeResult): GetStationByCodeResponseDto {
        return {
            id: result.id,
            name: result.name,
            subBasinName: result.subBasinName,
            stationCode: result.stationCode,
            stationType: result.stationType,
            subBasinId: result.subBasinId,
            threshold: toThresholdDto(result.threshold),
            latitude: result.latitude,
            longitude: result.longitude,
            altitude: result.altitude,
            municipio: result.municipio,
            provincia: result.provincia,
            ccaa: result.ccaa,
            tipoCod: result.tipoCod,
            zona: result.zona,
            zonaExplOgcFid: result.zonaExplOgcFid,
            zonaExplNombre: result.zonaExplNombre,
            comarcaName: result.comarcaName,
            sistemaName: result.sistemaName,
            meteoalertaZonaCode: result.meteoalertaZonaCode,
            meteoalertaZonaNombre: result.meteoalertaZonaNombre,
            description: result.description,
            isActive: result.isActive,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetDownstreamStations
// ─────────────────────────────────────────────────────────────

export class GetDownstreamStationsMapper {
    static toQuery(dto: GetDownstreamStationsRequestDto): GetDownstreamStationsQuery {
        return new GetDownstreamStationsQuery({ codes: dto.codes });
    }

    static toResponseDto(result: DownstreamStationsResult): GetDownstreamStationsResponseDto {
        return {
            items: result.items.map((item) => ({
                codigoDestino: item.codigoDestino,
                nombreDestino: item.nombreDestino,
                tipoDestino: item.tipoDestino,
            })),
            count: result.count,
        };
    }
}
