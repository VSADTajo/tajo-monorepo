export interface StationCatalogItem {
    code: string;
    name: string | null;
}

/**
 * Station threshold snapshot returned by ms-hydro-api under Station.threshold.
 * Each numeric field is individually nullable because a station usually
 * populates only the metrics that apply to it (an EMBALSE fills volume/capacity,
 * a river gauge fills level/flow, etc.).
 */
export interface StationThresholdSnapshot {
    id: string;
    stationId: string;
    parametro: string | null;
    senal: string | null;
    umbralNivel1: number | null;
    umbralCaudal1: number | null;
    umbralNivel2: number | null;
    umbralCaudal2: number | null;
    umbralNivel3: number | null;
    umbralCaudal3: number | null;
    maxNivelMuro: number | null;
    maxNivelCaseta: number | null;
    umbralVolumen1: number | null;
    umbralVolumen2: number | null;
    umbralVolumen3: number | null;
    caudalEntrada: string | null;
    caudalSalida: string | null;
    capacidad: number | null;
    umbral1Precip1h: number | null;
    umbral2Precip1h: number | null;
    umbral3Precip1h: number | null;
    umbral1Precip12h: number | null;
    umbral2Precip12h: number | null;
    umbral3Precip12h: number | null;
}

/**
 * Full station snapshot as returned by ms-hydro-api. Mirrors CreateStationResponseDto
 * on that service; unknown extra keys are preserved via passthrough.
 */
export interface FullStationCatalogItem {
    id: string;
    name: string;
    subBasinName: string;
    stationCode: string;
    stationType: string;
    subBasinId: string;
    threshold: StationThresholdSnapshot | null;
    latitude: number | null;
    longitude: number | null;
    altitude: number | null;
    municipio: string | null;
    provincia: string | null;
    ccaa: string | null;
    tipoCod: string | null;
    zona: string | null;
    zonaExplOgcFid: number | null;
    zonaExplNombre: string | null;
    comarcaName: string | null;
    sistemaName: string | null;
    meteoalertaZonaCode: string | null;
    meteoalertaZonaNombre: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: string | Date | null;
    updatedAt: string | Date | null;
}

/**
 * Read-only access to the canonical station catalog owned by ms-hydro-api.
 * Predictions reference stations by their `stationCode` (== predictions.stationId).
 */
export abstract class IStationCatalogService {
    abstract listStations(): Promise<StationCatalogItem[]>;
    abstract listFullStations(): Promise<FullStationCatalogItem[]>;
}
