import { ApiProperty } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────
// Shared: Basin
// ─────────────────────────────────────────────────────────────

export class BasinItemDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ example: 'Cabecera' }) name: string;
    @ApiProperty({ example: 'CABECERA' }) code: string;
    @ApiProperty({ nullable: true, example: 'Zona SAIH: CABECERA' }) description: string | null;
    @ApiProperty({ example: true }) isActive: boolean;
    @ApiProperty({ example: '2026-03-24T00:00:00.000Z' }) createdAt: Date | undefined;
    @ApiProperty({ example: '2026-03-24T00:00:00.000Z' }) updatedAt: Date | undefined;
}

// ─────────────────────────────────────────────────────────────
// ListBasins
// ─────────────────────────────────────────────────────────────

export class ListBasinsResponseDto {
    @ApiProperty({ type: [BasinItemDto] }) items: BasinItemDto[];
    @ApiProperty({ example: 11 }) total: number;
}

// ─────────────────────────────────────────────────────────────
// GetBasin
// ─────────────────────────────────────────────────────────────

export class GetBasinResponseDto extends BasinItemDto {
    @ApiProperty({ type: [Object], description: 'Sub-basins in this basin' }) subBasins: object[];
}

// ─────────────────────────────────────────────────────────────
// Shared: SubBasin
// ─────────────────────────────────────────────────────────────

export class SubBasinItemDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ example: 'ENTREPEÑAS' }) name: string;
    @ApiProperty({ example: 'E_01' }) code: string;
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) basinId: string;
    @ApiProperty({ nullable: true }) description: string | null;
    @ApiProperty({ nullable: true, example: 1234.56 }) area: number | null;
    @ApiProperty({ nullable: true, example: 234.78 }) perimetro: number | null;
    @ApiProperty({ nullable: true, example: -2.345 }) centroidX: number | null;
    @ApiProperty({ nullable: true, example: 40.123 }) centroidY: number | null;
    @ApiProperty({ example: true }) isActive: boolean;
    @ApiProperty({ example: '2026-03-24T00:00:00.000Z' }) createdAt: Date | undefined;
    @ApiProperty({ example: '2026-03-24T00:00:00.000Z' }) updatedAt: Date | undefined;
}

// ─────────────────────────────────────────────────────────────
// ListSubBasins
// ─────────────────────────────────────────────────────────────

export class ListSubBasinsResponseDto {
    @ApiProperty({ type: [SubBasinItemDto] }) items: SubBasinItemDto[];
    @ApiProperty({ example: 119 }) total: number;
}

// ─────────────────────────────────────────────────────────────
// GetSubBasin
// ─────────────────────────────────────────────────────────────

export class GetSubBasinResponseDto extends SubBasinItemDto {
    @ApiProperty({ type: [Object], description: 'Stations in this sub-basin' }) stations: object[];
}

// ─────────────────────────────────────────────────────────────
// Shared: StationThreshold
// ─────────────────────────────────────────────────────────────

export class StationThresholdDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) stationId: string;
    @ApiProperty({ nullable: true, example: 'NIVEL' }) parametro: string | null;
    @ApiProperty({ nullable: true, example: 'AR01LI__01' }) senal: string | null;
    @ApiProperty({ nullable: true, example: 0.95 }) umbralNivel1: number | null;
    @ApiProperty({ nullable: true, example: 6.06 }) umbralCaudal1: number | null;
    @ApiProperty({ nullable: true, example: 1.2 }) umbralNivel2: number | null;
    @ApiProperty({ nullable: true, example: 11.53 }) umbralCaudal2: number | null;
    @ApiProperty({ nullable: true, example: 1.4 }) umbralNivel3: number | null;
    @ApiProperty({ nullable: true, example: 17.65 }) umbralCaudal3: number | null;
    @ApiProperty({ nullable: true }) maxNivelMuro: number | null;
    @ApiProperty({ nullable: true }) maxNivelCaseta: number | null;
    @ApiProperty({ nullable: true }) umbralVolumen1: number | null;
    @ApiProperty({ nullable: true }) umbralVolumen2: number | null;
    @ApiProperty({ nullable: true }) umbralVolumen3: number | null;
    @ApiProperty({ nullable: true }) caudalEntrada: number | null;
    @ApiProperty({ nullable: true }) caudalSalida: number | null;
    @ApiProperty({ nullable: true }) capacidad: number | null;
}

