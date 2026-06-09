import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { Notification } from '../../../src/app/domain/entities/notification.entity';
import { INotificationRepository } from '../../../src/app/domain/ports/notification-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { NotificationRepository } from '../../../src/app/infrastructure/persistence/notification.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';
import {
    CreateNotificationHandler,
    MarkAsReadHandler,
    ArchiveNotificationHandler,
    BulkMarkAsReadHandler,
    BulkArchiveHandler,
} from '../../../src/app/application/commands/notification.commands';
import { ListNotificationsHandler } from '../../../src/app/application/queries/notification.queries';
import { NotificationController } from '../../../src/app/api/controllers/notification.controller';
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateNotificationDto } from '../../factories/notification.factory';

describe('Notifications CRUD (e2e)', () => {
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
            entities: [Notification],
            controllers: [NotificationController],
            providers: [
                CreateNotificationHandler,
                MarkAsReadHandler,
                ArchiveNotificationHandler,
                BulkMarkAsReadHandler,
                BulkArchiveHandler,
                ListNotificationsHandler,
                { provide: INotificationRepository, useClass: NotificationRepository },
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
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    // ─── Helpers ──────────────────────────────────────────────

    function createNotification(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/notifications').send(dto);
    }

    function listNotifications(query?: Record<string, unknown>) {
        return request(app.getHttpServer())
            .get('/notifications')
            .query(query ?? {});
    }

    function markAsRead(id: string) {
        return request(app.getHttpServer()).patch(`/notifications/${id}/read`);
    }

    function archive(id: string) {
        return request(app.getHttpServer()).patch(`/notifications/${id}/archive`);
    }

    function bulkRead(ids: string[]) {
        return request(app.getHttpServer()).patch('/notifications/bulk/read').send({ ids });
    }

    function bulkArchive(ids: string[]) {
        return request(app.getHttpServer()).patch('/notifications/bulk/archive').send({ ids });
    }

    // ─── US1: Create Notifications ───────────────────────────

    describe('POST /notifications', () => {
        it('should create a notification with all fields', async () => {
            const dto = buildCreateNotificationDto({
                severity: 'CRITICAL',
                metadata: { stationId: 'st-1', value: 5.8 },
            });
            const { body } = await createNotification(dto).expect(HttpStatus.CREATED);

            expect(body.id).toBeDefined();
            expect(body.type).toBe(dto.type);
            expect(body.source).toBe(dto.source);
            expect(body.title).toBe(dto.title);
            expect(body.message).toBe(dto.message);
            expect(body.severity).toBe('CRITICAL');
            expect(body.status).toBe('UNREAD');
            expect(body.metadata).toEqual({ stationId: 'st-1', value: 5.8 });
        });

        it('should return 400 for missing required fields', async () => {
            await createNotification({ type: 'TEST' }).expect(HttpStatus.BAD_REQUEST);
        });

        it('should accept any type and source (agnostic)', async () => {
            const dto = buildCreateNotificationDto({ type: 'CUSTOM_UNKNOWN', source: 'ms-whatever' });
            const { body } = await createNotification(dto).expect(HttpStatus.CREATED);
            expect(body.type).toBe('CUSTOM_UNKNOWN');
            expect(body.source).toBe('ms-whatever');
        });

        it('should return 400 for invalid severity', async () => {
            const dto = buildCreateNotificationDto({ severity: 'INVALID' as any });
            await createNotification(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('should create notifications with each severity level', async () => {
            for (const severity of ['INFO', 'WARNING', 'CRITICAL']) {
                const dto = buildCreateNotificationDto({ severity });
                const { body } = await createNotification(dto).expect(HttpStatus.CREATED);
                expect(body.severity).toBe(severity);
            }
        });
    });

    // ─── US2: List and Filter Notifications ──────────────────

    describe('GET /notifications', () => {
        it('should return empty list when no notifications exist', async () => {
            const { body } = await listNotifications().expect(HttpStatus.OK);
            expect(body.data).toEqual([]);
            expect(body.total).toBe(0);
        });

        it('should return notifications ordered by createdAt DESC', async () => {
            await createNotification(buildCreateNotificationDto({ title: 'First' })).expect(HttpStatus.CREATED);
            await createNotification(buildCreateNotificationDto({ title: 'Second' })).expect(HttpStatus.CREATED);
            await createNotification(buildCreateNotificationDto({ title: 'Third' })).expect(HttpStatus.CREATED);

            const { body } = await listNotifications().expect(HttpStatus.OK);
            expect(body.data).toHaveLength(3);
            expect(body.data[0].title).toBe('Third');
            expect(body.total).toBe(3);
        });

        it('should filter by severity', async () => {
            await createNotification(buildCreateNotificationDto({ severity: 'INFO' })).expect(HttpStatus.CREATED);
            await createNotification(buildCreateNotificationDto({ severity: 'CRITICAL' })).expect(HttpStatus.CREATED);

            const { body } = await listNotifications({ severity: 'CRITICAL' }).expect(HttpStatus.OK);
            expect(body.data).toHaveLength(1);
            expect(body.data[0].severity).toBe('CRITICAL');
        });

        it('should filter by source', async () => {
            await createNotification(buildCreateNotificationDto({ source: 'ms-predictions-api' })).expect(
                HttpStatus.CREATED,
            );
            await createNotification(buildCreateNotificationDto({ source: 'ms-hydro-api' })).expect(HttpStatus.CREATED);

            const { body } = await listNotifications({ source: 'ms-predictions-api' }).expect(HttpStatus.OK);
            expect(body.data).toHaveLength(1);
            expect(body.data[0].source).toBe('ms-predictions-api');
        });

        it('should filter by status', async () => {
            const { body: created } = await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);
            await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);
            await markAsRead(created.id).expect(HttpStatus.OK);

            const { body } = await listNotifications({ status: 'READ' }).expect(HttpStatus.OK);
            expect(body.data).toHaveLength(1);
            expect(body.data[0].status).toBe('READ');
        });

        it('should paginate correctly', async () => {
            for (let i = 0; i < 25; i++) {
                await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);
            }

            const { body } = await listNotifications({ page: 2, pageSize: 10 }).expect(HttpStatus.OK);
            expect(body.data).toHaveLength(10);
            expect(body.total).toBe(25);
            expect(body.page).toBe(2);
            expect(body.totalPages).toBe(3);
        });

        it('should exclude ARCHIVED by default', async () => {
            const { body: created } = await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);
            await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);
            await archive(created.id).expect(HttpStatus.OK);

            const { body } = await listNotifications().expect(HttpStatus.OK);
            expect(body.data).toHaveLength(1);
            expect(body.data.find((n: any) => n.id === created.id)).toBeUndefined();
        });

        it('should return ARCHIVED when explicitly filtered', async () => {
            const { body: created } = await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);
            await archive(created.id).expect(HttpStatus.OK);

            const { body } = await listNotifications({ status: 'ARCHIVED' }).expect(HttpStatus.OK);
            expect(body.data).toHaveLength(1);
            expect(body.data[0].status).toBe('ARCHIVED');
        });
    });

    // ─── US3: Mark as Read ───────────────────────────────────

    describe('PATCH /notifications/:id/read', () => {
        it('should mark an UNREAD notification as READ', async () => {
            const { body: created } = await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);

            const { body } = await markAsRead(created.id).expect(HttpStatus.OK);
            expect(body.status).toBe('READ');
            expect(body.id).toBe(created.id);
        });

        it('should be idempotent — marking READ again returns OK', async () => {
            const { body: created } = await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);
            await markAsRead(created.id).expect(HttpStatus.OK);
            await markAsRead(created.id).expect(HttpStatus.OK);
        });

        it('should return 404 for non-existent notification', async () => {
            await markAsRead('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
        });
    });

    // ─── US4: Archive Notifications ──────────────────────────

    describe('PATCH /notifications/:id/archive', () => {
        it('should archive an UNREAD notification', async () => {
            const { body: created } = await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);

            const { body } = await archive(created.id).expect(HttpStatus.OK);
            expect(body.status).toBe('ARCHIVED');
        });

        it('should archive a READ notification', async () => {
            const { body: created } = await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);
            await markAsRead(created.id).expect(HttpStatus.OK);

            const { body } = await archive(created.id).expect(HttpStatus.OK);
            expect(body.status).toBe('ARCHIVED');
        });

        it('should return 400 for already archived notification', async () => {
            const { body: created } = await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);
            await archive(created.id).expect(HttpStatus.OK);
            await archive(created.id).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 404 for non-existent notification', async () => {
            await archive('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
        });
    });

    // ─── US5: Bulk Operations ────────────────────────────────

    describe('PATCH /notifications/bulk/read', () => {
        it('should bulk mark as read', async () => {
            const ids: string[] = [];
            for (let i = 0; i < 3; i++) {
                const { body } = await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);
                ids.push(body.id);
            }

            const { body } = await bulkRead(ids).expect(HttpStatus.OK);
            expect(body.updated).toHaveLength(3);
            expect(body.notFound).toHaveLength(0);
        });

        it('should handle partial success with non-existent IDs', async () => {
            const { body: created } = await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);
            const fakeId = '00000000-0000-0000-0000-000000000000';

            const { body } = await bulkRead([created.id, fakeId]).expect(HttpStatus.OK);
            expect(body.updated).toContain(created.id);
            expect(body.notFound).toContain(fakeId);
        });
    });

    describe('PATCH /notifications/bulk/archive', () => {
        it('should bulk archive notifications', async () => {
            const ids: string[] = [];
            for (let i = 0; i < 3; i++) {
                const { body } = await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);
                ids.push(body.id);
            }

            const { body } = await bulkArchive(ids).expect(HttpStatus.OK);
            expect(body.updated).toHaveLength(3);
            expect(body.notFound).toHaveLength(0);

            // Verify archived notifications excluded from default list
            const { body: list } = await listNotifications().expect(HttpStatus.OK);
            expect(list.data).toHaveLength(0);
        });

        it('should handle partial success', async () => {
            const { body: created } = await createNotification(buildCreateNotificationDto()).expect(HttpStatus.CREATED);
            const fakeId = '00000000-0000-0000-0000-000000000000';

            const { body } = await bulkArchive([created.id, fakeId]).expect(HttpStatus.OK);
            expect(body.updated).toContain(created.id);
            expect(body.notFound).toContain(fakeId);
        });
    });
});
