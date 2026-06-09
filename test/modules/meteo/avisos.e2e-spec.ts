import { INestApplication, HttpStatus } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { MeteoIngestRun } from '../../../src/app/domain/entities/meteo-ingest-run.entity';
import { MeteoController } from '../../../src/app/api/controllers/meteo.controller';
import {
    GetAvisosHandler,
    GetAvisosResumenHandler,
    GetAvisosTiposHandler,
} from '../../../src/app/application/queries/avisos.queries';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';
import { IAemetClient, AemetGeoJsonCollection } from '../../../src/app/domain/ports/aemet-client.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { IGeoserverImageMosaicClient } from '../../../src/app/domain/ports/geoserver-image-mosaic-client.port';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { buildAvisosFeature } from '../../factories/avisos.factory';

describe('Avisos AEMET (e2e)', () => {
    let app: INestApplication;
    let pgContainer: StartedPostgreSqlContainer;

    // Dates relative to "now" for vigencia tests
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const in4Days = new Date(now);
    in4Days.setDate(in4Days.getDate() + 4);

    const mockFeatures = [
        // Active alert in Madrid (Tajo), amarillo — should appear
        buildAvisosFeature({
            eventTypeCode: 'AT',
            eventTypeName: 'Temperaturas máximas',
            provinciaCode: '28',
            level: 'amarillo',
            onset: yesterday.toISOString(),
            expires: tomorrow.toISOString(),
        }),
        // Active alert in Toledo (Tajo), rojo — should appear
        buildAvisosFeature({
            eventTypeCode: 'PR',
            eventTypeName: 'Lluvias',
            provinciaCode: '45',
            level: 'rojo',
            onset: yesterday.toISOString(),
            expires: tomorrow.toISOString(),
        }),
        // Verde level in Madrid (Tajo) — should be EXCLUDED
        buildAvisosFeature({
            eventTypeCode: 'AT',
            eventTypeName: 'Temperaturas máximas',
            provinciaCode: '28',
            level: 'verde',
            onset: yesterday.toISOString(),
            expires: tomorrow.toISOString(),
        }),
        // Alert in Barcelona (NOT Tajo, province 08) — should be EXCLUDED
        buildAvisosFeature({
            eventTypeCode: 'VI',
            eventTypeName: 'Vientos',
            provinciaCode: '08',
            level: 'naranja',
            onset: yesterday.toISOString(),
            expires: tomorrow.toISOString(),
        }),
        // Expired alert in Madrid — should appear in /avisos but NOT in /avisos/resumen
        buildAvisosFeature({
            eventTypeCode: 'TO',
            eventTypeName: 'Tormentas',
            provinciaCode: '28',
            level: 'amarillo',
            onset: new Date('2026-01-01').toISOString(),
            expires: new Date('2026-01-02').toISOString(),
        }),
        // Future alert (onset > day after tomorrow) — should appear in /avisos but NOT in /avisos/resumen
        buildAvisosFeature({
            eventTypeCode: 'NE',
            eventTypeName: 'Nevadas',
            provinciaCode: '28',
            level: 'naranja',
            onset: in4Days.toISOString(),
            expires: new Date(in4Days.getTime() + 86400000).toISOString(),
        }),
    ];

    const aemetMock: IAemetClient = {
        fetchAvisos: jest.fn(
            async (): Promise<AemetGeoJsonCollection> => ({
                type: 'FeatureCollection',
                features: mockFeatures,
            }),
        ),
    } as unknown as IAemetClient;

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

    const geoserverMock = {
        storeExists: jest.fn(),
        createImageMosaicStore: jest.fn(),
        listGranules: jest.fn(),
        addGranule: jest.fn(),
        deleteGranulesOlderThan: jest.fn(),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [MeteoIngestRun],
            controllers: [MeteoController],
            providers: [
                { provide: PinoLogger, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
                { provide: IAemetClient, useValue: aemetMock },
                { provide: ICacheService, useValue: cacheMock },
                { provide: IGeoserverImageMosaicClient, useValue: geoserverMock },
                CachingQueryBus,
                GetAvisosHandler,
                GetAvisosResumenHandler,
                GetAvisosTiposHandler,
            ],
        });
        app = ctx.app;
        pgContainer = ctx.pgContainer;
    }, 60_000);

    afterEach(() => {
        cacheStore.clear();
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
    // GET /meteo/avisos
    // ─────────────────────────────────────────────────────────────

    describe('GET /meteo/avisos', () => {
        it('excludes features with level verde', async () => {
            const { body } = await get('/meteo/avisos').expect(HttpStatus.OK);

            const levels = body.features.map((f: any) => f.properties.level);
            expect(levels).not.toContain('verde');
        });

        it('excludes features outside Tajo basin', async () => {
            const { body } = await get('/meteo/avisos').expect(HttpStatus.OK);

            const provincias = body.features.map((f: any) => f.properties.provinciaCode);
            expect(provincias).not.toContain('08');
        });

        it('returns only Tajo + non-verde features', async () => {
            const { body } = await get('/meteo/avisos').expect(HttpStatus.OK);

            // 6 total - 1 verde - 1 outside Tajo = 4 expected
            expect(body.features).toHaveLength(4);
            expect(body.type).toBe('FeatureCollection');
        });

        it('filters by tipo', async () => {
            const { body } = await get('/meteo/avisos?tipo=AT').expect(HttpStatus.OK);

            // Only the AT amarillo in Madrid (verde excluded)
            expect(body.features).toHaveLength(1);
            expect(body.features[0].properties.eventTypeCode).toBe('AT');
            expect(body.features[0].properties.level).toBe('amarillo');
        });

        it('filters by provincia', async () => {
            const { body } = await get('/meteo/avisos?provincia=45').expect(HttpStatus.OK);

            expect(body.features).toHaveLength(1);
            expect(body.features[0].properties.provinciaCode).toBe('45');
        });

        it('rejects invalid tipo', async () => {
            await get('/meteo/avisos?tipo=INVALID').expect(HttpStatus.BAD_REQUEST);
        });

        it('rejects invalid provincia', async () => {
            await get('/meteo/avisos?provincia=99').expect(HttpStatus.BAD_REQUEST);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // GET /meteo/avisos/tipos
    // ─────────────────────────────────────────────────────────────

    describe('GET /meteo/avisos/tipos', () => {
        it('returns all 13 event types', async () => {
            const { body } = await get('/meteo/avisos/tipos').expect(HttpStatus.OK);

            expect(body.tipos).toHaveLength(13);
            expect(body.tipos[0]).toHaveProperty('code');
            expect(body.tipos[0]).toHaveProperty('name');

            const codes = body.tipos.map((t: any) => t.code);
            expect(codes).toContain('AT');
            expect(codes).toContain('PR');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // GET /meteo/avisos/resumen
    // ─────────────────────────────────────────────────────────────

    describe('GET /meteo/avisos/resumen', () => {
        it('returns only categories with active (vigente) alerts', async () => {
            const { body } = await get('/meteo/avisos/resumen').expect(HttpStatus.OK);

            expect(body).toHaveProperty('categoriasActivas');
            expect(body).toHaveProperty('totalAvisos');

            const codes = body.categoriasActivas.map((c: any) => c.code);
            // AT (amarillo, Madrid) and PR (rojo, Toledo) are active
            expect(codes).toContain('AT');
            expect(codes).toContain('PR');
        });

        it('excludes verde level from resumen', async () => {
            const { body } = await get('/meteo/avisos/resumen').expect(HttpStatus.OK);

            // The verde AT feature should not contribute to the count
            const at = body.categoriasActivas.find((c: any) => c.code === 'AT');
            expect(at.count).toBe(1); // only amarillo, not verde
        });

        it('excludes expired alerts from resumen', async () => {
            const { body } = await get('/meteo/avisos/resumen').expect(HttpStatus.OK);

            const codes = body.categoriasActivas.map((c: any) => c.code);
            // TO (tormentas) is expired (Jan 2026) — should NOT appear
            expect(codes).not.toContain('TO');
        });

        it('excludes alerts with onset beyond day after tomorrow', async () => {
            const { body } = await get('/meteo/avisos/resumen').expect(HttpStatus.OK);

            const codes = body.categoriasActivas.map((c: any) => c.code);
            // NE (nevadas) has onset 4 days from now — should NOT appear
            expect(codes).not.toContain('NE');
        });

        it('returns correct totalAvisos count', async () => {
            const { body } = await get('/meteo/avisos/resumen').expect(HttpStatus.OK);

            // Only AT (1) + PR (1) are active and vigente = 2 total
            expect(body.totalAvisos).toBe(2);
        });

        it('each categoria has code, name and count', async () => {
            const { body } = await get('/meteo/avisos/resumen').expect(HttpStatus.OK);

            for (const cat of body.categoriasActivas) {
                expect(cat).toHaveProperty('code');
                expect(cat).toHaveProperty('name');
                expect(cat).toHaveProperty('count');
                expect(typeof cat.count).toBe('number');
                expect(cat.count).toBeGreaterThan(0);
            }
        });
    });
});
