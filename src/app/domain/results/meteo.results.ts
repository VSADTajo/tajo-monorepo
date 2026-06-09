import { MeteoInfoJsonValueObject, MeteoBbox } from '@domain/value-objects/meteo-info-json.value-object';
import { MeteoRasterFilenameValueObject } from '@domain/value-objects/meteo-raster-filename.value-object';
import { LayerNameValueObject } from '@domain/value-objects/layer-name.value-object';
import { IngestStatus, TriggerSource } from '@domain/types/ingest-status.enum';

/**
 * In-memory representation of one (provider, variable) dataset
 * discovered in the SFTP, plus everything needed to process it.
 *
 * Built by `MeteoDiscoveryService.discover()`.
 */
export interface DiscoveredDataset {
    provider: string; // uppercase
    variable: string | null;
    sftpPath: string; // e.g. 'tajo/METEO/HARMONIE/Precipitacion'
    layerName: LayerNameValueObject;
    info: MeteoInfoJsonValueObject;
    files: Array<{
        filename: string; // e.g. 'harm_prec0000.005'
        sftpPath: string; // full path under sftp base
        raster: MeteoRasterFilenameValueObject;
        timestamp: Date;
    }>;
}

/**
 * Lightweight metadata representation for the `GET /meteo/info` endpoint.
 * Returned by `MeteoInfoQuery` handler. Plain serializable shape (no value objects).
 */
export class MeteoInfoResult {
    constructor(
        public readonly provider: string,
        public readonly variable: string | null,
        public readonly layerName: string,
        public readonly info: {
            nombre: string;
            fechaInicio: string;
            fechaFin: string;
            pasoDeTiempo: number;
            unidad: string;
            ncols: number;
            nrows: number;
            bbox: MeteoBbox;
            cellsize: number;
            nodata: number;
        },
        public readonly lastRun: {
            startedAt: string | null;
            finishedAt: string | null;
            status: IngestStatus;
            filesOk: number;
            filesFailed: number;
        } | null,
    ) {}
}

/**
 * Per-dataset summary returned inside `SyncResult`.
 */
export class DatasetSyncResult {
    constructor(
        public readonly provider: string,
        public readonly variable: string | null,
        public readonly status: IngestStatus,
        public readonly filesOk: number,
        public readonly filesFailed: number,
        public readonly runId: string | null,
    ) {}
}

/**
 * Per-dataset aggregation result (daily + acumulado).
 */
export class DatasetAggregationResult {
    constructor(
        public readonly provider: string,
        public readonly variable: string | null,
        public readonly dailyCount: number,
        public readonly acumuladoCount: number,
    ) {}
}

/**
 * Aggregate result of the daily + acumulado layer generation.
 */
export class AggregationResult {
    constructor(
        public readonly datasetsProcessed: number,
        public readonly dailyLayersUpdated: number,
        public readonly acumuladoLayersUpdated: number,
        public readonly errors: string[],
    ) {}
}

/**
 * Result returned by `AccumulateMeteoCommand` — on-demand range accumulation.
 */
export class AccumulateResult {
    constructor(
        public readonly provider: string,
        public readonly variable: string | null,
        public readonly layerName: string,
        public readonly from: string,
        public readonly to: string,
        public readonly filesUsed: number,
    ) {}
}

/**
 * Aggregate result of a sync cycle (cron or manual).
 */
export class SyncResult {
    constructor(
        public readonly triggeredBy: TriggerSource,
        public readonly datasets: DatasetSyncResult[],
        public readonly aggregation?: AggregationResult | null,
    ) {}
}

/**
 * Result returned by `MeteoProvidersQuery` — distinct providers with their variables.
 */
export class MeteoProviderResult {
    constructor(
        public readonly provider: string,
        public readonly variables: string[],
    ) {}
}

/**
 * Result returned by `PurgeMeteoGranulesCommand` (US6 retention).
 */
export interface PurgeMeteoGranulesResult {
    datasetsScanned: number;
    granulesDeleted: number;
    filesDeleted: number;
    dailyGranulesDeleted: number;
    acumuladoGranulesDeleted: number;
    errors: string[];
}
