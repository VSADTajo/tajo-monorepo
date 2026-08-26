/**
 * WISKI CSV parser — pure TypeScript function, no framework dependencies.
 *
 * Timezone library: luxon
 * Ports the Python logic from tajo-volume_calculator/volume_calculator/reservoir_timeseries.py
 * (load_wiski_csv_payload, _parse_wiski_event, _parse_wiski_header_line, _build_wiski_time_series)
 *
 * TL requirement: the parameterId in the output MUST be the verbatim value read
 * from the "Nombre de la serie temporal" header line — never constructed from
 * other fields.
 */

import { DateTime } from 'luxon';

import {
    WiskiEventResult,
    WiskiTimeSeriesHeader,
    WiskiTimeSeriesResult,
} from '@domain/results/wiski-timeseries.result';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps WISKI header keys to our normalized field names.
 *
 * WISKI exports the same file in either locale, and the real Tagus_FlowCast.csv
 * we receive uses the English keys. Accept both: a locale mismatch used to yield
 * zero series without any error, which is indistinguishable from an empty file.
 */
const WISKI_HEADER_FIELDS: Record<string, string> = {
    // Spanish
    'Número de la estación': 'locationId',
    'Nombre de la serie temporal': 'parameterId',
    'Nombre de la estación': 'stationName',
    'Unidad de la serie temporal': 'units',
    Longitud: 'lon',
    Latitud: 'lat',
    // English
    'Station Number': 'locationId',
    'Time series Name': 'parameterId',
    'Station Name': 'stationName',
    'Time series Unit': 'units',
    Longitude: 'lon',
    Latitude: 'lat',
    // Locale-independent
    LocalX: 'x',
    LocalY: 'y',
    GlobalX: 'lon',
    GlobalY: 'lat',
};

const DEFAULT_TIME_STEP = { unit: 'hour', multiplier: 1 };
const DEFAULT_FLAG = '2';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface WiskiParseOptions {
    /** IANA timezone the CSV timestamps are expressed in. Default: 'UTC'. */
    sourceTimezone?: string;
}

/**
 * Parse the raw WISKI CSV text into an array of normalized time-series entries.
 *
 * @param csvText - Raw CSV text (may be decoded from a UTF-8 or latin-1 buffer).
 * @param options - Parse options (sourceTimezone).
 */
export function parseWiskiCsv(csvText: string, options?: WiskiParseOptions): WiskiTimeSeriesResult[] {
    const sourceTimezone = options?.sourceTimezone ?? 'UTC';
    const lines = csvText.split('\n').map((l) => l.trim());

    const results: WiskiTimeSeriesResult[] = [];

    // Mutable state for the current block
    let currentHeader: Partial<WiskiTimeSeriesHeader> | null = null;
    let currentEvents: WiskiEventResult[] = [];
    let hasEvents = false;

    for (const line of lines) {
        if (!line) continue;

        const headerParsed = tryParseHeaderLine(line);
        if (headerParsed !== null) {
            // If we were accumulating events and encounter a new header block,
            // flush the current block first.
            if (hasEvents && currentHeader !== null) {
                const result = buildResult(currentHeader, currentEvents, sourceTimezone);
                if (result) results.push(result);
                currentHeader = null;
                currentEvents = [];
                hasEvents = false;
            }

            if (currentHeader === null) {
                currentHeader = {};
            }

            const field = WISKI_HEADER_FIELDS[headerParsed.key];
            if (field) {
                (currentHeader as Record<string, unknown>)[field] = headerParsed.value;
            }
            continue;
        }

        // Try to parse as an event row (dd/mm/yyyy;hh:mm:ss;value)
        const event = tryParseEventLine(line, sourceTimezone);
        if (event !== null) {
            if (currentHeader !== null) {
                currentEvents.push(event);
                hasEvents = true;
            }
        }
        // Non-header, non-event lines are silently skipped
    }

    // Flush the last block
    if (currentHeader !== null && hasEvents) {
        const result = buildResult(currentHeader, currentEvents, sourceTimezone);
        if (result) results.push(result);
    }

    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Header values arrive as strings; anything non-numeric becomes undefined. */
function toNumberOrUndefined(raw: unknown): number | undefined {
    if (raw === null || raw === undefined || raw === '') return undefined;

    const numeric = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : undefined;
}

/** Removes the trailing colon WISKI appends to header keys ("Station Number:"). */
function stripTrailingColon(key: string): string {
    return key.endsWith(':') ? key.slice(0, -1).trim() : key;
}

/**
 * Try to parse a WISKI header line.
 * Supports both colon-separated ("Key: Value") and tab-separated ("Key\tValue").
 * Returns null if the line is not a header.
 */
function tryParseHeaderLine(line: string): { key: string; value: string } | null {
    // Tab-separated header. Real exports write "Station Number:<TAB>E_01", so the
    // colon belongs to the key and has to be trimmed before the lookup.
    const tabIdx = line.indexOf('\t');
    if (tabIdx > 0) {
        const key = stripTrailingColon(line.substring(0, tabIdx).trim());
        const value = line.substring(tabIdx + 1).trim();
        if (key && value) return { key, value };
    }

    // Colon-separated header — only treat as header if the key is in our known fields
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        if (key in WISKI_HEADER_FIELDS) {
            return { key, value };
        }
    }

    return null;
}

