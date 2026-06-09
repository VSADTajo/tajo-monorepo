import { Inject, Injectable } from '@nestjs/common';
import { spawn, execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Logger } from 'nestjs-pino';

import { ConvertRequest, IRasterConverter } from '@domain/ports/raster-converter.port';
import { ProviderError } from '@domain/errors/provider.error';

interface GdalInfo {
    width: number;
    height: number;
    geoTransform: [number, number, number, number, number, number];
    srsWkt: string;
    /** Authority code, e.g. "EPSG:4326". Preferred over srsWkt for VRT <SRS> to avoid WKT2 ENSEMBLE issues. */
    srsAuthority: string;
    noDataValue: number | null;
}

/**
 * Spawns the system `gdal_translate` CLI to convert ESRI ASCII Grid → GeoTIFF.
 * Requires `gdal-bin` (or alpine `gdal-tools`) installed in the container.
 *
 * Workflow:
 *  1. Write `sourceBuffer` to a temporary file under `os.tmpdir()`.
 *  2. Run `gdal_translate -of GTiff -a_srs <srs> -a_nodata <nodata> -co COMPRESS=DEFLATE -co TILED=YES <tmp> <output>`.
 *  3. Delete the temporary file (best effort).
 */
@Injectable()
export class GdalRasterConverter extends IRasterConverter {
    constructor(@Inject(Logger) private readonly logger: Logger) {
        super();
    }

    async toGeoTiff(input: ConvertRequest): Promise<void> {
        const tmpInput = path.join(os.tmpdir(), `meteo-${randomUUID()}.asc`);

        await fs.mkdir(path.dirname(input.outputPath), { recursive: true });
        await fs.writeFile(tmpInput, input.sourceBuffer);

        try {
            await this.runGdalTranslate(tmpInput, input.outputPath, input.srs, input.nodata);
        } finally {
            await fs.unlink(tmpInput).catch(() => {
                /* ignore */
            });
        }
    }

    async sumGeoTiffs(inputPaths: string[], outputPath: string): Promise<void> {
        if (inputPaths.length === 0) {
            throw new ProviderError('sumGeoTiffs: no input paths provided');
        }

        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        const info = await this.runGdalInfo(inputPaths[0]);
        const vrtXml = this.buildSumVrt(info, inputPaths);

        const tmpVrt = path.join(os.tmpdir(), `meteo-sum-${randomUUID()}.vrt`);
        await fs.writeFile(tmpVrt, vrtXml, 'utf8');

        try {
            await this.runGdalTranslate(tmpVrt, outputPath, '', 0, true);
        } finally {
            await fs.unlink(tmpVrt).catch(() => {
                /* ignore */
            });
        }
    }

    private runGdalInfo(filePath: string): Promise<GdalInfo> {
        return new Promise((resolve, reject) => {
            execFile('gdalinfo', ['-json', filePath], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) {
                    reject(new ProviderError(`gdalinfo failed: ${err.message} ${stderr}`));
                    return;
                }
                try {
                    const json = JSON.parse(stdout);
                    const band = json.bands?.[0];
                    const projjson = json.coordinateSystem?.projjson;
                    // Couple authority + code from the same object to avoid mixing projected/geographic CRS ids.
                    // projjson.id is the CRS identifier; for projected CRS, base_crs.id is the geographic base.
                    const projId = projjson?.id ?? projjson?.base_crs?.id ?? null;
                    const authority = projId?.authority ?? '';
                    const code = projId?.code !== undefined ? String(projId.code) : '';
                    let srsAuthority = authority && code ? `${authority}:${code}` : '';
                    // Fallback: some GDAL builds omit projjson but include ID["EPSG",4326] in WKT.
                    if (!srsAuthority) {
                        const wkt = json.coordinateSystem?.wkt ?? '';
                        const wktMatch = /ID\["(\w+)",(\d+)\]/.exec(wkt);
                        if (wktMatch) {
                            srsAuthority = `${wktMatch[1]}:${wktMatch[2]}`;
                        }
                    }
                    resolve({
                        width: json.size[0],
                        height: json.size[1],
                        geoTransform: json.geoTransform as [number, number, number, number, number, number],
                        srsWkt: json.coordinateSystem?.wkt ?? '',
                        srsAuthority,
                        noDataValue: band?.noDataValue ?? null,
                    });
                } catch (parseErr) {
                    reject(new ProviderError(`Failed to parse gdalinfo output: ${(parseErr as Error).message}`));
                }
            });
        });
    }

    private buildSumVrt(info: GdalInfo, inputPaths: string[]): string {
        const gt = info.geoTransform;
        const nodata = info.noDataValue ?? -9999;

        const sources = inputPaths
            .map(
                (p) =>
                    '    <SimpleSource>\n' +
                    `      <SourceFilename relativeToVRT="0">${this.escapeXml(p)}</SourceFilename>\n` +
                    '      <SourceBand>1</SourceBand>\n' +
                    `      <NoDataValue>${nodata}</NoDataValue>\n` +
                    '    </SimpleSource>',
            )
            .join('\n');

        // Prefer authority code (e.g. "EPSG:4326") over raw WKT to avoid GDAL 3.x
        // WKT2 ENSEMBLE format that GeoServer/GeoTools cannot parse.
        const srs = info.srsAuthority || info.srsWkt;

        return (
            `<VRTDataset rasterXSize="${info.width}" rasterYSize="${info.height}">\n` +
            `  <SRS>${this.escapeXml(srs)}</SRS>\n` +
            `  <GeoTransform>${gt.join(', ')}</GeoTransform>\n` +
            '  <VRTRasterBand dataType="Float64" band="1" subClass="VRTDerivedRasterBand">\n' +
            '    <PixelFunctionType>sum</PixelFunctionType>\n' +
            '    <SourceTransferType>Float64</SourceTransferType>\n' +
            `    <NoDataValue>${nodata}</NoDataValue>\n` +
            `${sources}\n` +
            '  </VRTRasterBand>\n' +
            '</VRTDataset>\n'
        );
    }

    private escapeXml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    private runGdalTranslate(input: string, output: string, srs: string, nodata: number, isVrt = false): Promise<void> {
        return new Promise((resolve, reject) => {
            const args: string[] = ['-of', 'GTiff'];

            if (!isVrt) {
                args.push('-a_srs', srs, '-a_nodata', String(nodata));
            }

            args.push('-co', 'COMPRESS=DEFLATE', '-co', 'TILED=YES', input, output);

            // OSR_WKT_FORMAT=WKT1_GDAL forces GDAL 3.x to write traditional WKT1 CRS
            // instead of WKT2 ENSEMBLE format, which GeoServer's GeoTools cannot parse.
            const proc = spawn('gdal_translate', args, {
                env: { ...process.env, OSR_WKT_FORMAT: 'WKT1_GDAL' },
            });
            let stderr = '';

            proc.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
            });
            proc.on('error', (err) => {
                reject(new ProviderError(`Failed to spawn gdal_translate: ${err.message}`));
            });
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    this.logger.warn({
                        msg: 'gdal_translate skipped: insufficient sources for pixel function (expected for last forecast day with <2 hourly files)',
                        entity: 'MeteoAggregation',
                        exitCode: code,
                        stderr: stderr.trim(),
                    });
                    reject(new ProviderError(`gdal_translate failed (exit ${code}): ${stderr.trim()}`));
                }
            });
        });
    }
}
