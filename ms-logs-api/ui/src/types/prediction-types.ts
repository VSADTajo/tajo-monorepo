export interface StationTypeCoverageItem {
    id: string;
    name: string;
    unit: string;
    hasData: boolean;
    /** ISO-8601 timestamp of the most recent ingested result, or null if it never entered. */
    lastEntered: string | null;
}

export interface StationPredictionTypesResponse {
    stationCode: string;
    total: number;
    withData: number;
    types: StationTypeCoverageItem[];
}

export interface PredictionTypeColumn {
    id: string;
    name: string;
    unit: string;
}

export interface CoverageMatrixStation {
    stationCode: string;
    stationName: string | null;
    /** lastEntered per type, aligned by index with `types`; null = never entered. */
    cells: (string | null)[];
    withData: number;
}

export interface CoverageMatrixResponse {
    generatedAt: string;
    types: PredictionTypeColumn[];
    stations: CoverageMatrixStation[];
}

export interface StationOption {
    stationCode: string;
    name: string | null;
}
