export interface IPredictionTypeResult {
    id: string;
    name: string;
    unit: string;
}

export class PredictionTypeResult {
    readonly id: string;
    readonly name: string;
    readonly unit: string;

    constructor(parameters: IPredictionTypeResult) {
        this.id = parameters.id;
        this.name = parameters.name;
        this.unit = parameters.unit;
    }
}

export class ListPredictionTypesResult {
    readonly predictionTypes: IPredictionTypeResult[];

    constructor(predictionTypes: IPredictionTypeResult[]) {
        this.predictionTypes = predictionTypes;
    }
}

// ─────────────────────────────────────────────────────────────
// Type coverage — one row per catalog type, with last ingestion
// ─────────────────────────────────────────────────────────────

export interface IStationTypeCoverageItem {
    id: string;
    name: string;
    unit: string;
    /** ISO-8601 timestamp of the most recent ingested result, or null if it never entered. */
    lastEntered: string | null;
}

export class StationTypeCoverageResult {
    readonly stationCode: string;
    /** Total prediction types in the catalog. */
    readonly total: number;
    /** How many of those types have at least one ingested result for this station. */
    readonly withData: number;
    readonly types: IStationTypeCoverageItem[];

    constructor(parameters: { stationCode: string; types: IStationTypeCoverageItem[] }) {
        this.stationCode = parameters.stationCode;
        this.types = parameters.types;
        this.total = parameters.types.length;
        this.withData = parameters.types.filter((t) => t.lastEntered !== null).length;
    }
}

// ─────────────────────────────────────────────────────────────
// Coverage matrix — all stations × all types
// ─────────────────────────────────────────────────────────────

export interface ICoverageMatrixType {
    id: string;
    name: string;
    unit: string;
}

export interface ICoverageMatrixStation {
    stationCode: string;
    stationName: string | null;
    /** lastEntered per type, aligned by index with `types`; null = never entered. */
    cells: (string | null)[];
    /** How many types this station has data for. */
    withData: number;
}

export class CoverageMatrixResult {
    readonly generatedAt: string;
    readonly types: ICoverageMatrixType[];
    readonly stations: ICoverageMatrixStation[];

    constructor(parameters: { generatedAt: string; types: ICoverageMatrixType[]; stations: ICoverageMatrixStation[] }) {
        this.generatedAt = parameters.generatedAt;
        this.types = parameters.types;
        this.stations = parameters.stations;
    }
}
