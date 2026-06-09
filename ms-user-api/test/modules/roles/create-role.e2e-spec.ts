import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { User } from '../../../src/app/domain/entities/user.entity';
import { Role } from '../../../src/app/domain/entities/role.entity';
import { UserRole } from '../../../src/app/domain/entities/user-role.entity';
import { IRoleRepository } from '../../../src/app/domain/ports/role-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { RoleRepository } from '../../../src/app/infrastructure/persistence/role.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { CreateRoleHandler } from '../../../src/app/application/commands/role.commands';
import { RoleController } from '../../../src/app/api/controllers/role.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateRoleDto } from '../../factories/role.factory';

describe('Create Role (e2e)', () => {
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
            entities: [User, Role, UserRole],
            controllers: [RoleController],
            providers: [
                CreateRoleHandler,
                CachingQueryBus,
                {
                    provide: IRoleRepository,
                    useClass: RoleRepository,
                },
                {
                    provide: ICacheService,
                    useValue: mockCacheService,
                },
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
    function createRole(dto: { name: string; description?: string }) {
        return request(app.getHttpServer()).post('/roles').send(dto);
    }

    // ─── Successful creation ──────────────────────────────────
    describe('POST /roles - successful creation', () => {
        it('should create a role and return its details', async () => {
            const dto = buildCreateRoleDto({ name: 'admin', description: 'System administrator' });

            const { body } = await createRole(dto).expect(HttpStatus.CREATED);

            expect(body).toMatchObject({
                id: expect.any(String),
                name: 'admin',
                description: 'System administrator',
            });
        });

        it('should create a role without description', async () => {
            const dto = { name: 'editor' };

            const { body } = await createRole(dto).expect(HttpStatus.CREATED);

            expect(body).toMatchObject({
                id: expect.any(String),
                name: 'editor',
                description: null,
            });
        });

        it('should normalize role name to lowercase', async () => {
            const dto = buildCreateRoleDto({ name: 'Admin' });

            const { body } = await createRole(dto).expect(HttpStatus.CREATED);

            expect(body.name).toBe('admin');
        });

        it('should trim whitespace from role name', async () => {
            const dto = buildCreateRoleDto({ name: '  viewer  ' });

            const { body } = await createRole(dto).expect(HttpStatus.CREATED);

            expect(body.name).toBe('viewer');
        });
    });

    // ─── Duplicate name rejection ─────────────────────────────
    describe('POST /roles - duplicate name', () => {
        it('should reject duplicate role name with 409', async () => {
            const dto = buildCreateRoleDto({ name: 'admin' });

            await createRole(dto).expect(HttpStatus.CREATED);

            const { body } = await createRole(dto).expect(HttpStatus.CONFLICT);

            expect(body.ErrorDescription).toContain('already exists');
        });

        it('should reject case-insensitive duplicate with 409', async () => {
            await createRole(buildCreateRoleDto({ name: 'admin' })).expect(HttpStatus.CREATED);

            const { body } = await createRole(buildCreateRoleDto({ name: 'ADMIN' })).expect(HttpStatus.CONFLICT);

            expect(body.ErrorDescription).toContain('already exists');
        });
    });

    // ─── Validation errors ────────────────────────────────────
    describe('POST /roles - validation', () => {
        it('should reject empty name with 400', async () => {
            await createRole({ name: '' }).expect(HttpStatus.BAD_REQUEST);
        });

        it('should reject name exceeding 50 characters with 400', async () => {
            const longName = 'a'.repeat(51);
            await createRole({ name: longName }).expect(HttpStatus.BAD_REQUEST);
        });

        it('should reject name with invalid characters with 400', async () => {
            const { body } = await createRole({ name: 'admin role!' }).expect(HttpStatus.BAD_REQUEST);

            expect(body.ErrorDescription).toContain('alphanumeric');
        });

        it('should reject name with spaces with 400', async () => {
            await createRole({ name: 'admin role' }).expect(HttpStatus.BAD_REQUEST);
        });

        it('should reject extra fields (whitelist)', async () => {
            const dto = {
                name: 'admin',
                description: 'test',
                extraField: 'should-not-be-here',
            };

            await request(app.getHttpServer()).post('/roles').send(dto).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
