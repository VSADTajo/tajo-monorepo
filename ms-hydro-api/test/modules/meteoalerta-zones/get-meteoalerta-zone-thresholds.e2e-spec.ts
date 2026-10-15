import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { CqrsModule } from '@nestjs/cqrs';

// Domain
import { IMeteoalertaZoneRepository } from '../../../src/app/domain/ports/meteoalerta-zone-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { MeteoalertaZoneRepository } from '../../../src/app/infrastructure/persistence/meteoalerta-zone.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { GetMeteoalertaZoneThresholdsByPointHandler } from '../../../src/app/application/queries/meteoalerta-zone.queries';
import { MeteoalertaZoneController } from '../../../src/app/api/controllers/meteoalerta-zone.controller';

// Test helpers
import { createGeoserverTestDb, GeoserverTestContext } from '../../helpers/geoserver-test.helper';

// Common
import { CustomValidationPipe } from '../../../src/common/pipes/custom-validation.pipe';
import { HttpExceptionFilter } from '../../../src/common/exceptions/http.exception';

describe('Get Meteoalerta Zone Thresholds (e2e)', () => {
    let app: INestApplication;
    let geoCtx: GeoserverTestContext;

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        // Real PostGIS: the lookup is a spatial query, so it is exercised against the GeoServer schema.
        geoCtx = await createGeoserverTestDb();

        const module: TestingModule = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRoot({
                    name: 'geoserver',
                    type: 'postgres',
                    host: geoCtx.geoContainer.getHost(),
                    port: geoCtx.geoContainer.getMappedPort(5432),
                    username: geoCtx.geoContainer.getUsername(),
                    password: geoCtx.geoContainer.getPassword(),
                    database: geoCtx.geoContainer.getDatabase(),
                    entities: [],
                    synchronize: false,
                }),
                CqrsModule,
                LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
            ],
            controllers: [MeteoalertaZoneController],
            providers: [
                GetMeteoalertaZoneThresholdsByPointHandler,
                CachingQueryBus,
                { provide: IMeteoalertaZoneRepository, useClass: MeteoalertaZoneRepository },
                { provide: ICacheService, useValue: mockCacheService },
                HttpExceptionFilter,
            ],
        }).compile();

        app = module.createNestApplication();
        app.useGlobalPipes(new CustomValidationPipe());
        app.useGlobalFilters(app.get(HttpExceptionFilter));
        await app.init();
    }, 120_000);

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await geoCtx.geoDataSource.destroy();
        await geoCtx.geoContainer.stop();
    });

    function getThresholds(query: Record<string, unknown>) {
        return request(app.getHttpServer()).get('/meteoalerta-zones/thresholds').query(query);
    }

    describe('GET /meteoalerta-zones/thresholds - success', () => {
        it('should return the zone containing the coordinate with its six precipitation thresholds', async () => {
            const { body } = await getThresholds({ lat: 40.48, lon: -2.73 }).expect(HttpStatus.OK);

            expect(body).toEqual({
                zonaCode: '681901',
                zonaNombre: 'Serranía de Guadalajara',
                provincia: 'Guadalajara',
                ccaa: 'Castilla - La Mancha',
                umbral1Precip1h: 15,
                umbral2Precip1h: 30,
                umbral3Precip1h: 60,
                umbral1Precip12h: 40,
                umbral2Precip12h: 80,
                umbral3Precip12h: 120,
            });
        });

        it('should resolve each coordinate to its own zone', async () => {
            const { body } = await getThresholds({ lat: 40.5, lon: -3.5 }).expect(HttpStatus.OK);

            expect(body.zonaCode).toBe('674002');
            expect(body.umbral1Precip1h).toBe(20);
            expect(body.umbral3Precip12h).toBe(150);
        });

        it('should resolve a coordinate on a shared border to a single zone', async () => {
            const { body } = await getThresholds({ lat: 40.5, lon: -3 }).expect(HttpStatus.OK);

            expect(['674002', '681901']).toContain(body.zonaCode);
        });

        it('should cache the result under the rounded coordinate key', async () => {
            await getThresholds({ lat: 40.48, lon: -2.73 }).expect(HttpStatus.OK);

            expect(mockCacheService.set).toHaveBeenCalledWith(
                'meteoalerta-zone:thresholds:40.48000:-2.73000',
                expect.objectContaining({ zonaCode: '681901' }),
                600,
            );
        });
    });

    describe('GET /meteoalerta-zones/thresholds - errors', () => {
        it('should return 404 when the coordinate is outside every zone', async () => {
            await getThresholds({ lat: 43.0, lon: -8.0 }).expect(HttpStatus.NOT_FOUND);
        });

        it('should return 400 when lat or lon is missing', async () => {
            await getThresholds({ lat: 40.48 }).expect(HttpStatus.BAD_REQUEST);
            await getThresholds({ lon: -2.73 }).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 400 when lat or lon is out of range or not numeric', async () => {
            await getThresholds({ lat: 95, lon: -2.73 }).expect(HttpStatus.BAD_REQUEST);
            await getThresholds({ lat: 40.48, lon: -190 }).expect(HttpStatus.BAD_REQUEST);
            await getThresholds({ lat: 'abc', lon: -2.73 }).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
