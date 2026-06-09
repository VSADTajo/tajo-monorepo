export interface GeoserverGranule {
    id: string;
    location: string;
    time: Date;
}

export interface CreateImageMosaicStoreOptions {
    workspace: string;
    store: string;
    /** Absolute directory containing the GeoTIFF files (must be reachable from the GeoServer container). */
    directory: string;
}

/**
 * Domain port for the subset of the GeoServer REST API used by the meteo
 * pipeline. All operations are scoped to ImageMosaic stores in a single
 * workspace and to the time-aware coverage of each store.
 *
 * Implementations must:
 *  - throw `ProviderError` on non-2xx (except `storeExists` which returns
 *    `false` on 404)
 *  - be idempotent: creating an existing store is a no-op, adding an
 *    already-published granule (same time) replaces the existing one
 */
export abstract class IGeoserverImageMosaicClient {
    abstract storeExists(workspace: string, store: string): Promise<boolean>;
    abstract createImageMosaicStore(opts: CreateImageMosaicStoreOptions): Promise<void>;
    abstract listGranules(workspace: string, layer: string): Promise<GeoserverGranule[]>;
    abstract addGranule(workspace: string, store: string, geotiffPath: string, time: Date): Promise<void>;
    abstract deleteGranulesOlderThan(workspace: string, layer: string, threshold: Date): Promise<number>;
    /**
     * Drops the PostGIS mosaic index table for the given store (if it exists).
     * Must be called before `createImageMosaicStore` when recreating a deleted
     * store to avoid GeoServer reusing stale index records from the old table.
     */
    abstract purgeMosaicIndex(tableName: string): Promise<void>;

    /**
     * Proxies a WMS GetMap request to GeoServer and returns the raw image buffer.
     * All WMS query parameters (BBOX, WIDTH, HEIGHT, LAYERS, etc.) must be
     * provided in `params` — this method forwards them verbatim.
     */
    abstract proxyWms(
        workspace: string,
        params: Record<string, string>,
    ): Promise<{ data: Buffer; contentType: string }>;
}
