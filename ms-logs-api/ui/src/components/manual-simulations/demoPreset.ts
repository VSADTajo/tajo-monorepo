import type { ManeuverDraft } from './types';

/**
 * Prefilled maneuvers for the Mock ("demo") mode.
 *
 * Mock replays a reference FEWS output, and that output only carries real values
 * for the reservoirs the Jarama-Henares model actually computes. Loading three
 * arbitrary reservoirs would produce a run that finishes with nothing to show,
 * so the preset uses the same ones as the reference: E_09, E_15 and E_21 — the
 * three modified in the real 27-jul simulation.
 *
 * One of them is filled as a CURVE so the demo also exercises that path, which
 * is otherwise easy to forget it exists.
 */

const DEMO_RESERVOIRS = {
    flat: [
        { code: 'E_09', flow: '12.5' },
        { code: 'E_15', flow: '8' },
    ],
    curve: { code: 'E_21', base: 5.25 },
};

/** Points of the demo curve — 3 hours at 15-minute steps. */
const CURVE_POINTS = 12;
const STEP_MINUTES = 15;

/**
 * Formats a Date as the "YYYY-MM-DD HH:MM:SS" the curve parser reads — in UTC.
 *
 * UTC is not a detail: the backend parses these stamps as `<date>T<time>Z` and
 * the generated file declares `timeZone: "0.0"`. Writing them with local getters
 * shifted the whole curve by the browser's offset, which on a UTC-3 machine put
 * it three hours before the simulation's forecast date — the curve landed
 * entirely outside the forecast window and could not influence the run.
 */
function formatPoint(date: Date): string {
    const iso = date.toISOString();
    return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
}

/**
 * Builds a curve starting at the next quarter-hour, so the dates always look
 * current instead of frozen at whenever this was written. Rounded in UTC for the
 * same reason the stamps are written in UTC.
 */
function buildDemoCurve(base: number, now: Date): string {
    const start = new Date(now);
    start.setUTCSeconds(0, 0);
    start.setUTCMinutes(Math.ceil(start.getUTCMinutes() / STEP_MINUTES) * STEP_MINUTES);

    const lines: string[] = [];
    for (let i = 0; i < CURVE_POINTS; i += 1) {
        const at = new Date(start.getTime() + i * STEP_MINUTES * 60 * 1000);
        // A gentle rise and fall — enough shape to be visibly a curve, not a flat line.
        const value = base + Math.sin((i / (CURVE_POINTS - 1)) * Math.PI) * base * 0.6;
        lines.push(`${formatPoint(at)};${value.toFixed(3)}`);
    }
    return lines.join('\n');
}

let demoSeq = 0;

/** Returns the demo maneuvers, ready to drop into the form. */
export function buildDemoManeuvers(now: Date = new Date()): ManeuverDraft[] {
    const maneuvers: ManeuverDraft[] = DEMO_RESERVOIRS.flat.map((reservoir) => {
        demoSeq += 1;
        return {
            id: `demo-${demoSeq}`,
            reservoirCode: reservoir.code,
            mode: 'FLAT',
            outputFlowValue: reservoir.flow,
            seriesText: '',
            startDate: '',
            endDate: '',
        };
    });

    demoSeq += 1;
    maneuvers.push({
        id: `demo-${demoSeq}`,
        reservoirCode: DEMO_RESERVOIRS.curve.code,
        mode: 'CURVE',
        outputFlowValue: '',
        seriesText: buildDemoCurve(DEMO_RESERVOIRS.curve.base, now),
        startDate: '',
        endDate: '',
    });

    return maneuvers;
}

/** True when the operator has not entered anything yet, so autofilling loses no work. */
export function isPristine(maneuvers: ManeuverDraft[]): boolean {
    return maneuvers.every(
        (maneuver) =>
            !maneuver.reservoirCode &&
            !maneuver.outputFlowValue &&
            !maneuver.seriesText.trim() &&
            !maneuver.startDate &&
            !maneuver.endDate,
    );
}
