export interface ITimeSeriesEventResult {
    timestamp: string;
    value: number;
    flag: number;
    isMissing: boolean;
}

export class TimeSeriesEventResult {
    readonly timestamp: string;
    readonly value: number;
    readonly flag: number;
    readonly isMissing: boolean;

    constructor(parameters: ITimeSeriesEventResult) {
        this.timestamp = parameters.timestamp;
        this.value = parameters.value;
        this.flag = parameters.flag;
        this.isMissing = parameters.isMissing;
    }
}

export interface INormalizedTimeSeriesResult {
    locationId: string;
    parameterId: string;
    sourceParameterId?: string;
    moduleInstanceId: string;
    stationName: string;
    lat: number;
    lon: number;
    x?: number;
    y?: number;
    z?: number;
    units: string;
    timeStep: { unit: string; multiplier: number };
    forecastDate: string | null;
    startDate: string;
    endDate: string;
    events: TimeSeriesEventResult[];
}

export class NormalizedTimeSeriesResult {
    readonly locationId: string;
    readonly parameterId: string;
    readonly sourceParameterId?: string;
    readonly moduleInstanceId: string;
    readonly stationName: string;
    readonly lat: number;
    readonly lon: number;
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
    readonly units: string;
    readonly timeStep: { unit: string; multiplier: number };
    readonly forecastDate: string | null;
    readonly startDate: string;
    readonly endDate: string;
    readonly events: TimeSeriesEventResult[];

    constructor(parameters: INormalizedTimeSeriesResult) {
        this.locationId = parameters.locationId;
        this.parameterId = parameters.parameterId;
        this.sourceParameterId = parameters.sourceParameterId;
        this.moduleInstanceId = parameters.moduleInstanceId;
        this.stationName = parameters.stationName;
        this.lat = parameters.lat;
        this.lon = parameters.lon;
        this.x = parameters.x;
        this.y = parameters.y;
        this.z = parameters.z;
        this.units = parameters.units;
        this.timeStep = parameters.timeStep;
        this.forecastDate = parameters.forecastDate;
        this.startDate = parameters.startDate;
        this.endDate = parameters.endDate;
        this.events = parameters.events;
    }
}
