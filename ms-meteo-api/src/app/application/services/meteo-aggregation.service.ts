import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { IRasterConverter } from '@domain/ports/raster-converter.port';
import { IGeoserverImageMosaicClient } from '@domain/ports/geoserver-image-mosaic-client.port';
import { IFileSystem } from '@domain/ports/file-system.port';
import { GeoTiffPathValueObject } from '@domain/value-objects/geotiff-path.value-object';
import { LayerNameValueObject } from '@domain/value-objects/layer-name.value-object';
import { ApiError } from '@domain/errors/api.error';
import {
    AccumulateResult,
    AggregationResult,
    DatasetAggregationResult,
    DiscoveredDataset,
} from '@domain/results/meteo.results';

import { MeteoConfigService } from '@config/meteo/meteo-config.service';
import { ImageMosaicBootstrapService } from '@application/services/image-mosaic-bootstrap.service';

const TIMESTAMP_REGEX = /(\d{14})\.tif$/;

interface HourlyTiff {
    filename: string;
    timestamp: Date;
    path: string;
}

/**
 * Aggregates hourly GeoTIFFs into daily and acumulado layers.
 *
 * Daily: groups hourly files by UTC date, sums pixel values per group.
 * Acumulado (full): sums all hourly files across the entire forecast period.
 * Acumulado (range): sums hourly files within a specific [from, to] date range.
 *
 * All are published to GeoServer as ImageMosaic stores, reusing the
 * same bootstrap and client infrastructure as the hourly pipeline.
 */