// ─────────────────────────────────────────────────────────────
// Shared: Station
// ─────────────────────────────────────────────────────────────

export class StationItemDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ example: 'TRASVASE ENTREPEÑAS-BUENDÍA' }) name: string;
    @ApiProperty({ example: 'ENTREPEÑAS' }) subBasinName: string;
    @ApiProperty({ example: 'AC01' }) stationCode: string;
    @ApiProperty({ example: 'AFOROS_EN_CANAL' }) stationType: string;
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) subBasinId: string;
    @ApiProperty({ nullable: true, type: StationThresholdDto }) threshold: StationThresholdDto | null;
    @ApiProperty({ nullable: true, example: 40.4826 }) latitude: number | null;
    @ApiProperty({ nullable: true, example: -1.4572 }) longitude: number | null;
    @ApiProperty({ nullable: true, example: null }) altitude: number | null;
    @ApiProperty({ nullable: true, example: 'Sacedón' }) municipio: string | null;
    @ApiProperty({ nullable: true, example: 'Guadalajara' }) provincia: string | null;
    @ApiProperty({ nullable: true, example: 'Castilla La Mancha' }) ccaa: string | null;
    @ApiProperty({ nullable: true, example: 'AC' }) tipoCod: string | null;
    @ApiProperty({ nullable: true, example: 'MADRID' }) zona: string | null;
    @ApiProperty({ nullable: true, example: 1 }) zonaExplOgcFid: number | null;
    @ApiProperty({ nullable: true, example: 'ZONA 1' }) zonaExplNombre: string | null;
    @ApiProperty({ nullable: true, example: 'LOZOYA SOMOSIERRA' }) comarcaName: string | null;
    @ApiProperty({ nullable: true, example: 'CABECERA' }) sistemaName: string | null;
    @ApiProperty({ nullable: true }) description: string | null;
    @ApiProperty({ example: true }) isActive: boolean;
    @ApiProperty({ example: '2026-03-24T00:00:00.000Z' }) createdAt: Date | undefined;
    @ApiProperty({ example: '2026-03-24T00:00:00.000Z' }) updatedAt: Date | undefined;
}

// ─────────────────────────────────────────────────────────────
// ListStations
// ─────────────────────────────────────────────────────────────

export class ListStationsResponseDto {
    @ApiProperty({ type: [StationItemDto] }) items: StationItemDto[];
    @ApiProperty({ example: 254 }) total: number;
}

// ─────────────────────────────────────────────────────────────
// GetStation
// ─────────────────────────────────────────────────────────────

export class GetStationResponseDto extends StationItemDto {}

// ─────────────────────────────────────────────────────────────
// GetThreshold
// ─────────────────────────────────────────────────────────────

export class GetThresholdResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) stationId: string;
    @ApiProperty({ example: 'AC01' }) stationCode: string;
    @ApiProperty({ nullable: true, type: StationThresholdDto }) threshold: StationThresholdDto | null;
}

// ─────────────────────────────────────────────────────────────
// ToggleBasin / DeleteBasin
// ─────────────────────────────────────────────────────────────

export class ToggleBasinResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ example: 'Cabecera' }) name: string;
    @ApiProperty({ example: 'CABECERA' }) code: string;
    @ApiProperty({ example: false }) isActive: boolean;
    @ApiProperty({ example: '2026-03-24T00:00:00.000Z' }) updatedAt: Date;
}

export class DeleteBasinResponseDto extends ToggleBasinResponseDto {}

// ─────────────────────────────────────────────────────────────
// ToggleSubBasin / DeleteSubBasin
// ─────────────────────────────────────────────────────────────

export class ToggleSubBasinResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ example: 'ENTREPEÑAS' }) name: string;
    @ApiProperty({ example: 'E_01' }) code: string;
    @ApiProperty({ example: false }) isActive: boolean;
    @ApiProperty({ example: '2026-03-24T00:00:00.000Z' }) updatedAt: Date;
}

export class DeleteSubBasinResponseDto extends ToggleSubBasinResponseDto {}

