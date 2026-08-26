/**
 * Unit tests for the WISKI observed-data JSON mapper.
 *
 * Fixtures are inline and mirror real readings from their endpoint: newest
 * first, no offset on the timestamp, no metadata beyond the concatenated
 * `variable`.
 */

import {
    WiskiObservedRecord,
    resolveVariable,
    toIngestionParameterId,
    toNormalizedTimeSeries,
    toWiskiTimeSeries,
} from './wiski-json.mapper';

const MADRID = 'Europe/Madrid';

/** Two quarter-hourly readings, newest first, as the endpoint orders them. */
const TWO_READINGS: WiskiObservedRecord[] = [
    { variable: 'E_08VICT01.Validado', lastchange: '2026-08-11T14:00:00', value: 20.68 },
    { variable: 'E_08VICT01.Validado', lastchange: '2026-08-11T13:45:00', value: 20.67 },
];

describe('toNormalizedTimeSeries()', () => {
    it('groups readings by variable and orders them chronologically', () => {
        const { series } = toNormalizedTimeSeries(TWO_READINGS, { sourceTimezone: MADRID });

        expect(series).toHaveLength(1);
        expect(series[0].events.map((e) => e.value)).toEqual([20.67, 20.68]);
        expect(series[0].startDate).toBe('2026-08-11T11:45:00.000Z');
        expect(series[0].endDate).toBe('2026-08-11T12:00:00.000Z');
    });

    it('splits the variable into station and series, and derives the unit', () => {
        const { series, resolvedCount, skippedVariables } = toNormalizedTimeSeries(TWO_READINGS, {
            sourceTimezone: MADRID,
        });

        expect(series[0].locationId).toBe('E_08');
        // VICT is reservoir volume — the endpoint never says so, the code does.
        expect(series[0].units).toBe('Hm3');
        expect(resolvedCount).toBe(1);
        expect(skippedVariables).toEqual([]);
    });

    it('uses the same parameterId convention as the CSV provider', () => {
        const { series } = toNormalizedTimeSeries(TWO_READINGS, { sourceTimezone: MADRID });

        expect(series[0].parameterId).toBe('VICT01.historical');
        expect(series[0].sourceParameterId).toBe('VICT01.Validado');
    });

    it('converts a summer timestamp from Madrid to UTC (CEST, -2h)', () => {
        const { series } = toNormalizedTimeSeries(TWO_READINGS, { sourceTimezone: MADRID });

        expect(series[0].events[0].timestamp).toBe('2026-08-11T11:45:00.000Z');
    });

    it('converts a winter timestamp from Madrid to UTC (CET, -1h)', () => {
        const winter: WiskiObservedRecord[] = [
            { variable: 'E_08VICT01.Validado', lastchange: '2026-01-15T10:00:00', value: 1 },
        ];

        const { series } = toNormalizedTimeSeries(winter, { sourceTimezone: MADRID });

        expect(series[0].events[0].timestamp).toBe('2026-01-15T09:00:00.000Z');
    });

    it('treats -999 and null as missing readings', () => {
        const withGaps: WiskiObservedRecord[] = [
            { variable: 'E_08VICT01.Validado', lastchange: '2026-08-11T13:45:00', value: -999 },
            { variable: 'E_08VICT01.Validado', lastchange: '2026-08-11T14:00:00', value: null },
            { variable: 'E_08VICT01.Validado', lastchange: '2026-08-11T14:15:00', value: 3.2 },
        ];

        const { series } = toNormalizedTimeSeries(withGaps, { sourceTimezone: MADRID });

        expect(series[0].events.map((e) => e.isMissing)).toEqual([true, true, false]);
        expect(series[0].events.map((e) => e.flag)).toEqual([8, 8, 0]);
        expect(series[0].events[0].value).toBe(0);
    });

    it('infers a 15-minute time step from the readings themselves', () => {
        const { series } = toNormalizedTimeSeries(TWO_READINGS, { sourceTimezone: MADRID });

        expect(series[0].timeStep).toEqual({ unit: 'MINUTE', multiplier: 15 });
    });

    it('drops a variable whose name follows no known instrument code', () => {
        const unknown: WiskiObservedRecord[] = [
            { variable: 'ALGO_RARO.Validado', lastchange: '2026-08-11T14:00:00', value: 1 },
        ];

        const { series, skippedVariables } = toNormalizedTimeSeries(unknown, { sourceTimezone: MADRID });

        expect(series).toEqual([]);
        expect(skippedVariables).toEqual(['ALGO_RARO.Validado']);
    });

    it('infers an hourly time step for a rain-gauge series', () => {
        const hourly: WiskiObservedRecord[] = [
            { variable: 'A005WI__01.Total.Horario', lastchange: '2026-08-11T14:00:00', value: 0 },
            { variable: 'A005WI__01.Total.Horario', lastchange: '2026-08-11T15:00:00', value: 0.4 },
            { variable: 'A005WI__01.Total.Horario', lastchange: '2026-08-11T16:00:00', value: 0 },
        ];

        const { series } = toNormalizedTimeSeries(hourly, { sourceTimezone: MADRID });

        expect(series[0].timeStep).toEqual({ unit: 'MINUTE', multiplier: 60 });
    });

    it('counts readings whose timestamp cannot be parsed instead of failing', () => {
        const broken: WiskiObservedRecord[] = [
            { variable: 'E_08VICT01.Validado', lastchange: 'not-a-date', value: 1 },
            { variable: 'E_08VICT01.Validado', lastchange: '2026-08-11T14:00:00', value: 2 },
        ];

        const { series, invalidEventCount } = toNormalizedTimeSeries(broken, { sourceTimezone: MADRID });

        expect(invalidEventCount).toBe(1);
        expect(series[0].events).toHaveLength(1);
    });

    it('returns nothing for an empty payload', () => {
        const { series } = toNormalizedTimeSeries([], { sourceTimezone: MADRID });

        expect(series).toEqual([]);
    });
});

