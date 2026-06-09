/**
 * Computes deterministic file paths for the GeoTIFFs that the meteo
 * pipeline writes to disk and registers as ImageMosaic granules.
 *
 * Convention:
 *   <baseDir>/<layer>/<layer>_<yyyyMMddTHHmmss>.tif
 *
 * The timestamp suffix is the same format that
 * `infrastructure/geoserver/.../timeregex.properties` extracts back from
 * the filename, so the round-trip is consistent.
 *
 * Lives in the domain layer on purpose: this is naming policy, not I/O.
 * No `node:path` is used so the file is framework-free.
 */
export class GeoTiffPathValueObject {
    private constructor(public readonly absolute: string) {}

    static compose(baseDir: string, layer: string, timestamp: Date): GeoTiffPathValueObject {
        const normalizedBase = baseDir.replace(/\/+$/, '');
        const filename = `${layer}_${GeoTiffPathValueObject.formatTimestamp(timestamp)}.tif`;
        return new GeoTiffPathValueObject(`${normalizedBase}/${layer}/${filename}`);
    }

    static directoryFor(baseDir: string, layer: string): string {
        const normalizedBase = baseDir.replace(/\/+$/, '');
        return `${normalizedBase}/${layer}`;
    }

    /** yyyyMMddHHmmss in UTC (14 consecutive digits, no separator). Matches `timeregex.properties`. */
    static formatTimestamp(date: Date): string {
        const pad = (n: number): string => String(n).padStart(2, '0');
        return (
            String(date.getUTCFullYear()) +
            pad(date.getUTCMonth() + 1) +
            pad(date.getUTCDate()) +
            pad(date.getUTCHours()) +
            pad(date.getUTCMinutes()) +
            pad(date.getUTCSeconds())
        );
    }

    toString(): string {
        return this.absolute;
    }
}
