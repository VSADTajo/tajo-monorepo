import { buildManualSimulationFile, FileManeuverInput, StationMeta } from './manual-simulation-file.builder';

/**
 * Pins the timezone contract of a pasted curve.
 *
 * Curve stamps are read as UTC (`<date>T<time>Z`) and the generated file declares
 * `timeZone: "0.0"`, so a curve is only in the forecast window if its stamps are
 * UTC too. Nothing said so out loud, and the backoffice demo preset wrote them
 * with local getters: on a UTC-3 browser the whole curve landed three hours
 * before the simulation's forecast date, outside the horizon, where it could not
 * influence the run. The values were right and the file validated — only the
 * clock was wrong, which is why nothing caught it.
 *
 * The backoffice has no test runner, so the guard lives here, on the side that
 * defines the interpretation.
 */
describe('buildManualSimulationFile — curve timezone', () => {
    const forecastDate = new Date('2026-07-29T23:15:00Z');
    const now = new Date('2026-07-29T23:15:30Z');

    const station: StationMeta = {
        code: 'E_21',
        name: 'EL PARDO',
        latitude: 40.5,
        longitude: -3.7,
        altitude: 600,
    };

    function build(maneuvers: FileManeuverInput[]) {
        return buildManualSimulationFile({
            maneuvers,
            stationsByCode: { e_21: station },
            forecastDate,
            now,
        });
    }

    /** A curve whose stamps are UTC, starting exactly at the forecast moment. */
    function utcCurve(points: number): FileManeuverInput {
        return {
            reservoirCode: 'E_21',
            outputFlowValue: 5.25,
            series: Array.from({ length: points }, (_, index) => {
                const at = new Date(forecastDate.getTime() + index * 15 * 60 * 1000);
                const iso = at.toISOString();
                return { date: iso.slice(0, 10), time: iso.slice(11, 19), value: 5 + index };
            }),
        };
    }

    it('reads curve stamps as UTC, so a curve at the forecast moment starts there', () => {
        const { content } = build([utcCurve(4)]);
        const header = (content.timeSeries[0] as { header: Record<string, { date: string; time: string }> }).header;

        expect(header.startDate).toEqual({ date: '2026-07-29', time: '23:15:00' });
        expect(header.forecastDate).toEqual({ date: '2026-07-29', time: '23:15:00' });
    });

    it('keeps the curve inside the forecast window', () => {
        // The property the demo preset broke: every event at or after the forecast
        // date. A curve entirely in the past is accepted by the schema and then
        // ignored by the model, which is the worst kind of failure — silent.
        const { content } = build([utcCurve(12)]);
        const events = (content.timeSeries[0] as { events: { date: string; time: string }[] }).events;

        for (const event of events) {
            expect(new Date(`${event.date}T${event.time}Z`).getTime()).toBeGreaterThanOrEqual(forecastDate.getTime());
        }
    });

    it('names the file after the earliest step, in UTC', () => {
        const { fileName } = build([utcCurve(4)]);

        // 202607292315, not the local-time 202607292015 a UTC-3 browser produced.
        expect(fileName).toBe('Q_mod_input_202607292315.json');
    });

    it('shows what a local-time curve does: it falls before the horizon', () => {
        // Documents the bug rather than asserting the broken behaviour is fine —
        // if someone writes local stamps again, this explains the symptom.
        const threeHoursEarly = utcCurve(4);
        threeHoursEarly.series = threeHoursEarly.series!.map((point) => ({ ...point, time: '20:15:00' }));

        const { content } = build([threeHoursEarly]);
        const events = (content.timeSeries[0] as { events: { date: string; time: string }[] }).events;

        expect(new Date(`${events[0].date}T${events[0].time}Z`).getTime()).toBeLessThan(forecastDate.getTime());
    });
});
