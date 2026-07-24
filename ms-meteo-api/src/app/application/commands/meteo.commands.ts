import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { TriggerSource, IngestStatus } from '@domain/types/ingest-status.enum';
import {
    AccumulateResult,
    DatasetSyncResult,
    DiscoveredDataset,
    PurgeMeteoGranulesResult,
    SyncResult,
} from '@domain/results/meteo.results';
import { ApiError } from '@domain/errors/api.error';
import { MeteoIngestRun } from '@domain/entities/meteo-ingest-run.entity';
import { IMeteoIngestRunRepository } from '@domain/ports/meteo-ingest-run-repository.port';
import { ISftpFileClient } from '@domain/ports/sftp-file-client.port';
import { IGeoserverImageMosaicClient } from '@domain/ports/geoserver-image-mosaic-client.port';
import { IRasterConverter } from '@domain/ports/raster-converter.port';
import { IFileSystem } from '@domain/ports/file-system.port';
import { GeoTiffPathValueObject } from '@domain/value-objects/geotiff-path.value-object';

import { MeteoConfigService } from '@config/meteo/meteo-config.service';
import { MeteoDiscoveryService } from '@application/services/meteo-discovery.service';
import { ImageMosaicBootstrapService } from '@application/services/image-mosaic-bootstrap.service';
import { MeteoAggregationService } from '@application/services/meteo-aggregation.service';
import { DatasetMutex } from '@application/services/dataset-mutex';
import { ICacheService } from '@domain/ports/cache-service.port';
import { MeteoAccumuladoCacheKeys, MeteoInfoCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// PurgeMeteoGranules — US6 retention
// ─────────────────────────────────────────────────────────────

export interface IPurgeMeteoGranulesCommand {
    /** Optional override of the retention window (days). Defaults to config. */
    retentionDays?: number;
}

export class PurgeMeteoGranulesCommand {
    constructor(private readonly parameters: IPurgeMeteoGranulesCommand = {}) {}
    get retentionDays(): number | undefined {
        return this.parameters.retentionDays;
    }
}

@CommandHandler(PurgeMeteoGranulesCommand)
export class PurgeMeteoGranulesHandler implements ICommandHandler<PurgeMeteoGranulesCommand, PurgeMeteoGranulesResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly discovery: MeteoDiscoveryService,
        private readonly geoserverClient: IGeoserverImageMosaicClient,
        private readonly fileSystem: IFileSystem,
        private readonly config: MeteoConfigService,
    ) {}

    async execute(command: PurgeMeteoGranulesCommand): Promise<PurgeMeteoGranulesResult> {
        let threshold: Date;
        const mode = this.config.meteoRetentionMode;
        if (mode === 'today') {
            const now = new Date();
            threshold = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        } else {
            const days = command.retentionDays ?? this.config.meteoRetentionDays;
            threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        }
        const result: PurgeMeteoGranulesResult = {
            datasetsScanned: 0,
            granulesDeleted: 0,
            filesDeleted: 0,
            dailyGranulesDeleted: 0,
            acumuladoGranulesDeleted: 0,
            errors: [],
        };

        let datasets: DiscoveredDataset[];
        try {
            datasets = await this.discovery.discover({});
        } catch (err) {
            result.errors.push(`discovery failed: ${(err as Error).message}`);
            return result;
        }

        const workspace = this.config.geoserverWorkspace;

        for (const dataset of datasets) {
            result.datasetsScanned++;
            const layer = dataset.layerName.bareName();
            const directory = GeoTiffPathValueObject.directoryFor(this.config.meteoGeotiffDir, layer);

            try {
                // Capture the granules that will be removed (need their location filenames).
                const before = await this.geoserverClient.listGranules(workspace, layer);
                const toDelete = before.filter((g) => g.time < threshold);

                const removed = await this.geoserverClient.deleteGranulesOlderThan(workspace, layer, threshold);
                result.granulesDeleted += removed;

                // Best-effort: remove the corresponding .tif files from disk via the filesystem port.
                for (const g of toDelete) {
                    await this.fileSystem.deleteFile(`${directory}/${g.location}`);
                    result.filesDeleted++;
                }
            } catch (err) {
                const msg = `${layer}: ${(err as Error).message}`;
                this.logger.error({ msg: 'Retention failure', error: msg, stack: (err as Error).stack });
                result.errors.push(msg);
            }

            // Purge aggregated _diaria layer.
            try {
                const dailyLayer = dataset.layerName.withSuffix('diaria').bareName();
                const dailyDir = GeoTiffPathValueObject.directoryFor(this.config.meteoGeotiffDir, dailyLayer);
                const dailyExists = await this.geoserverClient.storeExists(workspace, dailyLayer);

                if (dailyExists) {
                    const dailyBefore = await this.geoserverClient.listGranules(workspace, dailyLayer);
                    const dailyToDelete = dailyBefore.filter((g) => g.time < threshold);

                    if (dailyToDelete.length > 0) {
                        const removed = await this.geoserverClient.deleteGranulesOlderThan(
                            workspace,
                            dailyLayer,
                            threshold,
                        );
                        result.dailyGranulesDeleted += removed;

                        for (const g of dailyToDelete) {
                            await this.fileSystem.deleteFile(`${dailyDir}/${g.location}`);
                        }
                    }
                }
            } catch (err) {
                const msg = `${layer}_diaria retention: ${(err as Error).message}`;
                this.logger.error({ msg: 'Retention failure', error: msg, stack: (err as Error).stack });
                result.errors.push(msg);
            }

            // Purge aggregated _acumulado layer.
            try {
                const acumLayer = dataset.layerName.withSuffix('acumulado').bareName();
                const acumDir = GeoTiffPathValueObject.directoryFor(this.config.meteoGeotiffDir, acumLayer);
                const acumExists = await this.geoserverClient.storeExists(workspace, acumLayer);

                if (acumExists) {
                    const acumBefore = await this.geoserverClient.listGranules(workspace, acumLayer);
                    const acumToDelete = acumBefore.filter((g) => g.time < threshold);

                    if (acumToDelete.length > 0) {
                        const removed = await this.geoserverClient.deleteGranulesOlderThan(
                            workspace,
                            acumLayer,
                            threshold,
                        );
                        result.acumuladoGranulesDeleted += removed;

                        for (const g of acumToDelete) {
                            await this.fileSystem.deleteFile(`${acumDir}/${g.location}`);
                        }
                    }
                }
            } catch (err) {
                const msg = `${layer}_acumulado retention: ${(err as Error).message}`;
                this.logger.error({ msg: 'Retention failure', error: msg, stack: (err as Error).stack });
                result.errors.push(msg);
            }
        }

        return result;
    }
}

