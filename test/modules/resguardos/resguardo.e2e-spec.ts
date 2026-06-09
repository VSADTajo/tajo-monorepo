import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { Basin } from '../../../src/app/domain/entities/basin.entity';
import { SubBasin } from '../../../src/app/domain/entities/sub-basin.entity';
import { Station } from '../../../src/app/domain/entities/station.entity';
import { StationThreshold } from '../../../src/app/domain/entities/station-threshold.entity';
import { StationResguardo } from '../../../src/app/domain/entities/station-resguardo.entity';
import { IBasinRepository } from '../../../src/app/domain/ports/basin-repository.port';
import { ISubBasinRepository } from '../../../src/app/domain/ports/sub-basin-repository.port';
import { IStationRepository } from '../../../src/app/domain/ports/station-repository.port';
import { IStationResguardoRepository } from '../../../src/app/domain/ports/station-resguardo-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { BasinRepository } from '../../../src/app/infrastructure/persistence/basin.repository';
import { SubBasinRepository } from '../../../src/app/infrastructure/persistence/sub-basin.repository';
import { StationRepository } from '../../../src/app/infrastructure/persistence/station.repository';
import { StationResguardoRepository } from '../../../src/app/infrastructure/persistence/station-resguardo.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';
import { ResguardoImportService } from '../../../src/app/infrastructure/services/resguardo-import.service';

// Application
import { CreateBasinHandler } from '../../../src/app/application/commands/basin.commands';
import { CreateSubBasinHandler } from '../../../src/app/application/commands/sub-basin.commands';
import { CreateStationHandler } from '../../../src/app/application/commands/station.commands';
import {
    ImportResguardosHandler,
    UpdateResguardoHandler,
} from '../../../src/app/application/commands/resguardo.commands';
import {
    GetResguardosByStationHandler,
    GetResguardoByDateHandler,
} from '../../../src/app/application/queries/resguardo.queries';

// Controllers
import { BasinController } from '../../../src/app/api/controllers/basin.controller';
import { SubBasinController } from '../../../src/app/api/controllers/sub-basin.controller';
import { StationController } from '../../../src/app/api/controllers/station.controller';
import { ResguardoController } from '../../../src/app/api/controllers/resguardo.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateBasinDto } from '../../factories/basin.factory';
import { buildCreateSubBasinDto } from '../../factories/sub-basin.factory';
import { buildCreateStationDto } from '../../factories/station.factory';

