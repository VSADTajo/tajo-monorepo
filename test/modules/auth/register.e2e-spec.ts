import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

// Domain
import { IUserApiClient } from '../../../src/app/domain/ports/user-api-client.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Application
import { RegisterUserHandler } from '../../../src/app/application/commands/auth.commands';
import { AuthController } from '../../../src/app/api/controllers/auth.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';

describe('Register (e2e)', () => {
    let app: INestApplication;

    const mockUserApiClient = {
        getUserByEmail: jest.fn(),
        getUserById: jest.fn(),
        registerUser: jest.fn(),
    };

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            controllers: [AuthController],
            providers: [
                RegisterUserHandler,
                {
                    provide: IUserApiClient,
                    useValue: mockUserApiClient,
                },
                {
                    provide: ICacheService,
                    useValue: mockCacheService,
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

    function register(dto: { name: string; email: string; password: string }, correlationId?: string) {
        const req = request(app.getHttpServer()).post('/auth/register').send(dto);
        if (correlationId) {
            req.set('x-correlation-id', correlationId);
        }
        return req;
    }

    describe('POST /auth/register - successful register', () => {
        it('should return 201 and userId when user-api succeeds', async () => {
            mockUserApiClient.getUserByEmail.mockResolvedValue(null);
            const userId = '550e8400-e29b-41d4-a716-446655440000';
            mockUserApiClient.registerUser.mockResolvedValue({ id: userId });

            const dto = {
                name: 'John Doe',
                email: 'john.doe@example.com',
                password: 'MyP@ssw0rd',
            };
            const { body } = await register(dto).expect(HttpStatus.CREATED);

            expect(body).toEqual({ userId });
            expect(mockUserApiClient.registerUser).toHaveBeenCalledTimes(1);
            const [payload, correlationId] = mockUserApiClient.registerUser.mock.calls[0];
            expect(payload.name).toBe(dto.name);
            expect(payload.email).toBe(dto.email);
            expect(payload.password).not.toBe(dto.password);
            expect(bcrypt.compareSync(dto.password, payload.password)).toBe(true);
            expect(typeof correlationId === 'string' || correlationId === undefined).toBe(true);
        });

        it('should forward x-correlation-id to user-api when provided', async () => {
            mockUserApiClient.getUserByEmail.mockResolvedValue(null);
            mockUserApiClient.registerUser.mockResolvedValue({ id: 'some-uuid' });

            await register(
                { name: 'Jane Doe', email: 'jane@example.com', password: 'Secret123!' },
                'my-trace-123',
            ).expect(HttpStatus.CREATED);

            const [, correlationId] = mockUserApiClient.registerUser.mock.calls[0];
            expect(correlationId).toBe('my-trace-123');
        });
    });

    describe('POST /auth/register - email already exists', () => {
        it('should return 409 when user with email already exists', async () => {
            mockUserApiClient.getUserByEmail.mockResolvedValue({
                id: 'existing-user-id',
                email: 'john.doe@example.com',
                password: 'hashed',
                roles: [],
                status: 'active',
            });

            await register({
                name: 'John Doe',
                email: 'john.doe@example.com',
                password: 'MyP@ssw0rd',
            }).expect(HttpStatus.CONFLICT);

            expect(mockUserApiClient.getUserByEmail).toHaveBeenCalledWith('john.doe@example.com', expect.any(String));
            expect(mockUserApiClient.registerUser).not.toHaveBeenCalled();
        });
    });

    describe('POST /auth/register - validation', () => {
        it('should return 400 for invalid email format', async () => {
            await register({
                name: 'John',
                email: 'not-an-email',
                password: 'MyP@ssw0rd',
            }).expect(HttpStatus.BAD_REQUEST);
            expect(mockUserApiClient.registerUser).not.toHaveBeenCalled();
        });

        it('should return 400 for empty name', async () => {
            await register({
                name: '',
                email: 'john@example.com',
                password: 'MyP@ssw0rd',
            }).expect(HttpStatus.BAD_REQUEST);
            expect(mockUserApiClient.registerUser).not.toHaveBeenCalled();
        });

        it('should return 400 for empty email', async () => {
            await register({
                name: 'John Doe',
                email: '',
                password: 'MyP@ssw0rd',
            }).expect(HttpStatus.BAD_REQUEST);
            expect(mockUserApiClient.registerUser).not.toHaveBeenCalled();
        });

        it('should return 400 for password shorter than 8 characters', async () => {
            await register({
                name: 'John Doe',
                email: 'john@example.com',
                password: 'Short1',
            }).expect(HttpStatus.BAD_REQUEST);
            expect(mockUserApiClient.registerUser).not.toHaveBeenCalled();
        });
    });
});