// ─────────────────────────────────────────────────────────────
// SyncMeteo
// ─────────────────────────────────────────────────────────────

export interface ISyncMeteoCommand {
    provider?: string;
    variable?: string;
    triggeredBy: TriggerSource;
}

export class SyncMeteoCommand {
    constructor(private readonly parameters: ISyncMeteoCommand) {}
    get provider(): string | undefined {
        return this.parameters.provider;
    }
    get variable(): string | undefined {
        return this.parameters.variable;
    }
    get triggeredBy(): TriggerSource {
        return this.parameters.triggeredBy;
    }
}

@CommandHandler(SyncMeteoCommand)
export class SyncMeteoHandler implements ICommandHandler<SyncMeteoCommand, SyncResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly discovery: MeteoDiscoveryService,
        private readonly bootstrap: ImageMosaicBootstrapService,
        private readonly sftpClient: ISftpFileClient,
        private readonly geoserverClient: IGeoserverImageMosaicClient,
        private readonly rasterConverter: IRasterConverter,
        private readonly runRepository: IMeteoIngestRunRepository,
        private readonly mutex: DatasetMutex,
        private readonly cacheService: ICacheService,
        private readonly config: MeteoConfigService,
        private readonly aggregation: MeteoAggregationService,
    ) {}

    async execute(command: SyncMeteoCommand): Promise<SyncResult> {
        const startTime = Date.now();
        const datasets = await this.discovery.discover({
            provider: command.provider,
            variable: command.variable,
        });

        const results: DatasetSyncResult[] = [];
        const concurrency = Math.max(1, this.config.meteoIngestConcurrency);

        // Process datasets in bounded parallel batches.
        for (let i = 0; i < datasets.length; i += concurrency) {
            const batch = datasets.slice(i, i + concurrency);
            const batchResults = await Promise.all(batch.map((d) => this.processOne(d, command.triggeredBy)));
            results.push(...batchResults);
        }

        // Invalidate the meteo info cache for any dataset that actually changed.
        const changed = results.some((r) => r.filesOk > 0);
        if (changed) {
            try {
                await this.cacheService.delByPattern(MeteoInfoCacheKeys.pattern());
            } catch (err) {
                this.logger.warn({
                    msg: 'Failed to invalidate meteo info cache',
                    error: String(err),
                });
            }
        }

        // Run daily + acumulado aggregation after successful ingest.
        let aggregationResult = null;
        if (changed) {
            try {
                aggregationResult = await this.aggregation.aggregateAll(datasets);
            } catch (err) {
                this.logger.warn({ msg: 'Aggregation failed', error: String(err), stack: (err as Error).stack });
            }

            // Invalidate accumulated range cache — cron overwrites _acumulado with full forecast.
            for (const dataset of datasets) {
                const pattern = MeteoAccumuladoCacheKeys.forDataset(dataset.provider, dataset.variable ?? undefined);
                await this.cacheService.delByPattern(pattern).catch((err) =>
                    this.logger.warn({
                        msg: 'Failed to invalidate acumulado cache',
                        error: String(err),
                    }),
                );
            }
        }

        const filesOk = results.reduce((sum, r) => sum + r.filesOk, 0);
        const filesFailed = results.reduce((sum, r) => sum + r.filesFailed, 0);
        this.logger.log({
            msg: 'Meteo sync completed',
            triggeredBy: command.triggeredBy,
            datasetsProcessed: results.length,
            filesOk,
            filesFailed,
            aggregated: aggregationResult !== null,
            durationMs: Date.now() - startTime,
        });

        return new SyncResult(command.triggeredBy, results, aggregationResult);
    }

    private async processOne(dataset: DiscoveredDataset, triggeredBy: TriggerSource): Promise<DatasetSyncResult> {
        const release = this.mutex.tryAcquire(dataset.provider, dataset.variable);
        if (!release) {
            this.logger.log(`Skipping ${this.label(dataset)}: another sync is already running`);
            const noopRun = await this.persistNoopRun(dataset, triggeredBy, 'concurrent run already in progress');
            return new DatasetSyncResult(dataset.provider, dataset.variable, IngestStatus.NOOP, 0, 0, noopRun.id);
        }

        const run = new MeteoIngestRun({
            provider: dataset.provider,
            variable: dataset.variable,
            forecastRun: dataset.info.fechaInicio,
            triggeredBy,
            startedAt: new Date(),
            status: IngestStatus.RUNNING,
            filesProcessed: 0,
            filesOk: 0,
            filesFailed: 0,
        });
        run.markRunning();
        run.startedAt = new Date();
        run.validate();
        const persistedRun = await this.runRepository.create(run);

        try {
            // 1. Prepare directory and property files, check if store exists.
            const { directory, storeExists } = await this.bootstrap.ensure(dataset);

            // 2. Diff against what GeoServer already has (only if store exists).
            let existingTimes = new Set<number>();
            if (storeExists) {
                const existing = await this.geoserverClient.listGranules(
                    this.config.geoserverWorkspace,
                    dataset.layerName.bareName(),
                );
                existingTimes = new Set(existing.map((g) => g.time.getTime()));
            }

            const missing = dataset.files.filter((f) => !existingTimes.has(f.timestamp.getTime()));

            if (missing.length === 0) {
                persistedRun.markNoop();
                persistedRun.validate();
                await this.runRepository.update(persistedRun);
                this.logger.log(`${this.label(dataset)}: nothing to do (already published)`);
                return new DatasetSyncResult(
                    dataset.provider,
                    dataset.variable,
                    IngestStatus.NOOP,
                    0,
                    0,
                    persistedRun.id,
                );
            }

            // 3. Process missing files one by one.
            let ok = 0;
            let failed = 0;
            const errors: string[] = [];
            let storeCreated = storeExists;

            for (const file of missing) {
                void directory; // ensured by bootstrap; layer-scoped path is computed by the value object below
                const tifPath = GeoTiffPathValueObject.compose(
                    this.config.meteoGeotiffDir,
                    dataset.layerName.bareName(),
                    file.timestamp,
                ).toString();

                try {
                    const buffer = await this.sftpClient.download(file.sftpPath);
                    await this.rasterConverter.toGeoTiff({
                        sourceBuffer: buffer,
                        outputPath: tifPath,
                        nodata: dataset.info.noDataValue(),
                        srs: dataset.info.crs(),
                    });

                    // Create store after first successful GeoTIFF conversion if needed
                    if (!storeCreated) {
                        const exists = await this.geoserverClient.storeExists(
                            this.config.geoserverWorkspace,
                            dataset.layerName.bareName(),
                        );
                        if (!exists) {
                            await this.bootstrap.createStore(dataset, directory);
                        }
                        storeCreated = true;
                    }

                    await this.geoserverClient.addGranule(
                        this.config.geoserverWorkspace,
                        dataset.layerName.bareName(),
                        tifPath,
                        file.timestamp,
                    );
                    ok++;
                } catch (err) {
                    failed++;
                    const msg = `${file.filename}: ${(err as Error).message}`;
                    errors.push(msg);
                    this.logger.error({
                        msg: 'Sync file failed',
                        dataset: this.label(dataset),
                        file: file.filename,
                        error: msg,
                        stack: (err as Error).stack,
                    });
                }
            }

            // 4. Final status.
            if (failed === 0) {
                persistedRun.markOk(ok);
            } else if (ok === 0) {
                persistedRun.markFailed(this.truncateErrors(errors));
            } else {
                persistedRun.markPartial(ok, failed, this.truncateErrors(errors));
            }
            persistedRun.validate();
            await this.runRepository.update(persistedRun);

            return new DatasetSyncResult(
                dataset.provider,
                dataset.variable,
                persistedRun.status,
                ok,
                failed,
                persistedRun.id,
            );
        } catch (err) {
            // Catastrophic failure (bootstrap or listGranules failed).
            const msg = (err as Error).message;
            this.logger.error({
                msg: 'Sync catastrophic failure',
                dataset: this.label(dataset),
                error: msg,
                stack: (err as Error).stack,
            });
            persistedRun.markFailed(msg);
            persistedRun.validate();
            await this.runRepository.update(persistedRun);
            return new DatasetSyncResult(
                dataset.provider,
                dataset.variable,
                IngestStatus.FAILED,
                0,
                0,
                persistedRun.id,
            );
        } finally {
            release();
        }
    }

    private async persistNoopRun(
        dataset: DiscoveredDataset,
        triggeredBy: TriggerSource,
        reason: string,
    ): Promise<MeteoIngestRun> {
        const run = new MeteoIngestRun({
            provider: dataset.provider,
            variable: dataset.variable,
            forecastRun: dataset.info.fechaInicio,
            triggeredBy,
            startedAt: new Date(),
            status: IngestStatus.NOOP,
            filesProcessed: 0,
            filesOk: 0,
            filesFailed: 0,
            errorSummary: reason,
        });
        run.markNoop();
        run.errorSummary = reason;
        run.validate();
        return this.runRepository.create(run);
    }

    private label(dataset: DiscoveredDataset): string {
        return dataset.variable ? `${dataset.provider}/${dataset.variable}` : dataset.provider;
    }

    private truncateErrors(errors: string[]): string {
        const joined = errors.join('\n');
        return joined.length > 4000 ? joined.slice(0, 4000) + '\n…(truncated)' : joined;
    }
}

