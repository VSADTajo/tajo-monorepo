import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { User } from '../../../src/app/domain/entities/user.entity';
import { Role } from '../../../src/app/domain/entities/role.entity';
import { UserRole } from '../../../src/app/domain/entities/user-role.entity';
import { IUserRepository } from '../../../src/app/domain/ports/user-repository.port';
import { IRoleRepository } from '../../../src/app/domain/ports/role-repository.port';
import { IUserRoleRepository } from '../../../src/app/domain/ports/user-role-repository.port';
import { INotificationService } from '../../../src/app/domain/ports/notification-service.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { UserRepository } from '../../../src/app/infrastructure/persistence/user.repository';
import { RoleRepository } from '../../../src/app/infrastructure/persistence/role.repository';
import { UserRoleRepository } from '../../../src/app/infrastructure/persistence/user-role.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { RegisterUserHandler } from '../../../src/app/application/commands/user.commands';
import { CreateRoleHandler, AssignRoleToUserHandler } from '../../../src/app/application/commands/role.commands';
import { RoleController } from '../../../src/app/api/controllers/role.controller';
import { UserController } from '../../../src/app/api/controllers/user.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildRegisterUserDto } from '../../factories/user.factory';
import { buildCreateRoleDto, buildAssignRoleDto } from '../../factories/role.factory';

describe('Assign Role to User (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockNotificationService = {
        sendWelcomeEmail: jest.fn().mockResolvedValue({
            emailId: 'mock-email-id-123',
            sentAt: new Date(),
        }),
    };

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [User, Role, UserRole],
            controllers: [RoleController, UserController],
            providers: [
                RegisterUserHandler,
                CreateRoleHandler,
                AssignRoleToUserHandler,
                CachingQueryBus,
                {
                    provide: IUserRepository,
                    useClass: UserRepository,
                },
                {
                    provide: IRoleRepository,
                    useClass: RoleRepository,
                },
                {
                    provide: IUserRoleRepository,
                    useClass: UserRoleRepository,
                },
                {
                    provide: INotificationService,
                    useValue: mockNotificationService,
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
    function registerUser(dto: { name: string; email: string }) {
        return request(app.getHttpServer()).post('/users/register').send(dto);
    }

    function createRole(dto: { name: string; description?: string }) {
        return request(app.getHttpServer()).post('/roles').send(dto);
    }

    function assignRole(userId: string, dto: { roleId: string }) {
        return request(app.getHttpServer()).post(`/users/${userId}/roles`).send(dto);
    }

    async function createUserAndRole() {
        const userDto = buildRegisterUserDto();
        const { body: user } = await registerUser(userDto).expect(HttpStatus.CREATED);

        const roleDto = buildCreateRoleDto({ name: 'admin', description: 'Administrator' });
        const { body: role } = await createRole(roleDto).expect(HttpStatus.CREATED);

        return { user, role };
    }

    // ─── Successful assignment ──────────────────────────────
    describe('POST /users/:userId/roles - successful assignment', () => {
        it('should assign a role to a user and return assignment details', async () => {
            const { user, role } = await createUserAndRole();

            const { body } = await assignRole(user.id, buildAssignRoleDto({ roleId: role.id })).expect(
                HttpStatus.CREATED,
            );

            expect(body).toMatchObject({
                id: expect.any(String),
                userId: user.id,
                roleId: role.id,
                roleName: 'admin',
            });
        });
    });

    // ─── Duplicate assignment ───────────────────────────────
    describe('POST /users/:userId/roles - duplicate assignment', () => {
        it('should reject duplicate role assignment with 409', async () => {
            const { user, role } = await createUserAndRole();
            const dto = buildAssignRoleDto({ roleId: role.id });

            await assignRole(user.id, dto).expect(HttpStatus.CREATED);

            const { body } = await assignRole(user.id, dto).expect(HttpStatus.CONFLICT);

            expect(body.ErrorDescription).toContain('already has role');
        });
    });

    // ─── Non-existent user/role ─────────────────────────────
    describe('POST /users/:userId/roles - not found', () => {
        it('should return 404 for non-existent user', async () => {
            const roleDto = buildCreateRoleDto({ name: 'editor' });
            const { body: role } = await createRole(roleDto).expect(HttpStatus.CREATED);

            const fakeUserId = '00000000-0000-0000-0000-000000000000';
            const { body } = await assignRole(fakeUserId, buildAssignRoleDto({ roleId: role.id })).expect(
                HttpStatus.NOT_FOUND,
            );

            expect(body.ErrorDescription).toContain('not found');
        });

        it('should return 404 for non-existent role', async () => {
            const userDto = buildRegisterUserDto();
            const { body: user } = await registerUser(userDto).expect(HttpStatus.CREATED);

            const fakeRoleId = '00000000-0000-0000-0000-000000000000';
            const { body } = await assignRole(user.id, buildAssignRoleDto({ roleId: fakeRoleId })).expect(
                HttpStatus.NOT_FOUND,
            );

            expect(body.ErrorDescription).toContain('not found');
        });
    });

    // ─── Validation ─────────────────────────────────────────
    describe('POST /users/:userId/roles - validation', () => {
        it('should reject invalid roleId format with 400', async () => {
            const userDto = buildRegisterUserDto();
            const { body: user } = await registerUser(userDto).expect(HttpStatus.CREATED);

            await request(app.getHttpServer())
                .post(`/users/${user.id}/roles`)
                .send({ roleId: 'not-a-uuid' })
                .expect(HttpStatus.BAD_REQUEST);
        });

        it('should reject empty roleId with 400', async () => {
            const userDto = buildRegisterUserDto();
            const { body: user } = await registerUser(userDto).expect(HttpStatus.CREATED);

            await request(app.getHttpServer())
                .post(`/users/${user.id}/roles`)
                .send({ roleId: '' })
                .expect(HttpStatus.BAD_REQUEST);
        });
    });
});
