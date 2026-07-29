/**
 * A manual-simulation input document, as ms-predictions-api generates it.
 *
 * Hand-authored here because the builder lives in the other service and this one
 * must not depend on it. The shape is a faithful copy of its output — envelope,
 * header keys and 15-minute event grid; that the real builder conforms to the
 * published PI-JSON schema is pinned on the predictions side by
 * `manual-simulation-file.schema.spec.ts`, which validates it against Deltares'
 * own schema file.
 *
 * Includes a CURVE maneuver (the 12-point series) alongside a FLAT one, because
 * the curve path is the one that is easy to forget exists.
 */

const PARAMETER_ID = 'Q.salida.forecast';
const TIME_STEP_SECONDS = '900';
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

interface FixtureEvent {
    date: string;
    time: string;
    value: string;
    flag: string;
}

function stamp(at: Date): { date: string; time: string } {
    const [date, rest] = at.toISOString().split('T');
    return { date, time: rest.slice(0, 8) };
}

/** A 15-minute grid of `count` points starting at `start`. */
function buildEvents(start: Date, count: number, valueAt: (index: number) => number): FixtureEvent[] {
    return Array.from({ length: count }, (_, index) => {
        const at = new Date(start.getTime() + index * FIFTEEN_MIN_MS);
        return { ...stamp(at), value: valueAt(index).toFixed(3), flag: '0' };
    });
}

function buildHeader(locationId: string, events: FixtureEvent[], forecast: { date: string; time: string }) {
    const first = events[0];
    const last = events[events.length - 1];
    return {
        type: 'instantaneous',
        moduleInstanceId: 'RunMIKE11_Forecast_TajoJar_web',
        locationId,
        parameterId: PARAMETER_ID,
        timeStep: { unit: 'second', multiplier: TIME_STEP_SECONDS },
        startDate: { date: first.date, time: first.time },
        endDate: { date: last.date, time: last.time },
        forecastDate: forecast,
        missVal: '-999.0',
        stationName: locationId,
        lat: '0.0',
        lon: '0.0',
        x: '0.0',
        y: '0.0',
        z: '0.0',
        units: 'm3/s',
    };
}

/** Builds the input document: one FLAT station and one CURVE station. */
export function buildManualSimulationFile(forecastDate = new Date('2026-07-29T00:00:00Z')) {
    const forecast = stamp(forecastDate);

    const flatEvents = buildEvents(forecastDate, 8, () => 12.5);
    // A gentle rise and fall, the same shape the backoffice demo curve produces.
    const curveEvents = buildEvents(forecastDate, 12, (index) => 5.25 + Math.sin((index / 11) * Math.PI) * 5.25 * 0.6);

    return {
        version: '1.34',
        timeZone: '0.0',
        timeSeries: [
            { header: buildHeader('E_09', flatEvents, forecast), events: flatEvents },
            { header: buildHeader('E_21', curveEvents, forecast), events: curveEvents },
        ],
    };
}