// ─────────────────────────────────────────────────────────────
// AccumulateMeteo — on-demand range accumulation
// ─────────────────────────────────────────────────────────────

export interface IAccumulateMeteoCommand {
    provider: string;
    variable?: string;
    from: string; // ISO 8601 datetime string (e.g. 2026-05-01T06:00:00Z)
    to: string; // ISO 8601 datetime string (e.g. 2026-05-01T18:00:00Z)
}

export class AccumulateMeteoCommand {
    constructor(private readonly parameters: IAccumulateMeteoCommand) {}
    get provider(): string {
        return this.parameters.provider;
    }
    get variable(): string | undefined {
        return this.parameters.variable;
    }
    get from(): string {
        return this.parameters.from;
    }
    get to(): string {
        return this.parameters.to;
    }
}

@CommandHandler(AccumulateMeteoCommand)
export class AccumulateMeteoHandler implements ICommandHandler<AccumulateMeteoCommand, AccumulateResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly discovery: MeteoDiscoveryService,
        private readonly aggregation: MeteoAggregationService,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: AccumulateMeteoCommand): Promise<AccumulateResult> {
        const from = new Date(command.from);
        const to = new Date(command.to);

        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            throw new ApiError(400, 'Invalid date format. Use ISO 8601 datetime (e.g. 2026-05-01T06:00:00Z)');
        }
        if (from >= to) {
            throw new ApiError(400, '"from" must be before "to"');
        }

        const datasets = await this.discovery.discover({
            provider: command.provider,
            variable: command.variable,
        });

        if (datasets.length === 0) {
            throw new ApiError(
                404,
                `No datasets found for provider=${command.provider} variable=${command.variable ?? '*'}`,
            );
        }

        if (datasets.length > 1) {
            throw new ApiError(
                400,
                `Multiple datasets match provider=${command.provider}. Specify a variable filter. Available: ${datasets.map((d) => d.variable).join(', ')}`,
            );
        }

        // Check cache: if same range was already computed and layer exists in GeoServer, skip GDAL.
        const cacheKey = MeteoAccumuladoCacheKeys.forRange(
            command.provider,
            command.variable,
            command.from,
            command.to,
        );
        const cached = await this.cacheService.get<{ layerName: string; filesUsed: number }>(cacheKey);
        if (cached) {
            this.logger.debug(`AccumulateMeteo cache HIT: ${cacheKey}`);
            return new AccumulateResult(
                command.provider,
                command.variable ?? null,
                cached.layerName,
                command.from,
                command.to,
                cached.filesUsed,
            );
        }

        this.logger.log(
            `AccumulateMeteo: provider=${command.provider} variable=${command.variable ?? '*'} from=${command.from} to=${command.to}`,
        );
        const result = await this.aggregation.aggregateRange(datasets[0], from, to);

        // Store in cache for 3 hours (same interval as the cron).
        await this.cacheService
            .set(cacheKey, { layerName: result.layerName, filesUsed: result.filesUsed }, 10_800)
            .catch((err) => this.logger.warn({ msg: 'Failed to cache acumulado result', error: String(err) }));

        return result;
    }
}
