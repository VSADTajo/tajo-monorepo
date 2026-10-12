/**
 * SAIH signal code at the start of a time series name: two letters, then "CT"
 * or "__", then two digits (FICT99, VICT01, WI__01, LICT01, FI__01...).
 */
const SIGNAL_CODE = /^[A-Z]{2}(?:CT|__)\d{2}/;

/**
 * The series id a "Time series Name" is stored under: its signal code.
 *
 * Names append a qualifier after the code with either "." or "_"
 * (FICT99.Validado, FICT99_Calculado_1h, FICT99_Calculado-2). Every qualifier of
 * the same signal must land on the same key, because consumers ask for
 * "<code>.historical" only. Splitting on "_" is not an option: it would cut
 * WI__01 down to "WI". Names that do not start with a signal code keep the
 * previous behaviour (first "."-separated segment).
 */
export function toIngestionSeriesId(seriesName: string): string {
    const match = SIGNAL_CODE.exec(seriesName);
    return match ? match[0] : seriesName.split('.')[0];
}

/**
 * The parameterId both ingestion paths (WISKI API and CSV) use, so a series
 * lands on the same key whichever way it arrives.
 */
export function toIngestionParameterId(seriesName: string): string {
    return `${toIngestionSeriesId(seriesName) || seriesName}.historical`;
}