describe('toWiskiTimeSeries()', () => {
    it('keeps the parameterId verbatim, as the calculator requires', () => {
        const { series } = toWiskiTimeSeries(TWO_READINGS, { sourceTimezone: MADRID });

        expect(series[0].header.parameterId).toBe('VICT01.Validado');
        expect(series[0].header.locationId).toBe('E_08');
    });

    it('splits the timestamp into the date/time pair the calculator expects', () => {
        const { series } = toWiskiTimeSeries(TWO_READINGS, { sourceTimezone: MADRID });

        expect(series[0].events[0]).toEqual({
            date: '2026-08-11',
            time: '11:45:00',
            value: '20.67',
            flag: '2',
        });
    });

    it('writes the miss value for an absent reading', () => {
        const missing: WiskiObservedRecord[] = [
            { variable: 'E_08VICT01.Validado', lastchange: '2026-08-11T13:45:00', value: null },
        ];

        const { series } = toWiskiTimeSeries(missing, { sourceTimezone: MADRID });

        expect(series[0].events[0].value).toBe('-999');
    });
});

describe('resolveVariable()', () => {
    /**
     * Every expectation here is ground truth read off the real Tagus_FlowCast.csv,
     * which carries "Station Number" and "Time series Name" as separate fields.
     * The last six are the cases that used to be split one letter too early: the
     * qualifier belongs to the station, not to the series.
     */
    it.each([
        ['E_08VICT01.Validado', 'E_08', 'VICT01.Validado', 'Hm3'],
        ['AR35FICT98.Validado', 'AR35', 'FICT98.Validado', 'm³/s'],
        ['A005WI__01.Total.Horario', 'A005', 'WI__01.Total.Horario', 'mm'],
        ['E_01FICT99_Calculado', 'E_01', 'FICT99_Calculado', 'm³/s'],
        ['AR42FI__01.Validado', 'AR42', 'FI__01.Validado', 'm³/s'],
        ['AC19MDWI__01.Horario', 'AC19MD', 'WI__01.Horario', 'mm'],
        ['AC19MIWI__01.Horario', 'AC19MI', 'WI__01.Horario', 'mm'],
        ['AC22IIBWI__01.Horario', 'AC22IIB', 'WI__01.Horario', 'mm'],
        ['AC22IIIBWI__01.Horario', 'AC22IIIB', 'WI__01.Horario', 'mm'],
        ['E_31AWI__01.Horario', 'E_31A', 'WI__01.Horario', 'mm'],
        ['E_31BWI__01.Horario', 'E_31B', 'WI__01.Horario', 'mm'],
    ])('splits %s into %s + %s (%s)', (variable, locationId, seriesName, units) => {
        expect(resolveVariable(variable)).toEqual({ locationId, seriesName, units });
    });

    it('returns null for a name that follows no known instrument code', () => {
        expect(resolveVariable('something-else')).toBeNull();
    });
});

describe('toIngestionParameterId()', () => {
    it('keeps the first segment and appends .historical', () => {
        expect(toIngestionParameterId('VICT01.Validado')).toBe('VICT01.historical');
        expect(toIngestionParameterId('WI__01.Total.Horario')).toBe('WI__01.historical');
    });
});
