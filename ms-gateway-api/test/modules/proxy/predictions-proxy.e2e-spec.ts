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
        return request(app.getHttpServer()).post('/simulations/manual').send(body as object);
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
            return request(app.getHttpServer()).post('/maneuvers').send(body as object);
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
    });
});
