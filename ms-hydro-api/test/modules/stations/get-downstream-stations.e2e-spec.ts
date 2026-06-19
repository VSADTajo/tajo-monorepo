import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { Basin } from '../../../src/app/domain/entities/basin.entity';
import { SubBasin } from '../../../src/app/domain/entities/sub-basin.entity';
import { Station } from '../../../src/app/domain/entities/station.entity';
import { StationThreshold } from '../../../src/app/domain/entities/station-threshold.entity';
import { IDownstreamStationsRepository } from '../../../src/app/domain/ports/downstream-stations-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { GetDownstreamStationsHandler } from '../../../src/app/application/queries/station.queries';

// Controller
import { StationController } from '../../../src/app/api/controllers/station.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';

describe('Get Downstream Stations (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockDownstreamRepo = {
        findDownstream: jest.fn().mockResolvedValue([
            { codigoDestino: 'E010', nombreDestino: 'Estación Aguas Abajo', tipoDestino: 'aforo' },
            { codigoDestino: 'EMBALSE_001', nombreDestino: 'Embalse del Tranco', tipoDestino: 'embalse' },
        ]),
    };

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [Basin, SubBasin, Station, StationThreshold],
            controllers: [StationController],
            providers: [
                GetDownstreamStationsHandler,
                CachingQueryBus,
                { provide: IDownstreamStationsRepository, useValue: mockDownstreamRepo },
                { provide: ICacheService, useValue: mockCacheService },
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
    }, 120_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
        mockDownstreamRepo.findDownstream.mockResolvedValue([
            { codigoDestino: 'E010', nombreDestino: 'Estación Aguas Abajo', tipoDestino: 'aforo' },
            { codigoDestino: 'EMBALSE_001', nombreDestino: 'Embalse del Tranco', tipoDestino: 'embalse' },
        ]);
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    function getDownstreamStations(codes: string[]) {
        const queryString = codes.map((c) => `codes[]=${encodeURIComponent(c)}`).join('&');
        return request(app.getHttpServer()).get(`/stations/downstream?${queryString}`);
    }

    it('should return downstream stations for valid codes', async () => {
        const { body } = await getDownstreamStations(['E001', 'E002']).expect(HttpStatus.OK);

        expect(body.items).toHaveLength(2);
        expect(body.count).toBe(2);
        expect(body.items[0]).toEqual({
            codigoDestino: 'E010',
            nombreDestino: 'Estación Aguas Abajo',
            tipoDestino: 'aforo',
        });
        expect(body.items[1]).toEqual({
            codigoDestino: 'EMBALSE_001',
            nombreDestino: 'Embalse del Tranco',
            tipoDestino: 'embalse',
        });
    });

    it('should return 400 when codes param is missing', async () => {
        await request(app.getHttpServer()).get('/stations/downstream').expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when codes array is empty', async () => {
        await request(app.getHttpServer()).get('/stations/downstream?codes[]=').expect(HttpStatus.BAD_REQUEST);
    });
});
