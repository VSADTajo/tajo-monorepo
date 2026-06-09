import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { Basin } from '../../../src/app/domain/entities/basin.entity';
import { SubBasin } from '../../../src/app/domain/entities/sub-basin.entity';
import { Station } from '../../../src/app/domain/entities/station.entity';
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
            entities: [Basin, SubBasin, Station],
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

    function updateThreshold(id: string, dto: { umbral: number | null }) {
        return request(app.getHttpServer()).put(`/stations/${id}/threshold`).send(dto);
    }

    function getStation(id: string) {
        return request(app.getHttpServer()).get(`/stations/${id}`);
    }

    function getThreshold(id: string) {
        return request(app.getHttpServer()).get(`/stations/${id}/threshold`);
    }

    async function setupStationWithUmbral(umbral?: number | null) {
        const basinDto = buildCreateBasinDto();
        const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);
        const subBasinDto = buildCreateSubBasinDto(basin.id);
        const { body: subBasin } = await createSubBasin(subBasinDto).expect(HttpStatus.CREATED);
        const stationDto = buildCreateStationDto(subBasin.id, { umbral });
        const { body: station } = await createStation(stationDto).expect(HttpStatus.CREATED);
        return station;
    }

    // ─── Update threshold ──────────────────────────────────────
    describe('PUT /stations/:id/threshold - update', () => {
        it('should update threshold value', async () => {
            const station = await setupStationWithUmbral(100.0);

            const { body } = await updateThreshold(station.id, { umbral: 200.0 }).expect(HttpStatus.OK);

            expect(body.umbral).toBe(200.0);
        });

        it('should verify GET reflects updated threshold', async () => {
            const station = await setupStationWithUmbral(100.0);

            await updateThreshold(station.id, { umbral: 250.5 }).expect(HttpStatus.OK);

            const { body } = await getStation(station.id).expect(HttpStatus.OK);
            expect(body.umbral).toBe(250.5);
        });

        it('should set threshold to null (clear threshold)', async () => {
            const station = await setupStationWithUmbral(100.0);

            const { body } = await updateThreshold(station.id, { umbral: null }).expect(HttpStatus.OK);

            expect(body.umbral).toBeNull();
        });

        it('should set threshold to zero (valid value)', async () => {
            const station = await setupStationWithUmbral(100.0);

            const { body } = await updateThreshold(station.id, { umbral: 0 }).expect(HttpStatus.OK);

            expect(body.umbral).toBe(0);
        });
    });

    // ─── Get threshold ─────────────────────────────────────────
    describe('GET /stations/:id/threshold - lightweight endpoint', () => {
        it('should return only threshold data', async () => {
            const station = await setupStationWithUmbral(150.5);

            const { body } = await getThreshold(station.id).expect(HttpStatus.OK);

            expect(body.id).toBe(station.id);
            expect(body.stationCode).toBe(station.stationCode);
            expect(body.umbral).toBe(150.5);
            expect(body.name).toBeUndefined();
        });
    });

    // ─── Not found ────────────────────────────────────────────
    describe('PUT /stations/:id/threshold - not found', () => {
        it('should return 404 for non-existent station', async () => {
            await updateThreshold('00000000-0000-0000-0000-000000000000', { umbral: 100 }).expect(HttpStatus.NOT_FOUND);
        });
    });
});
