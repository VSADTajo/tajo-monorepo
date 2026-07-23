import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { Simulation } from '../../../src/app/domain/entities/simulation.entity';
import { ProviderError } from '../../../src/app/domain/errors/provider.error';
import { Maneuver } from '../../../src/app/domain/entities/maneuver.entity';
import { Prediction } from '../../../src/app/domain/entities/prediction.entity';
import { PredictionType } from '../../../src/app/domain/entities/prediction-type.entity';
import { PredictionResult } from '../../../src/app/domain/entities/prediction-result.entity';

import { ISimulationRepository } from '../../../src/app/domain/ports/simulation-repository.port';
import { IManeuverRepository } from '../../../src/app/domain/ports/maneuver-repository.port';
import { IPredictionRepository } from '../../../src/app/domain/ports/prediction-repository.port';
import { IStationCatalogService } from '../../../src/app/domain/ports/station-catalog-service.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { IMessageBroker } from '../../../src/app/domain/ports/message-broker.port';
import { ISimulationSftpService } from '../../../src/app/domain/ports/simulation-sftp.port';

import { SimulationRepository } from '../../../src/app/infrastructure/persistence/simulation.repository';
import { ManeuverRepository } from '../../../src/app/infrastructure/persistence/maneuver.repository';
import { PredictionRepository } from '../../../src/app/infrastructure/persistence/prediction.repository';

import { CreateManualSimulationHandler } from '../../../src/app/application/commands/manual-simulation.commands';
import {
    CreateManeuverHandler,
    UpdateManeuverHandler,
    DeleteManeuverHandler,
} from '../../../src/app/application/commands/maneuver.commands';
import { SimulationController } from '../../../src/app/api/controllers/simulation.controller';
import { ManeuverController } from '../../../src/app/api/controllers/maneuver.controller';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateManualSimulationDto, buildCreateManeuverDto } from '../../factories/manual-simulation.factory';

