/**
 * Parsing of a pasted output-flow curve into the points the backend expects.
 *
 * A manual maneuver can be sent in two ways (see manual-simulation-file.builder.ts):
 *   - FLAT : one constant value, and the backend fills the 15-minute grid.
 *   - CURVE: the full series, passed through verbatim as the station events.
 *
 * A 3-day curve at 15-minute steps is 289 points, so typing them is not an option:
 * the operator pastes them from a spreadsheet. This accepts the shapes that come
 * out of Excel/CSV without further massaging — semicolon, comma or tab separated,
 * 'T' or space between date and time, seconds optional, and decimal comma.
 */

export interface ManeuverSeriesPoint {
    date: string; // YYYY-MM-DD
    time: string; // HH:MM:SS
    value: number;
}

export interface ParsedSeries {
    points: ManeuverSeriesPoint[];
    /** 1-based line numbers that could not be read, to point the operator at them. */
    invalidLines: number[];
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_WITH_SECONDS = /^\d{2}:\d{2}:\d{2}$/;
const TIME_NO_SECONDS = /^\d{2}:\d{2}$/;

/** Splits on the separators a spreadsheet paste may use, collapsing repeats. */
function splitCells(line: string): string[] {
    return line
        .split(/[;\t]+|\s{2,}/)
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);
}

/** Accepts '12,5' as well as '12.5' — Spanish locale exports use the comma. */
function parseValue(raw: string): number {
    return Number(raw.replace(',', '.'));
}

function normalizeTime(raw: string): string | null {
    if (TIME_WITH_SECONDS.test(raw)) return raw;
    if (TIME_NO_SECONDS.test(raw)) return `${raw}:00`;
    return null;
}

/**
 * Reads one line into a point, or null when it cannot be understood.
 * Supported: "2026-07-27 11:00:00;12.5", "2026-07-27T11:00;12,5",
 * and the three-column form "2026-07-27;11:00:00;12.5".
 */
function parseLine(line: string): ManeuverSeriesPoint | null {
    const cells = splitCells(line.replace(/^﻿/, ''));
    if (cells.length < 2) return null;

    // Three columns: date, time, value
    if (cells.length >= 3 && DATE_ONLY.test(cells[0])) {
        const time = normalizeTime(cells[1]);
        const value = parseValue(cells[2]);
        if (!time || !Number.isFinite(value)) return null;
        return { date: cells[0], time, value };
    }

    // Two columns: timestamp, value
    const [stamp, rawValue] = [cells[0], cells[cells.length - 1]];
    const value = parseValue(rawValue);
    if (!Number.isFinite(value)) return null;

    const [datePart, timePart] = stamp.split(/[T ]/);
    if (!datePart || !timePart || !DATE_ONLY.test(datePart)) return null;

    const time = normalizeTime(timePart);
    if (!time) return null;

    return { date: datePart, time, value };
}

/** Parses pasted text, reporting which lines failed instead of dropping them silently. */
export function parseManeuverSeries(text: string): ParsedSeries {
    const points: ManeuverSeriesPoint[] = [];
    const invalidLines: number[] = [];

    text.split(/\r?\n/).forEach((line, index) => {
        if (line.trim().length === 0) return;

        const point = parseLine(line);
        if (point === null) {
            invalidLines.push(index + 1);
            return;
        }
        points.push(point);
    });

    return { points, invalidLines };
}

/** Chronological order, matching what the backend does before writing the events. */
export function sortSeries(points: ManeuverSeriesPoint[]): ManeuverSeriesPoint[] {
    return [...points].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}
