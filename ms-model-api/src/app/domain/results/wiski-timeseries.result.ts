/**
 * Event format for WISKI CSV time series (used by ms-calculator-api).
 * Dates and times are expressed in UTC after timezone conversion.
 */
export interface WiskiEventResult {
    /** UTC date, format: YYYY-MM-DD */
    date: string;
    /** UTC time, format: HH:MM:SS */
    time: string;
    /** Numeric value as string (decimal point normalized to '.') */
    value: string;
    /** WISKI quality flag, default '2' (valid) */
    flag: string;
}

export interface WiskiTimeSeriesHeader {
    locationId: string;
    parameterId: string;
    stationName: string;
    units: string;
    moduleInstanceId: string;
    timeStep: { unit: string; multiplier: number };
    forecastDate: string | null;
    startDate: string | null;
    endDate: string | null;
    sourceTimezone: string;
    lat?: number;
    lon?: number;
    x?: number;
    y?: number;
}

export interface WiskiTimeSeriesResult {
    header: WiskiTimeSeriesHeader;
    events: WiskiEventResult[];
}
