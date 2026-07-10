import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';

import { PredictionsProxyController } from '../../../src/app/api/controllers/predictions-proxy.controller';
import { ProxyService } from '../../../src/app/infrastructure/services/proxy.service';
import { ServicesConfigService } from '../../../src/configuration/services/services-config.service';
import { createTestApp, TestContext } from '../../helpers/test-app.helper';

describe('Predictions Proxy — Manual Simulation (e2e)', () => {
    let app: INestApplication;

    const mockProxyService = {
        forward: jest.fn(),
    };

    const mockServicesConfig = {
        predictionsApiUrl: 'http://predictions-api:3007',
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            controllers: [PredictionsProxyController],
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

    // Helper functions (NOT async — return the supertest chain so .expect() composes)
    function postManual(body: unknown) {
        return request(app.getHttpServer())
            .post('/simulations/manual')
            .send(body as object);
    }

    function buildValidManualBody(overrides: Record<string, unknown> = {}) {
        return {
            description: 'Operación de control Tranco',
            modmeteo: 'BOTH',
            maneuverIds: ['7f2a8b3c-9d1e-4f5a-b6c7-8d9e0f1a2b3c'],
            ...overrides,
        };
    }

    describe('POST /simulations/manual — valid payloads pass validation and forward', () => {
        it('should accept a valid body (including description) and forward it to predictions-api', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 201,
                data: { id: 'sim-uuid', status: 'MODEL_PROCESSING', type: 'MANUAL' },
            });

            const { body } = await postManual(buildValidManualBody()).expect(HttpStatus.CREATED);

            expect(body.id).toBe('sim-uuid');
            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    baseUrl: 'http://predictions-api:3007',
                    path: '/simulations/manual',
                    body: expect.objectContaining({ description: 'Operación de control Tranco', modmeteo: 'BOTH' }),
                }),
            );
        });

        it('should accept a body WITHOUT description (description is optional)', async () => {
            mockProxyService.forward.mockResolvedValue({ status: 201, data: { id: 'sim-uuid' } });

            const body = buildValidManualBody();
            delete (body as Record<string, unknown>).description;

            await postManual(body).expect(HttpStatus.CREATED);
            expect(mockProxyService.forward).toHaveBeenCalledTimes(1);
        });

        it('should accept an inline-maneuvers body (no ids) and forward it', async () => {
            mockProxyService.forward.mockResolvedValue({ status: 201, data: { id: 'sim-uuid' } });

            await postManual({
                modmeteo: 'HARMONIE',
                maneuvers: [{ reservoirCode: 'E001', outputFlowValue: 12.5 }],
            }).expect(HttpStatus.CREATED);

            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: '/simulations/manual',
                    body: expect.objectContaining({
                        maneuvers: [{ reservoirCode: 'E001', outputFlowValue: 12.5 }],
                    }),
                }),
            );
        });
    });

    describe('POST /simulations/manual — invalid payloads are rejected BEFORE forwarding', () => {
        it('should reject a description longer than 500 chars and NOT forward', async () => {
            await postManual(buildValidManualBody({ description: 'x'.repeat(501) })).expect(HttpStatus.BAD_REQUEST);
            expect(mockProxyService.forward).not.toHaveBeenCalled();
        });

        it('should reject an inline maneuver with a negative outputFlowValue (nested validation)', async () => {
            await postManual({
                modmeteo: 'HARMONIE',
                maneuvers: [{ reservoirCode: 'E001', outputFlowValue: -5 }],
            }).expect(HttpStatus.BAD_REQUEST);
            expect(mockProxyService.forward).not.toHaveBeenCalled();
        });

        it('should reject a non-string element in maneuverIds', async () => {
            await postManual(buildValidManualBody({ maneuverIds: [123] })).expect(HttpStatus.BAD_REQUEST);
            expect(mockProxyService.forward).not.toHaveBeenCalled();
        });

        it('should reject an invalid modmeteo value', async () => {
            await postManual(buildValidManualBody({ modmeteo: 'INVALID' })).expect(HttpStatus.BAD_REQUEST);
            expect(mockProxyService.forward).not.toHaveBeenCalled();
        });

        it('should reject an unknown extra property (forbidNonWhitelisted still active)', async () => {
            await postManual(buildValidManualBody({ hackerField: 'boom' })).expect(HttpStatus.BAD_REQUEST);
            expect(mockProxyService.forward).not.toHaveBeenCalled();
        });
    });

    describe('POST /maneuvers — standalone maneuver validation', () => {
        function postManeuver(body: unknown) {
            return request(app.getHttpServer())
                .post('/maneuvers')
                .send(body as object);
        }

        it('should accept a valid maneuver and forward it', async () => {
            mockProxyService.forward.mockResolvedValue({ status: 201, data: { id: 'man-uuid' } });

            await postManeuver({ reservoirCode: 'AR01', outputFlowValue: 12.5 }).expect(HttpStatus.CREATED);
            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'POST', path: '/maneuvers' }),
            );
        });

        it('should reject a maneuver with a negative outputFlowValue and NOT forward', async () => {
            await postManeuver({ reservoirCode: 'AR01', outputFlowValue: -1 }).expect(HttpStatus.BAD_REQUEST);
            expect(mockProxyService.forward).not.toHaveBeenCalled();
        });

        it('should accept optional start/end dates and forward them', async () => {
            mockProxyService.forward.mockResolvedValue({ status: 201, data: { id: 'man-uuid' } });

            await postManeuver({
                reservoirCode: 'AR01',
                outputFlowValue: 12.5,
                startDate: '2026-06-20T00:00:00.000Z',
                endDate: '2026-06-21T00:00:00.000Z',
            }).expect(HttpStatus.CREATED);

            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: '/maneuvers',
                    body: expect.objectContaining({
                        startDate: '2026-06-20T00:00:00.000Z',
                        endDate: '2026-06-21T00:00:00.000Z',
                    }),
                }),
            );
        });

        it('should reject a non-ISO startDate and NOT forward', async () => {
            await postManeuver({ reservoirCode: 'AR01', outputFlowValue: 12.5, startDate: 'nope' }).expect(
                HttpStatus.BAD_REQUEST,
            );
            expect(mockProxyService.forward).not.toHaveBeenCalled();
        });
    });

    describe('GET /simulations — forwards filters, sort and station-code', () => {
        function listSimulations(query: Record<string, string>) {
            return request(app.getHttpServer()).get('/simulations').query(query);
        }

        it('should forward all query params (filters + sort + stationCode) to predictions-api', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 200,
                data: { data: [], total: 0, page: 2, limit: 10 },
            });

            const { body } = await listSimulations({
                status: 'FINALIZED',
                stationCode: 'E001',
                sortBy: 'simulationDate',
                sortOrder: 'ASC',
                page: '2',
                limit: '10',
            }).expect(HttpStatus.OK);

            expect(body).toEqual({ data: [], total: 0, page: 2, limit: 10 });
            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'GET',
                    baseUrl: 'http://predictions-api:3007',
                    path: '/simulations',
                    query: expect.objectContaining({
                        status: 'FINALIZED',
                        stationCode: 'E001',
                        sortBy: 'simulationDate',
                        sortOrder: 'ASC',
                        page: '2',
                        limit: '10',
                    }),
                }),
            );
        });

        it('should forward GET /simulations even with no query params', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 200,
                data: { data: [], total: 0, page: 1, limit: 20 },
            });

            await request(app.getHttpServer()).get('/simulations').expect(HttpStatus.OK);

            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'GET', path: '/simulations' }),
            );
        });
    });

    describe('GET /simulations/manual/:id/results — proxies to predictions-api results endpoint', () => {
        const SIM_ID = '7f2a8b3c-9d1e-4f5a-b6c7-8d9e0f1a2b3c';

        it('should forward the request and return the results payload', async () => {
            const upstreamPayload = {
                simulation: {
                    id: SIM_ID,
                    simulationDate: '20260619120000',
                    status: 'FINALIZED',
                    type: 'MANUAL',
                    dataOrigin: 'FORECAST',
                    createdAt: '2026-06-19T12:00:00.000Z',
                    updatedAt: '2026-06-19T13:45:12.000Z',
                },
                predictions: [
                    {
                        id: '3f9d1e2b-6c47-4a8b-9c1d-2e3f4a5b6c7d',
                        stationId: 'AR35',
                        stationName: 'Embalse de Arévalo',
                        predictionTypeId: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
                        predictionTypeName: 'Q.NAM.forecast',
                        predictionTypeUnit: 'm3/s',
                        percentile: null,
                        predictionProvider: 'aemet',
                        predictedBy: 'harmonie-2026-06-19',
                        predictionDate: '2026-06-19T00:00:00.000Z',
                        predictionStartDate: '2026-06-19T00:00:00.000Z',
                        predictionEndDate: '2026-06-22T00:00:00.000Z',
                        results: [
                            { date: '2026-06-19T00:00:00.000Z', value: 123.4, flag: 0 },
                            { date: '2026-06-19T01:00:00.000Z', value: 121.9, flag: 0 },
                        ],
                    },
                ],
            };
            mockProxyService.forward.mockResolvedValue({ status: 200, data: upstreamPayload });

            const { body } = await request(app.getHttpServer())
                .get(`/simulations/manual/${SIM_ID}/results`)
                .expect(HttpStatus.OK);

            expect(body).toEqual(upstreamPayload);
            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'GET',
                    baseUrl: 'http://predictions-api:3007',
                    path: `/simulations/manual/${SIM_ID}/results`,
                }),
            );
        });

        it('should forward an empty predictions payload while the simulation is still processing', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 200,
                data: {
                    simulation: {
                        id: SIM_ID,
                        simulationDate: '20260619120000',
                        status: 'MODEL_PROCESSING',
                        type: 'MANUAL',
                        dataOrigin: 'FORECAST',
                        createdAt: '2026-06-19T12:00:00.000Z',
                        updatedAt: '2026-06-19T12:00:05.000Z',
                    },
                    predictions: [],
                },
            });

            const { body } = await request(app.getHttpServer())
                .get(`/simulations/manual/${SIM_ID}/results`)
                .expect(HttpStatus.OK);

            expect(body.simulation.status).toBe('MODEL_PROCESSING');
            expect(body.predictions).toEqual([]);
        });

        it('should propagate a 404 from predictions-api', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 404,
                data: { StatusCode: 404, ErrorDescription: 'Manual simulation not found' },
            });

            await request(app.getHttpServer())
                .get(`/simulations/manual/${SIM_ID}/results`)
                .expect(HttpStatus.NOT_FOUND);
        });

        it('should propagate a 400 for an invalid UUID', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 400,
                data: { StatusCode: 400, ErrorDescription: 'Invalid simulation id' },
            });

            await request(app.getHttpServer())
                .get('/simulations/manual/not-a-uuid/results')
                .expect(HttpStatus.BAD_REQUEST);
            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/simulations/manual/not-a-uuid/results' }),
            );
        });
    });
});
