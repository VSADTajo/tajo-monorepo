// Response shapes for GET /aerial-precipitation/* on ms-gateway-api.
// Mirrors ms-meteo-api/src/app/api/dtos/aerial-precipitation.dtos.ts.

export type AerialLayer = 'sistema' | 'aemet' | 'subcNAM';
export type AerialProvider = 'ens' | 'harmonie' | 'obs';
export type AerialAccumulation = '1h' | '12h' | '24h';
export type AerialStat = 'Med' | 'Max' | null;

export interface AerialEventPoint {
    eventDate: string;
    value: number;
    flag: number;
}

export interface AerialSeries {
    id: string;
    locationId: string;
    parameterId: string;
    provider: AerialProvider;
    layer: AerialLayer;
    stat: AerialStat;
    accumulation: AerialAccumulation;
    forecastDate: string;
    startDate: string | null;
    endDate: string | null;
    moduleInstanceId: string | null;
    stationName: string | null;
    lat: number | null;
    lon: number | null;
    units: string;
    timeStepSeconds: number;
    creationDate: string | null;
    approvedDate: string | null;
    sourceFileName: string;
    max: AerialEventPoint | null;
    last: AerialEventPoint | null;
    events?: AerialEventPoint[];
}

export interface ListAerialResponse {
    data: AerialSeries[];
    total: number;
    page: number;
    limit: number;
}

export interface LatestAerialResponse {
    generatedAt: string;
    layer: AerialLayer;
    provider: AerialProvider;
    accumulation: AerialAccumulation;
    stat: AerialStat;
    series: AerialSeries[];
}

export interface AerialByLocationGroup {
    provider: AerialProvider;
    accumulation: AerialAccumulation;
    stat: AerialStat;
    series: AerialSeries[];
}

export interface ByLocationAerialResponse {
    locationId: string;
    groups: AerialByLocationGroup[];
}
