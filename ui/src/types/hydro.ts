export interface Basin {
    id: string;
    name: string;
    code: string;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SubBasin {
    id: string;
    name: string;
    code: string;
    basinId: string;
    basinName: string | null;
    description: string | null;
    area: number | null;
    perimetro: number | null;
    centroidX: number | null;
    centroidY: number | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface StationThreshold {
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
    caudalEntrada: number | null;
    caudalSalida: number | null;
    capacidad: number | null;
}

export interface Station {
    id: string;
    name: string;
    subBasinName: string;
    stationCode: string;
    stationType: string;
    subBasinId: string;
    threshold: StationThreshold | null;
    latitude: number | null;
    longitude: number | null;
    altitude: number | null;
    municipio: string | null;
    provincia: string | null;
    ccaa: string | null;
    tipoCod: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export const STATION_TYPES = [
    'AFORO_EN_RIO',
    'AFOROS_EN_CANAL',
    'EMBALSE_SAIH',
    'PLUVIOMETRO',
    'TELENIVOMETRO',
    'IMPULSION',
    'MARCO_DE_CONTROL',
] as const;

export const STATION_TYPE_LABELS: Record<string, string> = {
    AFORO_EN_RIO: 'Aforo en rio',
    AFOROS_EN_CANAL: 'Aforos en canal',
    EMBALSE_SAIH: 'Embalse SAIH',
    PLUVIOMETRO: 'Pluviometro',
    TELENIVOMETRO: 'Telenivometro',
    IMPULSION: 'Impulsion',
    MARCO_DE_CONTROL: 'Marco de control',
};
