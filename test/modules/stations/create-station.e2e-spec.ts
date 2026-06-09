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
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';
import { StationController } from '../../../src/app/api/controllers/station.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';
import { buildCreateSubBasinDto } from '../../factories/sub-basin.factory';
import { buildCreateStationDto } from '../../factories/station.factory';

describe('Create Station (e2e)', () => {
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

    async function setupBasinAndSubBasin() {
        const basinDto = buildCreateBasinDto();
        const { body: basin } = await createBasin(basinDto).expect(HttpStatus.CREATED);
        const subBasinDto = buildCreateSubBasinDto(basin.id);
        const { body: subBasin } = await createSubBasin(subBasinDto).expect(HttpStatus.CREATED);
        return { basin, subBasin };
    }

    // ─── Successful creation ──────────────────────────────────
    describe('POST /stations - successful creation', () => {
        it('should create a station and return its details', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            const dto = buildCreateStationDto(subBasin.id, { umbral: 150.5 });

            const { body } = await createStation(dto).expect(HttpStatus.CREATED);

            expect(body).toMatchObject({
                id: expect.any(String),
                name: dto.name,
                subBasinName: dto.subBasinName,
                stationCode: dto.stationCode.toUpperCase(),
                stationType: 'HYDROLOGICAL',
                subBasinId: subBasin.id,
                umbral: 150.5,
                isActive: true,
            });
        });

        it('should create station without optional fields', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            const dto = buildCreateStationDto(subBasin.id);

            const { body } = await createStation(dto).expect(HttpStatus.CREATED);

            expect(body.umbral).toBeNull();
            expect(body.latitude).toBeNull();
            expect(body.longitude).toBeNull();
            expect(body.altitude).toBeNull();
        });

        it('should normalize stationCode to uppercase', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            const dto = buildCreateStationDto(subBasin.id, { stationCode: 'est-001' });

            const { body } = await createStation(dto).expect(HttpStatus.CREATED);

            expect(body.stationCode).toBe('EST-001');
        });

        it('should accept all station types', async () => {
            const { subBasin } = await setupBasinAndSubBasin();

            for (const type of ['HYDROLOGICAL', 'METEOROLOGICAL', 'PLUVIOMETRIC']) {
                const dto = buildCreateStationDto(subBasin.id, { stationType: type });
                const { body } = await createStation(dto).expect(HttpStatus.CREATED);
                expect(body.stationType).toBe(type);
            }
        });
    });

    // ─── Duplicate rejection ──────────────────────────────────
    describe('POST /stations - duplicates', () => {
        it('should reject duplicate subBasinName with 409', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            const dto1 = buildCreateStationDto(subBasin.id, { subBasinName: 'UniqueSubBasinName' });
            await createStation(dto1).expect(HttpStatus.CREATED);

            const dto2 = buildCreateStationDto(subBasin.id, { subBasinName: 'UniqueSubBasinName' });

            const { body } = await createStation(dto2).expect(HttpStatus.CONFLICT);
            expect(body.ErrorDescription).toContain('subBasinName');
        });

        it('should reject duplicate stationCode with 409', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            const dto1 = buildCreateStationDto(subBasin.id, { stationCode: 'SAME-CODE' });
            await createStation(dto1).expect(HttpStatus.CREATED);

            const dto2 = buildCreateStationDto(subBasin.id, { stationCode: 'SAME-CODE' });

            const { body } = await createStation(dto2).expect(HttpStatus.CONFLICT);
            expect(body.ErrorDescription).toContain('stationCode');
        });
    });

    // ─── Foreign key validation ───────────────────────────────
    describe('POST /stations - foreign key validation', () => {
        it('should reject invalid subBasinId with 404', async () => {
            const dto = buildCreateStationDto('00000000-0000-0000-0000-000000000000');

            await createStation(dto).expect(HttpStatus.NOT_FOUND);
        });
    });

    // ─── Validation errors ────────────────────────────────────
    describe('POST /stations - validation', () => {
        it('should reject missing required fields with 400', async () => {
            await createStation({}).expect(HttpStatus.BAD_REQUEST);
        });

        it('should reject invalid stationType with 400', async () => {
            const { subBasin } = await setupBasinAndSubBasin();
            const dto = buildCreateStationDto(subBasin.id, { stationType: 'INVALID' });

            await createStation(dto).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