// ─────────────────────────────────────────────────────────────
// ToggleStation / DeleteStation
// ─────────────────────────────────────────────────────────────

export class ToggleStationResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ example: 'TRASVASE ENTREPEÑAS-BUENDÍA' }) name: string;
    @ApiProperty({ example: 'AC01' }) stationCode: string;
    @ApiProperty({ example: false }) isActive: boolean;
    @ApiProperty({ example: '2026-03-24T00:00:00.000Z' }) updatedAt: Date;
}

export class DeleteStationResponseDto extends ToggleStationResponseDto {}

// ─────────────────────────────────────────────────────────────
// UpdateThreshold
// ─────────────────────────────────────────────────────────────

export class UpdateThresholdResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) stationId: string;
    @ApiProperty({ example: 'AC01' }) stationCode: string;
    @ApiProperty({ type: StationThresholdDto }) threshold: StationThresholdDto;
    @ApiProperty({ example: '2026-03-24T00:00:00.000Z' }) updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// SyncGeoserver
// ─────────────────────────────────────────────────────────────

export class SyncGeoserverResponseDto {
    @ApiProperty({ example: 11 }) basinsCreated: number;
    @ApiProperty({ example: 0 }) basinsUpdated: number;
    @ApiProperty({ example: 119 }) subBasinsCreated: number;
    @ApiProperty({ example: 0 }) subBasinsUpdated: number;
    @ApiProperty({ example: 254 }) stationsCreated: number;
    @ApiProperty({ example: 0 }) stationsUpdated: number;
    @ApiProperty({ example: 143 }) thresholdsCreated: number;
    @ApiProperty({ example: 0 }) thresholdsUpdated: number;
    @ApiProperty({ type: [String], example: [] }) errors: string[];
}

// ─────────────────────────────────────────────────────────────
// SearchGeoData
// ─────────────────────────────────────────────────────────────

export class SearchGeoDataItemDto {
    @ApiProperty({ example: 'punto_saih', description: 'Origin type: punto_saih, subcuenca, sistema, zona_expl' })
    origen: string;

    @ApiProperty({ nullable: true, example: 'P001' })
    codigo: string | null;

    @ApiProperty({ example: 'Estación Tajo' })
    nombre: string;

    @ApiProperty({ nullable: true, example: 'EST' })
    tipoCod: string | null;

    @ApiProperty({ example: -3.7038 })
    x: number;

    @ApiProperty({ example: 40.4168 })
    y: number;

    @ApiProperty({ example: 'Estación Tajo P001' })
    searchText: string;
}

export class SearchGeoDataResponseDto {
    @ApiProperty({ type: [SearchGeoDataItemDto] })
    results: SearchGeoDataItemDto[];

    @ApiProperty({ example: 15 })
    count: number;
}

// ─────────────────────────────────────────────────────────────
// Resguardos
// ─────────────────────────────────────────────────────────────

export class ResolvedResguardoEntryDto {
    @ApiProperty({ description: 'Minimum volume (Hm3)', example: 51.15, nullable: true }) minimumVolume: number | null;
    @ApiProperty({ description: 'Reserve volume (Hm3)', example: 802.563, nullable: true }) reserveVolume: number | null;
    @ApiProperty({ description: 'Reserve level (m)', example: 718, nullable: true }) reserveLevel: number | null;
}

export class GetResguardosByStationResponseDto {
    @ApiProperty({ example: 'E_01' }) stationCode: string;
    @ApiProperty({ example: 'ENTREPEÑAS' }) stationName: string;
    @ApiProperty({
        description: 'Map of date (YYYY-MM-DD) to resolved resguardo values',
        example: {
            '2025-10-01': { minimumVolume: 51.15, reserveVolume: 802.563, reserveLevel: 718 },
        },
    })
    entries: Record<string, ResolvedResguardoEntryDto>;
    @ApiProperty({ example: 365 }) total: number;
}

export class GetResguardoByDateResponseDto {
    @ApiProperty({ example: 'E_01' }) stationCode: string;
    @ApiProperty({ example: 'ENTREPEÑAS' }) stationName: string;
    @ApiProperty({ type: ResolvedResguardoEntryDto }) entry: ResolvedResguardoEntryDto;
}
