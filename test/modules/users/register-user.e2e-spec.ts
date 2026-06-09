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
import { RegisterUserHandler } from '../../../src/app/application/commands/user.commands';
import { GetUserByIdHandler } from '../../../src/app/application/queries/user.queries';
import { UserController } from '../../../src/app/api/controllers/user.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildRegisterUserDto } from '../../factories/user.factory';

describe('Register User (e2e)', () => {
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

    // ─── Helper: registrar y obtener usuario via endpoints ────────
    function registerUser(dto: { name: string; email: string; password: string }) {
        return request(app.getHttpServer()).post('/users/register').send(dto);
    }

    function getUserById(id: string) {
        return request(app.getHttpServer()).get(`/users/${id}`);
    }

    // ─── Registro exitoso ─────────────────────────────────────
    describe('POST /users/register - caso exitoso', () => {
        it('debe registrar un usuario, enviar email y retornar status active', async () => {
            const dto = buildRegisterUserDto();

            const { body } = await registerUser(dto).expect(HttpStatus.CREATED);

            expect(body).toMatchObject({
                id: expect.any(String),
                name: dto.name,
                email: dto.email,
                status: 'active',
                welcomeEmailId: 'mock-email-id-123',
            });

            expect(mockNotificationService.sendWelcomeEmail).toHaveBeenCalledWith(dto.email, dto.name);
            expect(mockNotificationService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
        });

        it('debe poder obtener el usuario creado via GET /users/:id', async () => {
            const dto = buildRegisterUserDto();

            const { body: created } = await registerUser(dto).expect(HttpStatus.CREATED);

            const { body: fetched } = await getUserById(created.id).expect(HttpStatus.OK);

            expect(fetched).toMatchObject({
                id: created.id,
                name: dto.name,
                email: dto.email,
                status: 'active',
                welcomeEmailId: 'mock-email-id-123',
            });
        });

        it('debe normalizar el email a lowercase', async () => {
            const dto = buildRegisterUserDto({ email: 'John.Doe@Example.COM' });

            const { body: created } = await registerUser(dto).expect(HttpStatus.CREATED);
            expect(created.email).toBe('john.doe@example.com');

            const { body: fetched } = await getUserById(created.id).expect(HttpStatus.OK);
            expect(fetched.email).toBe('john.doe@example.com');
        });
    });

    // ─── Email duplicado ──────────────────────────────────────
    describe('POST /users/register - email duplicado', () => {
        it('debe rechazar registro con email duplicado con 409', async () => {
            const dto = buildRegisterUserDto({ email: 'duplicate@test.com' });

            await registerUser(dto).expect(HttpStatus.CREATED);

            const { body } = await registerUser(dto).expect(HttpStatus.CONFLICT);

            expect(body.ErrorDescription).toContain('already exists');
        });

        it('debe llamar al notification service solo una vez en caso de duplicado', async () => {
            const dto = buildRegisterUserDto({ email: 'dup-check@test.com' });

            await registerUser(dto).expect(HttpStatus.CREATED);
            await registerUser(dto).expect(HttpStatus.CONFLICT);

            expect(mockNotificationService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
        });
    });

    // ─── Validaciones de DTO ──────────────────────────────────
    describe('POST /users/register - validaciones', () => {
        it('debe rechazar body vacío con 400', async () => {
            await registerUser({} as any).expect(HttpStatus.BAD_REQUEST);
        });

        it('debe rechazar email inválido', async () => {
            const dto = buildRegisterUserDto({ email: 'not-an-email' });

            const { body } = await registerUser(dto).expect(HttpStatus.BAD_REQUEST);

            expect(body.ErrorDescription).toContain('email');
        });

        it('debe rechazar nombre muy corto', async () => {
            const dto = buildRegisterUserDto({ name: 'A' });

            await registerUser(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('debe rechazar password con menos de 8 caracteres', async () => {
            const dto = buildRegisterUserDto({ password: 'short' });

            await registerUser(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('debe rechazar campos extra (whitelist)', async () => {
            const dto = {
                ...buildRegisterUserDto(),
                role: 'admin',
                isHacker: true,
            };

            await request(app.getHttpServer()).post('/users/register').send(dto).expect(HttpStatus.BAD_REQUEST);
        });
    });

    // ─── GET /users/:id - usuario no existe ─────────────────
    describe('GET /users/:id - usuario no existe', () => {
        it('debe retornar 404 para un id que no existe', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';

            const { body } = await getUserById(fakeId).expect(HttpStatus.NOT_FOUND);

            expect(body.ErrorDescription).toContain('not found');
        });
    });

    // ─── Fallo del servicio de email ──────────────────────────
    describe('POST /users/register - fallo de email', () => {
        it('debe retornar error si el servicio de email falla', async () => {
            mockNotificationService.sendWelcomeEmail.mockRejectedValueOnce(new Error('SMTP connection refused'));

            const dto = buildRegisterUserDto();

            const { body } = await registerUser(dto).expect(HttpStatus.INTERNAL_SERVER_ERROR);

            expect(body.ErrorDescription).toContain('welcome email failed');
        });

        it('el usuario debe existir en estado pending si el email falló', async () => {
            mockNotificationService.sendWelcomeEmail.mockRejectedValueOnce(new Error('SMTP timeout'));

            const dto = buildRegisterUserDto({ email: 'email-fail@test.com' });

            // El register falla por el email
            await registerUser(dto).expect(HttpStatus.INTERNAL_SERVER_ERROR);

            // Pero no podemos hacer GET porque no tenemos el id (el register no lo devolvió)
            // Intentamos registrar de nuevo con el mismo email → 409 confirma que existe
            const { body } = await registerUser(dto).expect(HttpStatus.CONFLICT);

            expect(body.ErrorDescription).toContain('already exists');
        });
    });
});
