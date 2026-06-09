export interface IPredictionResultItem {
    id: number;
    predictionId: string;
    date: Date;
    value: number;
    flag: number;
}

export interface IPredictionResult {
    id: string;
    stationId: string;
    stationName: string | null;
    predictionTypeId: string;
    simulationId: string;
    predictionDate: Date | null;
    predictionStartDate: Date | null;
    predictionEndDate: Date | null;
    percentile: number | null;
    predictionProvider: string | null;
    predictedBy: string | null;
    createdAt: Date;
    results?: IPredictionResultItem[];
}

export class PredictionResult {
    readonly id: string;
    readonly stationId: string;
    readonly stationName: string | null;
    readonly predictionTypeId: string;
    readonly simulationId: string;
    readonly predictionDate: Date | null;
    readonly predictionStartDate: Date | null;
    readonly predictionEndDate: Date | null;
    readonly percentile: number | null;
    readonly predictionProvider: string | null;
    readonly predictedBy: string | null;
    readonly createdAt: Date;
    readonly results?: IPredictionResultItem[];

    constructor(parameters: IPredictionResult) {
        this.id = parameters.id;
        this.stationId = parameters.stationId;
        this.stationName = parameters.stationName;
        this.predictionTypeId = parameters.predictionTypeId;
        this.simulationId = parameters.simulationId;
        this.predictionDate = parameters.predictionDate;
        this.predictionStartDate = parameters.predictionStartDate;
        this.predictionEndDate = parameters.predictionEndDate;
        this.percentile = parameters.percentile;
        this.predictionProvider = parameters.predictionProvider;
        this.predictedBy = parameters.predictedBy;
        this.createdAt = parameters.createdAt;
        this.results = parameters.results;
    }
}
