import { Inject, Injectable } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { Logger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import {
    CreateImageMosaicStoreOptions,
    GeoserverGranule,
    IGeoserverImageMosaicClient,
} from '@domain/ports/geoserver-image-mosaic-client.port';
import { ProviderError } from '@domain/errors/provider.error';
import { MeteoConfigService } from '@config/meteo/meteo-config.service';

interface GranulesFeatureCollection {
    features: Array<{
        id: string;
        properties: {
            location: string;
            ingestion: string;
        };
    }>;
}

@Injectable()
export class GeoserverImageMosaicClient extends IGeoserverImageMosaicClient {
    private readonly http: AxiosInstance;

    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly config: MeteoConfigService,
    ) {
        super();
        this.http = axios.create({
            baseURL: this.config.geoserverUrl,
            timeout: 60_000,
            auth: {
                username: this.config.geoserverUser,
                password: this.config.geoserverPassword,
            },
        });
    }

    async storeExists(workspace: string, store: string): Promise<boolean> {
        try {
            await this.http.get(`/rest/workspaces/${workspace}/coveragestores/${store}.json`);
            return true;
        } catch (error) {
            if (error instanceof AxiosError && error.response?.status === 404) {
                return false;
            }
            this.handleError(error, `storeExists(${store})`);
        }
    }

    async createImageMosaicStore(opts: CreateImageMosaicStoreOptions): Promise<void> {
        try {
            // Create the store by handing GeoServer the file:// URL of the directory.
            await this.http.put(
                `/rest/workspaces/${opts.workspace}/coveragestores/${opts.store}/external.imagemosaic`,
                `file://${opts.directory}/`,
                { headers: { 'Content-Type': 'text/plain' } },
            );

            // Enable the time dimension on the resulting coverage.
            await this.http.put(
                `/rest/workspaces/${opts.workspace}/coveragestores/${opts.store}/coverages/${opts.store}.json`,
                {
                    coverage: {
                        enabled: true,
                        metadata: {
                            entry: [
                                {
                                    '@key': 'time',
                                    dimensionInfo: {
                                        enabled: true,
                                        presentation: 'LIST',
                                        units: 'ISO8601',
                                        defaultValue: { strategy: 'MAXIMUM' },
                                    },
                                },
                            ],
                        },
                    },
                },
                { headers: { 'Content-Type': 'application/json' } },
            );
        } catch (error) {
            this.handleError(error, `createImageMosaicStore(${opts.store})`);
        }
    }

    async listGranules(workspace: string, layer: string): Promise<GeoserverGranule[]> {
        try {
            const { data } = await this.http.get<GranulesFeatureCollection>(
                `/rest/workspaces/${workspace}/coveragestores/${layer}/coverages/${layer}/index/granules.json`,
            );
            return (data.features ?? []).map((f) => ({
                id: f.id,
                location: f.properties.location,
                time: new Date(f.properties.ingestion),
            }));
        } catch (error) {
            if (error instanceof AxiosError && error.response?.status === 404) {
                // Store/layer does not exist yet → no granules.
                return [];
            }
            this.handleError(error, `listGranules(${layer})`);
        }
    }

    async addGranule(workspace: string, store: string, geotiffPath: string, time: Date): Promise<void> {
        // The ImageMosaic indexer extracts the timestamp from the filename via timeregex.properties.
        // The `time` argument is part of the port contract for symmetry with mocks/tests.
        void time;
        try {
            await this.http.post(
                `/rest/workspaces/${workspace}/coveragestores/${store}/external.imagemosaic`,
                `file://${geotiffPath}`,
                { headers: { 'Content-Type': 'text/plain' } },
            );
        } catch (error) {
            this.handleError(error, `addGranule(${store}, ${geotiffPath})`);
        }
    }

    async deleteGranulesOlderThan(workspace: string, layer: string, threshold: Date): Promise<number> {
        try {
            const isoThreshold = threshold.toISOString();
            const filter = encodeURIComponent(`ingestion < ${isoThreshold}`);
            const { data } = await this.http.delete<{ deleted?: number }>(
                `/rest/workspaces/${workspace}/coveragestores/${layer}/coverages/${layer}/index/granules?filter=${filter}`,
            );
            return data?.deleted ?? 0;
        } catch (error) {
            this.handleError(error, `deleteGranulesOlderThan(${layer}, ${threshold.toISOString()})`);
        }
    }

    async purgeMosaicIndex(tableName: string): Promise<void> {
        // GeoServer stores the mosaic index in a PostGIS table named after the store.
        // When a store is deleted via REST API, the table persists. We must drop it
        // before recreating the store so GeoServer starts with a clean slate.
        const ds = new DataSource({
            type: 'postgres',
            host: this.config.geoserverDbHost,
            port: this.config.geoserverDbPort,
            database: this.config.geoserverDbDatabase,
            username: this.config.geoserverDbUsername,
            password: this.config.geoserverDbPassword,
        });
        await ds.initialize();
        try {
            await ds.query(`DROP TABLE IF EXISTS "${tableName}"`);
            this.logger.log(`purgeMosaicIndex: dropped table "${tableName}" from GeoServer DB`);
        } finally {
            await ds.destroy();
        }
    }

    async proxyWms(workspace: string, params: Record<string, string>): Promise<{ data: Buffer; contentType: string }> {
        try {
            const response = await this.http.get(`/${workspace}/wms`, {
                params,
                responseType: 'arraybuffer',
                timeout: 30_000,
            });
            const contentType = (response.headers['content-type'] as string) ?? 'image/png';
            const data = Buffer.from(response.data as ArrayBuffer);

            // GeoServer returns XML ServiceException on errors (e.g., missing layer/granules)
            if (contentType.includes('xml') || contentType.includes('html')) {
                const body = data.toString('utf-8');
                const match = body.match(/<ServiceException[^>]*>([\s\S]*?)<\/ServiceException>/);
                const detail = match?.[1]?.trim() || 'Unknown GeoServer error';
                throw new ProviderError(`GeoServer WMS error: ${detail}`);
            }

            return { data, contentType };
        } catch (err) {
            if (err instanceof ProviderError) throw err;
            const msg = err instanceof AxiosError ? `${err.response?.status} ${err.message}` : String(err);
            throw new ProviderError(`GeoServer WMS proxy failed: ${msg}`);
        }
    }

    private handleError(error: unknown, context: string): never {
        if (error instanceof AxiosError) {
            const status = error.response?.status;
            const body = error.response?.data;
            const bodyStr = body ? ` body=${JSON.stringify(body).slice(0, 500)}` : '';
            const message = `geoserver ${context} failed: status=${status} message=${error.message}${bodyStr}`;
            this.logger.error({
                msg: 'GeoServer request failed',
                entity: 'GeoServer',
                context,
                status,
                error: error.message,
            });
            throw new ProviderError(message);
        }
        const message = `geoserver ${context} failed: ${(error as Error).message}`;
        this.logger.error({
            msg: 'GeoServer request failed',
            entity: 'GeoServer',
            context,
            error: (error as Error).message,
        });
        throw new ProviderError(message);
    }
}
