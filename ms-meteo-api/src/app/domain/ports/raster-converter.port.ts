export interface ConvertRequest {
    /** In-memory bytes of the source raster (e.g. ESRI ASCII Grid). */
    sourceBuffer: Buffer;
    /** Absolute path where the resulting GeoTIFF should be written. */
    outputPath: string;
    /** No-data value to embed in the output (e.g. -999). */
    nodata: number;
    /** Spatial reference system code (e.g. 'EPSG:4326'). */
    srs: string;
}

/**
 * Domain port for raster format conversion. The default infrastructure
 * implementation spawns the system `gdal_translate` binary, but tests
 * substitute an in-memory mock that just records calls.
 */
export abstract class IRasterConverter {
    abstract toGeoTiff(input: ConvertRequest): Promise<void>;

    /**
     * Sum multiple GeoTIFF rasters pixel-by-pixel and write the result.
     * Reads metadata (size, geotransform, SRS, NoData) from the first input.
     * All inputs must share the same spatial extent and resolution.
     */
    abstract sumGeoTiffs(inputPaths: string[], outputPath: string): Promise<void>;
}