@Injectable()
export class MeteoAggregationService {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly rasterConverter: IRasterConverter,
        private readonly geoserverClient: IGeoserverImageMosaicClient,
        private readonly fileSystem: IFileSystem,
        private readonly bootstrap: ImageMosaicBootstrapService,
        private readonly config: MeteoConfigService,
    ) {}

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    async aggregateAll(datasets: DiscoveredDataset[]): Promise<AggregationResult> {
        let datasetsProcessed = 0;
        let dailyLayersUpdated = 0;
        let acumuladoLayersUpdated = 0;
        const errors: string[] = [];

        for (const dataset of datasets) {
            try {
                const result = await this.aggregateDataset(dataset);
                datasetsProcessed++;
                dailyLayersUpdated += result.dailyCount;
                acumuladoLayersUpdated += result.acumuladoCount;
            } catch (err) {
                const label = this.label(dataset);
                const msg = `${label}: ${(err as Error).message}`;
                this.logger.warn({
                    msg: 'Aggregation failed',
                    entity: 'MeteoAggregation',
                    dataset: label,
                    error: (err as Error).message,
                });
                errors.push(msg);
            }
        }

        this.logger.log({
            msg: 'Aggregation complete',
            entity: 'MeteoAggregation',
            datasets: datasetsProcessed,
            daily: dailyLayersUpdated,
            acumulado: acumuladoLayersUpdated,
            errors: errors.length,
        });

        return new AggregationResult(datasetsProcessed, dailyLayersUpdated, acumuladoLayersUpdated, errors);
    }

    async aggregateDataset(dataset: DiscoveredDataset): Promise<DatasetAggregationResult> {
        let dailyCount = 0;
        let acumuladoCount = 0;

        try {
            dailyCount = await this.aggregateDaily(dataset);
        } catch (err) {
            this.logger.warn({
                msg: 'Daily aggregation failed',
                entity: 'MeteoAggregation',
                dataset: this.label(dataset),
                error: String(err),
            });
        }

        try {
            acumuladoCount = await this.aggregateAcumulado(dataset);
        } catch (err) {
            this.logger.error({
                msg: 'Acumulado aggregation failed',
                entity: 'MeteoAggregation',
                dataset: this.label(dataset),
                error: String(err),
            });
        }

        return new DatasetAggregationResult(dataset.provider, dataset.variable, dailyCount, acumuladoCount);
    }

    // ─────────────────────────────────────────────────────────────
    // Daily aggregation
    // ─────────────────────────────────────────────────────────────

    async aggregateDaily(dataset: DiscoveredDataset): Promise<number> {
        const hourlyLayer = dataset.layerName.bareName();
        const tiffs = await this.listHourlyTiffs(hourlyLayer);

        if (tiffs.length === 0) {
            this.logger.debug(`No hourly GeoTIFFs for ${hourlyLayer}, skipping daily aggregation`);
            return 0;
        }

        const dailyLayer = dataset.layerName.withSuffix('diaria');
        const groups = this.groupByDate(tiffs);
        let count = 0;

        for (const [dateKey, files] of groups) {
            try {
                const midnight = new Date(`${dateKey}T00:00:00Z`);
                const outputPath = GeoTiffPathValueObject.compose(
                    this.config.meteoGeotiffDir,
                    dailyLayer.bareName(),
                    midnight,
                ).toString();

                const inputPaths = files.map((f) => f.path);
                await this.rasterConverter.sumGeoTiffs(inputPaths, outputPath);

                await this.ensureStoreAndPublish(dataset, dailyLayer, outputPath, midnight);
                count++;
            } catch (err) {
                this.logger.warn({
                    msg: 'Daily aggregation skipped',
                    entity: 'MeteoAggregation',
                    layer: hourlyLayer,
                    date: dateKey,
                    error: String(err),
                });
            }
        }

        return count;
    }

    // ─────────────────────────────────────────────────────────────
    // Acumulado aggregation (full forecast — called by cron sync)
    // ─────────────────────────────────────────────────────────────

    async aggregateAcumulado(dataset: DiscoveredDataset): Promise<number> {
        const hourlyLayer = dataset.layerName.bareName();
        const tiffs = await this.listHourlyTiffs(hourlyLayer);

        if (tiffs.length === 0) {
            this.logger.debug(`No hourly GeoTIFFs for ${hourlyLayer}, skipping acumulado aggregation`);
            return 0;
        }

        const acumuladoLayer = dataset.layerName.withSuffix('acumulado');
        const forecastStart = dataset.info.fechaInicio;

        const outputPath = GeoTiffPathValueObject.compose(
            this.config.meteoGeotiffDir,
            acumuladoLayer.bareName(),
            forecastStart,
        ).toString();

        const inputPaths = tiffs.map((f) => f.path);
        await this.rasterConverter.sumGeoTiffs(inputPaths, outputPath);

        // Clean old acumulado granules before publishing the new one (ensure single granule).
        await this.replaceAcumuladoGranule(acumuladoLayer.bareName());

        await this.ensureStoreAndPublish(dataset, acumuladoLayer, outputPath, forecastStart);
        return 1;
    }

    // ─────────────────────────────────────────────────────────────
    // Acumulado aggregation (on-demand range — called by endpoint)
    // ─────────────────────────────────────────────────────────────

    async aggregateRange(dataset: DiscoveredDataset, from: Date, to: Date): Promise<AccumulateResult> {
        const hourlyLayer = dataset.layerName.bareName();
        const tiffs = await this.listHourlyTiffs(hourlyLayer);

        const filtered = tiffs.filter((t) => t.timestamp >= from && t.timestamp <= to);

        if (filtered.length === 0) {
            throw new ApiError(
                404,
                `No hourly data found in the requested range [${from.toISOString()}, ${to.toISOString()}]`,
            );
        }

        const acumuladoLayer = dataset.layerName.withSuffix('acumulado');

        const outputPath = GeoTiffPathValueObject.compose(
            this.config.meteoGeotiffDir,
            acumuladoLayer.bareName(),
            from,
        ).toString();

        const inputPaths = filtered.map((f) => f.path);
        await this.rasterConverter.sumGeoTiffs(inputPaths, outputPath);

        // Replace existing acumulado granule with the new range-specific one.
        await this.replaceAcumuladoGranule(acumuladoLayer.bareName());

        await this.ensureStoreAndPublish(dataset, acumuladoLayer, outputPath, from);

        this.logger.log({
            msg: 'Range accumulation',
            entity: 'MeteoAggregation',
            dataset: this.label(dataset),
            from: from.toISOString(),
            to: to.toISOString(),
            files: filtered.length,
        });

        return new AccumulateResult(
            dataset.provider,
            dataset.variable,
            acumuladoLayer.toString(),
            from.toISOString(),
            to.toISOString(),
            filtered.length,
        );
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    private async replaceAcumuladoGranule(store: string): Promise<void> {
        const workspace = this.config.geoserverWorkspace;
        const storeExists = await this.geoserverClient.storeExists(workspace, store);
        if (storeExists) {
            const existing = await this.geoserverClient.listGranules(workspace, store);
            if (existing.length > 0) {
                await this.geoserverClient.deleteGranulesOlderThan(workspace, store, new Date('2100-01-01'));
            }
        }
    }

    private async listHourlyTiffs(layer: string): Promise<HourlyTiff[]> {
        const directory = GeoTiffPathValueObject.directoryFor(this.config.meteoGeotiffDir, layer);
        const filenames = await this.fileSystem.listFiles(directory);

        const tiffs: HourlyTiff[] = [];
        for (const filename of filenames) {
            if (!filename.endsWith('.tif')) continue;
            const match = TIMESTAMP_REGEX.exec(filename);
            if (!match) continue;

            const ts = match[1];
            const year = Number(ts.slice(0, 4));
            const month = Number(ts.slice(4, 6)) - 1;
            const day = Number(ts.slice(6, 8));
            const hour = Number(ts.slice(8, 10));
            const minute = Number(ts.slice(10, 12));
            const second = Number(ts.slice(12, 14));

            tiffs.push({
                filename,
                timestamp: new Date(Date.UTC(year, month, day, hour, minute, second)),
                path: `${directory}/${filename}`,
            });
        }

        tiffs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        return tiffs;
    }

    private groupByDate(tiffs: HourlyTiff[]): Map<string, HourlyTiff[]> {
        const groups = new Map<string, HourlyTiff[]>();
        for (const tiff of tiffs) {
            const dateKey = tiff.timestamp.toISOString().slice(0, 10); // YYYY-MM-DD
            const group = groups.get(dateKey) ?? [];
            group.push(tiff);
            groups.set(dateKey, group);
        }
        return groups;
    }

    private async ensureStoreAndPublish(
        dataset: DiscoveredDataset,
        layerName: LayerNameValueObject,
        geotiffPath: string,
        timestamp: Date,
    ): Promise<void> {
        const workspace = this.config.geoserverWorkspace;
        const store = layerName.bareName();

        const syntheticDataset: DiscoveredDataset = {
            ...dataset,
            layerName,
            files: [],
        };

        const { storeExists } = await this.bootstrap.ensure(syntheticDataset);
        if (!storeExists) {
            const directory = GeoTiffPathValueObject.directoryFor(this.config.meteoGeotiffDir, store);
            await this.bootstrap.createStore(syntheticDataset, directory);
        }

        await this.geoserverClient.addGranule(workspace, store, geotiffPath, timestamp);
    }

    private label(dataset: DiscoveredDataset): string {
        return dataset.variable ? `${dataset.provider}/${dataset.variable}` : dataset.provider;
    }
}
