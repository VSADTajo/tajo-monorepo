import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Application - Commands
import {
    CreateCleanupJobHandler,
    UpdateCleanupJobHandler,
    ToggleCleanupJobHandler,
    DeleteCleanupJobHandler,
} from '../../../src/app/application/commands/cleanup-job.commands';

// Application - Queries
import {
    GetCleanupJobByIdHandler,
    GetCleanupJobByPathHandler,
    ListCleanupJobsHandler,
} from '../../../src/app/application/queries/cleanup-job.queries';

// Controller
import { CleanupJobController } from '../../../src/app/api/controllers/cleanup-job.controller';

// Domain
import { CleanupJob } from '../../../src/app/domain/entities/cleanup-job.entity';
import { ICleanupJobRepository } from '../../../src/app/domain/ports/cleanup-job-repository.port';
import { ICleanupScheduler } from '../../../src/app/domain/ports/cleanup-scheduler.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { CleanupFrequency } from '../../../src/app/domain/types/cleanup-frequency.enum';

// Infrastructure
import { CleanupJobRepository } from '../../../src/app/infrastructure/persistence/cleanup-job.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateCleanupJobDto } from '../../factories/cleanup-job.factory';

const mockCacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
};

const mockCleanupScheduler = {
    scheduleJob: jest.fn(),
    unscheduleJob: jest.fn(),
    rescheduleJob: jest.fn(),
    getNextExecution: jest.fn().mockReturnValue(new Date('2099-01-01T00:00:00Z')),
    isScheduled: jest.fn().mockReturnValue(false),
};

describe('Cleanup Jobs CRUD (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [CleanupJob],
            controllers: [CleanupJobController],
            providers: [
                // Command handlers
                CreateCleanupJobHandler,
                UpdateCleanupJobHandler,
                ToggleCleanupJobHandler,
                DeleteCleanupJobHandler,
                // Query handlers
                GetCleanupJobByIdHandler,
                GetCleanupJobByPathHandler,
                ListCleanupJobsHandler,
                // Ports
                { provide: ICleanupJobRepository, useClass: CleanupJobRepository },
                { provide: ICleanupScheduler, useValue: mockCleanupScheduler },
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
        mockCleanupScheduler.getNextExecution.mockReturnValue(new Date('2099-01-01T00:00:00Z'));
        mockCleanupScheduler.isScheduled.mockReturnValue(false);
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    function createJob(directoryPath = '/data/files/test', overrides?: object) {
        return request(app.getHttpServer())
            .post('/cleanup-jobs')
            .send(buildCreateCleanupJobDto(directoryPath, overrides));
    }

    function getJobById(id: string) {
        return request(app.getHttpServer()).get(`/cleanup-jobs/${id}`);
    }

    function toggleJob(id: string, isActive: boolean) {
        return request(app.getHttpServer()).patch(`/cleanup-jobs/${id}/toggle`).send({ isActive });
    }

    function updateJob(id: string, body: object) {
        return request(app.getHttpServer()).patch(`/cleanup-jobs/${id}`).send(body);
    }

    function deleteJob(id: string) {
        return request(app.getHttpServer()).delete(`/cleanup-jobs/${id}`);
    }

    // ─────────────────────────────────────────────────────────────
    // Tests
    // ─────────────────────────────────────────────────────────────

    it('(a) should create a cleanup job with isActive and nextExecutionAt', async () => {
        const { body } = await createJob().expect(HttpStatus.CREATED);

        expect(body.id).toBeDefined();
        expect(body.directoryPath).toBe('/data/files/test');
        expect(body.extensions).toEqual(['.xml', '.csv']);
        expect(body.frequency).toBe(CleanupFrequency.EVERY_DAY);
        expect(body.isActive).toBe(true);
        expect(body.nextExecutionAt).toBeDefined();
        expect(mockCleanupScheduler.scheduleJob).toHaveBeenCalledTimes(1);
    });

    it('(b) should reject duplicate path with 409', async () => {
        await createJob().expect(HttpStatus.CREATED);
        await createJob().expect(HttpStatus.CONFLICT);
    });

    it('(c) should get job by id', async () => {
        const { body: created } = await createJob().expect(HttpStatus.CREATED);
        const { body: fetched } = await getJobById(created.id).expect(HttpStatus.OK);

        expect(fetched.id).toBe(created.id);
        expect(fetched.directoryPath).toBe(created.directoryPath);
    });

    it('(d) should toggle job off: isActive false + nextExecutionAt null', async () => {
        const { body: created } = await createJob().expect(HttpStatus.CREATED);
        mockCleanupScheduler.isScheduled.mockReturnValue(true);

        const { body: toggled } = await toggleJob(created.id, false).expect(HttpStatus.OK);

        expect(toggled.isActive).toBe(false);
        expect(toggled.nextExecutionAt).toBeNull();
        expect(mockCleanupScheduler.unscheduleJob).toHaveBeenCalledWith(created.id);
    });

    it('(e) should toggle job on: isActive true + nextExecutionAt set', async () => {
        const { body: created } = await createJob().expect(HttpStatus.CREATED);
        await toggleJob(created.id, false).expect(HttpStatus.OK);

        jest.clearAllMocks();
        mockCleanupScheduler.getNextExecution.mockReturnValue(new Date('2099-06-01T00:00:00Z'));

        const { body: reactivated } = await toggleJob(created.id, true).expect(HttpStatus.OK);

        expect(reactivated.isActive).toBe(true);
        expect(reactivated.nextExecutionAt).toBe('2099-06-01T00:00:00.000Z');
        expect(mockCleanupScheduler.scheduleJob).toHaveBeenCalledTimes(1);
    });

    it('(f) should update frequency and recalculate nextExecutionAt', async () => {
        const { body: created } = await createJob().expect(HttpStatus.CREATED);
        mockCleanupScheduler.getNextExecution.mockReturnValue(new Date('2099-03-01T01:00:00Z'));
        mockCleanupScheduler.isScheduled.mockReturnValue(true);

        const { body: updated } = await updateJob(created.id, { frequency: CleanupFrequency.EVERY_HOUR }).expect(
            HttpStatus.OK,
        );

        expect(updated.frequency).toBe(CleanupFrequency.EVERY_HOUR);
        expect(updated.nextExecutionAt).toBe('2099-03-01T01:00:00.000Z');
        expect(mockCleanupScheduler.rescheduleJob).toHaveBeenCalledTimes(1);
    });

    it('(g) should delete job — 200 then 404', async () => {
        const { body: created } = await createJob().expect(HttpStatus.CREATED);
        mockCleanupScheduler.isScheduled.mockReturnValue(false);

        const { body: deleted } = await deleteJob(created.id).expect(HttpStatus.OK);
        expect(deleted.deletedId).toBe(created.id);

        await getJobById(created.id).expect(HttpStatus.NOT_FOUND);
    });

    it('(h) should return 404 for unknown id', async () => {
        await getJobById('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
    });
});
