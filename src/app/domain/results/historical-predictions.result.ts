export interface IHistoricalTimelinePoint {
    date: string;
    value: number;
    flag: number;
}

export class HistoricalPredictionsResult {
    readonly stationId: string;
    readonly predictionType: string;
    readonly results: IHistoricalTimelinePoint[];

    constructor(stationId: string, predictionType: string, results: IHistoricalTimelinePoint[]) {
        this.stationId = stationId;
        this.predictionType = predictionType;
        this.results = results;
    }
}
