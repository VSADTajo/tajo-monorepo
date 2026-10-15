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
    @ApiProperty({ required: false, example: 'NIVEL' }) parametro?: string;
    @ApiProperty({ required: false, example: 'AR01LI__01' }) senal?: string;
    @ApiProperty({ required: false, example: 0.95 }) umbralNivel1?: number;
    @ApiProperty({ required: false, example: 6.06 }) umbralCaudal1?: number;
    @ApiProperty({ required: false, example: 1.2 }) umbralNivel2?: number;
    @ApiProperty({ required: false, example: 11.53 }) umbralCaudal2?: number;
    @ApiProperty({ required: false, example: 1.4 }) umbralNivel3?: number;
    @ApiProperty({ required: false, example: 17.65 }) umbralCaudal3?: number;
    @ApiProperty({ required: false }) maxNivelMuro?: number;
    @ApiProperty({ required: false }) maxNivelCaseta?: number;
    @ApiProperty({ required: false }) umbralVolumen1?: number;
    @ApiProperty({ required: false }) umbralVolumen2?: number;
    @ApiProperty({ required: false }) umbralVolumen3?: number;
    @ApiProperty({ required: false }) caudalEntrada?: string;
    @ApiProperty({ required: false }) caudalSalida?: string;
    @ApiProperty({ required: false }) capacidad?: number;
    @ApiProperty({ required: false, example: 15, description: 'Precipitation 1h threshold 1 (pre-alert), mm' })
    umbral1Precip1h?: number;
    @ApiProperty({ required: false, example: 30, description: 'Precipitation 1h threshold 2 (alert), mm' })
    umbral2Precip1h?: number;
    @ApiProperty({ required: false, example: 60, description: 'Precipitation 1h threshold 3 (alarm), mm' })
    umbral3Precip1h?: number;
    @ApiProperty({ required: false, example: 40, description: 'Precipitation 12h threshold 1 (pre-alert), mm' })
    umbral1Precip12h?: number;
    @ApiProperty({ required: false, example: 80, description: 'Precipitation 12h threshold 2 (alert), mm' })
    umbral2Precip12h?: number;
    @ApiProperty({ required: false, example: 120, description: 'Precipitation 12h threshold 3 (alarm), mm' })
    umbral3Precip12h?: number;
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
    @ApiProperty({ nullable: true, example: '670502' }) meteoalertaZonaCode: string | null;
    @ApiProperty({ nullable: true, example: 'Sistema Central de Ávila' }) meteoalertaZonaNombre: string | null;
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
// Meteoalerta zones
// ─────────────────────────────────────────────────────────────

export class GetMeteoalertaZoneThresholdsResponseDto {
    @ApiProperty({ example: '681901', description: 'Meteoalerta zone code (cod_z)' })
    zonaCode: string;

    @ApiProperty({ example: 'Serranía de Guadalajara', description: 'Meteoalerta zone name (nom_z)' })
    zonaNombre: string;

    @ApiProperty({ nullable: true, example: 'Guadalajara' })
    provincia: string | null;

    @ApiProperty({ nullable: true, example: 'Castilla - La Mancha' })
    ccaa: string | null;

    @ApiProperty({ nullable: true, example: 15, description: 'Precipitation threshold level 1 accumulated in 1h (mm)' })
    umbral1Precip1h: number | null;

    @ApiProperty({ nullable: true, example: 30, description: 'Precipitation threshold level 2 accumulated in 1h (mm)' })
    umbral2Precip1h: number | null;

    @ApiProperty({ nullable: true, example: 60, description: 'Precipitation threshold level 3 accumulated in 1h (mm)' })
    umbral3Precip1h: number | null;

    @ApiProperty({
        nullable: true,
        example: 40,
        description: 'Precipitation threshold level 1 accumulated in 12h (mm)',
    })
    umbral1Precip12h: number | null;

    @ApiProperty({
        nullable: true,
        example: 80,
        description: 'Precipitation threshold level 2 accumulated in 12h (mm)',
    })
    umbral2Precip12h: number | null;

    @ApiProperty({
        nullable: true,
        example: 120,
        description: 'Precipitation threshold level 3 accumulated in 12h (mm)',
    })
    umbral3Precip12h: number | null;
}

// ─────────────────────────────────────────────────────────────
// Resguardos
// ─────────────────────────────────────────────────────────────

