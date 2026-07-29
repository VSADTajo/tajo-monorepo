import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { Basin } from '../../../src/app/domain/entities/basin.entity';
import { SubBasin } from '../../../src/app/domain/entities/sub-basin.entity';
import { Station } from '../../../src/app/domain/entities/station.entity';
import { StationThreshold } from '../../../src/app/domain/entities/station-threshold.entity';
import { IBasinRepository } from '../../../src/app/domain/ports/basin-repository.port';
import { ISubBasinRepository } from '../../../src/app/domain/ports/sub-basin-repository.port';
import { IStationRepository } from '../../../src/app/domain/ports/station-repository.port';
import { IStationThresholdRepository } from '../../../src/app/domain/ports/station-threshold-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { BasinRepository } from '../../../src/app/infrastructure/persistence/basin.repository';
import { SubBasinRepository } from '../../../src/app/infrastructure/persistence/sub-basin.repository';
import { StationRepository } from '../../../src/app/infrastructure/persistence/station.repository';
import { StationThresholdRepository } from '../../../src/app/infrastructure/persistence/station-threshold.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { CreateBasinHandler } from '../../../src/app/application/commands/basin.commands';
import { ImportStationsHandler } from '../../../src/app/application/commands/station.commands';
import { GetStationByCodeHandler, ListStationsHandler } from '../../../src/app/application/queries/station.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { StationController } from '../../../src/app/api/controllers/station.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';

// A single station entry in the sample-stations.json shape (demo labels, embedded predictions).
function buildImportItem(overrides: Record<string, unknown> = {}) {
    return {
        id: 'local-AR50',
        name: 'Río Ejemplo en Aranjuez',
        stationCode: 'AR50',
        stationType: 'Aforo',
        latitude: 40.0316,
        longitude: -3.6042,
        tipoCod: 'A',
        subBasinName: 'Cuenca Ejemplo',
        municipio: 'Aranjuez',
        provincia: 'Madrid',
        ccaa: 'Comunidad de Madrid',
        threshold: { umbralCaudal1: 15, umbralCaudal2: 25, umbralCaudal3: 40 },
        predictions: {
            historical: {
                id: 'local-AR50-FICT98.historical',
                predictionProvider: 'MOCK',
                results: [{ id: 1, date: '2026-07-27T17:19:47.457Z', value: 5.593, flag: 0 }],
            },
        },
        ...overrides,
    };
}

describe('Import Stations (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [Basin, SubBasin, Station, StationThreshold],
            controllers: [BasinController, StationController],
            providers: [
                CreateBasinHandler,
                ImportStationsHandler,
                GetStationByCodeHandler,
                ListStationsHandler,
                CachingQueryBus,
                { provide: IBasinRepository, useClass: BasinRepository },
                { provide: ISubBasinRepository, useClass: SubBasinRepository },
                { provide: IStationRepository, useClass: StationRepository },
                { provide: IStationThresholdRepository, useClass: StationThresholdRepository },
                { provide: ICacheService, useValue: mockCacheService },
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    // ─── Helpers ──────────────────────────────────────────────
    function createBasin() {
        return request(app.getHttpServer()).post('/basins').send(buildCreateBasinDto());
    }

    function importStations(body: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/stations/import').send(body);
    }

    function getByCode(code: string) {
        return request(app.getHttpServer()).get(`/stations/by-code/${code}`);
    }

    function listStations() {
        return request(app.getHttpServer()).get('/stations');
    }

    async function seedBasin(): Promise<string> {
        const { body: basin } = await createBasin().expect(HttpStatus.CREATED);
        return basin.id;
    }

    // ─── Happy path ───────────────────────────────────────────
    it('imports sample-shaped items, mapping labels and auto-creating the sub-basin', async () => {
        const basinId = await seedBasin();

        const { body } = await importStations({
            basinId,
            items: [
                buildImportItem(),
                buildImportItem({ id: 'local-EM10', name: 'Embalse Ejemplo', stationCode: 'EM10', stationType: 'Embalse', tipoCod: 'E' }),
            ],
        }).expect(HttpStatus.OK);

        expect(body).toEqual({ total: 2, created: 2, updated: 0, skipped: 0, errors: [] });

        // Aforo → AFORO_EN_RIO, threshold applied, sub-basin resolved by name.
        const { body: aforo } = await getByCode('AR50').expect(HttpStatus.OK);
        expect(aforo.stationType).toBe('AFORO_EN_RIO');
        expect(aforo.subBasinName).toBe('Cuenca Ejemplo');
        expect(aforo.municipio).toBe('Aranjuez');
        expect(aforo.threshold.umbralCaudal1).toBe(15);
        expect(aforo.threshold.umbralCaudal3).toBe(40);

        // Embalse → EMBALSE_SAIH.
        const { body: embalse } = await getByCode('EM10').expect(HttpStatus.OK);
        expect(embalse.stationType).toBe('EMBALSE_SAIH');

        // Both stations share the single auto-created sub-basin.
        expect(embalse.subBasinId).toBe(aforo.subBasinId);
    });

    // ─── Idempotency ──────────────────────────────────────────
    it('is idempotent by stationCode: re-import updates instead of duplicating', async () => {
        const basinId = await seedBasin();
        const payload = { basinId, items: [buildImportItem()] };

        const { body: first } = await importStations(payload).expect(HttpStatus.OK);
        expect(first).toMatchObject({ created: 1, updated: 0 });

        const { body: second } = await importStations({
            basinId,
            items: [buildImportItem({ name: 'Río Ejemplo (actualizado)' })],
        }).expect(HttpStatus.OK);
        expect(second).toMatchObject({ created: 0, updated: 1, skipped: 0 });

        const { body: updated } = await getByCode('AR50').expect(HttpStatus.OK);
        expect(updated.name).toBe('Río Ejemplo (actualizado)');

        const { body: list } = await listStations().expect(HttpStatus.OK);
        expect(list.total).toBe(1);
    });

    // ─── Per-item error handling ──────────────────────────────
    it('collects per-item errors without aborting the batch (unknown stationType)', async () => {
        const basinId = await seedBasin();

        const { body } = await importStations({
            basinId,
            items: [
                buildImportItem(),
                buildImportItem({ stationCode: 'BAD1', stationType: 'Pluviometro raro', subBasinName: 'Cuenca Ejemplo' }),
            ],
        }).expect(HttpStatus.OK);

        expect(body.total).toBe(2);
        expect(body.created).toBe(1);
        expect(body.skipped).toBe(1);
        expect(body.errors).toHaveLength(1);
        expect(body.errors[0].stationCode).toBe('BAD1');
        expect(body.errors[0].reason).toContain('stationType');

        // The valid item was still persisted.
        await getByCode('AR50').expect(HttpStatus.OK);
    });

    // ─── Basin not found ──────────────────────────────────────
    it('returns 404 when the basinId does not exist', async () => {
        const { body } = await importStations({
            basinId: '00000000-0000-0000-0000-000000000000',
            items: [buildImportItem()],
        }).expect(HttpStatus.NOT_FOUND);

        expect(body.ErrorDescription).toBeDefined();
    });

    // ─── Validation ───────────────────────────────────────────
    it('rejects a payload with no items (400)', async () => {
        const basinId = await seedBasin();
        await importStations({ basinId, items: [] }).expect(HttpStatus.BAD_REQUEST);
    });
});
