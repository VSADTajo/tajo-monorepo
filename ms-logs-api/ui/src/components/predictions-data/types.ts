// Response shapes from the API gateway (ms-gateway-api predictions proxy).
// Everything goes through the gateway — the backoffice never hits ms-predictions-api directly.

export type DataOrigin = 'HISTORICAL' | 'FORECAST';

// ── Prediction types ──────────────────────────────────────────

export interface PredictionType {
    id: string;
    name: string;
    unit: string;
}

export interface ListPredictionTypesResponse {
    predictionTypes: PredictionType[];
}

// ── Simulations (list) ────────────────────────────────────────

export interface SimulationItem {
    id: string;
    simulationDate: string; // YYYYMMDDHHMMSS
    jobType: string | null;
    modmeteo: string | null;
    status: string;
    type: string; // AUTOMATIC | MANUAL
    environment: string | null;
    description: string | null;
    createdBy: string | null;
    dataOrigin: DataOrigin | null;
    createdAt?: string; // ISO 8601
    updatedAt?: string; // ISO 8601
    predictionCount?: number;
}

export interface ListSimulationsResponse {
    data: SimulationItem[];
    total: number;
    page: number;
    limit: number;
}

export interface SimulationFilters {
    stationCode: string;
    status?: string;
    dataOrigin?: DataOrigin;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'simulationDate' | 'status';
    sortOrder?: 'ASC' | 'DESC';
}

// ── Forecast series (drill-down) ──────────────────────────────

export interface ForecastResultPoint {
    id: number;
    date: string; // ISO 8601 UTC
    value: number;
    flag: number;
}

export interface ForecastPrediction {
    id: string;
    stationId: string; // station CODE (e.g. 'AC01'), not the UUID
    stationName: string | null;
    predictionTypeName: string | null;
    simulationDate: string | null; // YYYYMMDDHHMMSS
    predictionDate: string | null; // ISO 8601 UTC
    percentile: number | null;
    predictionProvider: string | null;
    predictedBy: string | null;
    results: ForecastResultPoint[];
}

export interface ForecastResponse {
    predictions: ForecastPrediction[];
}

// ── Simulation SFTP files (input/output) ──────────────────────

export type SimulationFolder = 'input' | 'output';

/**
 * What happened to an output file. ms-model-api moves each result out of
 * output/ once polled: to historial/ (parsed) or corrupted/ (unreadable).
 */
export type SimulationFileStatus = 'pending' | 'processed' | 'failed';

export interface SftpFileMeta {
    name: string;
    size: number;
    modifiedAt: string | null;
    status: SimulationFileStatus;
}

export interface SimulationFilesResponse {
    input: SftpFileMeta[];
    output: SftpFileMeta[];
}
