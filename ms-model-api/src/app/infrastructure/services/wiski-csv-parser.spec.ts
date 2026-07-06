/**
 * Unit tests for parseWiskiCsv.
 *
 * Timezone library: luxon (installed via npm).
 * Fixtures are embedded inline — no external files.
 *
 * TL requirement: parameterId MUST be the verbatim string from the CSV header
 * "Nombre de la serie temporal" — never constructed from other fields.
 */

import { parseWiskiCsv } from './wiski-csv-parser';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single-block CSV with two events, using colon-separated headers.
 * Timestamps in UTC.
 */
const SINGLE_BLOCK_UTC = `
Número de la estación: E_08
Nombre de la serie temporal: VICT01.Validado
Nombre de la estación: Estación Victoria
Unidad de la serie temporal: m3/s

01/06/2026;10:00:00;12.3
02/06/2026;11:00:00;14.5
`.trim();

/**
 * Single-block CSV with two events — timestamps in Europe/Madrid in July (CEST, UTC+2).
 * 10:00 Madrid time = 08:00 UTC.
 */
const SINGLE_BLOCK_MADRID_SUMMER = `
Número de la estación: E_08
Nombre de la serie temporal: VICT01.Validado
Nombre de la estación: Estación Victoria
Unidad de la serie temporal: m3/s

15/07/2026;10:00:00;12.3
15/07/2026;11:00:00;14.5
`.trim();

/**
 * Single-block CSV — timestamps in Europe/Madrid in January (CET, UTC+1).
 * 10:00 Madrid = 09:00 UTC.
 */
const SINGLE_BLOCK_MADRID_WINTER = `
Número de la estación: E_08
Nombre de la serie temporal: VICT01.Validado
Nombre de la estación: Estación Victoria
Unidad de la serie temporal: m3/s

15/01/2026;10:00:00;12.3
`.trim();

/**
 * Multi-block CSV — two series blocks.
 */
const MULTI_BLOCK = `
Número de la estación: E_08
Nombre de la serie temporal: VICT01.Validado
Nombre de la estación: Estación Victoria
Unidad de la serie temporal: m3/s

01/06/2026;10:00:00;12.3

Número de la estación: E_09
Nombre de la serie temporal: VICT02.Validado
Nombre de la estación: Estación Victoria 2
Unidad de la serie temporal: hm3

02/06/2026;12:00:00;99.9
`.trim();

/**
 * CSV with tab-separated headers (WISKI also uses tab as separator).
 */
const TAB_HEADER = `Número de la estación\tE_08
Nombre de la serie temporal\tVICT01.Validado
Nombre de la estación\tEstación Victoria
Unidad de la serie temporal\tm3/s

01/06/2026;10:00:00;12.3`.trim();

/**
 * CSV with an invalid date row followed by a valid row.
 */
const INVALID_DATE_ROW = `
Número de la estación: E_08
Nombre de la serie temporal: VICT01.Validado
Nombre de la estación: Estación Victoria
Unidad de la serie temporal: m3/s

31/02/2026;10:00:00;12.3
01/06/2026;10:00:00;14.5
`.trim();

/**
 * CSV with a comma decimal value.
 */
const COMMA_DECIMAL = `
Número de la estación: E_08
Nombre de la serie temporal: VICT01.Validado
Nombre de la estación: Estación Victoria
Unidad de la serie temporal: m3/s

01/06/2026;10:00:00;12,34
`.trim();

