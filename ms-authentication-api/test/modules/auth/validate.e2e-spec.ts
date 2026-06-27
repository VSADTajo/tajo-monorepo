import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';

// Domain
import { IUserApiClient } from '../../../src/app/domain/ports/user-api-client.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Application
import { ValidateTokenHandler } from '../../../src/app/application/commands/auth.commands';
import { AuthController } from '../../../src/app/api/controllers/auth.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';

describe('Validate token (e2e)', () => {
    let app: INestApplication;
    let jwtService: JwtService;

    const mockUserApiClient = {
        getUserByEmail: jest.fn(),
        getUserById: jest.fn(),
        getUserRoles: jest.fn().mockResolvedValue([]),
        registerUser: jest.fn(),
        updatePassword: jest.fn(),
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
                ValidateTokenHandler,
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
        jwtService = app.get(JwtService);
    }, 30_000);

    afterEach(() => {
        jest.clearAllMocks();
        mockCacheService.get.mockResolvedValue(null);
    });

    afterAll(async () => {
        await app.close();
    });

    function validateToken(dto: { token: string }) {
        return request(app.getHttpServer()).post('/auth/validate').send(dto);
    }

    describe('POST /auth/validate - valid token', () => {
        it('should return 200 with userId, roles, email and name when token is valid and user-api returns profile', async () => {
            const userId = '550e8400-e29b-41d4-a716-446655440000';
            const token = jwtService.sign(
                { sub: userId, roles: ['admin', 'editor'], type: 'access' },
                { expiresIn: '1h' },
            );
            mockUserApiClient.getUserById.mockResolvedValue({
                id: userId,
                name: 'John Doe',
                email: 'john@example.com',
            });
            mockUserApiClient.getUserRoles.mockResolvedValue(['admin', 'editor']);

            const { body } = await validateToken({ token }).expect(HttpStatus.OK);

            expect(body.valid).toBe(true);
            expect(body.userId).toBe(userId);
            expect(body.roles).toEqual(['admin', 'editor']);
            expect(body.email).toBe('john@example.com');
            expect(body.name).toBe('John Doe');
            expect(mockUserApiClient.getUserById).toHaveBeenCalledWith(userId);
        });

        it('should return 200 with userId and roles only when user-api returns 404 (no email/name)', async () => {
            const userId = '660e8400-e29b-41d4-a716-446655440001';
            const token = jwtService.sign({ sub: userId, roles: ['user'], type: 'access' }, { expiresIn: '1h' });
            mockUserApiClient.getUserById.mockResolvedValue(null);
            mockUserApiClient.getUserRoles.mockResolvedValue(['user']);

            const { body } = await validateToken({ token }).expect(HttpStatus.OK);

            expect(body.valid).toBe(true);
            expect(body.userId).toBe(userId);
            expect(body.roles).toEqual(['user']);
            expect(body.email).toBeUndefined();
            expect(body.name).toBeUndefined();
        });
    });

    describe('POST /auth/validate - invalid or expired token', () => {
        it('should return 401 for invalid token', async () => {
            await validateToken({ token: 'invalid-jwt' }).expect(HttpStatus.UNAUTHORIZED);
            expect(mockUserApiClient.getUserById).not.toHaveBeenCalled();
        });

        it('should return 401 when token is blacklisted', async () => {
            const userId = '770e8400-e29b-41d4-a716-446655440002';
            const token = jwtService.sign({ sub: userId, roles: [], type: 'access' }, { expiresIn: '1h' });
            mockCacheService.get.mockResolvedValue('blacklisted');

            await validateToken({ token }).expect(HttpStatus.UNAUTHORIZED);

            expect(mockUserApiClient.getUserById).not.toHaveBeenCalled();
        });
    });

    describe('POST /auth/validate - validation', () => {
        it('should return 400 for missing token', async () => {
            await validateToken({ token: '' }).expect(HttpStatus.BAD_REQUEST);
            expect(mockUserApiClient.getUserById).not.toHaveBeenCalled();
        });
    });
});
