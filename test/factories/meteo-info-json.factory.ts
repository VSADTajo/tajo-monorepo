/**
 * Builders for synthetic info.json content used by e2e tests.
 *
 * The shape mirrors what providers actually deposit in the SFTP.
 * Use `buildInfoJson(...)` for an in-memory object and `buildInfoJsonRaw(...)`
 * for the JSON string the test will hand to the InMemorySftpFileClient.
 */

export interface InfoJsonOverrides {
    nombre?: string;
    fecha_inicio?: string; // YYYYMMDDHHMM
    fecha_fin?: string; // YYYYMMDDHHMM
    paso_de_tiempo?: number;
    unidad?: string;
    ncols?: number;
    nrows?: number;
    xtopleft?: number;
    ytopleft?: number;
    xbottomright?: number;
    ybottomright?: number;
    cellsize?: number;
    NODATA?: number;
}

export function buildInfoJson(overrides: InfoJsonOverrides = {}): Record<string, unknown> {
    return {
        nombre: 'Precipitación',
        fecha_inicio: '202604061200',
        fecha_fin: '202604081100',
        paso_de_tiempo: 60,
        unidad: 'mm',
        ncols: 677,
        nrows: 280,
        xtopleft: -7.5438,
        ytopleft: 41.3045,
        xbottomright: -1.4508,
        ybottomright: 38.7845,
        cellsize: 0.009,
        NODATA: -999.0,
        ...overrides,
    };
}

export function buildInfoJsonRaw(overrides: InfoJsonOverrides = {}): string {
    return JSON.stringify(buildInfoJson(overrides));
}

/**
 * Generates the 48 hourly raster filenames for a given prefix
 * (e.g. 'radarprec', 'harm_prec', 'eps_pmedia').
 */
export function buildRasterFilenames(prefix: string, count = 48): string[] {
    return Array.from({ length: count }, (_, i) => `${prefix}0000.${String(i).padStart(3, '0')}`);
}