describe('Resguardos (e2e)', () => {
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
            entities: [Basin, SubBasin, Station, StationThreshold, StationResguardo],
            controllers: [BasinController, SubBasinController, StationController, ResguardoController],
            providers: [
                CreateBasinHandler,
                CreateSubBasinHandler,
                CreateStationHandler,
                ImportResguardosHandler,
                UpdateResguardoHandler,
                GetResguardosByStationHandler,
                GetResguardoByDateHandler,
                ResguardoImportService,
                CachingQueryBus,
                { provide: IBasinRepository, useClass: BasinRepository },
                { provide: ISubBasinRepository, useClass: SubBasinRepository },
                { provide: IStationRepository, useClass: StationRepository },
                { provide: IStationResguardoRepository, useClass: StationResguardoRepository },
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

    async function setupEmbalseStation(): Promise<{ stationCode: string }> {
        const basinDto = buildCreateBasinDto();
        const { body: basin } = await request(app.getHttpServer())
            .post('/basins')
            .send(basinDto)
            .expect(HttpStatus.CREATED);

        const subBasinDto = buildCreateSubBasinDto(basin.id);
        const { body: subBasin } = await request(app.getHttpServer())
            .post('/sub-basins')
            .send(subBasinDto)
            .expect(HttpStatus.CREATED);

        const stationCode = `E_${Date.now().toString().slice(-2)}`;
        const stationDto = buildCreateStationDto(subBasin.id, {
            stationCode,
            stationType: 'EMBALSE_SAIH',
        });
        await request(app.getHttpServer()).post('/stations').send(stationDto).expect(HttpStatus.CREATED);

        return { stationCode };
    }

    async function seedResguardos(stationCode: string, count: number = 3): Promise<void> {
        const repo = dataSource.getRepository(StationResguardo);
        const stationRepo = dataSource.getRepository(Station);
        const station = await stationRepo.findOneOrFail({ where: { stationCode } });

        const entities: Partial<StationResguardo>[] = [];
        for (let i = 0; i < count; i++) {
            const day = String(i + 1).padStart(2, '0');
            entities.push({
                stationId: station.id,
                date: `2025-10-${day}`,
                organismo: 'EXPLOTACION' as any,
                originalReserveVolume: 800 + i * 10,
                originalReserveLevel: 700 + i,
                originalMinimumVolume: 50 + i,
                reserveVolume: null,
                reserveLevel: null,
                minimumVolume: null,
            });
        }

        await repo.save(entities.map((e) => repo.create(e)));
    }

    function getResguardosByStation(stationCode: string, query?: Record<string, string | number>) {
        const req = request(app.getHttpServer()).get(`/resguardos/${stationCode}`);
        if (query) req.query(query);
        return req;
    }

    function getResguardoByDate(stationCode: string, date: string) {
        return request(app.getHttpServer()).get(`/resguardos/${stationCode}/${date}`);
    }

    function updateResguardo(stationCode: string, date: string, dto: Record<string, unknown>) {
        return request(app.getHttpServer()).put(`/resguardos/${stationCode}/${date}`).send(dto);
    }

    // ─── Tests ────────────────────────────────────────────────

    describe('GET /resguardos/:stationCode', () => {
        it('should return resguardos as date-keyed map', async () => {
            const { stationCode } = await setupEmbalseStation();
            await seedResguardos(stationCode, 5);

            const { body } = await getResguardosByStation(stationCode).expect(HttpStatus.OK);

            expect(body.stationCode).toBe(stationCode);
            expect(body.total).toBe(5);
            expect(body.entries).toBeDefined();
            expect(body.entries['2025-10-01']).toMatchObject({
                minimumVolume: 50,
                reserveVolume: 800,
                reserveLevel: 700,
            });
        });

        it('should filter by year', async () => {
            const { stationCode } = await setupEmbalseStation();
            await seedResguardos(stationCode, 3);

            const { body } = await getResguardosByStation(stationCode, { year: 2025 }).expect(HttpStatus.OK);

            expect(body.total).toBe(3);
            expect(Object.keys(body.entries)).toHaveLength(3);
        });

        it('should return 404 for non-existent station', async () => {
            await getResguardosByStation('UNKNOWN_CODE').expect(HttpStatus.NOT_FOUND);
        });

        it('should return empty entries when station has no resguardos', async () => {
            const { stationCode } = await setupEmbalseStation();

            const { body } = await getResguardosByStation(stationCode).expect(HttpStatus.OK);

            expect(Object.keys(body.entries)).toHaveLength(0);
            expect(body.total).toBe(0);
        });
    });

    describe('GET /resguardos/:stationCode/:date', () => {
        it('should return resolved values for a single date', async () => {
            const { stationCode } = await setupEmbalseStation();
            await seedResguardos(stationCode, 3);

            const { body } = await getResguardoByDate(stationCode, '2025-10-02').expect(HttpStatus.OK);

            expect(body.stationCode).toBe(stationCode);
            expect(body.entry).toMatchObject({
                minimumVolume: 51,
                reserveVolume: 810,
                reserveLevel: 701,
            });
        });

        it('should return 404 for non-existent date', async () => {
            const { stationCode } = await setupEmbalseStation();
            await seedResguardos(stationCode, 1);

            await getResguardoByDate(stationCode, '2099-01-01').expect(HttpStatus.NOT_FOUND);
        });
    });

    describe('PUT /resguardos/:stationCode/:date', () => {
        it('should update and return resolved values', async () => {
            const { stationCode } = await setupEmbalseStation();
            await seedResguardos(stationCode, 1);

            const { body } = await updateResguardo(stationCode, '2025-10-01', {
                reserveVolume: 750,
                reserveLevel: 710,
            }).expect(HttpStatus.OK);

            // Resolved: edited values override originals
            expect(body.entry.reserveVolume).toBe(750);
            expect(body.entry.reserveLevel).toBe(710);
            // minimumVolume not edited → resolves to original (50)
            expect(body.entry.minimumVolume).toBe(50);
        });

        it('should revert to original when set to null', async () => {
            const { stationCode } = await setupEmbalseStation();
            await seedResguardos(stationCode, 1);

            // First set a value
            await updateResguardo(stationCode, '2025-10-01', { reserveVolume: 750 }).expect(HttpStatus.OK);

            // Then set it back to null → should resolve to original (800)
            const { body } = await updateResguardo(stationCode, '2025-10-01', { reserveVolume: null }).expect(
                HttpStatus.OK,
            );

            expect(body.entry.reserveVolume).toBe(800);
        });

        it('should return 404 for non-existent station', async () => {
            await updateResguardo('UNKNOWN', '2025-10-01', { reserveVolume: 100 }).expect(HttpStatus.NOT_FOUND);
        });
    });
});
