import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { IGeoDataRepository } from '../../../src/app/domain/ports/geo-data-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { SearchGeoDataResult } from '../../../src/app/domain/results/search-geo-data.result';

// Infrastructure
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { SearchGeoDataHandler } from '../../../src/app/application/queries/geo-data.queries';
import { GeoDataController } from '../../../src/app/api/controllers/geo-data.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildSearchGeoDataDto } from '../../factories/geo-data.factory';

describe('Search Geo Data (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    // Mock repository since the materialized view requires PostGIS and GeoServer tables
    const mockGeoDataRepository = {
        search: jest.fn(),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [], // No entities needed since repository is mocked
            controllers: [GeoDataController],
            providers: [
                SearchGeoDataHandler,
                CachingQueryBus,
                { provide: IGeoDataRepository, useValue: mockGeoDataRepository },
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
    function searchGeoData(query: Record<string, unknown>) {
        return request(app.getHttpServer()).get('/search').query(query);
    }

    // ─── Success cases ───────────────────────────────────────────
    describe('GET /search - success', () => {
        it('should return search results', async () => {
            const mockResults: SearchGeoDataResult[] = [
                new SearchGeoDataResult({
                    origen: 'punto_saih',
                    codigo: 'P001',
                    nombre: 'Estación Tajo',
                    tipoCod: 'EST',
                    x: -3.7038,
                    y: 40.4168,
                    searchText: 'Estación Tajo P001',
                }),
                new SearchGeoDataResult({
                    origen: 'subcuenca',
                    codigo: 'SC-TAJO',
                    nombre: 'Subcuenca Tajo',
                    tipoCod: null,
                    x: -3.5,
                    y: 40.0,
                    searchText: 'Subcuenca Tajo SC-TAJO',
                }),
            ];

            mockGeoDataRepository.search.mockResolvedValue(mockResults);

            const dto = buildSearchGeoDataDto({ q: 'tajo' });
            const { body } = await searchGeoData(dto).expect(HttpStatus.OK);

            expect(body.results).toHaveLength(2);
            expect(body.count).toBe(2);
            expect(body.results[0].origen).toBe('punto_saih');
            expect(body.results[0].nombre).toBe('Estación Tajo');
            expect(body.results[1].origen).toBe('subcuenca');
            expect(mockGeoDataRepository.search).toHaveBeenCalledWith('tajo');
        });

        it('should return empty results when no matches found', async () => {
            mockGeoDataRepository.search.mockResolvedValue([]);

            const dto = buildSearchGeoDataDto({ q: 'nonexistent' });
            const { body } = await searchGeoData(dto).expect(HttpStatus.OK);

            expect(body.results).toEqual([]);
            expect(body.count).toBe(0);
            expect(mockGeoDataRepository.search).toHaveBeenCalledWith('nonexistent');
        });

        it('should search with different queries', async () => {
            const mockResult = new SearchGeoDataResult({
                origen: 'sistema',
                codigo: null,
                nombre: 'Sistema Central',
                tipoCod: null,
                x: -4.0,
                y: 40.5,
                searchText: 'Sistema Central',
            });

            mockGeoDataRepository.search.mockResolvedValue([mockResult]);

            const dto = buildSearchGeoDataDto({ q: 'central' });
            const { body } = await searchGeoData(dto).expect(HttpStatus.OK);

            expect(body.results).toHaveLength(1);
            expect(body.results[0].nombre).toBe('Sistema Central');
            expect(mockGeoDataRepository.search).toHaveBeenCalledWith('central');
        });
    });

    // ─── Validation errors ──────────────────────────────────────
    describe('GET /search - validation', () => {
        it('should reject request without query parameter', async () => {
            await searchGeoData({}).expect(HttpStatus.BAD_REQUEST);
        });

        it('should reject request with empty query', async () => {
            await searchGeoData({ q: '' }).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
