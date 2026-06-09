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
import { GetUserRolesHandler } from '../../../src/app/application/queries/role.queries';
import { RoleController } from '../../../src/app/api/controllers/role.controller';
import { UserController } from '../../../src/app/api/controllers/user.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildRegisterUserDto } from '../../factories/user.factory';
import { buildCreateRoleDto, buildAssignRoleDto } from '../../factories/role.factory';

describe('Get User Roles (e2e)', () => {
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
                GetUserRolesHandler,
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

    function getUserRoles(userId: string) {
        return request(app.getHttpServer()).get(`/users/${userId}/roles`);
    }

    // ─── Get user roles ─────────────────────────────────────
    describe('GET /users/:userId/roles', () => {
        it('should return empty array when user has no roles', async () => {
            const userDto = buildRegisterUserDto();
            const { body: user } = await registerUser(userDto).expect(HttpStatus.CREATED);

            const { body } = await getUserRoles(user.id).expect(HttpStatus.OK);

            expect(body.roles).toEqual([]);
        });

        it('should return all roles assigned to a user', async () => {
            const userDto = buildRegisterUserDto();
            const { body: user } = await registerUser(userDto).expect(HttpStatus.CREATED);

            const { body: adminRole } = await createRole(
                buildCreateRoleDto({ name: 'admin', description: 'Administrator' }),
            ).expect(HttpStatus.CREATED);
            const { body: editorRole } = await createRole(
                buildCreateRoleDto({ name: 'editor', description: 'Content editor' }),
            ).expect(HttpStatus.CREATED);

            await assignRole(user.id, buildAssignRoleDto({ roleId: adminRole.id })).expect(HttpStatus.CREATED);
            await assignRole(user.id, buildAssignRoleDto({ roleId: editorRole.id })).expect(HttpStatus.CREATED);

            const { body } = await getUserRoles(user.id).expect(HttpStatus.OK);

            expect(body.roles).toHaveLength(2);
            expect(body.roles).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ id: adminRole.id, name: 'admin', description: 'Administrator' }),
                    expect.objectContaining({ id: editorRole.id, name: 'editor', description: 'Content editor' }),
                ]),
            );
        });

        it('should return 404 for non-existent user', async () => {
            const fakeUserId = '00000000-0000-0000-0000-000000000000';

            const { body } = await getUserRoles(fakeUserId).expect(HttpStatus.NOT_FOUND);

            expect(body.ErrorDescription).toContain('not found');
        });
    });
});
