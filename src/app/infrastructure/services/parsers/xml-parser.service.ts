import { XMLParser } from 'fast-xml-parser';

export interface ParsedRow {
    [key: string]: string | number | boolean | null;
}

/**
 * Parses FEWS PI TimeSeries XML format.
 * Flattens multi-series: each event row includes header metadata fields.
 */
export class XmlParserService {
    private readonly parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            isArray: (tagName: string) => tagName === 'series' || tagName === 'event',
        });
    }

    parse(data: Buffer): ParsedRow[] {
        const parsed = this.parser.parse(data);
        const timeSeries = parsed?.TimeSeries;
        if (!timeSeries) {
            return [];
        }

        const seriesArray: unknown[] = Array.isArray(timeSeries.series)
            ? timeSeries.series
            : timeSeries.series
              ? [timeSeries.series]
              : [];

        const rows: ParsedRow[] = [];

        for (const series of seriesArray) {
            const s = series as Record<string, unknown>;
            const header = (s.header ?? {}) as Record<string, unknown>;
            const headerFlat = this.flattenHeader(header);

            const events: unknown[] = Array.isArray(s.event) ? s.event : s.event ? [s.event] : [];

            for (const event of events) {
                const evt = event as Record<string, unknown>;
                const row: ParsedRow = { ...headerFlat };

                // event attributes: @_date, @_time, @_value, @_flag
                if (evt['@_date'] !== undefined) row.date = String(evt['@_date']);
                if (evt['@_time'] !== undefined) row.time = String(evt['@_time']);
                if (evt['@_value'] !== undefined) row.value = String(evt['@_value']);
                if (evt['@_flag'] !== undefined) row.flag = String(evt['@_flag']);

                rows.push(row);
            }
        }

        return rows;
    }

    private flattenHeader(header: Record<string, unknown>): ParsedRow {
        const flat: ParsedRow = {};
        for (const [key, value] of Object.entries(header)) {
            if (value === null || value === undefined) continue;
            if (typeof value === 'object' && !Array.isArray(value)) {
                // Nested objects like timeStep: flatten attributes
                const obj = value as Record<string, unknown>;
                for (const [subKey, subVal] of Object.entries(obj)) {
                    const cleanKey = subKey.replace('@_', '');
                    flat[`${key}_${cleanKey}`] = subVal != null ? String(subVal) : null;
                }
            } else {
                flat[key] =
                    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
                        ? value
                        : String(value);
            }
        }
        return flat;
    }
}
