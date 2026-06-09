export interface ILegacyPredictionResultItem {
    id: number;
    date: string;
    value: number;
    flag: number;
}

export interface ILegacyPredictionItem {
    id: string;
    stationId: string;
    stationName: string | null;
    predictionTypeName: string | null;
    simulationDate: string | null;
    predictionDate: string | null;
    percentile: number | null;
    predictionProvider: string | null;
    predictedBy: string | null;
    results: ILegacyPredictionResultItem[];
}

export class LegacyPredictionsResult {
    readonly predictions: ILegacyPredictionItem[];

    constructor(predictions: ILegacyPredictionItem[]) {
        this.predictions = predictions;
    }
}
