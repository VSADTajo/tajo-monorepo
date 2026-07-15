export interface StationCatalogItem {
    code: string;
    name: string | null;
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
    threshold: unknown | null;
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
