import { SearchGeoDataRequestDto, SearchGeoDataResponseDto } from '@api/dtos/geo-data.dtos';
import { SearchGeoDataQuery } from '@application/queries/geo-data.queries';
import { SearchGeoDataResult } from '@domain/results/search-geo-data.result';

// ─────────────────────────────────────────────────────────────
// SearchGeoData
// ─────────────────────────────────────────────────────────────

export class SearchGeoDataMapper {
    static toQuery(dto: SearchGeoDataRequestDto): SearchGeoDataQuery {
        return new SearchGeoDataQuery({ query: dto.q });
    }

    static toResponseDto(results: SearchGeoDataResult[]): SearchGeoDataResponseDto {
        return {
            results: results.map((result) => ({
                origen: result.origen,
                codigo: result.codigo,
                nombre: result.nombre,
                tipoCod: result.tipoCod,
                x: result.x,
                y: result.y,
                searchText: result.searchText,
            })),
            count: results.length,
        };
    }
}
