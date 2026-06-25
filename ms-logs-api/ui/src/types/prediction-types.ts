export interface PredictionTypeItem {
    id: string;
    name: string;
    unit: string;
}

export interface StationPredictionTypesResponse {
    stationCode: string;
    predictionTypes: PredictionTypeItem[];
}