export class ResolvedResguardoEntryDto {
    @ApiProperty({ description: 'Minimum volume (Hm3)', example: 51.15, nullable: true }) minimumVolume: number | null;
    @ApiProperty({ description: 'Reserve volume (Hm3)', example: 802.563, nullable: true }) reserveVolume:
        | number
        | null;
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

export class RawResguardoValuesDto {
    @ApiProperty({ description: 'Reserve volume (Hm3)', example: 802.563, nullable: true }) reserveVolume:
        | number
        | null;
    @ApiProperty({ description: 'Reserve level (m)', example: 718, nullable: true }) reserveLevel: number | null;
    @ApiProperty({ description: 'Minimum volume (Hm3)', example: 51.15, nullable: true }) minimumVolume: number | null;
}

export class GetResguardoByDateResponseDto {
    @ApiProperty({ example: 'E_01' }) stationCode: string;
    @ApiProperty({ example: 'ENTREPEÑAS' }) stationName: string;
    @ApiProperty({ example: '2025-10-01' }) date: string;
    @ApiProperty({ type: RawResguardoValuesDto, description: 'Immutable original values' })
    original: RawResguardoValuesDto;
    @ApiProperty({ type: RawResguardoValuesDto, description: 'Manual edits (nullable)' }) edited: RawResguardoValuesDto;
    @ApiProperty({ type: ResolvedResguardoEntryDto, description: 'edited ?? original per field' })
    resolved: ResolvedResguardoEntryDto;
}

export class UpdateResguardoRequestDto {
    @ApiProperty({ description: 'Reserve volume (Hm3)', example: 750.0, required: false, nullable: true })
    reserveVolume?: number | null;
    @ApiProperty({ description: 'Reserve level (m)', example: 710.0, required: false, nullable: true }) reserveLevel?:
        | number
        | null;
    @ApiProperty({ description: 'Minimum volume (Hm3)', example: 45.0, required: false, nullable: true })
    minimumVolume?: number | null;
}

export class UpdateResguardoResponseDto {
    @ApiProperty({ type: ResolvedResguardoEntryDto }) entry: ResolvedResguardoEntryDto;
}

// ─────────────────────────────────────────────────────────────
// DownstreamStations
// ─────────────────────────────────────────────────────────────

export class DownstreamStationItemDto {
    @ApiProperty({ description: 'Destination station/reservoir code', example: 'E010' })
    codigoDestino: string;

    @ApiProperty({ description: 'Destination name', example: 'Estación Aguas Abajo 1' })
    nombreDestino: string;

    @ApiProperty({ description: 'Destination type', example: 'aforo' })
    tipoDestino: string;
}

export class GetDownstreamStationsResponseDto {
    @ApiProperty({ type: [DownstreamStationItemDto], description: 'Distinct downstream destinations' })
    items: DownstreamStationItemDto[];

    @ApiProperty({ description: 'Number of items returned', example: 2 })
    count: number;
}

// ─────────────────────────────────────────────────────────────
// Scenarios (test datasets — raw JSON storage)
// ─────────────────────────────────────────────────────────────

export class ScenarioMetadataDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ example: 'sample-stations' }) name: string;
    @ApiProperty({ nullable: true, example: 'Escenario de prueba' }) description: string | null;
    @ApiProperty({ example: 3 }) itemsCount: number;
    @ApiProperty({ example: 370245 }) sizeBytes: number;
    @ApiProperty({ example: '2026-07-30T00:00:00.000Z' }) createdAt: Date | undefined;
    @ApiProperty({ example: '2026-07-30T00:00:00.000Z' }) updatedAt: Date | undefined;
}

export class ListScenariosResponseDto {
    @ApiProperty({ type: [ScenarioMetadataDto] }) items: ScenarioMetadataDto[];
    @ApiProperty({ example: 5 }) total: number;
}

export class ScenarioFileMetadataDto {
    @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) scenarioId: string;
    @ApiProperty({ example: 'episodio-1.csv' }) filename: string;
    @ApiProperty({ example: 'text/csv' }) contentType: string;
    @ApiProperty({ example: 20481 }) sizeBytes: number;
    @ApiProperty({ example: '2026-08-12T00:00:00.000Z' }) createdAt: Date | undefined;
    @ApiProperty({ example: '2026-08-12T00:00:00.000Z' }) updatedAt: Date | undefined;
}

export class GetScenarioResponseDto extends ScenarioMetadataDto {
    @ApiProperty({ type: [ScenarioFileMetadataDto], description: 'Files belonging to this scenario' })
    files: ScenarioFileMetadataDto[];

    @ApiProperty({
        type: 'object',
        additionalProperties: true,
        nullable: true,
        description: 'Legacy raw JSON payload (deprecated)',
    })
    payload: Record<string, unknown> | null;
}

export class DeleteScenarioResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ example: true }) deleted: boolean;
}

export class AddFilesToScenarioResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) scenarioId: string;
    @ApiProperty({ type: [ScenarioFileMetadataDto] }) files: ScenarioFileMetadataDto[];
}

export class DeleteScenarioFileResponseDto {
    @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ example: true }) deleted: boolean;
}
