import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { ISftpFileClient, SftpFileEntry } from '@domain/ports/sftp-file-client.port';
import { MeteoConfigService } from '@config/meteo/meteo-config.service';
import { MeteoInfoJsonValueObject } from '@domain/value-objects/meteo-info-json.value-object';
import { MeteoRasterFilenameValueObject } from '@domain/value-objects/meteo-raster-filename.value-object';
import { LayerNameValueObject } from '@domain/value-objects/layer-name.value-object';
import { ProviderNameValueObject } from '@domain/value-objects/provider-name.value-object';
import { VariableNameValueObject } from '@domain/value-objects/variable-name.value-object';
import { DiscoveredDataset } from '@domain/results/meteo.results';
import { ApiError } from '@domain/errors/api.error';

const INFO_JSON = 'info.json';

export interface DiscoverFilter {
    provider?: string;
    variable?: string;
}

/**
 * Walks the SFTP `tajo/METEO/<PROVIDER>/(<VARIABLE>/)?` tree and produces
 * one `DiscoveredDataset` per (provider, variable) folder that has a valid
 * `info.json` and at least one parseable raster file.
 *
 * Optional filter narrows the walk:
 *   - { provider: 'radar' }                       → only that provider
 *   - { provider: 'harmonie', variable: 'Precipitacion' } → one dataset
 *
 * Folders without an `info.json`, with malformed JSON, or with zero matching
 * raster files are skipped and logged as warnings — they do NOT abort the walk
 * (FR-017).
 */
@Injectable()
export class MeteoDiscoveryService {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly sftpClient: ISftpFileClient,
        private readonly config: MeteoConfigService,
    ) {}

    async discover(filter: DiscoverFilter = {}): Promise<DiscoveredDataset[]> {
        if (filter.variable && !filter.provider) {
            throw new ApiError(400, 'variable filter requires provider filter');
        }

        const basePath = this.config.meteoBasePath;
        const root = await this.safeListDirectory(basePath);
        const providerEntries = root.filter((e) => e.isDirectory);

        const wantedProvider = filter.provider?.toUpperCase();
        const datasets: DiscoveredDataset[] = [];
        let providerMatched = false;

        for (const providerEntry of providerEntries) {
            const providerName = providerEntry.name.toUpperCase();
            if (wantedProvider && providerName !== wantedProvider) continue;
            providerMatched = true;

            let providerVo: ProviderNameValueObject;
            try {
                providerVo = new ProviderNameValueObject(providerEntry.name);
            } catch (err) {
                this.logger.warn({
                    msg: 'Skipping provider folder',
                    entity: 'MeteoDiscovery',
                    name: providerEntry.name,
                    error: String(err),
                });
                continue;
            }

            const providerPath = `${basePath}/${providerEntry.name}`;
            const providerChildren = await this.safeListDirectory(providerPath);
            const hasOwnInfoJson = providerChildren.some((c) => !c.isDirectory && c.name === INFO_JSON);

            if (hasOwnInfoJson) {
                // Provider has files directly (RADAR-style — implicit single dataset, no variable level).
                if (filter.variable) {
                    // Filter wants a specific variable but this provider has none → no match.
                    continue;
                }
                const dataset = await this.tryBuildDataset({
                    provider: providerVo,
                    variable: null,
                    sftpPath: providerPath,
                    children: providerChildren,
                });
                if (dataset) datasets.push(dataset);
                continue;
            }

            // Otherwise: every direct subdirectory is a variable.
            const variableEntries = providerChildren.filter((c) => c.isDirectory);
            const wantedVariable = filter.variable;
            for (const variableEntry of variableEntries) {
                if (wantedVariable && variableEntry.name !== wantedVariable) continue;

                let variableVo: VariableNameValueObject;
                try {
                    variableVo = new VariableNameValueObject(variableEntry.name);
                } catch (err) {
                    this.logger.warn({
                        msg: 'Skipping variable folder',
                        entity: 'MeteoDiscovery',
                        provider: providerEntry.name,
                        variable: variableEntry.name,
                        error: String(err),
                    });
                    continue;
                }

                const variablePath = `${providerPath}/${variableEntry.name}`;
                const variableChildren = await this.safeListDirectory(variablePath);
                const dataset = await this.tryBuildDataset({
                    provider: providerVo,
                    variable: variableVo,
                    sftpPath: variablePath,
                    children: variableChildren,
                });
                if (dataset) datasets.push(dataset);
            }
        }

        if (wantedProvider && !providerMatched) {
            throw new ApiError(404, `Provider not found: ${wantedProvider}`);
        }
        if (filter.variable && datasets.length === 0) {
            throw new ApiError(404, `Variable not found: ${filter.provider}/${filter.variable}`);
        }
        return datasets;
    }

    private async safeListDirectory(path: string): Promise<SftpFileEntry[]> {
        try {
            return await this.sftpClient.listDirectory(path);
        } catch (err) {
            this.logger.error({ msg: 'Failed to list directory', entity: 'MeteoDiscovery', path, error: String(err) });
            throw err;
        }
    }

    private async tryBuildDataset(args: {
        provider: ProviderNameValueObject;
        variable: VariableNameValueObject | null;
        sftpPath: string;
        children: SftpFileEntry[];
    }): Promise<DiscoveredDataset | null> {
        const { provider, variable, sftpPath, children } = args;

        const infoEntry = children.find((c) => !c.isDirectory && c.name === INFO_JSON);
        if (!infoEntry) {
            this.logger.warn(`Skipping ${sftpPath}: no info.json`);
            return null;
        }

        let info: MeteoInfoJsonValueObject;
        try {
            const raw = await this.sftpClient.readText(infoEntry.path);
            info = MeteoInfoJsonValueObject.parse(raw);
        } catch (err) {
            this.logger.warn({
                msg: 'Skipping: invalid info.json',
                entity: 'MeteoDiscovery',
                sftpPath,
                error: String(err),
            });
            return null;
        }

        const fileEntries = children
            .filter((c) => !c.isDirectory)
            .map((c) => {
                const raster = MeteoRasterFilenameValueObject.parse(c.name);
                return raster ? { entry: c, raster } : null;
            })
            .filter((x): x is { entry: SftpFileEntry; raster: MeteoRasterFilenameValueObject } => x !== null)
            .sort((a, b) => a.raster.step - b.raster.step);

        if (fileEntries.length === 0) {
            this.logger.warn(`Skipping ${sftpPath}: no parseable raster files`);
            return null;
        }

        const layerName = LayerNameValueObject.compose(provider, variable, this.config.geoserverWorkspace);
        const files = fileEntries.map(({ entry, raster }) => ({
            filename: entry.name,
            sftpPath: entry.path,
            raster,
            timestamp: info.timestampForStep(raster.step),
        }));

        return {
            provider: provider.value,
            variable: variable?.value ?? null,
            sftpPath,
            layerName,
            info,
            files,
        };
    }
}
