import {
    buildManualSimulationFile,
    StationMeta,
    FileManeuverInput,
    DEFAULT_PARAMETER_ID,
    DEFAULT_MODULE_INSTANCE_ID,
    DEFAULT_HORIZON_DAYS,
} from './manual-simulation-file.builder';

/**
 * Unit coverage for the manual-simulation input file builder.
 * Each block maps to a concrete requirement from the modelling team (Idrica) email.
 */
describe('buildManualSimulationFile', () => {
    const forecastDate = new Date('2026-07-22T00:00:00Z');
    const now = new Date('2026-07-22T05:10:00Z');

    const alcorlo: StationMeta = {
        code: 'E_09',
        name: 'ALCORLO',
        latitude: 41.008652934448925,
        longitude: -3.0240949838231646,
        altitude: 924,
    };

    function build(maneuvers: FileManeuverInput[], stations: StationMeta[] = [alcorlo]) {
        const stationsByCode = stations.reduce<Record<string, StationMeta>>((acc, s) => {
            acc[s.code.toLowerCase()] = s;
            return acc;
        }, {});
        return buildManualSimulationFile({ maneuvers, stationsByCode, forecastDate, now });
    }

    // ── Single file, correct envelope ──────────────────────────────
    it('produces a single file with the FEWS envelope (version 1.34, timeZone 0.0)', () => {
        const { content } = build([{ reservoirCode: 'E_09', outputFlowValue: 20 }]);

        expect(content.version).toBe('1.34');
        expect(content.timeZone).toBe('0.0');
        expect(Array.isArray(content.timeSeries)).toBe(true);
    });

    // ── parameterId + locationId (import-critical) ─────────────────
    it('sets the import identifiers Idrica expects and locationId to the station code', () => {
        const { content } = build([{ reservoirCode: 'E_09', outputFlowValue: 20 }]);
        const header = (content.timeSeries[0] as { header: Record<string, unknown> }).header;

        expect(header.parameterId).toBe(DEFAULT_PARAMETER_ID);
        expect(header.parameterId).toBe('Q.salida.forecast.web');
        expect(header.locationId).toBe('E_09');
        expect(header.moduleInstanceId).toBe(DEFAULT_MODULE_INSTANCE_ID);
        expect(header.moduleInstanceId).toBe('ImportAPI_Q_mod');
        expect(header.type).toBe('instantaneous');
        expect(header.units).toBe('m3/s');
        expect(header.timeStep).toEqual({ unit: 'second', multiplier: '900' });
    });

    it('lets the caller override the import identifiers, so a change on the FEWS side is an env change', () => {
        const stationsByCode = { e_09: alcorlo };
        const { content } = buildManualSimulationFile({
            maneuvers: [{ reservoirCode: 'E_09', outputFlowValue: 20 }],
            stationsByCode,
            forecastDate,
            now,
            moduleInstanceId: 'Other_Module',
            parameterId: 'Q.salida.forecast',
        });
        const header = (content.timeSeries[0] as { header: Record<string, unknown> }).header;

        expect(header.moduleInstanceId).toBe('Other_Module');
        expect(header.parameterId).toBe('Q.salida.forecast');
    });

    // ── Header enrichment from the hydro catalog ───────────────────
    it('enriches the header with station name and geo from the catalog', () => {
        const { content } = build([{ reservoirCode: 'E_09', outputFlowValue: 20 }]);
        const header = (content.timeSeries[0] as { header: Record<string, unknown> }).header;

        expect(header.stationName).toBe('E_09 ALCORLO');
        expect(header.lat).toBe('41.008652934448925');
        expect(header.lon).toBe('-3.0240949838231646');
        expect(header.z).toBe('924');
    });

    it('falls back to placeholders when the station is not in the catalog', () => {
        const { content } = build([{ reservoirCode: 'E_99', outputFlowValue: 20 }], []);
        const header = (content.timeSeries[0] as { header: Record<string, unknown> }).header;

        expect(header.locationId).toBe('E_99');
        expect(header.stationName).toBe('E_99');
        expect(header.lat).toBe('0.0');
        expect(header.x).toBe('0.0');
        expect(header.y).toBe('0.0');
    });

    // ── Filename = date of the first time step + .json ─────────────
    it('names the file with the first time step of the series', () => {
        const { fileName } = build([
            {
                reservoirCode: 'E_09',
                outputFlowValue: 20,
                startDate: '2026-07-22T00:00:00Z',
                endDate: '2026-07-25T00:00:00Z',
            },
        ]);

        expect(fileName).toBe('Q_mod_input_202607220000.json');
    });

    // ── FLAT: complete 15-min grid over the modified window ────────
    it('fills a complete 15-minute grid for the flat window (3 days → 289 events, inclusive)', () => {
        const { content } = build([
            {
                reservoirCode: 'E_09',
                outputFlowValue: 20.011,
                startDate: '2026-07-22T00:00:00Z',
                endDate: '2026-07-25T00:00:00Z',
            },
        ]);
        const series = content.timeSeries[0] as {
            events: Array<{ date: string; time: string; value: string; flag: string }>;
        };

        expect(series.events).toHaveLength(289); // 3 days * 96 + 1
        expect(series.events[0]).toEqual({ date: '2026-07-22', time: '00:00:00', value: '20.011', flag: '0' });
        expect(series.events[1].time).toBe('00:15:00');
        expect(series.events[series.events.length - 1]).toEqual({
            date: '2026-07-25',
            time: '00:00:00',
            value: '20.011',
            flag: '0',
        });
        // grid continuity: every step is exactly 15 min apart
        for (let i = 1; i < series.events.length; i++) {
            const prev = new Date(`${series.events[i - 1].date}T${series.events[i - 1].time}Z`).getTime();
            const cur = new Date(`${series.events[i].date}T${series.events[i].time}Z`).getTime();
            expect(cur - prev).toBe(15 * 60 * 1000);
        }
    });

    it('snaps the flat grid to :00/:15/:30/:45 even when the window starts on an odd second', () => {
        const oddForecast = new Date('2026-07-22T05:23:47Z');
        const stationsByCode = { e_09: alcorlo };
        const { content } = buildManualSimulationFile({
            maneuvers: [{ reservoirCode: 'E_09', outputFlowValue: 20 }],
            stationsByCode,
            forecastDate: oddForecast,
            now,
        });
        const header = (content.timeSeries[0] as { header: Record<string, unknown> }).header;
        const series = content.timeSeries[0] as { events: Array<{ time: string }> };

        // start floored from 05:23:47 → 05:15:00; forecastDate in header also aligned
        expect(series.events[0].time).toBe('05:15:00');
        expect((header.forecastDate as { time: string }).time).toBe('05:15:00');
        // every tick lands on a quarter-hour boundary
        for (const e of series.events) {
            expect(['00', '15', '30', '45']).toContain(e.time.substring(3, 5));
            expect(e.time.substring(6, 8)).toBe('00');
        }
    });

    it('defaults the flat window to the forecast horizon when no endDate is given', () => {
        const { content } = build([{ reservoirCode: 'E_09', outputFlowValue: 15 }]);
        const series = content.timeSeries[0] as { events: unknown[] };

        // forecastDate → forecastDate + DEFAULT_HORIZON_DAYS at 15 min, inclusive
        expect(series.events).toHaveLength(DEFAULT_HORIZON_DAYS * 96 + 1);
    });

    // ── CURVE: passthrough of the visor series ─────────────────────
    it('passes a provided curve through verbatim, ordered, taking precedence over outputFlowValue', () => {
        const { content } = build([
            {
                reservoirCode: 'E_09',
                outputFlowValue: 999, // must be ignored when a curve is present
                series: [
                    { date: '2026-07-22', time: '00:15:00', value: 20.011, flag: 0 },
                    { date: '2026-07-22', time: '00:00:00', value: 20.004 }, // out of order on purpose
                    { date: '2026-07-22', time: '00:30:00', value: 20.02, flag: 2 },
                ],
            },
        ]);
        const series = content.timeSeries[0] as {
            events: Array<{ date: string; time: string; value: string; flag: string }>;
        };

        expect(series.events).toHaveLength(3);
        expect(series.events[0]).toEqual({ date: '2026-07-22', time: '00:00:00', value: '20.004', flag: '0' });
        expect(series.events[1]).toEqual({ date: '2026-07-22', time: '00:15:00', value: '20.011', flag: '0' });
        expect(series.events[2]).toEqual({ date: '2026-07-22', time: '00:30:00', value: '20.02', flag: '2' });
    });

    // ── Multiple stations in one file ──────────────────────────────
    it('emits one timeSeries per modified station in the same file', () => {
        const jarama: StationMeta = { code: 'E_10', name: 'EL VADO', latitude: 40.9, longitude: -3.3, altitude: 900 };
        const { content } = build(
            [
                {
                    reservoirCode: 'E_09',
                    outputFlowValue: 20,
                    startDate: '2026-07-22T00:00:00Z',
                    endDate: '2026-07-22T01:00:00Z',
                },
                {
                    reservoirCode: 'E_10',
                    outputFlowValue: 5,
                    startDate: '2026-07-22T00:00:00Z',
                    endDate: '2026-07-22T01:00:00Z',
                },
            ],
            [alcorlo, jarama],
        );

        expect(content.timeSeries).toHaveLength(2);
        const locationIds = content.timeSeries.map((s) => (s as { header: { locationId: string } }).header.locationId);
        expect(locationIds).toEqual(['E_09', 'E_10']);
    });

    it('names the file after the earliest first step across all stations', () => {
        const { fileName } = build(
            [
                {
                    reservoirCode: 'E_09',
                    outputFlowValue: 20,
                    startDate: '2026-07-23T00:00:00Z',
                    endDate: '2026-07-23T01:00:00Z',
                },
                {
                    reservoirCode: 'E_10',
                    outputFlowValue: 5,
                    startDate: '2026-07-22T06:00:00Z',
                    endDate: '2026-07-22T07:00:00Z',
                },
            ],
            [alcorlo, { code: 'E_10', name: 'EL VADO', latitude: 40.9, longitude: -3.3, altitude: 900 }],
        );

        expect(fileName).toBe('Q_mod_input_202607220600.json');
    });

    it('throws when a flat maneuver has endDate before startDate', () => {
        expect(() =>
            build([
                {
                    reservoirCode: 'E_09',
                    outputFlowValue: 20,
                    startDate: '2026-07-25T00:00:00Z',
                    endDate: '2026-07-22T00:00:00Z',
                },
            ]),
        ).toThrow(/endDate is before startDate/);
    });
});
