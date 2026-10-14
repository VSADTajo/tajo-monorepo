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
import { CreateSubBasinHandler } from '../../../src/app/application/commands/sub-basin.commands';
import {
    CreateStationHandler,
    UpdateStationThresholdHandler,
} from '../../../src/app/application/commands/station.commands';
import {
    GetStationByIdHandler,
    GetStationThresholdHandler,
} from '../../../src/app/application/queries/station.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';
import { StationController } from '../../../src/app/api/controllers/station.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';
import { buildCreateSubBasinDto } from '../../factories/sub-basin.factory';
import { buildCreateStationDto } from '../../factories/station.factory';

describe('Update Station Threshold (e2e)', () => {
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
                UpdateStationThresholdHandler,
                GetStationByIdHandler,
                GetStationThresholdHandler,
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
    function createBasin(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/basins').send(dto);
    }

    function createSubBasin(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/sub-basins').send(dto);
    }

    function createStation(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/stations').send(dto);
    }

    function updateThreshold(id: string, dto: Record<string, unknown>) {
        return request(app.getHttpServer()).put(`/stations/${id}/threshold`).send(dto);
    }

    function getThreshold(id: string) {
        return request(app.getHttpServer()).get(`/stations/${id}/threshold`);
    }

    async function setupStation() {
        const basinDto = buildCreateBasinDto();
        const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);
        const subBasinDto = buildCreateSubBasinDto(basin.id);
        const { body: subBasin } = await createSubBasin(subBasinDto).expect(HttpStatus.CREATED);
        const stationDto = buildCreateStationDto(subBasin.id);
        const { body: station } = await createStation(stationDto).expect(HttpStatus.CREATED);
        return station;
    }

    // ─── Update threshold ──────────────────────────────────────
    describe('PUT /stations/:id/threshold - update', () => {
        it('should update threshold values', async () => {
            const station = await setupStation();

            const { body } = await updateThreshold(station.id, { umbralNivel1: 0.95, umbralCaudal1: 6.06 }).expect(HttpStatus.OK);

            expect(body.stationId).toBe(station.id);
            expect(body.stationCode).toBe(station.stationCode);
            expect(body.threshold.umbralNivel1).toBe(0.95);
            expect(body.threshold.umbralCaudal1).toBe(6.06);
        });

        it('should update precipitation thresholds (1h and 12h)', async () => {
            const station = await setupStation();
            const precip = {
                umbral1Precip1h: 15,
                umbral2Precip1h: 30,
                umbral3Precip1h: 60,
                umbral1Precip12h: 40,
                umbral2Precip12h: 80,
                umbral3Precip12h: 120,
            };

            const { body } = await updateThreshold(station.id, precip).expect(HttpStatus.OK);
            expect(body.threshold).toMatchObject(precip);

            const { body: fetched } = await getThreshold(station.id).expect(HttpStatus.OK);
            expect(fetched.threshold).toMatchObject(precip);
        });

        it('should keep precipitation thresholds when updating other fields', async () => {
            const station = await setupStation();
            await updateThreshold(station.id, { umbral1Precip1h: 15 }).expect(HttpStatus.OK);

            const { body } = await updateThreshold(station.id, { umbralNivel1: 1.5 }).expect(HttpStatus.OK);

            expect(body.threshold).toMatchObject({ umbralNivel1: 1.5, umbral1Precip1h: 15 });
        });

        it('should reject a non-numeric precipitation threshold', async () => {
            const station = await setupStation();

            await updateThreshold(station.id, { umbral1Precip12h: 'mucho' }).expect(HttpStatus.BAD_REQUEST);
        });

        it('should verify GET reflects updated threshold', async () => {
            const station = await setupStation();

            await updateThreshold(station.id, { umbralNivel1: 250.5 }).expect(HttpStatus.OK);

            const { body } = await getThreshold(station.id).expect(HttpStatus.OK);
            expect(body.threshold.umbralNivel1).toBe(250.5);
        });

        it('should clear a threshold value (set to null)', async () => {
            const station = await setupStation();
            await updateThreshold(station.id, { umbralNivel1: 100.0 }).expect(HttpStatus.OK);

            const { body } = await updateThreshold(station.id, { umbralNivel1: null }).expect(HttpStatus.OK);

            expect(body.threshold.umbralNivel1).toBeNull();
        });

        it('should set threshold to zero (valid value)', async () => {
            const station = await setupStation();

            const { body } = await updateThreshold(station.id, { umbralNivel1: 0 }).expect(HttpStatus.OK);

            expect(body.threshold.umbralNivel1).toBe(0);
        });
    });

    // ─── Get threshold ─────────────────────────────────────────
    describe('GET /stations/:id/threshold - lightweight endpoint', () => {
        it('should return threshold data for the station', async () => {
            const station = await setupStation();
            await updateThreshold(station.id, { umbralNivel1: 150.5, senal: 'AR01LI__01' }).expect(HttpStatus.OK);

            const { body } = await getThreshold(station.id).expect(HttpStatus.OK);

            expect(body.stationId).toBe(station.id);
            expect(body.stationCode).toBe(station.stationCode);
            expect(body.threshold.umbralNivel1).toBe(150.5);
            expect(body.threshold.senal).toBe('AR01LI__01');
            expect(body.name).toBeUndefined();
        });

        it('should return null threshold when none is set', async () => {
            const station = await setupStation();

            const { body } = await getThreshold(station.id).expect(HttpStatus.OK);

            expect(body.stationId).toBe(station.id);
            expect(body.threshold).toBeNull();
        });
    });

    // ─── Not found ────────────────────────────────────────────
    describe('PUT /stations/:id/threshold - not found', () => {
        it('should return 404 for non-existent station', async () => {
            await updateThreshold('00000000-0000-0000-0000-000000000000', { umbralNivel1: 100 }).expect(HttpStatus.NOT_FOUND);
        });
    });
});
