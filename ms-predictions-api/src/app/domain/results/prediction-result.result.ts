export interface IPredictionResultResult {
    id: number;
    predictionId: string;
    date: Date;
    value: number;
    flag: number;
    createdAt: Date;
}

export class PredictionResultResult {
    readonly id: number;
    readonly predictionId: string;
    readonly date: Date;
    readonly value: number;
    readonly flag: number;
    readonly createdAt: Date;

    constructor(parameters: IPredictionResultResult) {
        this.id = parameters.id;
        this.predictionId = parameters.predictionId;
        this.date = parameters.date;
        this.value = parameters.value;
        this.flag = parameters.flag;
        this.createdAt = parameters.createdAt;
    }
}
