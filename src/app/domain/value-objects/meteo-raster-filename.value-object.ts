/**
 * Parses raster filenames of the form `<prefix>0000.<NNN>`,
 * e.g. `radarprec0000.005`, `harm_temp0000.047`, `eps_pmedia0000.000`.
 *
 * The 3-digit step suffix is the only structural information we need;
 * the prefix is provider/variable specific and ignored here.
 */
const RASTER_REGEX = /^(?<prefix>[A-Za-z0-9_]+?)0000\.(?<step>\d{3})$/;

export class MeteoRasterFilenameValueObject {
    public readonly raw: string;
    public readonly prefix: string;
    public readonly step: number;

    private constructor(raw: string, prefix: string, step: number) {
        this.raw = raw;
        this.prefix = prefix;
        this.step = step;
    }

    /**
     * Returns the parsed value object, or `null` if the filename is not a meteo raster
     * (e.g. `info.json`, `radar_info.xml`).
     */
    static parse(filename: string): MeteoRasterFilenameValueObject | null {
        const match = RASTER_REGEX.exec(filename);
        if (!match || !match.groups) {
            return null;
        }
        const step = Number(match.groups.step);
        if (!Number.isInteger(step) || step < 0) {
            return null;
        }
        return new MeteoRasterFilenameValueObject(filename, match.groups.prefix, step);
    }

    toString(): string {
        return this.raw;
    }
}
