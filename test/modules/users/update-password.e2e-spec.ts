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
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { INotificationService } from '../../../src/app/domain/ports/notification-service.port';

// Infrastructure (implementaciones reales contra la DB)
import { UserRepository } from '../../../src/app/infrastructure/persistence/user.repository';
import { RoleRepository } from '../../../src/app/infrastructure/persistence/role.repository';
import { UserRoleRepository } from '../../../src/app/infrastructure/persistence/user-role.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { RegisterUserHandler, UpdateUserPasswordHandler } from '../../../src/app/application/commands/user.commands';
import { GetUserByIdHandler, GetUserByEmailHandler } from '../../../src/app/application/queries/user.queries';
import { UserController } from '../../../src/app/api/controllers/user.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildRegisterUserDto } from '../../factories/user.factory';

describe('Update Password (e2e) — PATCH /users/:id/password', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    const mockNotificationService = {
        sendWelcomeEmail: jest.fn().mockResolvedValue({ emailId: 'mock-email-id-123', sentAt: new Date() }),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [User, Role, UserRole],
            controllers: [UserController],
            providers: [
                RegisterUserHandler,
                UpdateUserPasswordHandler,
                GetUserByIdHandler,
                GetUserByEmailHandler,
                CachingQueryBus,
                { provide: IUserRepository, useClass: UserRepository },
                { provide: IRoleRepository, useClass: RoleRepository },
                { provide: IUserRoleRepository, useClass: UserRoleRepository },
                { provide: ICacheService, useValue: mockCacheService },
                { provide: INotificationService, useValue: mockNotificationService },
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

    // ─── Helpers ───────────────────────────────────────────────────────
    function registerUser(dto: { name: string; email: string; password: string }) {
        return request(app.getHttpServer()).post('/users/register').send(dto);
    }

    function updatePassword(id: string, dto: { password: string }) {
        return request(app.getHttpServer()).patch(`/users/${id}/password`).send(dto);
    }

    function getUserByEmail(email: string) {
        return request(app.getHttpServer()).get(`/users/by-email/${encodeURIComponent(email)}`);
    }

    // ─── PATCH /users/:id/password - caso exitoso ───────────────────────
    describe('PATCH /users/:id/password - caso exitoso', () => {
        it('debe retornar 204 y actualizar el hash', async () => {
            const dto = buildRegisterUserDto({ email: 'pwd@test.com', password: '$2b$10$old' });
            const { body: created } = await registerUser(dto).expect(HttpStatus.CREATED);

            await updatePassword(created.id, { password: '$2b$10$new' }).expect(HttpStatus.NO_CONTENT);

            const { body } = await getUserByEmail(dto.email).expect(HttpStatus.OK);
            expect(body.password).toBe('$2b$10$new');
        });
    });

    // ─── PATCH /users/:id/password - no encontrado ──────────────────────
    describe('PATCH /users/:id/password - no encontrado', () => {
        it('debe retornar 404 cuando el usuario no existe', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const { body } = await updatePassword(fakeId, { password: '$2b$10$new' }).expect(HttpStatus.NOT_FOUND);
            expect(body.ErrorDescription).toContain('not found');
        });
    });
});
