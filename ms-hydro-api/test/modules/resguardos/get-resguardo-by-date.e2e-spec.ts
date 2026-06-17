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
import { GetResguardoByDateHandler } from '../../../src/app/application/queries/resguardo.queries';

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
import { buildResguardoXlsBuffer } from '../../factories/resguardo-xls.factory';

describe('GET /resguardos/:stationCode/:date — extended contract (e2e)', () => {
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

    // ─── Setup helpers ────────────────────────────────────────

    /**
     * Creates basin → sub-basin → EMBALSE_SAIH station.
     * The stationCode must match an EMBALSE_TO_CODE key so the XLS import
     * can resolve it. We use 'ENTREPEÑAS' → 'E_01'.
     */
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

        // E_01 is the code that 'ENTREPEÑAS' resolves to in EMBALSE_TO_CODE
        const stationCode = 'E_01';
        const stationDto = buildCreateStationDto(subBasin.id, {
            stationCode,
            stationType: 'EMBALSE_SAIH',
        });
        await request(app.getHttpServer()).post('/stations').send(stationDto).expect(HttpStatus.CREATED);

        return { stationCode };
    }

    /**
     * Seeds a single resguardo row via POST /resguardos/import (multipart XLS).
     * Uses baseYear=2025 so dates are deterministic.
     * After import all editables are null. If the caller passes editedValues,
     * a follow-up PUT is issued so the "edited" fields are populated.
     */
    async function seedResguardo(
        stationCode: string,
        dateStr: string, // hydrological format, e.g. '1oct'
        originals: { vol: number | null; cota: number | null; volMin: number | null },
        editedValues?: { reserveVolume?: number | null; reserveLevel?: number | null; minimumVolume?: number | null },
    ): Promise<{ isoDate: string }> {
        const buffer = buildResguardoXlsBuffer([
            {
                embalseName: 'ENTREPEÑAS', // maps to stationCode E_01
                dateStr,
                vol: originals.vol,
                cota: originals.cota,
                volMin: originals.volMin,
            },
        ]);

        await request(app.getHttpServer())
            .post('/resguardos/import?baseYear=2025')
            .attach('file', buffer, 'resguardos.xlsx')
            .expect(HttpStatus.CREATED);

        // Resolve the ISO date from hydrological dateStr for assertions and optional PUT
        // Oct-Dec → baseYear (2025); Jan-Sep → baseYear+1 (2026)
        const match = dateStr.match(/^(\d{1,2})([a-z]{3})$/i);
        if (!match) throw new Error(`Invalid dateStr: ${dateStr}`);
        const day = match[1].padStart(2, '0');
        const monthNames: Record<string, string> = {
            ene: '01',
            feb: '02',
            mar: '03',
            abr: '04',
            may: '05',
            jun: '06',
            jul: '07',
            ago: '08',
            sep: '09',
            oct: '10',
            nov: '11',
            dic: '12',
        };
        const monthNum = monthNames[match[2].toLowerCase()];
        const monthInt = parseInt(monthNum, 10);
        const year = monthInt >= 10 ? 2025 : 2026;
        const isoDate = `${year}-${monthNum}-${day}`;

        if (editedValues) {
            await request(app.getHttpServer())
                .put(`/resguardos/${stationCode}/${isoDate}`)
                .send(editedValues)
                .expect(HttpStatus.OK);
        }

        return { isoDate };
    }

    function getResguardoByDate(stationCode: string, date: string) {
        return request(app.getHttpServer()).get(`/resguardos/${stationCode}/${date}`);
    }

    // ─── Tests ────────────────────────────────────────────────

    describe('(a) resguardo con todos los editables en null', () => {
        it('should return original, edited (all null) and resolved equal to original', async () => {
            const { stationCode } = await setupEmbalseStation();

            const { isoDate } = await seedResguardo(stationCode, '1oct', {
                vol: 802.563,
                cota: 718,
                volMin: 51.15,
            });

            const { body } = await getResguardoByDate(stationCode, isoDate).expect(HttpStatus.OK);

            expect(body.stationCode).toBe(stationCode);
            expect(body.date).toBe(isoDate);

            expect(body.original).toMatchObject({
                reserveVolume: 802.563,
                reserveLevel: 718,
                minimumVolume: 51.15,
            });

            expect(body.edited).toMatchObject({
                reserveVolume: null,
                reserveLevel: null,
                minimumVolume: null,
            });

            expect(body.resolved).toMatchObject({
                reserveVolume: 802.563,
                reserveLevel: 718,
                minimumVolume: 51.15,
            });

            // El campo viejo "entry" ya no debe existir
            expect(body.entry).toBeUndefined();
        });
    });

    describe('(b) resguardo con un editable cargado (reserveVolume)', () => {
        it('should return edited with the loaded value and resolved applying edited ?? original', async () => {
            const { stationCode } = await setupEmbalseStation();

            const { isoDate } = await seedResguardo(
                stationCode,
                '2oct',
                { vol: 802.563, cota: 718, volMin: 51.15 },
                { reserveVolume: 750.0 },
            );

            const { body } = await getResguardoByDate(stationCode, isoDate).expect(HttpStatus.OK);

            expect(body.date).toBe(isoDate);

            // original always shows the immutable originals
            expect(body.original).toMatchObject({
                reserveVolume: 802.563,
                reserveLevel: 718,
                minimumVolume: 51.15,
            });

            // edited shows the raw editable columns
            expect(body.edited).toMatchObject({
                reserveVolume: 750.0,
                reserveLevel: null,
                minimumVolume: null,
            });

            // resolved: edited ?? original per field
            expect(body.resolved).toMatchObject({
                reserveVolume: 750.0, // takes edited
                reserveLevel: 718, // falls back to original
                minimumVolume: 51.15, // falls back to original
            });
        });
    });

    describe('(c) fecha inexistente', () => {
        it('should return 404 when no resguardo exists for that date', async () => {
            const { stationCode } = await setupEmbalseStation();
            // No seedamos nada
            await getResguardoByDate(stationCode, '2099-01-01').expect(HttpStatus.NOT_FOUND);
        });

        it('should return 404 when station does not exist', async () => {
            await getResguardoByDate('UNKNOWN_STATION', '2025-10-01').expect(HttpStatus.NOT_FOUND);
        });
    });
});
