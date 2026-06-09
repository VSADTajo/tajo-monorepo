import {
    GetAvisosQueryDto,
    GetAvisosResponseDto,
    GetAvisosResumenResponseDto,
    GetAvisosTiposResponseDto,
} from '@api/dtos/avisos.dtos';
import { GetAvisosQuery, GetAvisosResumenQuery, GetAvisosTiposQuery } from '@application/queries/avisos.queries';
import { GetAvisosResult, GetAvisosResumenResult, GetAvisosTiposResult } from '@domain/results/avisos.results';

// ─────────────────────────────────────────────────────────────
// GetAvisos
// ─────────────────────────────────────────────────────────────

export class GetAvisosMapper {
    static toQuery(dto: GetAvisosQueryDto): GetAvisosQuery {
        return new GetAvisosQuery({ tipo: dto.tipo, provincia: dto.provincia });
    }

    static toResponseDto(result: GetAvisosResult): GetAvisosResponseDto {
        return result.geojson as GetAvisosResponseDto;
    }
}

// ─────────────────────────────────────────────────────────────
// GetAvisosTipos
// ─────────────────────────────────────────────────────────────

export class GetAvisosTiposMapper {
    static toQuery(): GetAvisosTiposQuery {
        return new GetAvisosTiposQuery();
    }

    static toResponseDto(result: GetAvisosTiposResult): GetAvisosTiposResponseDto {
        return { tipos: result.tipos };
    }
}

// ─────────────────────────────────────────────────────────────
// GetAvisosResumen
// ─────────────────────────────────────────────────────────────

export class GetAvisosResumenMapper {
    static toQuery(): GetAvisosResumenQuery {
        return new GetAvisosResumenQuery();
    }

    static toResponseDto(result: GetAvisosResumenResult): GetAvisosResumenResponseDto {
        return {
            categoriasActivas: result.categoriasActivas,
            totalAvisos: result.totalAvisos,
        };
    }
}
