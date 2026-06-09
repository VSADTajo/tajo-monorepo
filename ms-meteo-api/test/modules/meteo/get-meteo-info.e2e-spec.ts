import { INestApplication, HttpStatus, Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { MeteoIngestRun } from '../../../src/app/domain/entities/meteo-ingest-run.entity';
import { IngestStatus, TriggerSource } from '../../../src/app/domain/types/ingest-status.enum';

import { MeteoController } from '../../../src/app/api/controllers/meteo.controller';
import { MeteoInfoHandler } from '../../../src/app/application/queries/meteo.queries';
import { MeteoDiscoveryService } from '../../../src/app/application/services/meteo-discovery.service';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { ISftpFileClient } from '../../../src/app/domain/ports/sftp-file-client.port';
import { IMeteoIngestRunRepository } from '../../../src/app/domain/ports/meteo-ingest-run-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { MeteoIngestRunRepository } from '../../../src/app/infrastructure/persistence/meteo-ingest-run.repository';
import { MeteoConfigService } from '../../../src/configuration/meteo/meteo-config.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { InMemorySftpFileClient, buildSftpTree } from '../../helpers/sftp-api.mock';
import { buildInfoJsonRaw, buildRasterFilenames } from '../../factories/meteo-info-json.factory';

describe('GET /meteo/info (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let sftpMock: InMemorySftpFileClient;

    const meteoConfigStub: Partial<MeteoConfigService> = {
        meteoBasePath: 'tajo/METEO',
        geoserverWorkspace: 'tajo',
    };

    const cacheStore = new Map<string, unknown>();
    const cacheMock: ICacheService = {
        get: jest.fn(async (k: string) => (cacheStore.has(k) ? cacheStore.get(k) : null)),
        set: jest.fn(async (k: string, v: unknown) => {
            cacheStore.set(k, v);
        }),
        del: jest.fn(async (k: string) => {
            cacheStore.delete(k);
        }),
        delByPattern: jest.fn(async (pattern: string) => {
            const prefix = pattern.replace(/\*$/, '');
            for (const k of [...cacheStore.keys()]) {
                if (k.startsWith(prefix)) cacheStore.delete(k);
            }
        }),
    } as unknown as ICacheService;

    function fullTree() {
        return buildSftpTree('tajo/METEO', {
            // RADAR (no variable subfolder)
            'RADAR/info.json': buildInfoJsonRaw({ nombre: 'Precipitación radar', fecha_inicio: '202604061200' }),
            ...Object.fromEntries(buildRasterFilenames('radarprec').map((name) => [`RADAR/${name}`, Buffer.from('x')])),
            // HARMONIE/Precipitacion
            'HARMONIE/Precipitacion/info.json': buildInfoJsonRaw({ nombre: 'Precipitación HARMONIE' }),
            ...Object.fromEntries(
                buildRasterFilenames('harm_prec').map((name) => [`HARMONIE/Precipitacion/${name}`, Buffer.from('x')]),
            ),
            // EPS/Precipitacion_25
            'EPS/Precipitacion_25/info.json': buildInfoJsonRaw({ nombre: 'EPS p25' }),
            ...Object.fromEntries(
                buildRasterFilenames('eps_p25').map((name) => [`EPS/Precipitacion_25/${name}`, Buffer.from('x')]),
            ),
        });
    }

    beforeAll(async () => {
        sftpMock = new InMemorySftpFileClient(fullTree());

        const ctx: TestContext = await createTestApp({
            entities: [MeteoIngestRun],
            controllers: [MeteoController],
            providers: [
                { provide: PinoLogger, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
                { provide: Logger, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
                { provide: ConfigService, useValue: { getOrThrow: jest.fn() } },
                { provide: MeteoConfigService, useValue: meteoConfigStub },
                { provide: ISftpFileClient, useValue: sftpMock },
                { provide: ICacheService, useValue: cacheMock },
                { provide: IMeteoIngestRunRepository, useClass: MeteoIngestRunRepository },
                CachingQueryBus,
                MeteoDiscoveryService,
                MeteoInfoHandler,
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        cacheStore.clear();
        sftpMock.setRoot(fullTree());
        sftpMock.listCalls = 0;
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    function get(path: string) {
        return request(app.getHttpServer()).get(path);
    }

    // ─────────────────────────────────────────────────────────────

    it('returns one entry per discovered (provider, variable)', async () => {
        const { body } = await get('/meteo/info').expect(HttpStatus.OK);
        expect(Array.isArray(body)).toBe(true);

        const layers = body.map((b: any) => b.layerName).sort();
        expect(layers).toEqual([
            'tajo:eps_precipitacion_25',
            'tajo:harmonie_precipitacion',
            'tajo:radar_precipitacion',
        ]);

        const radar = body.find((b: any) => b.provider === 'RADAR');
        expect(radar.variable).toBeNull();
        expect(radar.lastRun).toBeNull();
        expect(radar.info.nombre).toBe('Precipitación radar');
    });

    it('filter by provider', async () => {
        const { body } = await get('/meteo/info?provider=harmonie').expect(HttpStatus.OK);
        expect(body).toHaveLength(1);
        expect(body[0].provider).toBe('HARMONIE');
        expect(body[0].variable).toBe('Precipitacion');
    });

    it('filter by provider+variable', async () => {
        const { body } = await get('/meteo/info?provider=eps&variable=Precipitacion_25').expect(HttpStatus.OK);
        expect(body).toHaveLength(1);
        expect(body[0].layerName).toBe('tajo:eps_precipitacion_25');
    });

    it('rejects variable without provider', async () => {
        await get('/meteo/info?variable=Precipitacion').expect(HttpStatus.BAD_REQUEST);
    });

    it('returns 404 for unknown provider', async () => {
        await get('/meteo/info?provider=unknown').expect(HttpStatus.NOT_FOUND);
    });

    it('returns 404 for unknown variable inside known provider', async () => {
        await get('/meteo/info?provider=harmonie&variable=NoSuchVariable').expect(HttpStatus.NOT_FOUND);
    });

    it('attaches lastRun when a run row exists for the dataset', async () => {
        const repo = dataSource.getRepository(MeteoIngestRun);
        const run = new MeteoIngestRun({
            provider: 'HARMONIE',
            variable: 'Precipitacion',
            triggeredBy: TriggerSource.MANUAL,
            startedAt: new Date('2026-04-06T18:00:00Z'),
            status: IngestStatus.OK,
            filesProcessed: 48,
            filesOk: 48,
            filesFailed: 0,
        });
        run.markOk(48);
        run.startedAt = new Date('2026-04-06T18:00:00Z');
        run.finishedAt = new Date('2026-04-06T18:02:14Z');
        await repo.save(run);

        const { body } = await get('/meteo/info?provider=harmonie&variable=Precipitacion').expect(HttpStatus.OK);
        expect(body[0].lastRun).not.toBeNull();
        expect(body[0].lastRun.status).toBe('ok');
        expect(body[0].lastRun.filesOk).toBe(48);
    });

    it('cache hit: second call within TTL does not re-list the SFTP', async () => {
        sftpMock.listCalls = 0;
        await get('/meteo/info?provider=radar').expect(HttpStatus.OK);
        const callsAfterFirst = sftpMock.listCalls;
        expect(callsAfterFirst).toBeGreaterThan(0);

        await get('/meteo/info?provider=radar').expect(HttpStatus.OK);
        expect(sftpMock.listCalls).toBe(callsAfterFirst);
    });
});
