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
import { CreateStationHandler } from '../../../src/app/application/commands/station.commands';
import { GetStationBySubBasinNameHandler } from '../../../src/app/application/queries/station.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';
import { StationController } from '../../../src/app/api/controllers/station.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';
import { buildCreateSubBasinDto } from '../../factories/sub-basin.factory';
import { buildCreateStationDto } from '../../factories/station.factory';

describe('Get Station by SubBasinName (e2e)', () => {
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
                GetStationBySubBasinNameHandler,
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

    function getStationBySubBasinName(subBasinName: string) {
        return request(app.getHttpServer()).get(`/stations/by-sub-basin-name/${encodeURIComponent(subBasinName)}`);
    }

    async function setupBasinAndSubBasin() {
        const basinDto = buildCreateBasinDto();
        const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);
        const subBasinDto = buildCreateSubBasinDto(basin.id);
        const { body: subBasin } = await createSubBasin(subBasinDto).expect(HttpStatus.CREATED);
        return { basin, subBasin };
    }

    // ─── Successful lookup ─────────────────────────────────────
    describe('GET /stations/by-sub-basin-name/:subBasinName - successful', () => {
        it('should return station by sub-basin name', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            const stationDto = buildCreateStationDto(subBasin.id, { subBasinName: 'Arroyo de la Vega', umbral: 200.0 });
            await createStation(stationDto).expect(HttpStatus.CREATED);

            const { body } = await getStationBySubBasinName('Arroyo de la Vega').expect(HttpStatus.OK);

            expect(body.subBasinName).toBe('Arroyo de la Vega');
            expect(body.umbral).toBe(200.0);
        });

        it('should handle URL-encoded sub-basin names with spaces', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            const stationDto = buildCreateStationDto(subBasin.id, { subBasinName: 'Rio Tajo Medio' });
            await createStation(stationDto).expect(HttpStatus.CREATED);

            const { body } = await getStationBySubBasinName('Rio Tajo Medio').expect(HttpStatus.OK);

            expect(body.subBasinName).toBe('Rio Tajo Medio');
        });
    });

    // ─── Not found ────────────────────────────────────────────
    describe('GET /stations/by-sub-basin-name/:subBasinName - not found', () => {
        it('should return 404 for non-existent sub-basin name', async () => {
            const { body } = await getStationBySubBasinName('Non Existent Name').expect(HttpStatus.NOT_FOUND);

            expect(body.ErrorDescription).toBeDefined();
        });
    });
});
