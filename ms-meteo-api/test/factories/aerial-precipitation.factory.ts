import { AerialPrecipitationSeries } from '../../src/app/domain/entities/aerial-precipitation-series.entity';
import { AerialPrecipitationEvent } from '../../src/app/domain/entities/aerial-precipitation-event.entity';

// ─── FEWS JSON shape types ────────────────────────────────────────────────────

export interface FewsTimeStepDto {
    unit: string;
    multiplier: string;
}

export interface FewsDateTimeDto {
    date: string; // YYYY-MM-DD
    time: string; // HH:MM:SS
}

export interface FewsHeaderDto {
    type: string;
    moduleInstanceId: string;
    locationId: string;
    parameterId: string;
    timeStep: FewsTimeStepDto;
    startDate: FewsDateTimeDto;
    endDate: FewsDateTimeDto;
    forecastDate: FewsDateTimeDto;
    missVal: string;
    stationName: string;
    lat: string;
    lon: string;
    units: string;
    creationDate: string;
    creationTime: string;
    approvedDate: FewsDateTimeDto;
}

export interface FewsEventDto {
    date: string;
    time: string;
    value: string;
    flag: string;
}

export interface FewsTimeSeriesDto {
    header: FewsHeaderDto;
    events: FewsEventDto[];
}

export interface FewsPayloadDto {
    version: string;
    timeZone: string;
    timeSeries: FewsTimeSeriesDto[];
}

// ─── Counter for unique offsets ───────────────────────────────────────────────

let _counter = 0;
function nextCounter(): number {
    return ++_counter;
}

/** Resets the internal counter — call this in beforeEach if needed. */
export function resetAerialPrecipFactoryCounter(): void {
    _counter = 0;
}

// ─── FEWS builders ────────────────────────────────────────────────────────────

/**
 * Builds a minimal FEWS header DTO with sensible defaults.
 * Each call increments an internal counter so concurrent tests don't collide.
 */
export function buildFewsHeader(overrides?: Partial<FewsHeaderDto>): FewsHeaderDto {
    const n = nextCounter();
    const forecastDateStr = new Date(Date.UTC(2026, 6, 14 + n)).toISOString().slice(0, 10);

    return {
        type: 'accumulative',
        moduleInstanceId: 'Processing_Catchment_EPS',
        locationId: `Cuenca.NAM.E_${String(n).padStart(2, '0')}`,
        parameterId: 'P.areal.ens.subcNAM.Med.24h',
        timeStep: { unit: 'second', multiplier: '3600' },
        startDate: { date: forecastDateStr, time: '01:00:00' },
        endDate: { date: forecastDateStr, time: '03:00:00' },
        forecastDate: { date: forecastDateStr, time: '00:00:00' },
        missVal: '-999.0',
        stationName: `STATION_${n}`,
        lat: '40.0',
        lon: '-2.5',
        units: 'mm',
        creationDate: forecastDateStr,
        creationTime: '10:00:00',
        approvedDate: { date: forecastDateStr, time: '10:05:00' },
        ...overrides,
    };
}

/**
 * Builds a single FEWS event DTO.
 * @param index — used to offset the event time so each event in a series is unique.
 */
export function buildFewsEvent(overrides?: Partial<FewsEventDto> & { index?: number }): FewsEventDto {
    const { index = 0, ...rest } = overrides ?? {};
    const hour = String(1 + index).padStart(2, '0');
    return {
        date: '2026-07-14',
        time: `${hour}:00:00`,
        value: (1.5 + index * 0.1).toFixed(2),
        flag: '2',
        ...rest,
    };
}

/**
 * Builds a FEWS timeSeries entry (header + events).
 */
export function buildFewsTimeSeries(params?: {
    header?: Partial<FewsHeaderDto>;
    events?: FewsEventDto[];
    count?: number;
}): FewsTimeSeriesDto {
    const header = buildFewsHeader(params?.header);
    const count = params?.count ?? 3;
    const events = params?.events ?? Array.from({ length: count }, (_, i) => buildFewsEvent({ index: i }));
    return { header, events };
}

/**
 * Builds a full FEWS JSON payload.
 */
export function buildFewsPayload(params?: { series?: FewsTimeSeriesDto[] }): FewsPayloadDto {
    const timeSeries = params?.series ?? [buildFewsTimeSeries()];
    return {
        version: '1.34',
        timeZone: '0.0',
        timeSeries,
    };
}

// ─── Domain entity builders ───────────────────────────────────────────────────

/**
 * Builds an `AerialPrecipitationSeries` entity ready to persist.
 * Does NOT call `validate()` — let the test decide whether to call it.
 */
export function buildSeriesEntity(overrides?: Partial<AerialPrecipitationSeries>): AerialPrecipitationSeries {
    const n = nextCounter();
    const forecastDate = new Date(Date.UTC(2026, 6, 14 + (n % 30)));

    return new AerialPrecipitationSeries({
        locationId: `Cuenca.NAM.E_${String(n).padStart(2, '0')}`,
        parameterId: 'P.areal.ens.subcNAM.Med.24h',
        forecastDate,
        provider: 'ens',
        layer: 'subcNAM',
        stat: 'Med',
        accumulation: '24h',
        moduleInstanceId: 'Processing_Catchment_EPS',
        stationName: `STATION_${n}`,
        lat: 40.0 + n * 0.01,
        lon: -2.5 - n * 0.01,
        startDate: new Date(Date.UTC(2026, 6, 14 + (n % 30), 1)),
        endDate: new Date(Date.UTC(2026, 6, 17 + (n % 30), 1)),
        units: 'mm',
        missVal: -999,
        timeStepSeconds: 3600,
        creationDate: new Date(Date.UTC(2026, 6, 14)),
        approvedDate: new Date(Date.UTC(2026, 6, 14, 10, 5)),
        sourceFileName: `tagus_eps_Pareal_2026071400${String(n).padStart(2, '0')}.json`,
        ...overrides,
    });
}

/**
 * Builds an `AerialPrecipitationEvent` entity for a given seriesId.
 */
export function buildEventEntity(
    params: { seriesId: string } & Partial<AerialPrecipitationEvent>,
): AerialPrecipitationEvent {
    const { seriesId, ...overrides } = params;
    const n = nextCounter();
    return new AerialPrecipitationEvent({
        seriesId,
        eventDate: new Date(Date.UTC(2026, 6, 14, n % 24)),
        value: 1.5 + n * 0.1,
        flag: 2,
        ...overrides,
    });
}
