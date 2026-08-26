/**
 * WISKI observed-data JSON mapper — pure functions, no framework dependencies.
 *
 * Their endpoint answers a flat array of readings:
 *
 *     [{ "variable": "E_08VICT01.Validado", "lastchange": "2026-08-11T13:45:00", "value": 20.67 }]
 *
 * `variable` is the station number and the time-series name concatenated with
 * no separator, and nothing else travels: no station name, no units, no
 * coordinates and no UTC offset. Everything the two consumers need is either
 * resolved through the catalog (seeded from the WISKI CSV we already receive)
 * or derived from the readings themselves.
 *
 * The two output shapes exist because the two consumers already disagree on the
 * parameterId convention, and this mapper must not be the place where that
 * changes:
 *   - ingestion  -> NormalizedTimeSeriesResult, parameterId `<first segment>.historical`,
 *                   exactly what CsvFileProviderService produces from the same series.
 *   - v.obs      -> WiskiTimeSeriesResult, parameterId verbatim, as parseWiskiCsv produces.
 */

import { DateTime } from 'luxon';

import { NormalizedTimeSeriesResult, TimeSeriesEventResult } from '@domain/results/normalized-timeseries.result';
import { WiskiEventResult, WiskiTimeSeriesResult } from '@domain/results/wiski-timeseries.result';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Same sentinel the calculator payload uses for an absent reading. */
const MISS_VAL = -999;

/** Flags mirror CsvFileProviderService: 0 = good, 8 = missing. */
const FLAG_OK = 0;
const FLAG_MISSING = 8;

/** WISKI quality flag for a valid reading, as parseWiskiCsv emits it. */
const WISKI_FLAG_OK = '2';

const MODULE_INSTANCE_ID = 'FlowCast';

/** Used when a series carries a single reading and no cadence can be observed. */
const DEFAULT_TIME_STEP = { unit: 'MINUTE', multiplier: 15 };

/**
 * Splits a `variable` into station number and time-series name.
 *
 * The endpoint concatenates the two fields the WISKI CSV keeps apart, with no
 * separator. Every series name starts with one of the known instrument codes, so
 * the boundary is the first one of those: "E_08VICT01.Validado" -> E_08 +
 * VICT01.Validado, "A005WI__01.Total.Horario" -> A005 + WI__01.Total.Horario.
 *
 * Validated against the real Tagus_FlowCast.csv, which carries both fields
 * explicitly: 389 of 389 overlapping series split exactly as the file spells
 * them. Note the lazy prefix must NOT absorb letters before the code — a
 * qualifier like MD/MI/IIB/A/B belongs to the station ("AC19MD", "E_31A" are
 * distinct stations), and reading it as part of the series invented six station
 * ids that do not exist.
 */
const SERIES_CODES = ['FICT', 'VICT', 'WI__', 'FI__'] as const;

const VARIABLE_SPLIT = new RegExp(`^(.+?)((?:${SERIES_CODES.join('|')})\\d+(?:[._].+)?)$`);

/**
 * Unit of measure per instrument code.
 *
 * The JSON never carries units, and ms-predictions-api stores whatever arrives
 * on the PredictionType (falling back to the literal 'unknown'). Deriving them
 * from the code is exact rather than approximate: across the 429 blocks of the
 * real CSV export the mapping never varies — WI__ is always mm, FICT/FI__ always
 * m³/s, VICT always Hm3.
 */
