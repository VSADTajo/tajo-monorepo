export interface IPrecipAccumulationItem {
    stationId: string;
    stationName: string | null;
    /** Accumulated precipitation in mm over the window. */
    accumulated: number;
    /** Exclusive lower bound of the accumulation window (ISO 8601, UTC). */
    windowStart: string;
    /** Inclusive upper bound of the accumulation window (ISO 8601, UTC). */
    windowEnd: string;
    /** Last timestamp of the station series (ISO 8601, UTC). */
    lastDate: string;
    /** True when an observed station's last measurement is too old to be read as live. Always false for forecasts. */
    isStale: boolean;
}

export class PrecipAccumulationResult {
    readonly source: string;
    readonly hours: number;
    readonly predictionType: string;
    /** Forecast simulation the values come from; null for observed data. */
    readonly simulationDate: string | null;
    /** Instant the accumulation was computed at (ISO 8601, UTC). */
    readonly referenceDate: string;
    readonly items: IPrecipAccumulationItem[];

    constructor(params: {
        source: string;
        hours: number;
        predictionType: string;
        simulationDate: string | null;
        referenceDate: string;
        items: IPrecipAccumulationItem[];
    }) {
        this.source = params.source;
        this.hours = params.hours;
        this.predictionType = params.predictionType;
        this.simulationDate = params.simulationDate;
        this.referenceDate = params.referenceDate;
        this.items = params.items;
    }
}
