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
import { RegisterUserHandler, UpdateUserHandler } from '../../../src/app/application/commands/user.commands';
import { GetUserByIdHandler } from '../../../src/app/application/queries/user.queries';
import { UserController } from '../../../src/app/api/controllers/user.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildRegisterUserDto, buildUpdateUserDto } from '../../factories/user.factory';

describe('Update User (e2e)', () => {
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
                UpdateUserHandler,
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

    // ─── Helpers: register (para tener usuario), PATCH ─────────────────
    function registerUser(dto: { name: string; email: string; password: string }) {
        return request(app.getHttpServer()).post('/users/register').send(dto);
    }

    function updateUser(id: string, dto: { name?: string; email?: string }) {
        return request(app.getHttpServer()).patch(`/users/${id}`).send(dto);
    }

    // ─── PATCH /users/:id - casos exitosos ────────────────────────────
    describe('PATCH /users/:id - casos exitosos', () => {
        it('debe actualizar solo el nombre y retornar 200', async () => {
            const registerDto = buildRegisterUserDto({ name: 'Old Name', email: 'original@test.com' });
            const { body: created } = await registerUser(registerDto).expect(HttpStatus.CREATED);

            const { body } = await updateUser(created.id, { name: 'New Name' }).expect(HttpStatus.OK);

            expect(body).toMatchObject({
                id: created.id,
                name: 'New Name',
                email: registerDto.email.toLowerCase(),
                status: 'active',
            });
        });

        it('debe actualizar solo el email y retornar 200', async () => {
            const registerDto = buildRegisterUserDto({ name: 'Bob', email: 'bob-old@test.com' });
            const { body: created } = await registerUser(registerDto).expect(HttpStatus.CREATED);

            // Email nuevo único para evitar conflicto
            const newEmail = `bob-new-${Date.now()}@test.com`;
            const { body } = await updateUser(created.id, { email: newEmail }).expect(HttpStatus.OK);

            expect(body).toMatchObject({
                id: created.id,
                name: 'Bob',
                email: newEmail,
            });
        });

        it('debe actualizar nombre y email y retornar 200', async () => {
            const registerDto = buildRegisterUserDto();
            const { body: created } = await registerUser(registerDto).expect(HttpStatus.CREATED);

            const updateDto = buildUpdateUserDto({ name: 'Full Update', email: `full-${Date.now()}@test.com` });
            const { body } = await updateUser(created.id, updateDto).expect(HttpStatus.OK);

            expect(body).toMatchObject({
                id: created.id,
                name: updateDto.name,
                email: updateDto.email,
            });
        });
    });

    // ─── PATCH /users/:id - usuario no existe ────────────────────────
    describe('PATCH /users/:id - usuario no existe', () => {
        it('debe retornar 404 cuando el usuario no existe', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const updateDto = buildUpdateUserDto();

            const { body } = await updateUser(fakeId, updateDto).expect(HttpStatus.NOT_FOUND);

            expect(body.ErrorDescription).toContain('not found');
        });
    });

    // ─── PATCH /users/:id - email ya en uso ───────────────────────────
    describe('PATCH /users/:id - email ya en uso', () => {
        it('debe retornar 409 cuando el nuevo email ya está en uso por otro usuario', async () => {
            const dto1 = buildRegisterUserDto({ email: 'first@test.com' });
            const dto2 = buildRegisterUserDto({ email: 'second@test.com' });

            const { body: user1 } = await registerUser(dto1).expect(HttpStatus.CREATED);
            await registerUser(dto2).expect(HttpStatus.CREATED);

            // Intentar poner a user1 el email de user2 → conflicto
            const { body } = await updateUser(user1.id, { email: 'second@test.com' }).expect(HttpStatus.CONFLICT);

            expect(body.ErrorDescription).toContain('already exists');
        });
    });

    // ─── PATCH /users/:id - validaciones de DTO ──────────────────────
    describe('PATCH /users/:id - validaciones', () => {
        it('debe rechazar email inválido con 400', async () => {
            const registerDto = buildRegisterUserDto();
            const { body: created } = await registerUser(registerDto).expect(HttpStatus.CREATED);

            const { body } = await updateUser(created.id, { email: 'not-an-email' }).expect(HttpStatus.BAD_REQUEST);

            expect(body.ErrorDescription).toContain('email');
        });

        it('debe rechazar nombre muy corto con 400', async () => {
            const registerDto = buildRegisterUserDto();
            const { body: created } = await registerUser(registerDto).expect(HttpStatus.CREATED);

            await updateUser(created.id, { name: 'A' }).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