const UNITS_BY_CODE: Record<string, string> = {
    WI__: 'mm',
    FICT: 'm³/s',
    FI__: 'm³/s',
    VICT: 'Hm3',
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** One reading as it arrives from the endpoint. */
export interface WiskiObservedRecord {
    variable: string;
    lastchange: string;
    value: number | string | null;
}

/** Station and series a `variable` resolves to, plus what can be derived from it. */
export interface WiskiVariableResolution {
    locationId: string;
    seriesName: string;
    units: string;
}

export interface WiskiJsonMapOptions {
    /** IANA timezone the `lastchange` timestamps are expressed in. */
    sourceTimezone: string;
}

export interface WiskiMapReport {
    /** Variables split into station and series. */
    resolvedCount: number;
    /** Variables dropped: their name follows no known instrument code. */
    skippedVariables: string[];
    /** Readings dropped because their timestamp could not be parsed. */
    invalidEventCount: number;
}

export interface WiskiNormalizedMapResult extends WiskiMapReport {
    series: NormalizedTimeSeriesResult[];
}

export interface WiskiVobsMapResult extends WiskiMapReport {
    series: WiskiTimeSeriesResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Ingestion shape — what the provider publishes as `timeseries.ingested`. */
export function toNormalizedTimeSeries(
    records: readonly WiskiObservedRecord[],
    options: WiskiJsonMapOptions,
): WiskiNormalizedMapResult {
    const { groups, report } = groupAndResolve(records, options);

    const series = groups.map((group) => {
        const events = group.events.map(
            (event) =>
                new TimeSeriesEventResult({
                    timestamp: event.timestamp,
                    value: event.isMissing ? 0 : event.value,
                    flag: event.isMissing ? FLAG_MISSING : FLAG_OK,
                    isMissing: event.isMissing,
                }),
        );

        const startDate = group.events[0].timestamp;
        const endDate = group.events[group.events.length - 1].timestamp;

        return new NormalizedTimeSeriesResult({
            locationId: group.resolution.locationId,
            parameterId: toIngestionParameterId(group.resolution.seriesName),
            sourceParameterId: group.resolution.seriesName,
            moduleInstanceId: MODULE_INSTANCE_ID,
            stationName: '',
            lat: 0,
            lon: 0,
            units: group.resolution.units,
            timeStep: inferTimeStep(group.events.map((e) => e.timestamp)),
            forecastDate: startDate,
            startDate,
            endDate,
            events,
        });
    });

    return { series, ...report };
}

/**
 * v.obs shape — what the manual-simulation poller merges into the calculator
 * payload. The parameterId stays verbatim, which is a standing requirement.
 */
export function toWiskiTimeSeries(
    records: readonly WiskiObservedRecord[],
    options: WiskiJsonMapOptions,
): WiskiVobsMapResult {
    const { groups, report } = groupAndResolve(records, options);

    const series: WiskiTimeSeriesResult[] = groups.map((group) => {
        const events: WiskiEventResult[] = group.events.map((event) => {
            const [date, timeWithZone] = event.timestamp.split('T');
            return {
                date,
                time: timeWithZone.replace(/\.\d+Z$/, '').replace(/Z$/, ''),
                value: event.isMissing ? String(MISS_VAL) : String(event.value),
                flag: WISKI_FLAG_OK,
            };
        });

        return {
            header: {
                locationId: group.resolution.locationId,
                parameterId: group.resolution.seriesName,
                stationName: '',
                units: group.resolution.units,
                moduleInstanceId: 'wiski_api',
                timeStep: inferTimeStep(group.events.map((e) => e.timestamp)),
                forecastDate: null,
                startDate: group.events[0].timestamp,
                endDate: group.events[group.events.length - 1].timestamp,
                sourceTimezone: 'UTC',
            },
            events,
        };
    });

    return { series, ...report };
}

/**
 * The parameterId the ingestion path uses. Kept identical to what
 * CsvFileProviderService derives from the same "Time series Name", so a series
 * arriving over the API lands on the same key it did over the CSV.
 */
export function toIngestionParameterId(seriesName: string): string {
    const head = seriesName.split('.')[0];
    return `${head || seriesName}.historical`;
}

/**
 * Splits one `variable` and derives its unit. Returns null when the name follows
 * no known instrument code — the series is then dropped and reported, never
 * guessed into an invented station.
 */
export function resolveVariable(variable: string): WiskiVariableResolution | null {
    const match = VARIABLE_SPLIT.exec(variable);
    if (!match) return null;

    const [, locationId, seriesName] = match;
    if (!locationId || !seriesName) return null;

    const code = SERIES_CODES.find((candidate) => seriesName.startsWith(candidate));

    return { locationId, seriesName, units: code ? UNITS_BY_CODE[code] : '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

interface MappedEvent {
    /** ISO-8601 in UTC, millisecond precision. */
    timestamp: string;
    value: number;
    isMissing: boolean;
}

interface ResolvedGroup {
    variable: string;
    resolution: WiskiVariableResolution;
    events: MappedEvent[];
}

function groupAndResolve(
    records: readonly WiskiObservedRecord[],
    options: WiskiJsonMapOptions,
): { groups: ResolvedGroup[]; report: WiskiMapReport } {
    const byVariable = new Map<string, MappedEvent[]>();
    // A Set, not an array: a full answer carries ~270k readings, and a linear
    // membership check per reading over hundreds of variables would turn the
    // mapping into tens of millions of string comparisons.
    const skipped = new Set<string>();
    const resolutions = new Map<string, WiskiVariableResolution>();
    let invalidEventCount = 0;

    for (const record of records) {
        const variable = typeof record?.variable === 'string' ? record.variable.trim() : '';
        if (!variable) {
            invalidEventCount++;
            continue;
        }

        if (!resolutions.has(variable) && !skipped.has(variable)) {
            const resolved = resolveVariable(variable);
            if (resolved) {
                resolutions.set(variable, resolved);
            } else {
                skipped.add(variable);
            }
        }

        const resolution = resolutions.get(variable);
        if (!resolution) continue;

        const timestamp = toUtcIso(record.lastchange, options.sourceTimezone);
        if (timestamp === null) {
            invalidEventCount++;
            continue;
        }

        const events = byVariable.get(variable) ?? [];
        events.push({ timestamp, ...normalizeValue(record.value) });
        byVariable.set(variable, events);
    }

    const groups: ResolvedGroup[] = [];

    for (const [variable, events] of byVariable) {
        if (events.length === 0) continue;

        // The endpoint answers newest-first; every consumer downstream assumes
        // chronological order, and a start/end read off an unsorted list would
        // be silently inverted.
        const ordered = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        const resolution = resolutions.get(variable);
        if (!resolution) continue;

        groups.push({ variable, resolution, events: ordered });
    }

    groups.sort((a, b) => a.variable.localeCompare(b.variable));

    return {
        groups,
        report: { resolvedCount: resolutions.size, skippedVariables: [...skipped], invalidEventCount },
    };
}

/** `2026-08-11T13:45:00` in the source zone -> `2026-08-11T11:45:00.000Z`. */
function toUtcIso(lastchange: unknown, sourceTimezone: string): string | null {
    if (typeof lastchange !== 'string' || lastchange.trim().length === 0) return null;

    const parsed = DateTime.fromISO(lastchange.trim(), { zone: sourceTimezone });
    if (!parsed.isValid) return null;

    return parsed.toUTC().toISO({ suppressMilliseconds: false })!;
}

function normalizeValue(raw: unknown): { value: number; isMissing: boolean } {
    if (raw === null || raw === undefined || raw === '') return { value: 0, isMissing: true };

    const numeric = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(numeric)) return { value: 0, isMissing: true };
    if (numeric === MISS_VAL) return { value: 0, isMissing: true };

    return { value: numeric, isMissing: false };
}

/**
 * Reads the cadence off the series instead of storing it: the endpoint mixes
 * 15-minute and hourly series, and the modal gap between consecutive readings
 * says which is which without another field to keep in sync.
 */
function inferTimeStep(timestamps: readonly string[]): { unit: string; multiplier: number } {
    if (timestamps.length < 2) return { ...DEFAULT_TIME_STEP };

    const gaps = new Map<number, number>();

    for (let i = 1; i < timestamps.length; i++) {
        const seconds = (Date.parse(timestamps[i]) - Date.parse(timestamps[i - 1])) / 1000;
        if (!Number.isFinite(seconds) || seconds <= 0) continue;
        gaps.set(seconds, (gaps.get(seconds) ?? 0) + 1);
    }

    let modalSeconds = 0;
    let modalCount = 0;
    for (const [seconds, count] of gaps) {
        if (count > modalCount || (count === modalCount && seconds < modalSeconds)) {
            modalSeconds = seconds;
            modalCount = count;
        }
    }

    if (modalSeconds === 0) return { ...DEFAULT_TIME_STEP };
    if (modalSeconds % 60 === 0) return { unit: 'MINUTE', multiplier: modalSeconds / 60 };

    return { unit: 'SECOND', multiplier: modalSeconds };
}