/**
 * Try to parse a WISKI event row: dd/mm/yyyy;hh:mm:ss;value
 * Returns a WiskiEventResult in UTC, or null if the row is invalid.
 */
function tryParseEventLine(line: string, sourceTimezone: string): WiskiEventResult | null {
    const parts = line.split(';');
    if (parts.length < 3) return null;

    const [rawDate, rawTime, rawValue] = parts;

    // Validate date format dd/mm/yyyy
    const dateParts = rawDate.trim().split('/');
    if (dateParts.length !== 3) return null;

    const [dd, mm, yyyy] = dateParts;
    if (!dd || !mm || !yyyy) return null;

    // Build ISO string for parsing: yyyy-mm-dd HH:mm:ss
    const isoString = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${rawTime.trim()}`;

    // Parse in source timezone and convert to UTC
    const dt = DateTime.fromISO(isoString, { zone: sourceTimezone });
    if (!dt.isValid) return null;

    const utc = dt.toUTC();
    const date = utc.toFormat('yyyy-MM-dd');
    const time = utc.toFormat('HH:mm:ss');

    // Normalize comma decimal
    const value = rawValue.trim().replace(',', '.');

    return { date, time, value, flag: DEFAULT_FLAG };
}

/**
 * Build a WiskiTimeSeriesResult from the accumulated header and events.
 * Returns null if mandatory header fields (locationId, parameterId) are missing.
 */
function buildResult(
    header: Partial<WiskiTimeSeriesHeader>,
    events: WiskiEventResult[],
    sourceTimezone: string,
): WiskiTimeSeriesResult | null {
    if (!header.locationId || !header.parameterId) return null;

    // Determine start/end from events
    const startDate = events.length > 0 ? `${events[0].date}T${events[0].time}Z` : null;
    const endDate = events.length > 0 ? `${events[events.length - 1].date}T${events[events.length - 1].time}Z` : null;

    const fullHeader: WiskiTimeSeriesHeader = {
        locationId: header.locationId,
        parameterId: header.parameterId,
        stationName: header.stationName ?? '',
        units: header.units ?? '',
        moduleInstanceId: 'wiski_csv',
        timeStep: DEFAULT_TIME_STEP,
        forecastDate: null,
        startDate,
        endDate,
        sourceTimezone: 'UTC', // output is always UTC
        // Header values always arrive as strings; the previous `typeof === number`
        // guard meant coordinates were silently dropped on every file.
        lat: toNumberOrUndefined(header.lat),
        lon: toNumberOrUndefined(header.lon),
        x: toNumberOrUndefined(header.x),
        y: toNumberOrUndefined(header.y),
    };

    // Suppress unused variable warning — sourceTimezone already used in tryParseEventLine
    void sourceTimezone;

    return { header: fullHeader, events };
}
