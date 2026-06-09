import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { User } from '../../../src/app/domain/entities/user.entity';
import { Role } from '../../../src/app/domain/entities/role.entity';
import { UserRole } from '../../../src/app/domain/entities/user-role.entity';
import { IUserRepository } from '../../../src/app/domain/ports/user-repository.port';
import { INotificationService } from '../../../src/app/domain/ports/notification-service.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure (implementaciones reales contra la DB)
import { UserRepository } from '../../../src/app/infrastructure/persistence/user.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { RegisterUserHandler, DeleteUserHandler } from '../../../src/app/application/commands/user.commands';
import { GetUserByIdHandler } from '../../../src/app/application/queries/user.queries';
import { UserController } from '../../../src/app/api/controllers/user.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildRegisterUserDto } from '../../factories/user.factory';

describe('Delete User (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    // Mock solo del servicio externo (email), nunca del repositorio
    const mockNotificationService = {
        sendWelcomeEmail: jest.fn().mockResolvedValue({
            emailId: 'mock-email-id-123',
            sentAt: new Date(),
        }),
    };

    // Cache mockeado para CachingQueryBus (no impacta en este flujo)
    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [User, Role, UserRole],
            controllers: [UserController],
            providers: [
                RegisterUserHandler,
                DeleteUserHandler,
                GetUserByIdHandler,
                CachingQueryBus,
                {
                    provide: IUserRepository,
                    useClass: UserRepository,
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

    // ─── Helpers: register (para tener usuario), DELETE, GET (verificar que ya no existe) ───
    function registerUser(dto: { name: string; email: string; password: string }) {
        return request(app.getHttpServer()).post('/users/register').send(dto);
    }

    function deleteUser(id: string) {
        return request(app.getHttpServer()).delete(`/users/${id}`);
    }

    function getUserById(id: string) {
        return request(app.getHttpServer()).get(`/users/${id}`);
    }

    // ─── DELETE /users/:id - caso exitoso ────────────────────────────
    describe('DELETE /users/:id - caso exitoso', () => {
        it('debe retornar 204 y eliminar el usuario', async () => {
            const dto = buildRegisterUserDto();
            const { body: created } = await registerUser(dto).expect(HttpStatus.CREATED);

            await deleteUser(created.id).expect(HttpStatus.NO_CONTENT);

            // Verificar que el usuario ya no existe con GET
            await getUserById(created.id).expect(HttpStatus.NOT_FOUND);
        });
    });

    // ─── DELETE /users/:id - usuario no existe ─────────────────────────
    describe('DELETE /users/:id - usuario no existe', () => {
        it('debe retornar 404 cuando el usuario no existe', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';

            const { body } = await deleteUser(fakeId).expect(HttpStatus.NOT_FOUND);

            expect(body.ErrorDescription).toContain('not found');
        });
    });
});
