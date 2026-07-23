/**
 * Builds the single JSON input file uploaded to the FTP for a manual simulation.
 *
 * Format mirrors the FEWS example `Q_mod_input_<YYYYMMDDHHMM>.json` provided by the
 * modelling team (Idrica): one envelope with one `timeSeries` entry per modified
 * station. Each series carries a fixed `parameterId = "Q.salida.forecast"`, the
 * station code as `locationId`, and a complete 15-minute grid of events.
 *
 * Two modes are supported per station, both feeding the same output shape:
 *   - CURVE: the visor sends the full 15-minute series (passthrough of FEWS events).
 *   - FLAT : the visor sends a single output-flow value; the grid is filled with that
 *            constant value over the modified window.
 *
 * This module is intentionally framework-free and pure (a `now` timestamp is injected)
 * so it can be unit-tested without a NestJS context.
 */

// ─────────────────────────────────────────────────────────────
// Constants (from the FEWS example header)
// ─────────────────────────────────────────────────────────────

export const PARAMETER_ID = 'Q.salida.forecast';
export const SERIES_TYPE = 'instantaneous';
export const TIME_STEP_SECONDS = '900'; // 15 minutes
export const UNITS = 'm3/s';
export const MISS_VAL = '-999.0';
export const FILE_VERSION = '1.34';
export const FILE_TIME_ZONE = '0.0';
export const GEO_PLACEHOLDER = '0.0';

/** moduleInstanceId is not relevant for import; keep the example value until configured. */
export const MODULE_INSTANCE_ID = 'RunMIKE11_Forecast_TajoJar_web';

/** Default forecast horizon (in days) used to close the FLAT window when the maneuver has no endDate. */
export const DEFAULT_HORIZON_DAYS = 3;

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/** Hard cap on generated points per station (~1 year at 15 min) to prevent runaway loops / OOM. */
export const MAX_EVENTS_PER_SERIES = 366 * 96 + 1;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** A single point of a modified series, in the FEWS-native passthrough shape. */
export interface SeriesPoint {
    date: string; // YYYY-MM-DD
    time: string; // HH:MM:SS
    value: number;
    flag?: number;
}

/** A station the user modified in the visor, plus how it was modified (flat value or full curve). */
export interface FileManeuverInput {
    reservoirCode: string;
    outputFlowValue: number;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    series?: SeriesPoint[];
}

/** Station metadata pulled from the ms-hydro-api catalog to enrich the header. */
export interface StationMeta {
    code: string;
    name: string | null;
    latitude: number | null;
    longitude: number | null;
    altitude: number | null;
}

export interface BuildFileParams {
    maneuvers: FileManeuverInput[];
    /** Station metadata indexed by lowercased station code. Missing entries fall back to placeholders. */
    stationsByCode: Record<string, StationMeta | undefined>;
    /** The simulation forecast moment (used as forecastDate and as the FLAT window start when no startDate). */
    forecastDate: Date;
    /** The instant the file is created (creationDate/creationTime/approvedDate). Injected for testability. */
    now: Date;
    horizonDays?: number;
}

interface TimeStamp {
    date: string;
    time: string;
}

