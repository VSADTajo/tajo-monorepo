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
import { CreateStationHandler, ToggleStationHandler } from '../../../src/app/application/commands/station.commands';
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

describe('Toggle Station (e2e)', () => {
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
                ToggleStationHandler,
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

    function toggleStation(id: string) {
        return request(app.getHttpServer()).patch(`/stations/${id}/toggle`);
    }

    function getStation(id: string) {
        return request(app.getHttpServer()).get(`/stations/${id}`);
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

    // ─── Toggle active status ────────────────────────────────────
    describe('PATCH /stations/:id/toggle', () => {
        it('should toggle active to inactive', async () => {
            const station = await setupStation();
            expect(station.isActive).toBe(true);

            const { body } = await toggleStation(station.id).expect(HttpStatus.OK);

            expect(body.id).toBe(station.id);
            expect(body.isActive).toBe(false);
        });

        it('should toggle inactive back to active', async () => {
            const station = await setupStation();

            // First toggle: active → inactive
            await toggleStation(station.id).expect(HttpStatus.OK);

            // Second toggle: inactive → active
            const { body } = await toggleStation(station.id).expect(HttpStatus.OK);

            expect(body.isActive).toBe(true);
        });

        it('should verify GET reflects the toggle', async () => {
            const station = await setupStation();

            await toggleStation(station.id).expect(HttpStatus.OK);

            const { body } = await getStation(station.id).expect(HttpStatus.OK);
            expect(body.isActive).toBe(false);
        });
    });

    // ─── Not found ────────────────────────────────────────────
    describe('PATCH /stations/:id/toggle - not found', () => {
        it('should return 404 for non-existent station', async () => {
            await toggleStation('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
        });
    });
});
