import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────
// Balance Computed Event — factory for tests
// Mirrors the shape published by the volume-balance calculator
// on exchange `simulation-events`, routing key `simulation.manual.balance.computed`.
// ─────────────────────────────────────────────────────────────

export interface BalanceEventRaw {
    date: string;
    time: string;
    value: string;
    flag: string;
}

export interface BalanceTimeSeriesHeader {
    type: string;
    moduleInstanceId: string;
    locationId: string;
    parameterId: string;
    timeStep: { unit: string; multiplier: string };
    startDate: { date: string; time: string };
    endDate: { date: string; time: string };
    forecastDate: { date: string; time: string };
    missVal: string;
    stationName: string;
    units: string;
    creationDate: string;
    creationTime: string;
    approvedDate: { date: string; time: string };
}

export interface BalanceTimeSeries {
    header: BalanceTimeSeriesHeader;
    events: BalanceEventRaw[];
}

export interface SimulationBalanceComputedPayload {
    simulationId: string;
    providerName: string;
    seriesCount: number;
    eventsCount: number;
    computedAt: string;
    timeSeries: BalanceTimeSeries[];
}

/** Parameters accepted by the calculator — one per series. */
const BALANCE_PARAMETERS = [
    'v.balance.q.in.for.harmonie',
    'v.balance.q.in.for.eps.10',
    'v.balance.q.in.for.eps.25',
    'v.balance.q.in.for.eps.50',
    'v.balance.q.in.for.eps.75',
    'v.balance.q.in.for.eps.90',
] as const;

function buildBalanceEvents(locationId: string, missVal = '-999.0'): BalanceEventRaw[] {
    // 3 valid events + 1 missing-value event
    return [
        { date: '2026-07-05', time: '01:00:00', value: '12.5', flag: '0' },
        { date: '2026-07-05', time: '02:00:00', value: '14.2', flag: '0' },
        { date: '2026-07-05', time: '03:00:00', value: missVal, flag: '8' },
        { date: '2026-07-05', time: '04:00:00', value: '11.0', flag: '0' },
    ];
}

function buildTimeSeries(locationId: string, parameterId: string, missVal = '-999.0'): BalanceTimeSeries {
    return {
        header: {
            type: 'instantaneous',
            moduleInstanceId: 'volume_calculator',
            locationId,
            parameterId,
            timeStep: { unit: 'second', multiplier: '3600' },
            startDate: { date: '2026-07-05', time: '00:00:00' },
            endDate: { date: '2026-07-15', time: '00:00:00' },
            forecastDate: { date: '2026-07-05', time: '00:00:00' },
            missVal,
            stationName: `Reservoir ${locationId}`,
            units: 'hm3',
            creationDate: '2026-07-05',
            creationTime: '12:00:00',
            approvedDate: { date: '2026-07-05', time: '12:00:00' },
        },
        events: buildBalanceEvents(locationId, missVal),
    };
}

/**
 * Build a well-formed `SimulationBalanceComputedPayload` with 6 series
 * (one per confirmed balance parameter). Pass `overrides` to customise any
 * top-level field or replace the `timeSeries` array entirely.
 */
export function buildBalanceComputedPayload(
    overrides?: Partial<SimulationBalanceComputedPayload>,
): SimulationBalanceComputedPayload {
    const locationId = 'E_08';
    const defaultTimeSeries: BalanceTimeSeries[] = BALANCE_PARAMETERS.map((parameterId) =>
        buildTimeSeries(locationId, parameterId),
    );

    return {
        simulationId: uuidv4(),
        providerName: 'volume-calculator',
        seriesCount: defaultTimeSeries.length,
        eventsCount: defaultTimeSeries.length * 4,
        computedAt: '2026-07-05T12:00:00Z',
        timeSeries: defaultTimeSeries,
        ...overrides,
    };
}

/**
 * Build a minimal single-series payload for simpler unit test cases.
 */
export function buildSingleSeriesPayload(
    parameterId = 'v.balance.q.in.for.harmonie',
    overrides?: Partial<SimulationBalanceComputedPayload>,
): SimulationBalanceComputedPayload {
    return buildBalanceComputedPayload({
        timeSeries: [buildTimeSeries('E_08', parameterId)],
        seriesCount: 1,
        eventsCount: 4,
        ...overrides,
    });
}
