import { EntityError } from '@domain/errors/entity.error';

/**
 * Raw shape of an info.json file as written by providers.
 * Field names match the SFTP convention (Spanish, snake_case).
 */
export interface RawMeteoInfoJson {
    nombre: string;
    fecha_inicio: string; // YYYYMMDDHHMM
    fecha_fin: string; // YYYYMMDDHHMM
    paso_de_tiempo: number; // minutes
    unidad: string;
    ncols: number;
    nrows: number;
    xtopleft: number;
    ytopleft: number;
    xbottomright: number;
    ybottomright: number;
    cellsize: number;
    NODATA: number;
}

export interface MeteoBbox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

const REQUIRED_FIELDS: Array<keyof RawMeteoInfoJson> = [
    'nombre',
    'fecha_inicio',
    'fecha_fin',
    'paso_de_tiempo',
    'unidad',
    'ncols',
    'nrows',
    'xtopleft',
    'ytopleft',
    'xbottomright',
    'ybottomright',
    'cellsize',
    'NODATA',
];

const FECHA_REGEX = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/;

function parseFecha(raw: string, field: string): Date {
    const match = FECHA_REGEX.exec(raw);
    if (!match) {
        throw new EntityError(`Invalid ${field} format: "${raw}" (expected YYYYMMDDHHMM)`, field);
    }
    const [, y, mo, d, h, mi] = match;
    const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), 0));
    if (Number.isNaN(date.getTime())) {
        throw new EntityError(`Invalid ${field}: "${raw}" is not a real date`, field);
    }
    return date;
}

/**
 * Parsed and validated info.json. Construct from `MeteoInfoJsonValueObject.parse(rawString)`
 * or `new MeteoInfoJsonValueObject(rawObject)`.
 */
export class MeteoInfoJsonValueObject {
    public readonly nombre: string;
    public readonly fechaInicio: Date;
    public readonly fechaFin: Date;
    public readonly pasoDeTiempo: number;
    public readonly unidad: string;
    public readonly ncols: number;
    public readonly nrows: number;
    public readonly cellsize: number;
    public readonly nodata: number;
    private readonly _bbox: MeteoBbox;

    constructor(raw: unknown) {
        if (raw === null || typeof raw !== 'object') {
            throw new EntityError('info.json must be an object');
        }
        const obj = raw as Record<string, unknown>;

        for (const field of REQUIRED_FIELDS) {
            if (obj[field] === undefined || obj[field] === null) {
                throw new EntityError(`info.json missing required field: ${field}`, field);
            }
        }

        this.nombre = String(obj.nombre);
        this.unidad = String(obj.unidad);

        if (typeof obj.fecha_inicio !== 'string' || typeof obj.fecha_fin !== 'string') {
            throw new EntityError('fecha_inicio and fecha_fin must be strings (YYYYMMDDHHMM)');
        }
        this.fechaInicio = parseFecha(obj.fecha_inicio, 'fecha_inicio');
        this.fechaFin = parseFecha(obj.fecha_fin, 'fecha_fin');

        this.pasoDeTiempo = Number(obj.paso_de_tiempo);
        if (!Number.isFinite(this.pasoDeTiempo) || this.pasoDeTiempo <= 0) {
            throw new EntityError('paso_de_tiempo must be a positive number', 'paso_de_tiempo');
        }

        this.ncols = Number(obj.ncols);
        if (!Number.isInteger(this.ncols) || this.ncols <= 0) {
            throw new EntityError('ncols must be a positive integer', 'ncols');
        }

        this.nrows = Number(obj.nrows);
        if (!Number.isInteger(this.nrows) || this.nrows <= 0) {
            throw new EntityError('nrows must be a positive integer', 'nrows');
        }

        this.cellsize = Number(obj.cellsize);
        if (!Number.isFinite(this.cellsize) || this.cellsize <= 0) {
            throw new EntityError('cellsize must be a positive number', 'cellsize');
        }

        this.nodata = Number(obj.NODATA);
        if (!Number.isFinite(this.nodata)) {
            throw new EntityError('NODATA must be a number', 'NODATA');
        }

        const xtopleft = Number(obj.xtopleft);
        const ytopleft = Number(obj.ytopleft);
        const xbottomright = Number(obj.xbottomright);
        const ybottomright = Number(obj.ybottomright);
        for (const [name, val] of [
            ['xtopleft', xtopleft],
            ['ytopleft', ytopleft],
            ['xbottomright', xbottomright],
            ['ybottomright', ybottomright],
        ] as const) {
            if (!Number.isFinite(val)) {
                throw new EntityError(`${name} must be a number`, name);
            }
        }

        this._bbox = {
            minX: Math.min(xtopleft, xbottomright),
            maxX: Math.max(xtopleft, xbottomright),
            minY: Math.min(ytopleft, ybottomright),
            maxY: Math.max(ytopleft, ybottomright),
        };
    }

    static parse(raw: string): MeteoInfoJsonValueObject {
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            throw new EntityError(`Failed to parse info.json: ${(err as Error).message}`);
        }
        return new MeteoInfoJsonValueObject(parsed);
    }

    /**
     * Compute the timestamp of step N: fechaInicio + N * pasoDeTiempo (minutes).
     */
    timestampForStep(stepIndex: number): Date {
        return new Date(this.fechaInicio.getTime() + stepIndex * this.pasoDeTiempo * 60_000);
    }

    /**
     * Build the array of expected timestamps given a known number of files.
     */
    expectedTimestamps(fileCount: number): Date[] {
        return Array.from({ length: fileCount }, (_, i) => this.timestampForStep(i));
    }

    bbox(): MeteoBbox {
        return { ...this._bbox };
    }

    crs(): 'EPSG:4326' {
        return 'EPSG:4326';
    }

    noDataValue(): number {
        return this.nodata;
    }
}
