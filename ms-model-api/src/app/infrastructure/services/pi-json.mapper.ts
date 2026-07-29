import { NormalizedTimeSeriesResult, TimeSeriesEventResult } from '@domain/results/normalized-timeseries.result';

/**
 * Maps FEWS PI-JSON to our normalized series. Pure and framework-free so it can
 * be unit-tested on its own, and shared by both ways a result reaches us: a file
 * dropped on the SFTP, and the REST API of the direct flow. The same payload
 * must be read identically either way.
 *
 * The tolerances here are not defensive programming, they are the actual FEWS
 * contract, learnt the hard way:
 *   - the five execution fields (forecastDate, moduleInstanceId, creationDate,
 *     creationTime, approvedDate) only exist on series a module produced; series
 *     outside the running model carry none of them
 *   - one unmappable series must never invalidate the whole payload
 *   - missVal is compared numerically, so "-999" and "-999.0" mean the same
 */

export interface MappedSeries {
    series: NormalizedTimeSeriesResult[];
    /** Series dropped because every event carried missVal (not modelled by FEWS). */
    skippedEmptySeries: number;
    /** Series dropped because their shape could not be mapped. */
    skippedInvalidSeries: number;
}

/** Reports a skipped series. Kept as a callback so this module stays logger-free. */
export type SkipReporter = (message: string, context: Record<string, unknown>) => void;

/**
 * Converts a FEWS `{ date, time }` pair into an ISO-8601 UTC string.
 * FEWS omits optional date blocks entirely, so absence is expected, not an error.
 */
export function toIsoUtc(dateTime: { date: string; time: string } | null | undefined): string | null {
    if (!dateTime?.date || !dateTime?.time) {
        return null;
    }

    return `${dateTime.date}T${dateTime.time}Z`;
}

function mapSingleSeries(entry: any): NormalizedTimeSeriesResult {
    const { header, events } = entry;
    const missValue = parseFloat(header.missVal);

    const mappedEvents: TimeSeriesEventResult[] = (events ?? []).map((event: any) => {
        const rawValue = parseFloat(event.value);
        const isMissing = Number.isNaN(rawValue) || rawValue === missValue;

        return new TimeSeriesEventResult({
            timestamp: `${event.date}T${event.time}Z`,
            value: isMissing ? 0 : rawValue,
            flag: parseInt(event.flag, 10),
            isMissing,
        });
    });

    const startDate = toIsoUtc(header.startDate);
    const endDate = toIsoUtc(header.endDate);

    if (!startDate || !endDate) {
        throw new Error(`Series "${header.locationId}/${header.parameterId}" is missing startDate or endDate`);
    }

    return new NormalizedTimeSeriesResult({
        locationId: header.locationId,
        parameterId: header.parameterId,
        moduleInstanceId: header.moduleInstanceId ?? '',
        stationName: header.stationName,
        lat: parseFloat(header.lat) || 0,
        lon: parseFloat(header.lon) || 0,
        x: parseFloat(header.x) || 0,
        y: parseFloat(header.y) || 0,
        z: parseFloat(header.z) || 0,
        units: header.units,
        timeStep: {
            unit: header.timeStep?.unit || 'hour',
            multiplier: parseInt(header.timeStep?.multiplier || '1', 10),
        },
        forecastDate: toIsoUtc(header.forecastDate),
        startDate,
        endDate,
        events: mappedEvents,
    });
}

/** Maps a whole PI-JSON payload, counting what had to be skipped. */
export function mapPiJsonToNormalized(data: unknown, reportSkip: SkipReporter): MappedSeries {
    const parsed = typeof data === 'string' ? JSON.parse(data) : (data as any);
    const seriesList = parsed?.timeSeries;

    if (!Array.isArray(seriesList)) {
        throw new Error('Malformed simulation result: "timeSeries" is missing or is not an array');
    }

    const series: NormalizedTimeSeriesResult[] = [];
    let skippedEmptySeries = 0;
    let skippedInvalidSeries = 0;

    for (const entry of seriesList) {
        let mapped: NormalizedTimeSeriesResult;

        try {
            mapped = mapSingleSeries(entry);
        } catch (error) {
            skippedInvalidSeries += 1;
            reportSkip('Skipping unmappable time series', {
                locationId: entry?.header?.locationId,
                parameterId: entry?.header?.parameterId,
                error: error instanceof Error ? error.message : String(error),
            });
            continue;
        }

        if (mapped.events.every((event) => event.isMissing)) {
            skippedEmptySeries += 1;
            continue;
        }

        series.push(mapped);
    }

    return { series, skippedEmptySeries, skippedInvalidSeries };
}