/** Empty CSV (only whitespace). */
const EMPTY_CSV = '   \n  \n  ';

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('parseWiskiCsv()', () => {
    // ── Critical TL requirement: parameterId must be verbatim from CSV header ──

    it('should produce header.parameterId equal to the verbatim value from "Nombre de la serie temporal" header', () => {
        const results = parseWiskiCsv(SINGLE_BLOCK_UTC, { sourceTimezone: 'UTC' });
        expect(results).toHaveLength(1);
        expect(results[0].header.parameterId).toBe('VICT01.Validado');
    });

    it('should produce header.locationId equal to the verbatim value from "Número de la estación" header', () => {
        const results = parseWiskiCsv(SINGLE_BLOCK_UTC, { sourceTimezone: 'UTC' });
        expect(results[0].header.locationId).toBe('E_08');
    });

    // ── Single-block UTC ──────────────────────────────────────────────────────

    it('should parse a single-block CSV with UTC timezone and return one result', () => {
        const results = parseWiskiCsv(SINGLE_BLOCK_UTC, { sourceTimezone: 'UTC' });
        expect(results).toHaveLength(1);
    });

    it('should parse events with UTC timezone — date and time are unchanged', () => {
        const results = parseWiskiCsv(SINGLE_BLOCK_UTC, { sourceTimezone: 'UTC' });
        const events = results[0].events;
        expect(events).toHaveLength(2);
        expect(events[0].date).toBe('2026-06-01');
        expect(events[0].time).toBe('10:00:00');
        expect(events[1].date).toBe('2026-06-02');
        expect(events[1].time).toBe('11:00:00');
    });

    it('should set the flag to "2" by default', () => {
        const results = parseWiskiCsv(SINGLE_BLOCK_UTC, { sourceTimezone: 'UTC' });
        expect(results[0].events[0].flag).toBe('2');
    });

    // ── Timezone conversion: Europe/Madrid summer (CEST = UTC+2) ─────────────

    it('should shift timestamps from Europe/Madrid summer (CEST) to UTC (-2h)', () => {
        const results = parseWiskiCsv(SINGLE_BLOCK_MADRID_SUMMER, { sourceTimezone: 'Europe/Madrid' });
        expect(results).toHaveLength(1);
        const events = results[0].events;
        // 10:00 Madrid (UTC+2) → 08:00 UTC
        expect(events[0].date).toBe('2026-07-15');
        expect(events[0].time).toBe('08:00:00');
        // 11:00 Madrid (UTC+2) → 09:00 UTC
        expect(events[1].date).toBe('2026-07-15');
        expect(events[1].time).toBe('09:00:00');
    });

    // ── Timezone conversion: Europe/Madrid winter (CET = UTC+1) ──────────────

    it('should shift timestamps from Europe/Madrid winter (CET) to UTC (-1h)', () => {
        const results = parseWiskiCsv(SINGLE_BLOCK_MADRID_WINTER, { sourceTimezone: 'Europe/Madrid' });
        expect(results).toHaveLength(1);
        const events = results[0].events;
        // 10:00 Madrid (UTC+1) → 09:00 UTC
        expect(events[0].date).toBe('2026-01-15');
        expect(events[0].time).toBe('09:00:00');
    });

    // ── Multi-block ───────────────────────────────────────────────────────────

    it('should parse a multi-block CSV into two separate WiskiTimeSeriesResult entries', () => {
        const results = parseWiskiCsv(MULTI_BLOCK, { sourceTimezone: 'UTC' });
        expect(results).toHaveLength(2);
    });

    it('should assign correct locationId and parameterId per block', () => {
        const results = parseWiskiCsv(MULTI_BLOCK, { sourceTimezone: 'UTC' });
        expect(results[0].header.locationId).toBe('E_08');
        expect(results[0].header.parameterId).toBe('VICT01.Validado');
        expect(results[1].header.locationId).toBe('E_09');
        expect(results[1].header.parameterId).toBe('VICT02.Validado');
    });

    // ── Tab-separated headers ─────────────────────────────────────────────────

    it('should parse headers with tab separator', () => {
        const results = parseWiskiCsv(TAB_HEADER, { sourceTimezone: 'UTC' });
        expect(results).toHaveLength(1);
        expect(results[0].header.parameterId).toBe('VICT01.Validado');
        expect(results[0].header.locationId).toBe('E_08');
    });

    // ── Invalid date row ──────────────────────────────────────────────────────

    it('should skip a row with an invalid date and keep subsequent valid rows', () => {
        const results = parseWiskiCsv(INVALID_DATE_ROW, { sourceTimezone: 'UTC' });
        expect(results).toHaveLength(1);
        const events = results[0].events;
        // 31/02 is invalid — skip it; only the valid row survives
        expect(events).toHaveLength(1);
        expect(events[0].date).toBe('2026-06-01');
        expect(events[0].time).toBe('10:00:00');
    });

    // ── Comma decimal ─────────────────────────────────────────────────────────

    it('should convert comma decimal "12,34" to dot decimal "12.34"', () => {
        const results = parseWiskiCsv(COMMA_DECIMAL, { sourceTimezone: 'UTC' });
        expect(results[0].events[0].value).toBe('12.34');
    });

    // ── Empty CSV ─────────────────────────────────────────────────────────────

    it('should return an empty array for a whitespace-only CSV', () => {
        const results = parseWiskiCsv(EMPTY_CSV, { sourceTimezone: 'UTC' });
        expect(results).toEqual([]);
    });

    // ── Default timezone ──────────────────────────────────────────────────────

    it('should default to UTC when no sourceTimezone is provided', () => {
        const results = parseWiskiCsv(SINGLE_BLOCK_UTC);
        const events = results[0].events;
        expect(events[0].date).toBe('2026-06-01');
        expect(events[0].time).toBe('10:00:00');
    });
});
