import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';

import { AerialPrecipitationProxyController } from '../../../src/app/api/controllers/aerial-precipitation-proxy.controller';
import { ProxyService } from '../../../src/app/infrastructure/services/proxy.service';
import { ServicesConfigService } from '../../../src/configuration/services/services-config.service';
import { createTestApp, TestContext } from '../../helpers/test-app.helper';

describe('Aerial Precipitation Proxy (e2e)', () => {
    let app: INestApplication;

    const mockProxyService = {
        forward: jest.fn(),
    };

    const mockServicesConfig = {
        meteoApiUrl: 'http://meteo-api:3010',
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            controllers: [AerialPrecipitationProxyController],
            providers: [
                { provide: ProxyService, useValue: mockProxyService },
                { provide: ServicesConfigService, useValue: mockServicesConfig },
            ],
        });
        app = ctx.app;
    }, 30_000);

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
    });

    // ─────────────────────────────────────────────────────────────
    // GET /aerial-precipitation (list)
    // ─────────────────────────────────────────────────────────────

    describe('GET /aerial-precipitation — list', () => {
        const UPSTREAM_LIST_PAYLOAD = {
            data: [
                {
                    id: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
                    locationId: 'Cuenca.NAM.E_08',
                    parameterId: 'P.areal.harmonie.subcNAM.24H',
                    provider: 'harmonie',
                    layer: 'subcNAM',
                    stat: null,
                    accumulation: '24h',
                    forecastDate: '2026-07-21T00:00:00.000Z',
                    startDate: '2026-07-21T01:00:00.000Z',
                    endDate: '2026-07-24T01:00:00.000Z',
                    moduleInstanceId: 'Processing_Catchment_Harmonie',
                    stationName: 'PÁLMACES',
                    lat: 40.4721,
                    lon: -2.4155,
                    units: 'mm',
                    timeStepSeconds: 3600,
                    creationDate: '2026-07-21T11:15:08.000Z',
                    approvedDate: '2026-07-21T11:17:46.000Z',
                    sourceFileName: 'tagus_harmonie_Pareal_202607210000.json',
                    max: { eventDate: '2026-07-22T13:00:00.000Z', value: 12.5, flag: 2 },
                    last: { eventDate: '2026-07-24T01:00:00.000Z', value: 0.3, flag: 2 },
                },
            ],
            total: 4176,
            page: 1,
            limit: 50,
        };

        it('should forward the request to meteo-api and return the payload verbatim', async () => {
            mockProxyService.forward.mockResolvedValue({ status: 200, data: UPSTREAM_LIST_PAYLOAD });

            const { body } = await request(app.getHttpServer()).get('/aerial-precipitation').expect(HttpStatus.OK);

            expect(body).toEqual(UPSTREAM_LIST_PAYLOAD);
            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'GET',
                    baseUrl: 'http://meteo-api:3010',
                    path: '/aerial-precipitation',
                    headers: expect.objectContaining({ 'x-internal-caller': 'ms-gateway-api' }),
                }),
            );
        });

        it('should forward only allowlisted query params (layer, provider, locationId, accumulation, stat, fromForecastDate, toForecastDate, includeEvents, page, limit)', async () => {
            mockProxyService.forward.mockResolvedValue({ status: 200, data: UPSTREAM_LIST_PAYLOAD });

            await request(app.getHttpServer())
                .get('/aerial-precipitation')
                .query({
                    layer: 'subcNAM',
                    provider: 'harmonie',
                    locationId: 'Cuenca.NAM.E_08',
                    accumulation: '24h',
                    stat: 'Med',
                    fromForecastDate: '2026-07-14T00:00:00Z',
                    toForecastDate: '2026-07-21T00:00:00Z',
                    includeEvents: 'false',
                    page: '1',
                    limit: '50',
                    unknownParam: 'should-be-dropped',
                    anotherUnknown: 'also-dropped',
                })
                .expect(HttpStatus.OK);

            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    query: expect.objectContaining({
                        layer: 'subcNAM',
                        provider: 'harmonie',
                        locationId: 'Cuenca.NAM.E_08',
                        accumulation: '24h',
                        stat: 'Med',
                        fromForecastDate: '2026-07-14T00:00:00Z',
                        toForecastDate: '2026-07-21T00:00:00Z',
                        includeEvents: 'false',
                        page: '1',
                        limit: '50',
                    }),
                }),
            );

            const forwardCall = mockProxyService.forward.mock.calls[0][0];
            expect(forwardCall.query).not.toHaveProperty('unknownParam');
            expect(forwardCall.query).not.toHaveProperty('anotherUnknown');
        });

        it('should forward the request with no query params when none are provided', async () => {
            mockProxyService.forward.mockResolvedValue({ status: 200, data: UPSTREAM_LIST_PAYLOAD });

            await request(app.getHttpServer()).get('/aerial-precipitation').expect(HttpStatus.OK);

            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'GET',
                    path: '/aerial-precipitation',
                }),
            );
        });

        it('should propagate a 400 from the upstream service', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 400,
                data: { StatusCode: 400, ErrorDescription: 'Invalid layer value' },
            });

            await request(app.getHttpServer())
                .get('/aerial-precipitation')
                .query({ layer: 'invalid-layer' })
                .expect(HttpStatus.BAD_REQUEST);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // GET /aerial-precipitation/latest
    // ─────────────────────────────────────────────────────────────

    describe('GET /aerial-precipitation/latest', () => {
        const UPSTREAM_LATEST_PAYLOAD = {
            generatedAt: '2026-07-21T11:20:00.000Z',
            layer: 'subcNAM',
            provider: 'ens',
            accumulation: '12h',
            stat: 'Med',
            series: [
                {
                    id: 'c3d4e5f6-a7b8-9012-cdef-012345678901',
                    locationId: 'Cuenca.AEMET.1',
                    parameterId: 'P.areal.ens.aemet.Med.12h',
                    provider: 'ens',
                    layer: 'aemet',
                    stat: 'Med',
                    accumulation: '12h',
                    forecastDate: '2026-07-21T00:00:00.000Z',
                    startDate: '2026-07-21T12:00:00.000Z',
                    endDate: '2026-07-24T00:00:00.000Z',
                    moduleInstanceId: 'Processing_Catchment_EPS',
                    stationName: 'Albarracín y Jiloca',
                    lat: 40.4001,
                    lon: -1.4389,
                    units: 'mm',
                    timeStepSeconds: 3600,
                    creationDate: '2026-07-21T11:15:08.000Z',
                    approvedDate: '2026-07-21T11:17:46.000Z',
                    sourceFileName: 'tagus_eps_Pareal_202607210000.json',
                    max: { eventDate: '2026-07-22T12:00:00.000Z', value: 9.8, flag: 2 },
                    last: { eventDate: '2026-07-24T00:00:00.000Z', value: 0.0, flag: 2 },
                },
            ],
        };

        it('should forward the request to /aerial-precipitation/latest and return the payload verbatim', async () => {
            mockProxyService.forward.mockResolvedValue({ status: 200, data: UPSTREAM_LATEST_PAYLOAD });

            const { body } = await request(app.getHttpServer())
                .get('/aerial-precipitation/latest')
                .query({ layer: 'subcNAM', provider: 'ens', accumulation: '12h', stat: 'Med' })
                .expect(HttpStatus.OK);

            expect(body).toEqual(UPSTREAM_LATEST_PAYLOAD);
            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'GET',
                    baseUrl: 'http://meteo-api:3010',
                    path: '/aerial-precipitation/latest',
                    headers: expect.objectContaining({ 'x-internal-caller': 'ms-gateway-api' }),
                }),
            );
        });

        it('should forward only allowlisted query params (layer, provider, accumulation, stat, includeEvents)', async () => {
            mockProxyService.forward.mockResolvedValue({ status: 200, data: UPSTREAM_LATEST_PAYLOAD });

            await request(app.getHttpServer())
                .get('/aerial-precipitation/latest')
                .query({
                    layer: 'aemet',
                    provider: 'ens',
                    accumulation: '12h',
                    stat: 'Med',
                    includeEvents: 'true',
                    unknownParam: 'should-be-dropped',
                })
                .expect(HttpStatus.OK);

            const forwardCall = mockProxyService.forward.mock.calls[0][0];
            expect(forwardCall.query).toMatchObject({
                layer: 'aemet',
                provider: 'ens',
                accumulation: '12h',
                stat: 'Med',
                includeEvents: 'true',
            });
            expect(forwardCall.query).not.toHaveProperty('unknownParam');
        });

        it('should propagate a 400 from the upstream service', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 400,
                data: { StatusCode: 400, ErrorDescription: 'layer is required' },
            });

            await request(app.getHttpServer()).get('/aerial-precipitation/latest').expect(HttpStatus.BAD_REQUEST);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // GET /aerial-precipitation/by-location/:locationId
    // ─────────────────────────────────────────────────────────────

    describe('GET /aerial-precipitation/by-location/:locationId', () => {
        const LOCATION_ID = 'Sistema.Tajo.3';

        const UPSTREAM_BY_LOCATION_PAYLOAD = {
            locationId: 'Sistema.Tajo.3',
            groups: [
                {
                    provider: 'obs',
                    accumulation: '1h',
                    stat: null,
                    series: [
                        {
                            id: 'd4e5f6a7-b8c9-0123-defa-123456789012',
                            locationId: 'Sistema.Tajo.3',
                            parameterId: 'P.areal.obs.sis10.1h.v',
                            provider: 'obs',
                            layer: 'sistema',
                            stat: null,
                            accumulation: '1h',
                            forecastDate: '2026-07-21T00:00:00.000Z',
                            startDate: '2026-07-20T01:00:00.000Z',
                            endDate: '2026-07-21T00:00:00.000Z',
                            moduleInstanceId: null,
                            stationName: 'HENARES',
                            lat: 40.9812,
                            lon: -3.2047,
                            units: 'mm',
                            timeStepSeconds: 3600,
                            creationDate: '2026-07-21T02:05:00.000Z',
                            approvedDate: null,
                            sourceFileName: 'tagus_obs_Pareal_202607210000.json',
                            max: { eventDate: '2026-07-20T16:00:00.000Z', value: 12.5, flag: 2 },
                            last: { eventDate: '2026-07-21T00:00:00.000Z', value: 0.1, flag: 2 },
                        },
                    ],
                },
            ],
        };

        it('should forward the locationId as a path param to /aerial-precipitation/by-location/:locationId', async () => {
            mockProxyService.forward.mockResolvedValue({ status: 200, data: UPSTREAM_BY_LOCATION_PAYLOAD });

            const { body } = await request(app.getHttpServer())
                .get(`/aerial-precipitation/by-location/${LOCATION_ID}`)
                .expect(HttpStatus.OK);

            expect(body).toEqual(UPSTREAM_BY_LOCATION_PAYLOAD);
            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'GET',
                    baseUrl: 'http://meteo-api:3010',
                    path: `/aerial-precipitation/by-location/${LOCATION_ID}`,
                    headers: expect.objectContaining({ 'x-internal-caller': 'ms-gateway-api' }),
                }),
            );
        });

        it('should forward only allowlisted query params (provider, accumulation, fromForecastDate, toForecastDate, includeEvents)', async () => {
            mockProxyService.forward.mockResolvedValue({ status: 200, data: UPSTREAM_BY_LOCATION_PAYLOAD });

            await request(app.getHttpServer())
                .get(`/aerial-precipitation/by-location/${LOCATION_ID}`)
                .query({
                    provider: 'obs',
                    accumulation: '1h',
                    fromForecastDate: '2026-07-14T00:00:00Z',
                    toForecastDate: '2026-07-21T00:00:00Z',
                    includeEvents: 'false',
                    unknownParam: 'should-be-dropped',
                    anotherParam: 'also-dropped',
                })
                .expect(HttpStatus.OK);

            const forwardCall = mockProxyService.forward.mock.calls[0][0];
            expect(forwardCall.query).toMatchObject({
                provider: 'obs',
                accumulation: '1h',
                fromForecastDate: '2026-07-14T00:00:00Z',
                toForecastDate: '2026-07-21T00:00:00Z',
                includeEvents: 'false',
            });
            expect(forwardCall.query).not.toHaveProperty('unknownParam');
            expect(forwardCall.query).not.toHaveProperty('anotherParam');
        });

        it('should propagate a 404 from the upstream service when locationId has no data', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 404,
                data: { StatusCode: 404, ErrorDescription: 'No series found for locationId' },
            });

            await request(app.getHttpServer())
                .get('/aerial-precipitation/by-location/NonExistent.Location.99')
                .expect(HttpStatus.NOT_FOUND);
        });

        it('should propagate a 400 from the upstream service for invalid query params', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 400,
                data: { StatusCode: 400, ErrorDescription: 'Invalid accumulation value' },
            });

            await request(app.getHttpServer())
                .get(`/aerial-precipitation/by-location/${LOCATION_ID}`)
                .query({ accumulation: 'invalid' })
                .expect(HttpStatus.BAD_REQUEST);
        });
    });
});
