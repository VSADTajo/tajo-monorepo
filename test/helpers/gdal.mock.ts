/**
 * In-memory test double for the IRasterConverter port (added in US1).
 *
 * Records every call so tests can assert on count and parameters.
 * Writes a stub `.tif` file to disk so any downstream `fs.stat()` succeeds.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ConvertCall {
    outputPath: string;
    nodata: number;
    srs: string;
    bytes: number;
}

export class InMemoryRasterConverter {
    public calls: ConvertCall[] = [];
    public failOnOutput: Set<string> = new Set(); // outputPath that should fail

    async toGeoTiff(input: { sourceBuffer: Buffer; outputPath: string; nodata: number; srs: string }): Promise<void> {
        this.calls.push({
            outputPath: input.outputPath,
            nodata: input.nodata,
            srs: input.srs,
            bytes: input.sourceBuffer.length,
        });

        if (this.failOnOutput.has(input.outputPath)) {
            throw new Error(`Mock GDAL: forced failure on ${input.outputPath}`);
        }

        // Write a tiny stub so listGranules / fs.stat downstream works.
        fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
        fs.writeFileSync(input.outputPath, Buffer.from('GeoTIFFstub'));
    }

    public sumCalls: { inputPaths: string[]; outputPath: string }[] = [];
    public failSumGeoTiffs = false;

    async sumGeoTiffs(inputPaths: string[], outputPath: string): Promise<void> {
        this.sumCalls.push({ inputPaths, outputPath });
        if (this.failSumGeoTiffs) {
            throw new Error('Mock GDAL: sumGeoTiffs forced failure');
        }
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, Buffer.from('GeoTIFFstub-sum'));
    }

    reset(): void {
        this.calls = [];
        this.sumCalls = [];
        this.failOnOutput.clear();
        this.failSumGeoTiffs = false;
    }
}