export interface BuiltFile {
    fileName: string;
    content: {
        version: string;
        timeZone: string;
        timeSeries: object[];
    };
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export function buildManualSimulationFile(params: BuildFileParams): BuiltFile {
    const { maneuvers, stationsByCode, forecastDate, now } = params;
    const horizonDays = params.horizonDays ?? DEFAULT_HORIZON_DAYS;

    if (maneuvers.length === 0) {
        throw new Error('Cannot build a manual simulation file with no maneuvers');
    }

    const forecastStamp = toStamp(floorTo15Min(forecastDate));
    const creation = toStamp(now);

    const timeSeries: object[] = [];
    let earliestFirstStep: Date | null = null;

    for (const maneuver of maneuvers) {
        const events = buildEvents(maneuver, forecastDate, horizonDays);
        const firstStep = parseStamp(events[0].date, events[0].time);
        if (earliestFirstStep === null || firstStep.getTime() < earliestFirstStep.getTime()) {
            earliestFirstStep = firstStep;
        }

        const station = stationsByCode[maneuver.reservoirCode.toLowerCase()];
        const header = buildHeader({
            reservoirCode: maneuver.reservoirCode,
            station,
            start: { date: events[0].date, time: events[0].time },
            end: { date: events[events.length - 1].date, time: events[events.length - 1].time },
            forecast: forecastStamp,
            creation,
        });

        timeSeries.push({ header, events });
    }

    // earliestFirstStep is always set: maneuvers is non-empty and every series has >= 1 event.
    const fileName = buildFileName(earliestFirstStep as Date);

    return {
        fileName,
        content: { version: FILE_VERSION, timeZone: FILE_TIME_ZONE, timeSeries },
    };
}

// ─────────────────────────────────────────────────────────────
// Events (curve passthrough or flat 15-min fill)
// ─────────────────────────────────────────────────────────────

interface FewsEvent {
    date: string;
    time: string;
    value: string;
    flag: string;
}

function buildEvents(maneuver: FileManeuverInput, forecastDate: Date, horizonDays: number): FewsEvent[] {
    if (maneuver.series && maneuver.series.length > 0) {
        return buildCurveEvents(maneuver.series);
    }
    return buildFlatEvents(maneuver, forecastDate, horizonDays);
}

/** CURVE: passthrough of the visor-provided points, ordered chronologically. */
function buildCurveEvents(series: SeriesPoint[]): FewsEvent[] {
    return [...series]
        .sort((a, b) => parseStamp(a.date, a.time).getTime() - parseStamp(b.date, b.time).getTime())
        .map((p) => ({
            date: p.date,
            time: p.time,
            value: String(p.value),
            flag: String(p.flag ?? 0),
        }));
}

/**
 * FLAT: a single constant value repeated on a complete 15-minute grid over the modified window.
 * The window is [startDate ?? forecastDate, endDate ?? start + horizonDays], both endpoints inclusive.
 * Both endpoints are snapped to the previous :00/:15/:30/:45 boundary so the series lands on clean
 * FEWS ticks regardless of the sub-minute instant the request arrived.
 */
function buildFlatEvents(maneuver: FileManeuverInput, forecastDate: Date, horizonDays: number): FewsEvent[] {
    const rawStart = maneuver.startDate ? new Date(maneuver.startDate) : new Date(forecastDate);
    const rawEnd = maneuver.endDate ? new Date(maneuver.endDate) : addDays(rawStart, horizonDays);

    if (rawEnd.getTime() < rawStart.getTime()) {
        throw new Error(`Maneuver ${maneuver.reservoirCode}: endDate is before startDate`);
    }

    const start = floorTo15Min(rawStart);
    const end = floorTo15Min(rawEnd);

    const value = String(maneuver.outputFlowValue);
    const events: FewsEvent[] = [];
    for (let t = start.getTime(); t <= end.getTime(); t += FIFTEEN_MIN_MS) {
        const stamp = toStamp(new Date(t));
        events.push({ date: stamp.date, time: stamp.time, value, flag: '0' });
        if (events.length > MAX_EVENTS_PER_SERIES) {
            throw new Error(
                `Maneuver ${maneuver.reservoirCode}: window is too large (exceeds ${MAX_EVENTS_PER_SERIES} points)`,
            );
        }
    }
    return events;
}

/** Snap a UTC instant down to the previous 15-minute boundary (seconds/millis zeroed). */
function floorTo15Min(d: Date): Date {
    const t = new Date(d.getTime());
    t.setUTCSeconds(0, 0);
    t.setUTCMinutes(Math.floor(t.getUTCMinutes() / 15) * 15);
    return t;
}

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

function buildHeader(args: {
    reservoirCode: string;
    station: StationMeta | undefined;
    start: TimeStamp;
    end: TimeStamp;
    forecast: TimeStamp;
    creation: TimeStamp;
}): object {
    const { reservoirCode, station, start, end, forecast, creation } = args;
    const stationName = station?.name ? `${reservoirCode} ${station.name}` : reservoirCode;

    return {
        type: SERIES_TYPE,
        moduleInstanceId: MODULE_INSTANCE_ID,
        locationId: reservoirCode,
        parameterId: PARAMETER_ID,
        timeStep: { unit: 'second', multiplier: TIME_STEP_SECONDS },
        startDate: { date: start.date, time: start.time },
        endDate: { date: end.date, time: end.time },
        forecastDate: { date: forecast.date, time: forecast.time },
        missVal: MISS_VAL,
        stationName,
        lat: geo(station?.latitude),
        lon: geo(station?.longitude),
        // TODO: projected UTM coordinates (EPSG:25830) are not in the hydro catalog yet.
        // Placeholder until the modelling team confirms x/y are required for import.
        x: GEO_PLACEHOLDER,
        y: GEO_PLACEHOLDER,
        z: geo(station?.altitude),
        units: UNITS,
        creationDate: creation.date,
        creationTime: creation.time,
        approvedDate: { date: creation.date, time: creation.time },
    };
}

function geo(value: number | null | undefined): string {
    return value === null || value === undefined ? GEO_PLACEHOLDER : String(value);
}

// ─────────────────────────────────────────────────────────────
// Filename + timestamp helpers
// ─────────────────────────────────────────────────────────────

function buildFileName(firstStep: Date): string {
    const stamp = toStamp(firstStep);
    const compact = `${stamp.date.replace(/-/g, '')}${stamp.time.substring(0, 5).replace(':', '')}`;
    return `Q_mod_input_${compact}.json`;
}

/** UTC → { date: YYYY-MM-DD, time: HH:MM:SS }. */
function toStamp(d: Date): TimeStamp {
    const iso = d.toISOString();
    return { date: iso.split('T')[0], time: iso.split('T')[1].substring(0, 8) };
}

/** Parse a FEWS date/time pair as UTC. */
function parseStamp(date: string, time: string): Date {
    return new Date(`${date}T${time}Z`);
}

function addDays(d: Date, days: number): Date {
    return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
