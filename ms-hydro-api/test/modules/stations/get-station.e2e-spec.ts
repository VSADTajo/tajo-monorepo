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
import { CreateStationHandler } from '../../../src/app/application/commands/station.commands';
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

describe('Get Station (e2e)', () => {
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

    function getStation(id: string) {
        return request(app.getHttpServer()).get(`/stations/${id}`);
    }

    async function setupBasinAndSubBasin() {
        const basinDto = buildCreateBasinDto();
        const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);
        const subBasinDto = buildCreateSubBasinDto(basin.id);
        const { body: subBasin } = await createSubBasin(subBasinDto).expect(HttpStatus.CREATED);
        return { basin, subBasin };
    }

    // ─── Successful retrieval ──────────────────────────────────
    describe('GET /stations/:id - successful retrieval', () => {
        it('should return station with its details', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            const stationDto = buildCreateStationDto(subBasin.id, { stationType: 'AFORO_EN_RIO' });
            const { body: created } = await createStation(stationDto).expect(HttpStatus.CREATED);

            const { body } = await getStation(created.id).expect(HttpStatus.OK);

            expect(body.id).toBe(created.id);
            expect(body.name).toBe(stationDto.name);
            expect(body.subBasinName).toBe(stationDto.subBasinName);
            expect(body.stationCode).toBe(stationDto.stationCode.toUpperCase());
            expect(body.stationType).toBe('AFORO_EN_RIO');
            expect(body.subBasinId).toBe(subBasin.id);
            expect(body.isActive).toBe(true);
        });

        it('should return station with null threshold when none is set', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            const stationDto = buildCreateStationDto(subBasin.id);
            const { body: created } = await createStation(stationDto).expect(HttpStatus.CREATED);

            const { body } = await getStation(created.id).expect(HttpStatus.OK);

            expect(body.threshold).toBeNull();
        });

        it('should include geographic coordinates when provided', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            const stationDto = buildCreateStationDto(subBasin.id, {
                latitude: 40.4168,
                longitude: -3.7038,
                altitude: 650.0,
            });
            const { body: created } = await createStation(stationDto).expect(HttpStatus.CREATED);

            const { body } = await getStation(created.id).expect(HttpStatus.OK);

            expect(body.latitude).toBe(40.4168);
            expect(body.longitude).toBe(-3.7038);
            expect(body.altitude).toBe(650.0);
        });
    });

    // ─── Not found ────────────────────────────────────────────
    describe('GET /stations/:id - not found', () => {
        it('should return 404 for non-existent station', async () => {
            const { body } = await getStation('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);

            expect(body.ErrorDescription).toBeDefined();
        });
    });
});
