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
import { CreateStationHandler } from '../../../src/app/application/commands/station.commands';
import { GetStationByCodeHandler } from '../../../src/app/application/queries/station.queries';
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';
import { StationController } from '../../../src/app/api/controllers/station.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';
import { buildCreateSubBasinDto } from '../../factories/sub-basin.factory';

describe('Get Station By Code (e2e)', () => {
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
                GetStationByCodeHandler,
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

    function getStationByCode(code: string) {
        return request(app.getHttpServer()).get(`/stations/by-code/${code}`);
    }

    async function setupBasinAndSubBasin() {
        const basinDto = buildCreateBasinDto();
        const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);
        const subBasinDto = buildCreateSubBasinDto(basin.id);
        const { body: subBasin } = await createSubBasin(subBasinDto).expect(HttpStatus.CREATED);
        return { basin, subBasin };
    }

    async function insertStation(subBasinId: string, stationCode: string, overrides?: Partial<Station>) {
        const repo = dataSource.getRepository(Station);
        const station = repo.create({
            name: `Station ${stationCode}`,
            subBasinName: `sub-basin-${stationCode}`,
            stationCode,
            stationType: 'AFORO_EN_RIO' as any,
            subBasinId,
            isActive: true,
            ...overrides,
        });
        return repo.save(station);
    }

    // ─── Successful retrieval ──────────────────────────────────
    describe('GET /stations/by-code/:code - successful', () => {
        it('should return station by its code', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            await insertStation(subBasin.id, 'AR04', {
                zona: 'CABECERA',
                comarcaName: 'GUADALAJARA',
                sistemaName: 'CABECERA',
            });

            const { body } = await getStationByCode('AR04').expect(HttpStatus.OK);

            expect(body.stationCode).toBe('AR04');
            expect(body.zona).toBe('CABECERA');
            expect(body.comarcaName).toBe('GUADALAJARA');
            expect(body.sistemaName).toBe('CABECERA');
        });
    });

    // ─── Not found ────────────────────────────────────────────
    describe('GET /stations/by-code/:code - not found', () => {
        it('should return 404 for non-existent code', async () => {
            await getStationByCode('NONEXISTENT').expect(HttpStatus.NOT_FOUND);
        });
    });
});
