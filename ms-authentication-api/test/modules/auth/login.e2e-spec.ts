import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

// Domain
import { IUserApiClient } from '../../../src/app/domain/ports/user-api-client.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Application
import { LoginUserHandler } from '../../../src/app/application/commands/auth.commands';
import { AuthController } from '../../../src/app/api/controllers/auth.controller';

// Config
import { JwtConfigService } from '../../../src/configuration/jwt/jwt-config.service';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';

describe('Login (e2e)', () => {
    let app: INestApplication;

    const hashedPassword = bcrypt.hashSync('MyP@ssw0rd', 10);

    const mockUserApiClient = {
        getUserByEmail: jest.fn(),
        getUserById: jest.fn(),
        registerUser: jest.fn(),
        updatePassword: jest.fn(),
    };

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    const mockJwtConfigService = {
        secret: 'test-secret',
        expiration: '1h',
        accessExpiration: '15m',
        refreshExpiration: '15d',
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            controllers: [AuthController],
            providers: [
                LoginUserHandler,
                {
                    provide: IUserApiClient,
                    useValue: mockUserApiClient,
                },
                {
                    provide: ICacheService,
                    useValue: mockCacheService,
                },
                {
                    provide: JwtConfigService,
                    useValue: mockJwtConfigService,
                },
            ],
        });
        app = ctx.app;
    }, 30_000);

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
    });

    function login(dto: { email: string; password: string }, correlationId?: string) {
        const req = request(app.getHttpServer()).post('/auth/login').send(dto);
        if (correlationId) {
            req.set('x-correlation-id', correlationId);
        }
        return req;
    }

    describe('POST /auth/login - successful login', () => {
        it('should return a JWT token for valid credentials', async () => {
            mockUserApiClient.getUserByEmail.mockResolvedValue({
                id: '550e8400-e29b-41d4-a716-446655440000',
                password: hashedPassword,
                roles: [{ id: '1', name: 'admin' }],
                status: 'active',
            });

            const { body } = await login({ email: 'john@example.com', password: 'MyP@ssw0rd' }).expect(HttpStatus.OK);

            expect(body).toMatchObject({
                accessToken: expect.any(String),
                expiresIn: '15m',
                tokenType: 'Bearer',
                refreshToken: expect.any(String),
                refreshExpiresIn: '15d',
            });
            expect(mockUserApiClient.getUserByEmail).toHaveBeenCalledWith('john@example.com', expect.any(String));
        });

        it('should forward x-correlation-id to user-api when provided', async () => {
            mockUserApiClient.getUserByEmail.mockResolvedValue({
                id: '550e8400-e29b-41d4-a716-446655440000',
                password: hashedPassword,
                roles: [{ id: '1', name: 'admin' }],
                status: 'active',
            });

            await login({ email: 'john@example.com', password: 'MyP@ssw0rd' }, 'my-trace-123').expect(HttpStatus.OK);

            expect(mockUserApiClient.getUserByEmail).toHaveBeenCalledWith('john@example.com', 'my-trace-123');
        });
    });

    describe('POST /auth/login - invalid credentials', () => {
        it('should return 401 for non-existent user', async () => {
            mockUserApiClient.getUserByEmail.mockResolvedValue(null);

            await login({ email: 'unknown@example.com', password: 'MyP@ssw0rd' }).expect(HttpStatus.UNAUTHORIZED);
        });

        it('should return 401 for wrong password', async () => {
            mockUserApiClient.getUserByEmail.mockResolvedValue({
                id: '550e8400-e29b-41d4-a716-446655440000',
                password: hashedPassword,
                roles: [],
                status: 'active',
            });

            await login({ email: 'john@example.com', password: 'WrongPassword1' }).expect(HttpStatus.UNAUTHORIZED);
        });
    });

    describe('POST /auth/login - validation', () => {
        it('should return 400 for invalid email format', async () => {
            await login({ email: 'not-an-email', password: 'MyP@ssw0rd' }).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 400 for empty email', async () => {
            await login({ email: '', password: 'MyP@ssw0rd' }).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 400 for empty password', async () => {
            await login({ email: 'john@example.com', password: '' }).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
