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
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { BasinRepository } from '../../../src/app/infrastructure/persistence/basin.repository';
import { SubBasinRepository } from '../../../src/app/infrastructure/persistence/sub-basin.repository';
import { StationRepository } from '../../../src/app/infrastructure/persistence/station.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { CreateBasinHandler } from '../../../src/app/application/commands/basin.commands';
import { CreateSubBasinHandler } from '../../../src/app/application/commands/sub-basin.commands';
import { CreateStationHandler, UpdateStationHandler } from '../../../src/app/application/commands/station.commands';
import { GetStationByIdHandler } from '../../../src/app/application/queries/station.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';
import { StationController } from '../../../src/app/api/controllers/station.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';
import { buildCreateSubBasinDto } from '../../factories/sub-basin.factory';
import { buildCreateStationDto } from '../../factories/station.factory';

describe('Update Station (e2e)', () => {
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
            controllers: [BasinController, SubBasinController, StationController],
            providers: [
                CreateBasinHandler,
                CreateSubBasinHandler,
                CreateStationHandler,
                UpdateStationHandler,
                GetStationByIdHandler,
                CachingQueryBus,
                { provide: IBasinRepository, useClass: BasinRepository },
                { provide: ISubBasinRepository, useClass: SubBasinRepository },
                { provide: IStationRepository, useClass: StationRepository },
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
    function createBasin(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/basins').send(dto);
    }

    function createSubBasin(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/sub-basins').send(dto);
    }

    function createStation(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/stations').send(dto);
    }

    function updateStation(id: string, dto: Record<string, unknown>) {
        return request(app.getHttpServer()).put(`/stations/${id}`).send(dto);
    }

    function getStation(id: string) {
        return request(app.getHttpServer()).get(`/stations/${id}`);
    }

    async function setupStationWithData(overrides?: Record<string, unknown>) {
        const basinDto = buildCreateBasinDto();
        const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);
        const subBasinDto = buildCreateSubBasinDto(basin.id);
        const { body: subBasin } = await createSubBasin(subBasinDto).expect(HttpStatus.CREATED);
        const stationDto = buildCreateStationDto(subBasin.id, overrides);
        const { body: station } = await createStation(stationDto).expect(HttpStatus.CREATED);
        return { basin, subBasin, station };
    }

    // ─── Successful updates ──────────────────────────────────────
    describe('PUT /stations/:id - successful updates', () => {
        it('should update station name', async () => {
            const { station } = await setupStationWithData();

            const { body } = await updateStation(station.id, { name: 'Updated Name' }).expect(HttpStatus.OK);

            expect(body.name).toBe('Updated Name');
            expect(body.id).toBe(station.id);
        });

        it('should update multiple fields', async () => {
            const { station } = await setupStationWithData();

            const { body } = await updateStation(station.id, {
                name: 'New Name',
                latitude: 40.0,
                longitude: -3.0,
                altitude: 500.0,
            }).expect(HttpStatus.OK);

            expect(body.name).toBe('New Name');
            expect(body.latitude).toBe(40.0);
            expect(body.longitude).toBe(-3.0);
            expect(body.altitude).toBe(500.0);
        });

        it('should verify GET reflects the update', async () => {
            const { station } = await setupStationWithData();

            await updateStation(station.id, { name: 'Verified Name' }).expect(HttpStatus.OK);

            const { body } = await getStation(station.id).expect(HttpStatus.OK);
            expect(body.name).toBe('Verified Name');
        });

        it('should update stationType', async () => {
            const { station } = await setupStationWithData({ stationType: 'AFORO_EN_RIO' });

            const { body } = await updateStation(station.id, { stationType: 'EMBALSE_SAIH' }).expect(HttpStatus.OK);

            expect(body.stationType).toBe('EMBALSE_SAIH');
        });

        it('should set altitude to null', async () => {
            const { station } = await setupStationWithData({ altitude: 100.0 });

            const { body } = await updateStation(station.id, { altitude: null }).expect(HttpStatus.OK);

            expect(body.altitude).toBeNull();
        });
    });

    // ─── Not found ────────────────────────────────────────────
    describe('PUT /stations/:id - not found', () => {
        it('should return 404 for non-existent station', async () => {
            await updateStation('00000000-0000-0000-0000-000000000000', { name: 'Test' }).expect(HttpStatus.NOT_FOUND);
        });
    });

    // ─── Conflict ─────────────────────────────────────────────
    describe('PUT /stations/:id - conflicts', () => {
        it('should reject duplicate stationCode with 409', async () => {
            const { subBasin } = await setupStationWithData({ stationCode: 'CODE-A' });
            const stationDto2 = buildCreateStationDto(subBasin.id, { stationCode: 'CODE-B' });
            const { body: station2 } = await createStation(stationDto2).expect(HttpStatus.CREATED);

            const { body } = await updateStation(station2.id, { stationCode: 'CODE-A' }).expect(HttpStatus.CONFLICT);
            expect(body.ErrorDescription).toContain('stationCode');
        });

        it('should allow updating own subBasinName to same value', async () => {
            const { station } = await setupStationWithData({ subBasinName: 'Same Name' });

            await updateStation(station.id, { subBasinName: 'Same Name' }).expect(HttpStatus.OK);
        });
    });
});
