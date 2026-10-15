export interface StationCatalogItem {
    code: string;
    name: string | null;
}

/**
 * Station threshold snapshot returned by ms-hydro-api under Station.threshold.
 * Each metric field is optional: a station populates only the metrics that apply
 * to it (an EMBALSE fills volume/capacity, a river gauge fills level/flow, etc.)
 * and hydro-api omits the ones without a value.
 */
export interface StationThresholdSnapshot {
    id: string;
    stationId: string;
    parametro?: string;
    senal?: string;
    umbralNivel1?: number;
    umbralCaudal1?: number;
    umbralNivel2?: number;
    umbralCaudal2?: number;
    umbralNivel3?: number;
    umbralCaudal3?: number;
    maxNivelMuro?: number;
    maxNivelCaseta?: number;
    umbralVolumen1?: number;
    umbralVolumen2?: number;
    umbralVolumen3?: number;
    caudalEntrada?: string;
    caudalSalida?: string;
    capacidad?: number;
    umbral1Precip1h?: number;
    umbral2Precip1h?: number;
    umbral3Precip1h?: number;
    umbral1Precip12h?: number;
    umbral2Precip12h?: number;
    umbral3Precip12h?: number;
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
