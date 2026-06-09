import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { User } from '../../../src/app/domain/entities/user.entity';
import { Role } from '../../../src/app/domain/entities/role.entity';
import { UserRole } from '../../../src/app/domain/entities/user-role.entity';
import { IUserRepository } from '../../../src/app/domain/ports/user-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import { INotificationService } from '../../../src/app/domain/ports/notification-service.port';

// Infrastructure (implementaciones reales contra la DB)
import { UserRepository } from '../../../src/app/infrastructure/persistence/user.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { RegisterUserHandler } from '../../../src/app/application/commands/user.commands';
import { GetUserByIdHandler } from '../../../src/app/application/queries/user.queries';
import { UserController } from '../../../src/app/api/controllers/user.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildRegisterUserDto } from '../../factories/user.factory';

describe('Create User (e2e) — POST /users/register (AUTH-API)', () => {
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
                GetUserByIdHandler,
                CachingQueryBus,
                { provide: IUserRepository, useClass: UserRepository },
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
    function createUser(dto: { email: string; name: string; password: string }) {
        return request(app.getHttpServer()).post('/users/register').send(dto);
    }

    function getUserById(id: string) {
        return request(app.getHttpServer()).get(`/users/${id}`);
    }

    // ─── POST /users/register - caso exitoso ───────────────────────────
    describe('POST /users/register - caso exitoso', () => {
        it('debe crear usuario con email, name y password y retornar 201', async () => {
            const dto = buildRegisterUserDto({ name: 'Alice', email: 'alice@test.com' });

            const { body } = await createUser(dto).expect(HttpStatus.CREATED);

            expect(body).toMatchObject({
                id: expect.any(String),
                name: dto.name,
                email: dto.email,
                status: 'active',
            });
        });

        it('debe persistir el usuario y poder obtenerlo por id', async () => {
            const dto = buildRegisterUserDto();

            const { body: created } = await createUser(dto).expect(HttpStatus.CREATED);

            const { body: fetched } = await getUserById(created.id).expect(HttpStatus.OK);
            expect(fetched.email).toBe(dto.email);
            expect(fetched.name).toBe(dto.name);
        });
    });

    // ─── POST /users/register - email duplicado ────────────────────────
    describe('POST /users/register - email duplicado', () => {
        it('debe rechazar creación con email duplicado con 409', async () => {
            const dto = buildRegisterUserDto({ email: 'dup@test.com' });

            await createUser(dto).expect(HttpStatus.CREATED);

            const { body } = await createUser(dto).expect(HttpStatus.CONFLICT);
            expect(body.ErrorDescription).toContain('already exists');
        });
    });

    // ─── POST /users/register - validaciones ──────────────────────────
    describe('POST /users/register - validaciones', () => {
        it('debe rechazar email inválido con 400', async () => {
            const dto = buildRegisterUserDto({ email: 'not-an-email' });
            const { body } = await createUser(dto).expect(HttpStatus.BAD_REQUEST);
            expect(body.ErrorDescription).toContain('email');
        });

        it('debe rechazar nombre muy corto con 400', async () => {
            const dto = buildRegisterUserDto({ name: 'A' });
            await createUser(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('debe rechazar password vacío con 400', async () => {
            const dto = buildRegisterUserDto({ password: '' });
            await createUser(dto).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