describe('Create Manual Simulation (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockSftpService = {
        uploadInputFile: jest.fn().mockResolvedValue(undefined),
        ensureOutputFolder: jest.fn().mockResolvedValue(undefined),
    };

    const mockMessageBroker = {
        publish: jest.fn().mockResolvedValue(undefined),
        publishToTopic: jest.fn().mockResolvedValue(undefined),
    };

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    // The station catalog is an HTTP call to ms-hydro-api → mocked (no external calls in tests).
    const mockStationCatalogService = {
        listStations: jest.fn().mockResolvedValue([]),
        listFullStations: jest.fn().mockResolvedValue([]),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [Simulation, Maneuver, Prediction, PredictionType, PredictionResult],
            controllers: [SimulationController, ManeuverController],
            providers: [
                CreateManualSimulationHandler,
                CreateManeuverHandler,
                UpdateManeuverHandler,
                DeleteManeuverHandler,
                { provide: ISimulationRepository, useClass: SimulationRepository },
                { provide: IManeuverRepository, useClass: ManeuverRepository },
                { provide: IPredictionRepository, useClass: PredictionRepository },
                { provide: IStationCatalogService, useValue: mockStationCatalogService },
                { provide: ISimulationSftpService, useValue: mockSftpService },
                { provide: IMessageBroker, useValue: mockMessageBroker },
                { provide: ICacheService, useValue: mockCacheService },
                CachingQueryBus,
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
        mockSftpService.uploadInputFile.mockResolvedValue(undefined);
        mockSftpService.ensureOutputFolder.mockResolvedValue(undefined);
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    function createManualSimulation(dto: object) {
        return request(app.getHttpServer()).post('/simulations/manual').send(dto);
    }

    async function createManeuvers(
        count: number,
        override?: Partial<{ reservoirCode: string; outputFlowValue: number }>,
    ): Promise<string[]> {
        const ids: string[] = [];
        for (let i = 0; i < count; i++) {
            const dto = buildCreateManeuverDto({ reservoirCode: `E${100 + i}`, ...override });
            const { body } = await request(app.getHttpServer()).post('/maneuvers').send(dto).expect(HttpStatus.CREATED);
            ids.push(body.id);
        }
        return ids;
    }

    // T020: Happy path
    describe('happy path', () => {
        it('should create a manual simulation referencing existing maneuvers', async () => {
            const maneuverIds = await createManeuvers(2);
            const dto = buildCreateManualSimulationDto({ maneuverIds });

            const { body } = await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(body.id).toBeDefined();
            expect(body.status).toBe('MODEL_PROCESSING');
            expect(body.type).toBe('MANUAL');
            // simulationDate is auto-generated in YYYYMMDDHHMMSS format
            expect(body.simulationDate).toMatch(/^\d{14}$/);
            expect(body.maneuvers).toHaveLength(2);
            expect(body.maneuvers.map((m: { id: string }) => m.id).sort()).toEqual([...maneuverIds].sort());
        });

        it('should create and attach inline maneuvers', async () => {
            const dto = buildCreateManualSimulationDto({
                maneuverIds: undefined,
                maneuvers: [{ reservoirCode: 'E001', outputFlowValue: 12.5 }],
            });

            const { body } = await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(body.maneuvers).toHaveLength(1);
            expect(body.maneuvers[0].reservoirCode).toBe('E001');
            expect(body.maneuvers[0].outputFlowValue).toBe(12.5);
            expect(body.maneuvers[0].id).toBeDefined(); // the API created it
        });

        it('should accept a hybrid payload (existing ids + inline maneuvers)', async () => {
            const [existingId] = await createManeuvers(1);
            const dto = buildCreateManualSimulationDto({
                maneuverIds: [existingId],
                maneuvers: [{ reservoirCode: 'E200', outputFlowValue: 7 }],
            });

            const { body } = await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(body.maneuvers).toHaveLength(2);
            const codes = body.maneuvers.map((m: { reservoirCode: string }) => m.reservoirCode).sort();
            expect(codes).toContain('E200');
        });

        it('should call SFTP service to upload a single input file named by the first time step', async () => {
            const maneuverIds = await createManeuvers(1);
            const dto = buildCreateManualSimulationDto({ maneuverIds, modmeteo: 'HARMONIE' });

            await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(mockSftpService.uploadInputFile).toHaveBeenCalledTimes(1);
            const [simulationId, fileName, content] = mockSftpService.uploadInputFile.mock.calls[0];
            expect(typeof simulationId).toBe('string');
            expect(fileName).toMatch(/^Q_mod_input_\d{12}\.json$/);
            expect(content).toBeInstanceOf(Buffer);

            // The single file carries the modified series with the import-critical header fields.
            const parsed = JSON.parse((content as Buffer).toString('utf-8'));
            expect(parsed.version).toBe('1.34');
            expect(parsed.timeSeries).toHaveLength(1);
            expect(parsed.timeSeries[0].header.parameterId).toBe('Q.salida.forecast');
            expect(typeof parsed.timeSeries[0].header.locationId).toBe('string');
        });

        it('should pre-create the output folder on the SFTP for the simulation', async () => {
            const maneuverIds = await createManeuvers(1);
            const dto = buildCreateManualSimulationDto({ maneuverIds });

            const { body } = await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(mockSftpService.ensureOutputFolder).toHaveBeenCalledWith(body.id);
        });

        it('should still dispatch when output-folder creation fails (best-effort, non-blocking)', async () => {
            mockSftpService.ensureOutputFolder.mockRejectedValueOnce(new ProviderError('SFTP unavailable'));
            const maneuverIds = await createManeuvers(1);
            const dto = buildCreateManualSimulationDto({ maneuverIds });

            await createManualSimulation(dto).expect(HttpStatus.CREATED);
        });

        it('should upload a single file regardless of modmeteo (BOTH no longer splits the file)', async () => {
            const maneuverIds = await createManeuvers(1);
            const dto = buildCreateManualSimulationDto({ maneuverIds, modmeteo: 'BOTH' });

            await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(mockSftpService.uploadInputFile).toHaveBeenCalledTimes(1);
            expect(mockSftpService.uploadInputFile.mock.calls[0][1]).toMatch(/^Q_mod_input_\d{12}\.json$/);
        });

        it('should emit one timeSeries per modified station in the same file', async () => {
            const maneuverIds = await createManeuvers(3); // E100, E101, E102
            const dto = buildCreateManualSimulationDto({ maneuverIds });

            await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(mockSftpService.uploadInputFile).toHaveBeenCalledTimes(1);
            const content = mockSftpService.uploadInputFile.mock.calls[0][2] as Buffer;
            const parsed = JSON.parse(content.toString('utf-8'));
            expect(parsed.timeSeries).toHaveLength(3);
            const locationIds = parsed.timeSeries
                .map((s: { header: { locationId: string } }) => s.header.locationId)
                .sort();
            expect(locationIds).toEqual(['E100', 'E101', 'E102']);
            for (const s of parsed.timeSeries) {
                expect(s.header.parameterId).toBe('Q.salida.forecast');
            }
        });

        it('should write a provided curve verbatim (CURVE mode) instead of a flat fill', async () => {
            const dto = buildCreateManualSimulationDto({
                maneuverIds: undefined,
                maneuvers: [
                    {
                        reservoirCode: 'E_09',
                        outputFlowValue: 20,
                        series: [
                            { date: '2026-07-22', time: '00:00:00', value: 20.004, flag: 0 },
                            { date: '2026-07-22', time: '00:15:00', value: 20.011, flag: 0 },
                            { date: '2026-07-22', time: '00:30:00', value: 20.02, flag: 0 },
                        ],
                    },
                ],
            });

            await createManualSimulation(dto).expect(HttpStatus.CREATED);

            const content = mockSftpService.uploadInputFile.mock.calls[0][2] as Buffer;
            const parsed = JSON.parse(content.toString('utf-8'));
            expect(parsed.timeSeries[0].events).toHaveLength(3);
            expect(parsed.timeSeries[0].events[0]).toEqual({
                date: '2026-07-22',
                time: '00:00:00',
                value: '20.004',
                flag: '0',
            });
        });

        it('should publish simulation.manual.dispatched event', async () => {
            const maneuverIds = await createManeuvers(1);
            const dto = buildCreateManualSimulationDto({ maneuverIds });

            const { body } = await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(mockMessageBroker.publishToTopic).toHaveBeenCalledTimes(1);
            const [exchange, routingKey, payload] = mockMessageBroker.publishToTopic.mock.calls[0];
            expect(exchange).toBe('simulation-events');
            expect(routingKey).toBe('simulation.manual.dispatched');
            expect(payload.simulationId).toBe(body.id);
            expect(payload.outputFolder).toContain(body.id);
        });

        it('should invalidate BOTH simulation cache namespaces on dispatch', async () => {
            const maneuverIds = await createManeuvers(1);
            const dto = buildCreateManualSimulationDto({ maneuverIds });

            // Drop the cache calls made while seeding maneuvers; assert only the dispatch.
            mockCacheService.delByPattern.mockClear();

            await createManualSimulation(dto).expect(HttpStatus.CREATED);

            // A manual simulation surfaces in both the general and manual GET endpoints,
            // so dispatch must clear both namespaces.
            expect(mockCacheService.delByPattern).toHaveBeenCalledWith('simulations:*');
            expect(mockCacheService.delByPattern).toHaveBeenCalledWith('manual-simulation:*');
            expect(mockCacheService.delByPattern).toHaveBeenCalledTimes(2);
        });
    });

    // T021: Validation errors
    describe('validation errors', () => {
        it('should return 400 when maneuverIds array is empty', async () => {
            const dto = buildCreateManualSimulationDto({ maneuverIds: [] });

            const { body } = await createManualSimulation(dto).expect(HttpStatus.BAD_REQUEST);
            expect(body).toBeDefined();
        });

        it('should return 400 when neither maneuverIds nor maneuvers are provided', async () => {
            await createManualSimulation({ modmeteo: 'HARMONIE', description: 'no maneuvers' }).expect(
                HttpStatus.BAD_REQUEST,
            );
        });

        it('should return 400 when an inline maneuver has a negative outputFlowValue', async () => {
            const dto = buildCreateManualSimulationDto({
                maneuverIds: undefined,
                maneuvers: [{ reservoirCode: 'E001', outputFlowValue: -3 }],
            });

            await createManualSimulation(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 400 (not 500) when a curve series has an unparseable timestamp', async () => {
            const dto = buildCreateManualSimulationDto({
                maneuverIds: undefined,
                maneuvers: [
                    {
                        reservoirCode: 'E_09',
                        outputFlowValue: 20,
                        // passes the DTO format regex but is not a real date/time → must be rejected
                        // by the handler BEFORE persisting (no 500, no orphaned simulation).
                        series: [{ date: '2026-13-45', time: '99:99:99', value: 20 }],
                    },
                ],
            });

            await createManualSimulation(dto).expect(HttpStatus.BAD_REQUEST);
            expect(mockSftpService.uploadInputFile).not.toHaveBeenCalled();
        });

        it('should return 400 (not 500) when a maneuverId is not a valid UUID', async () => {
            const dto = buildCreateManualSimulationDto({ maneuverIds: ['not-a-uuid'] });

            await createManualSimulation(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 404 when a referenced maneuverId does not exist', async () => {
            const dto = buildCreateManualSimulationDto({
                maneuverIds: ['00000000-0000-0000-0000-000000000000'],
            });

            await createManualSimulation(dto).expect(HttpStatus.NOT_FOUND);
        });

        it('should return 503 when SFTP upload fails, and simulation remains CREATED', async () => {
            mockSftpService.uploadInputFile.mockRejectedValueOnce(new ProviderError('SFTP connection refused'));
            const maneuverIds = await createManeuvers(1);

            const dto = buildCreateManualSimulationDto({ maneuverIds });

            const { body } = await createManualSimulation(dto).expect(HttpStatus.SERVICE_UNAVAILABLE);
            expect(body).toBeDefined();
        });
    });

    describe('maneuver dates (optional startDate / endDate)', () => {
        function postManeuver(body: object) {
            return request(app.getHttpServer()).post('/maneuvers').send(body);
        }

        it('should create a maneuver with start/end dates and echo them', async () => {
            const { body } = await postManeuver({
                reservoirCode: 'E001',
                outputFlowValue: 12.5,
                startDate: '2026-06-20T00:00:00.000Z',
                endDate: '2026-06-21T00:00:00.000Z',
            }).expect(HttpStatus.CREATED);

            expect(new Date(body.startDate).toISOString()).toBe('2026-06-20T00:00:00.000Z');
            expect(new Date(body.endDate).toISOString()).toBe('2026-06-21T00:00:00.000Z');
        });

        it('should default the dates to null when omitted', async () => {
            const { body } = await postManeuver({ reservoirCode: 'E002', outputFlowValue: 5 }).expect(
                HttpStatus.CREATED,
            );

            expect(body.startDate).toBeNull();
            expect(body.endDate).toBeNull();
        });

        it('should reject a maneuver whose endDate is before its startDate', async () => {
            await postManeuver({
                reservoirCode: 'E003',
                outputFlowValue: 5,
                startDate: '2026-06-21T00:00:00.000Z',
                endDate: '2026-06-20T00:00:00.000Z',
            }).expect(HttpStatus.BAD_REQUEST);
        });

        it('should reject a non-ISO startDate', async () => {
            await postManeuver({ reservoirCode: 'E004', outputFlowValue: 5, startDate: 'not-a-date' }).expect(
                HttpStatus.BAD_REQUEST,
            );
        });

        it('should accept a maneuver with only an endDate (the two dates are independent)', async () => {
            const { body } = await postManeuver({
                reservoirCode: 'E005',
                outputFlowValue: 5,
                endDate: '2026-06-21T00:00:00.000Z',
            }).expect(HttpStatus.CREATED);

            expect(body.startDate).toBeNull();
            expect(new Date(body.endDate).toISOString()).toBe('2026-06-21T00:00:00.000Z');
        });

        it('should clear a date back to null via PATCH (startDate: null), not set it to epoch', async () => {
            const { body: created } = await postManeuver({
                reservoirCode: 'E006',
                outputFlowValue: 5,
                startDate: '2026-06-20T00:00:00.000Z',
                endDate: '2026-06-21T00:00:00.000Z',
            }).expect(HttpStatus.CREATED);

            const { body: updated } = await request(app.getHttpServer())
                .patch(`/maneuvers/${created.id}`)
                .send({ startDate: null })
                .expect(HttpStatus.OK);

            expect(updated.startDate).toBeNull();
            // the untouched endDate stays put
            expect(new Date(updated.endDate).toISOString()).toBe('2026-06-21T00:00:00.000Z');
        });

        it('should accept inline maneuvers with dates in the manual simulation POST', async () => {
            const dto = buildCreateManualSimulationDto({
                maneuverIds: undefined,
                maneuvers: [
                    {
                        reservoirCode: 'E001',
                        outputFlowValue: 12.5,
                        startDate: '2026-06-20T00:00:00.000Z',
                        endDate: '2026-06-21T00:00:00.000Z',
                    },
                ],
            });

            const { body } = await createManualSimulation(dto).expect(HttpStatus.CREATED);

            expect(body.maneuvers).toHaveLength(1);
            expect(new Date(body.maneuvers[0].startDate).toISOString()).toBe('2026-06-20T00:00:00.000Z');
            expect(new Date(body.maneuvers[0].endDate).toISOString()).toBe('2026-06-21T00:00:00.000Z');
        });
    });
});
