export interface IMaxAndLatestValueItem {
    stationId: string;
    stationName: string | null;
    maxValue: number;
    maxDate: Date;
    latestValue: number;
    latestDate: Date;
    predictionTypeName: string;
    simulationDate: string;
}

export class MaxAndLatestValuesResult {
    readonly values: IMaxAndLatestValueItem[];

    constructor(values: IMaxAndLatestValueItem[]) {
        this.values = values;
    }
}
