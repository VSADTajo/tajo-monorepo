import { INestApplication, HttpStatus, Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { MeteoIngestRun } from '../../../src/app/domain/entities/meteo-ingest-run.entity';
import { MeteoController } from '../../../src/app/api/controllers/meteo.controller';
import { AccumulateMeteoHandler } from '../../../src/app/application/commands/meteo.commands';
import { MeteoDiscoveryService } from '../../../src/app/application/services/meteo-discovery.service';
import { MeteoAggregationService } from '../../../src/app/application/services/meteo-aggregation.service';
import { ImageMosaicBootstrapService } from '../../../src/app/application/services/image-mosaic-bootstrap.service';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { ISftpFileClient } from '../../../src/app/domain/ports/sftp-file-client.port';
import { IGeoserverImageMosaicClient } from '../../../src/app/domain/ports/geoserver-image-mosaic-client.port';
import { IRasterConverter } from '../../../src/app/domain/ports/raster-converter.port';
import { IFileSystem } from '../../../src/app/domain/ports/file-system.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { MeteoConfigService } from '../../../src/configuration/meteo/meteo-config.service';
import { GeoTiffPathValueObject } from '../../../src/app/domain/value-objects/geotiff-path.value-object';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { InMemorySftpFileClient, buildSftpTree } from '../../helpers/sftp-api.mock';
import { InMemoryGeoserverImageMosaicClient } from '../../helpers/geoserver-rest.mock';
import { InMemoryRasterConverter } from '../../helpers/gdal.mock';
import { buildInfoJsonRaw, buildRasterFilenames } from '../../factories/meteo-info-json.factory';

// ─────────────────────────────────────────────────────────────
// Accumulate Meteo — POST /meteo/accumulate + GET /meteo/accumulate/map
// ─────────────────────────────────────────────────────────────

describe('Accumulate Meteo (e2e)', () => {
    let app: INestApplication;
    let pgContainer: StartedPostgreSqlContainer;

    let sftpMock: InMemorySftpFileClient;
    let geoserverMock: InMemoryGeoserverImageMosaicClient;
    let gdalMock: InMemoryRasterConverter;
    let cacheGetMock: jest.Mock;
    let cacheSetMock: jest.Mock;
    let cacheDelByPatternMock: jest.Mock;

    const tmpGeotiffDir = path.join(os.tmpdir(), `meteo-acum-test-${Date.now()}`);

    // Dates used across tests — 48 hourly files: 2026-04-06T12:00 → 2026-04-08T11:00
    const FORECAST_START = { fecha_inicio: '202604061200', fecha_fin: '202604081100' };

    const meteoConfigStub: Partial<MeteoConfigService> = {
        sftpApiUrl: 'http://mock',
        sftpApiInternalCaller: 'ms-meteo-api',
        meteoBasePath: 'tajo/METEO',
        geoserverWorkspace: 'tajo',
        meteoGeotiffDir: tmpGeotiffDir,
        meteoIngestConcurrency: 4,
        geoserverUrl: 'http://mock',
        geoserverUser: 'admin',
        geoserverPassword: 'admin',
        meteoSyncCron: '* * * * *',
        meteoRetentionCron: '* * * * *',
        meteoRetentionDays: 7,
    };

    beforeAll(async () => {
        // Create 48 stub hourly GeoTIFF files on disk so aggregateRange can find them.
        const layerDir = path.join(tmpGeotiffDir, 'harmonie_precipitacion');
        fs.mkdirSync(layerDir, { recursive: true });
        for (let i = 0; i < 48; i++) {
            const t = new Date(Date.UTC(2026, 3, 6, 12 + i, 0, 0)); // 2026-04-06T12:00+i hours
            const ts = GeoTiffPathValueObject.formatTimestamp(t);
            fs.writeFileSync(path.join(layerDir, `harmonie_precipitacion_${ts}.tif`), 'stub');
        }

        sftpMock = new InMemorySftpFileClient(
            buildSftpTree('tajo/METEO', {
                'HARMONIE/Precipitacion/info.json': buildInfoJsonRaw(FORECAST_START),
                ...Object.fromEntries(
                    buildRasterFilenames('harm_prec').map((name) => [
                        `HARMONIE/Precipitacion/${name}`,
                        Buffer.from('stub'),
                    ]),
                ),
            }),
        );

        geoserverMock = new InMemoryGeoserverImageMosaicClient();
        gdalMock = new InMemoryRasterConverter();
        cacheGetMock = jest.fn().mockResolvedValue(null);
        cacheSetMock = jest.fn().mockResolvedValue(undefined);
        cacheDelByPatternMock = jest.fn().mockResolvedValue(undefined);

        const cacheServiceMock = {
            get: cacheGetMock,
            set: cacheSetMock,
            del: jest.fn().mockResolvedValue(undefined),
            delByPattern: cacheDelByPatternMock,
        } as unknown as ICacheService;

        // IFileSystem reads from the real tmpdir for listFiles, stubs the rest.
        const fileSystemMock: IFileSystem = {
            mkdir: jest.fn().mockResolvedValue(undefined),
            writeFile: jest.fn().mockResolvedValue(undefined),
            deleteFile: jest.fn().mockResolvedValue(undefined),
            listFiles: async (directory: string) => {
                try {
                    return fs.readdirSync(directory);
                } catch {
                    return [];
                }
            },
        } as unknown as IFileSystem;

        const ctx: TestContext = await createTestApp({
            entities: [MeteoIngestRun],
            controllers: [MeteoController],
            providers: [
                {
                    provide: PinoLogger,
                    useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
                },
                { provide: Logger, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } },
                { provide: ConfigService, useValue: { getOrThrow: jest.fn() } },
                { provide: MeteoConfigService, useValue: meteoConfigStub },
                { provide: ISftpFileClient, useValue: sftpMock },
                { provide: IGeoserverImageMosaicClient, useValue: geoserverMock },
                { provide: IRasterConverter, useValue: gdalMock },
                { provide: IFileSystem, useValue: fileSystemMock },
                { provide: ICacheService, useValue: cacheServiceMock },
                CachingQueryBus,
                MeteoDiscoveryService,
                ImageMosaicBootstrapService,
                MeteoAggregationService,
                AccumulateMeteoHandler,
            ],
        });

        app = ctx.app;
        pgContainer = ctx.pgContainer;
    }, 60_000);

    afterEach(() => {
        geoserverMock.reset();
        gdalMock.reset();
        cacheGetMock.mockResolvedValue(null);
        cacheSetMock.mockClear();
        cacheDelByPatternMock.mockClear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
        try {
            fs.rmSync(tmpGeotiffDir, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    });

    function accumulate(body: object) {
        return request(app.getHttpServer()).post('/meteo/accumulate').send(body);
    }

    function accumulateMap(query: Record<string, string>) {
        return request(app.getHttpServer()).get('/meteo/accumulate/map').query(query);
    }

    // ─────────────────────────────────────────────────────────────
    // POST /meteo/accumulate — validation
    // ─────────────────────────────────────────────────────────────

    it('returns 400 for invalid date format', async () => {
        const { body } = await accumulate({
            provider: 'harmonie',
            variable: 'Precipitacion',
            from: 'not-a-date',
            to: '2026-04-07T00:00:00Z',
        }).expect(HttpStatus.BAD_REQUEST);
        expect(body.ErrorDescription).toMatch(/invalid date/i);
    });

    it('returns 400 when from >= to', async () => {
        const { body } = await accumulate({
            provider: 'harmonie',
            variable: 'Precipitacion',
            from: '2026-04-07T00:00:00Z',
            to: '2026-04-06T00:00:00Z',
        }).expect(HttpStatus.BAD_REQUEST);
        expect(body.ErrorDescription).toMatch(/from.*before.*to/i);
    });

    it('returns 400 when required fields are missing', async () => {
        await accumulate({ provider: 'harmonie' }).expect(HttpStatus.BAD_REQUEST);
    });

    it('returns 404 when provider does not exist in SFTP', async () => {
        const { body } = await accumulate({
            provider: 'unknown',
            from: '2026-04-06T12:00:00Z',
            to: '2026-04-07T12:00:00Z',
        }).expect(HttpStatus.NOT_FOUND);
        expect(body.ErrorDescription).toMatch(/provider not found/i);
    });

    it('returns 404 when no hourly data exists in the requested range', async () => {
        // Range is entirely outside the forecast window (2026-04-06 to 2026-04-08).
        const { body } = await accumulate({
            provider: 'harmonie',
            variable: 'Precipitacion',
            from: '2025-01-01T00:00:00Z',
            to: '2025-01-02T00:00:00Z',
        }).expect(HttpStatus.NOT_FOUND);
        expect(body.ErrorDescription).toMatch(/no hourly data/i);
    });

    // ─────────────────────────────────────────────────────────────
    // POST /meteo/accumulate — happy path
    // ─────────────────────────────────────────────────────────────

    it('computes accumulated layer for a valid date range', async () => {
        const { body } = await accumulate({
            provider: 'harmonie',
            variable: 'Precipitacion',
            from: '2026-04-06T12:00:00Z',
            to: '2026-04-07T12:00:00Z',
        }).expect(HttpStatus.OK);

        expect(body.provider).toBe('HARMONIE');
        expect(body.variable).toBe('Precipitacion');
        expect(body.layerName).toContain('acumulado');
        expect(body.filesUsed).toBe(25);
        expect(body.from).toBeDefined();
        expect(body.to).toBeDefined();

        // GDAL sumGeoTiffs must have been called once.
        expect(gdalMock.sumCalls).toHaveLength(1);
        // GeoServer received one new granule.
        expect(geoserverMock.addGranuleCalls).toBe(1);
        // Result was cached.
        expect(cacheSetMock).toHaveBeenCalledTimes(1);
    });

    it('returns cached result without re-running GDAL on second call with same range', async () => {
        cacheGetMock.mockResolvedValue({
            layerName: 'tajo:harmonie_precipitacion_acumulado',
            filesUsed: 36,
        });

        const { body } = await accumulate({
            provider: 'harmonie',
            variable: 'Precipitacion',
            from: '2026-04-06T12:00:00Z',
            to: '2026-04-07T12:00:00Z',
        }).expect(HttpStatus.OK);

        expect(body.filesUsed).toBe(36);
        expect(body.layerName).toBe('tajo:harmonie_precipitacion_acumulado');
        // GDAL must NOT have been called.
        expect(gdalMock.sumCalls).toHaveLength(0);
        expect(geoserverMock.addGranuleCalls).toBe(0);
    });

    // ─────────────────────────────────────────────────────────────
    // GET /meteo/accumulate/map
    // ─────────────────────────────────────────────────────────────

    it('returns PNG image for a valid range', async () => {
        geoserverMock.setProxyWmsResponse(Buffer.from('PNG-data'), 'image/png');

        const response = await accumulateMap({
            provider: 'harmonie',
            variable: 'Precipitacion',
            from: '2026-04-06T12:00:00Z',
            to: '2026-04-07T12:00:00Z',
        });

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.headers['content-type']).toContain('image/png');
        expect(geoserverMock.proxyWmsCalls).toBe(1);
    });

    it('uses WMS passthrough params when provided', async () => {
        geoserverMock.setProxyWmsResponse(Buffer.from('PNG-small'), 'image/png');
        let capturedParams: Record<string, string> = {};
        const original = geoserverMock.proxyWms.bind(geoserverMock);
        geoserverMock.proxyWms = async (workspace, params) => {
            capturedParams = params;
            return original(workspace, params);
        };

        await accumulateMap({
            provider: 'harmonie',
            variable: 'Precipitacion',
            from: '2026-04-06T12:00:00Z',
            to: '2026-04-07T12:00:00Z',
            WIDTH: '400',
            HEIGHT: '200',
        });

        expect(capturedParams.WIDTH).toBe('400');
        expect(capturedParams.HEIGHT).toBe('200');
        // LAYERS is always overridden with the computed layer.
        expect(capturedParams.LAYERS).toContain('acumulado');
    });

    it('returns 404 for map request when date range has no data', async () => {
        const response = await accumulateMap({
            provider: 'harmonie',
            variable: 'Precipitacion',
            from: '2025-01-01T00:00:00Z',
            to: '2025-01-02T00:00:00Z',
        });
        expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('returns 404 for map request when provider does not exist', async () => {
        const response = await accumulateMap({
            provider: 'ghost',
            from: '2026-04-06T12:00:00Z',
            to: '2026-04-07T12:00:00Z',
        });
        expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });
});
