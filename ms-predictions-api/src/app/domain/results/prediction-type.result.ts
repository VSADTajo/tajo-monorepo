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

export class StationPredictionTypesResult {
    readonly stationCode: string;
    readonly predictionTypes: IPredictionTypeResult[];

    constructor(parameters: { stationCode: string; predictionTypes: IPredictionTypeResult[] }) {
        this.stationCode = parameters.stationCode;
        this.predictionTypes = parameters.predictionTypes;
    }
}
