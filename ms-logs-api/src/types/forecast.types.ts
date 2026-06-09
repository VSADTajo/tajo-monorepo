export enum StrategyType {
    SMC = "smc",
    ECMWF = "ecmwf",
    WRF = "wrf",
}

export enum JobType {
    FORECAST = "forecast",
    HISTORICAL = "historical",
}

export interface ForecastEvent {
    date: string;
    time: string;
    value: number;
    flag?: string;
}

export interface ForecastData {
    basin: string; // locationId from XML (e.g., EA001, EA004)
    strategy: StrategyType;
    model?: string; // optional: specific model used
    jobType: JobType;
    parameterId?: string; // e.g., "Discharge_forecast"
    units?: string; // e.g., "m3/s"
    events: ForecastEvent[];
    startDate?: Date;
    endDate?: Date;
    jobId?: string; // reference to the job that generated this forecast
    metadata?: Record<string, any>; // additional metadata
}
