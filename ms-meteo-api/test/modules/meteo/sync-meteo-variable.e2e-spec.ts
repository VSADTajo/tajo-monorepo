import { INestApplication, HttpStatus, Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { MeteoIngestRun } from '../../../src/app/domain/entities/meteo-ingest-run.entity';
import { IngestStatus } from '../../../src/app/domain/types/ingest-status.enum';

import { MeteoController } from '../../../src/app/api/controllers/meteo.controller';
import { SyncMeteoHandler } from '../../../src/app/application/commands/meteo.commands';
import { MeteoDiscoveryService } from '../../../src/app/application/services/meteo-discovery.service';
import { DatasetMutex } from '../../../src/app/application/services/dataset-mutex';
import { ImageMosaicBootstrapService } from '../../../src/app/application/services/image-mosaic-bootstrap.service';
import { IFileSystem } from '../../../src/app/domain/ports/file-system.port';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { ISftpFileClient } from '../../../src/app/domain/ports/sftp-file-client.port';
import { IGeoserverImageMosaicClient } from '../../../src/app/domain/ports/geoserver-image-mosaic-client.port';
import { IRasterConverter } from '../../../src/app/domain/ports/raster-converter.port';
import { IMeteoIngestRunRepository } from '../../../src/app/domain/ports/meteo-ingest-run-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { MeteoIngestRunRepository } from '../../../src/app/infrastructure/persistence/meteo-ingest-run.repository';
import { MeteoConfigService } from '../../../src/configuration/meteo/meteo-config.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { InMemorySftpFileClient, buildSftpTree } from '../../helpers/sftp-api.mock';
import { InMemoryGeoserverImageMosaicClient } from '../../helpers/geoserver-rest.mock';
import { InMemoryRasterConverter } from '../../helpers/gdal.mock';
import { buildInfoJsonRaw, buildRasterFilenames } from '../../factories/meteo-info-json.factory';

describe('Sync Meteo Variable (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    let sftpMock: InMemorySftpFileClient;
    let geoserverMock: InMemoryGeoserverImageMosaicClient;
    let gdalMock: InMemoryRasterConverter;

    const tmpGeotiffDir = path.join(os.tmpdir(), `meteo-test-${Date.now()}`);

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

    const noopCache: ICacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    } as unknown as ICacheService;

    beforeAll(async () => {
        // Build a synthetic SFTP tree: HARMONIE/Precipitacion with 48 raster files + info.json.
        sftpMock = new InMemorySftpFileClient(
            buildSftpTree('tajo/METEO', {
                'HARMONIE/Precipitacion/info.json': buildInfoJsonRaw({
                    nombre: 'Precipitación HARMONIE',
                    fecha_inicio: '202604061200',
                    fecha_fin: '202604081100',
                }),
                ...Object.fromEntries(
                    buildRasterFilenames('harm_prec').map((name) => [
                        `HARMONIE/Precipitacion/${name}`,
                        Buffer.from(`fake-raster-${name}`),
                    ]),
                ),
            }),
        );
        geoserverMock = new InMemoryGeoserverImageMosaicClient();
        gdalMock = new InMemoryRasterConverter();

        const ctx: TestContext = await createTestApp({
            entities: [MeteoIngestRun],
            controllers: [MeteoController],
            providers: [
                { provide: PinoLogger, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
                { provide: Logger, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
                { provide: ConfigService, useValue: { getOrThrow: jest.fn() } },
                { provide: MeteoConfigService, useValue: meteoConfigStub },
                { provide: ISftpFileClient, useValue: sftpMock },
                { provide: IGeoserverImageMosaicClient, useValue: geoserverMock },
                { provide: IRasterConverter, useValue: gdalMock },
                {
                    provide: IFileSystem,
                    useValue: {
                        mkdir: jest.fn().mockResolvedValue(undefined),
                        writeFile: jest.fn().mockResolvedValue(undefined),
                        deleteFile: jest.fn().mockResolvedValue(undefined),
                    },
                },
                { provide: ICacheService, useValue: noopCache },
                { provide: IMeteoIngestRunRepository, useClass: MeteoIngestRunRepository },
                CachingQueryBus,
                DatasetMutex,
                MeteoDiscoveryService,
                ImageMosaicBootstrapService,
                SyncMeteoHandler,
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        sftpMock.setRoot(
            buildSftpTree('tajo/METEO', {
                'HARMONIE/Precipitacion/info.json': buildInfoJsonRaw({
                    nombre: 'Precipitación HARMONIE',
                    fecha_inicio: '202604061200',
                    fecha_fin: '202604081100',
                }),
                ...Object.fromEntries(
                    buildRasterFilenames('harm_prec').map((name) => [
                        `HARMONIE/Precipitacion/${name}`,
                        Buffer.from(`fake-raster-${name}`),
                    ]),
                ),
            }),
        );
        geoserverMock.reset();
        gdalMock.reset();
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

    function syncOne() {
        return request(app.getHttpServer()).post('/meteo/sync?provider=harmonie&variable=Precipitacion');
    }

    function listRuns(): Promise<MeteoIngestRun[]> {
        return dataSource.getRepository(MeteoIngestRun).find({ order: { startedAt: 'DESC' } });
    }

    // ─────────────────────────────────────────────────────────────

    it('initial publish: bootstraps store and adds 48 granules', async () => {
        const { body } = await syncOne()
            .expect(HttpStatus.CREATED)
            .catch(() => syncOne().expect(HttpStatus.OK));

        expect(body.datasets).toHaveLength(1);
        expect(body.datasets[0].provider).toBe('HARMONIE');
        expect(body.datasets[0].variable).toBe('Precipitacion');
        expect(body.datasets[0].status).toBe('ok');
        expect(body.datasets[0].filesOk).toBe(48);
        expect(body.datasets[0].filesFailed).toBe(0);

        expect(geoserverMock.createStoreCalls).toBe(1);
        expect(geoserverMock.addGranuleCalls).toBe(48);
        expect(gdalMock.calls).toHaveLength(48);

        const runs = await listRuns();
        expect(runs).toHaveLength(1);
        expect(runs[0].status).toBe(IngestStatus.OK);
        expect(runs[0].filesOk).toBe(48);
    });

    it('re-sync after full publish: noop with zero conversions', async () => {
        await syncOne();
        gdalMock.reset();
        geoserverMock.addGranuleCalls = 0;

        const { body } = await syncOne();
        expect(body.datasets[0].status).toBe('noop');
        expect(gdalMock.calls).toHaveLength(0);
        expect(geoserverMock.addGranuleCalls).toBe(0);

        const runs = await listRuns();
        expect(runs).toHaveLength(2);
        expect(runs[0].status).toBe(IngestStatus.NOOP);
    });

    it('partial reconcile: only the missing 1 file is processed', async () => {
        await syncOne();

        // Remove one granule from GeoServer to simulate it being missing.
        const store = geoserverMock.stores.get('tajo:harmonie_precipitacion')!;
        store.granules.pop();

        gdalMock.reset();
        geoserverMock.addGranuleCalls = 0;

        const { body } = await syncOne();
        expect(body.datasets[0].status).toBe('ok');
        expect(body.datasets[0].filesOk).toBe(1);
        expect(gdalMock.calls).toHaveLength(1);
        expect(geoserverMock.addGranuleCalls).toBe(1);
    });

    it('GDAL failure on one file: marks run partial then recovers next sync', async () => {
        // First, run normally to know the GeoTIFF path that will be generated.
        await syncOne();
        const generatedFile = gdalMock.calls[5].outputPath;

        // Reset GeoServer + force GDAL to fail on one specific file.
        geoserverMock.reset();
        gdalMock.reset();
        gdalMock.failOnOutput.add(generatedFile);

        const { body: first } = await syncOne();
        expect(first.datasets[0].status).toBe('partial');
        expect(first.datasets[0].filesOk).toBe(47);
        expect(first.datasets[0].filesFailed).toBe(1);

        // Recover.
        gdalMock.failOnOutput.clear();
        gdalMock.reset();
        const { body: second } = await syncOne();
        expect(second.datasets[0].status).toBe('ok');
        expect(second.datasets[0].filesOk).toBe(1);
    });

    it('malformed info.json: dataset is skipped, no run row is written', async () => {
        sftpMock.setRoot(
            buildSftpTree('tajo/METEO', {
                'HARMONIE/Precipitacion/info.json': '{ this is not valid json',
            }),
        );

        // Discovery skips the variable → returns []. The endpoint then 404s
        // because the explicit (provider, variable) filter found nothing.
        const res = await syncOne();
        expect(res.status).toBe(HttpStatus.NOT_FOUND);

        const runs = await listRuns();
        expect(runs).toHaveLength(0);
    });
});
