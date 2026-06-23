import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RmqContext } from '@nestjs/microservices';
import { CommandBus } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';
import { TraceContext } from 'tajo-toolkit';

import { Notification } from '../../../src/app/domain/entities/notification.entity';
import { INotificationRepository } from '../../../src/app/domain/ports/notification-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { NotificationRepository } from '../../../src/app/infrastructure/persistence/notification.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';
import { CreateNotificationHandler } from '../../../src/app/application/commands/notification.commands';
import { ListNotificationsHandler } from '../../../src/app/application/queries/notification.queries';
import { NotificationController } from '../../../src/app/api/controllers/notification.controller';
import { SimulationStatusConsumer } from '../../../src/app/application/consumers/simulation-status.consumer';
import {
    SimulationStatusNotificationMapper,
    SIMULATION_STATUS_NOTIFICATION_TYPE,
    SIMULATION_STATUS_NOTIFICATION_SOURCE,
} from '../../../src/app/application/mappers/notification.mappers';
import { NotificationSeverity } from '../../../src/app/domain/types/notification-severity.enum';
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';

// ─────────────────────────────────────────────────────────────
// Mapper (pure — no infrastructure)
// ─────────────────────────────────────────────────────────────

describe('SimulationStatusNotificationMapper', () => {
    it('maps MODEL_FAILED to a CRITICAL notification', () => {
        const command = SimulationStatusNotificationMapper.fromEvent('sim-1', 'MODEL_FAILED');

        expect(command.type).toBe(SIMULATION_STATUS_NOTIFICATION_TYPE);
        expect(command.source).toBe(SIMULATION_STATUS_NOTIFICATION_SOURCE);
        expect(command.severity).toBe(NotificationSeverity.CRITICAL);
        expect(command.title).toBe('Simulación fallida');
        expect(command.message).toContain('sim-1');
        expect(command.metadata).toEqual({ simulationId: 'sim-1', status: 'MODEL_FAILED' });
    });

    it('maps FINALIZED to an INFO notification', () => {
        const command = SimulationStatusNotificationMapper.fromEvent('sim-2', 'FINALIZED');

        expect(command.severity).toBe(NotificationSeverity.INFO);
        expect(command.title).toBe('Simulación finalizada');
        expect(command.message).toContain('sim-2');
    });

    it('falls back to a generic INFO notification for an unknown status', () => {
        const command = SimulationStatusNotificationMapper.fromEvent('sim-3', 'SOMETHING_NEW');

        expect(command.severity).toBe(NotificationSeverity.INFO);
        expect(command.title).toBe('Estado de simulación actualizado');
        expect(command.message).toContain('SOMETHING_NEW');
    });
});

// ─────────────────────────────────────────────────────────────
// Consumer error handling (unit — no infrastructure)
// ─────────────────────────────────────────────────────────────

describe('SimulationStatusConsumer — transient error handling', () => {
    it('requeues the message (nack requeue=true) when the command bus throws', async () => {
        const ack = jest.fn();
        const nack = jest.fn();
        const context = {
            getChannelRef: () => ({ ack, nack }),
            getMessage: () => ({ properties: { headers: {} } }),
        } as unknown as RmqContext;

        const mockLogger = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        } as unknown as Logger;
        const mockCommandBus = {
            execute: jest.fn().mockRejectedValue(new Error('db down')),
        } as unknown as CommandBus;
        const mockTrace = {
            runInContext: (_traceId: string, cb: () => Promise<void>) => cb(),
        } as unknown as TraceContext;

        const consumer = new SimulationStatusConsumer(mockLogger, mockCommandBus, mockTrace);
        await consumer.handleSimulationStatusUpdated({ simulationId: 'sim-1', status: 'MODEL_FAILED' }, context);

        expect(nack).toHaveBeenCalledWith(expect.anything(), false, true);
        expect(ack).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────
// Consumer (end-to-end — real Postgres, verified through the API)
// ─────────────────────────────────────────────────────────────

describe('Simulation Status Notification (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let consumer: SimulationStatusConsumer;
    let ack: jest.Mock;
    let nack: jest.Mock;

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    // TraceContext only needs to run the callback inline for the consumer to work.
    const mockTraceContext = {
        runInContext: (_traceId: string, cb: () => Promise<void>) => cb(),
    };

    const buildContext = () =>
        ({
            getChannelRef: () => ({ ack, nack }),
            getMessage: () => ({ properties: { headers: {} } }),
        }) as unknown as RmqContext;

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [Notification],
            controllers: [SimulationStatusConsumer, NotificationController],
            providers: [
                CreateNotificationHandler,
                ListNotificationsHandler,
                { provide: INotificationRepository, useClass: NotificationRepository },
                { provide: ICacheService, useValue: mockCacheService },
                { provide: TraceContext, useValue: mockTraceContext },
                CachingQueryBus,
            ],
        });
        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
        consumer = app.get(SimulationStatusConsumer);
    }, 60_000);

    beforeEach(() => {
        ack = jest.fn();
        nack = jest.fn();
    });

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    function listNotifications() {
        return request(app.getHttpServer()).get('/notifications');
    }

    it('creates a CRITICAL notification when a simulation fails, and acks', async () => {
        await consumer.handleSimulationStatusUpdated({ simulationId: 'sim-1', status: 'MODEL_FAILED' }, buildContext());

        const { body } = await listNotifications().expect(HttpStatus.OK);

        expect(body.total).toBe(1);
        const notification = body.data[0];
        expect(notification.type).toBe('SIMULATION_STATUS_CHANGED');
        expect(notification.source).toBe('ms-model-api');
        expect(notification.severity).toBe('CRITICAL');
        expect(notification.message).toContain('sim-1');
        expect(notification.metadata).toEqual({ simulationId: 'sim-1', status: 'MODEL_FAILED' });
        expect(ack).toHaveBeenCalledTimes(1);
        expect(nack).not.toHaveBeenCalled();
    });

    it('rejects an invalid payload without requeue and creates no notification', async () => {
        // Missing status → poison message.
        await consumer.handleSimulationStatusUpdated(
            { simulationId: 'sim-x' } as { simulationId: string; status?: string },
            buildContext(),
        );

        const { body } = await listNotifications().expect(HttpStatus.OK);

        expect(body.total).toBe(0);
        expect(nack).toHaveBeenCalledWith(expect.anything(), false, false);
        expect(ack).not.toHaveBeenCalled();
    });
});
