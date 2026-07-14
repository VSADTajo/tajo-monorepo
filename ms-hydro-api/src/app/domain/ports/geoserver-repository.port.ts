export interface GeoserverStationData {
    codigo: string;
    nombre: string;
    tipoCod: string;
    tipo: string;
    zona: string;
    municipio: string;
    provincia: string;
    ccaa: string;
    latitude: number;
    longitude: number;
    subcuencaCode: string | null;
    subcuencaName: string | null;
    comarcaName: string | null;
    sistemaName: string | null;
    zonaExplOgcFid: number | null;
    zonaExplNombre: string | null;
    meteoalertaZonaCode: string | null;
    meteoalertaZonaNombre: string | null;
}

export interface GeoserverSubcuencaData {
    code: string;
    name: string;
    area: number;
    perimetro: number;
    centroidX: number;
    centroidY: number;
}

export interface GeoserverThresholdData {
    codigo: string;
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
}

export abstract class IGeoserverRepository {
    abstract findAllStationsWithSubcuenca(): Promise<GeoserverStationData[]>;
    abstract findAllSubcuencas(): Promise<GeoserverSubcuencaData[]>;
    abstract findAllSubcuencaZonaMappings(): Promise<Map<string, string>>;
    abstract findAllThresholds(): Promise<GeoserverThresholdData[]>;
}
