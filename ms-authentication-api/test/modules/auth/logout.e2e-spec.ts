import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';

// Domain
import { IUserApiClient } from '../../../src/app/domain/ports/user-api-client.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Application
import { LogoutHandler, ValidateTokenHandler } from '../../../src/app/application/commands/auth.commands';
import { AuthController } from '../../../src/app/api/controllers/auth.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';

describe('Logout (e2e)', () => {
    let app: INestApplication;
    let jwtService: JwtService;

    const blacklist = new Map<string, string>();

    const mockUserApiClient = {
        getUserByEmail: jest.fn(),
        getUserById: jest.fn().mockResolvedValue(null),
        getUserRoles: jest.fn().mockResolvedValue(['admin']),
        registerUser: jest.fn(),
        updatePassword: jest.fn(),
    };

    const mockCacheService = {
        get: jest.fn((key: string) => Promise.resolve(blacklist.get(key) ?? null)),
        set: jest.fn((key: string, value: string) => {
            blacklist.set(key, value);
            return Promise.resolve();
        }),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            controllers: [AuthController],
            providers: [
                LogoutHandler,
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
        blacklist.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
    });

    function logout(dto: { token: string }) {
        return request(app.getHttpServer()).post('/auth/logout').send(dto);
    }

    function validate(dto: { token: string }) {
        return request(app.getHttpServer()).post('/auth/validate').send(dto);
    }

    function validAccessToken() {
        return jwtService.sign(
            {
                sub: '550e8400-e29b-41d4-a716-446655440000',
                roles: ['admin'],
                type: 'access',
            },
            { expiresIn: '15m' },
        );
    }

    describe('POST /auth/logout - successful logout', () => {
        it('should return 200 and success when token is valid', async () => {
            const token = validAccessToken();
            const { body } = await logout({ token }).expect(HttpStatus.OK);

            expect(body).toEqual({ success: true });
            expect(mockCacheService.set).toHaveBeenCalled();
        });

        it('should invalidate token so validate returns 401 after logout', async () => {
            const token = validAccessToken();
            await validate({ token }).expect(HttpStatus.OK);

            await logout({ token }).expect(HttpStatus.OK);

            await validate({ token }).expect(HttpStatus.UNAUTHORIZED);
        });
    });

    describe('POST /auth/logout - invalid token', () => {
        it('should return 401 for invalid token', async () => {
            await logout({ token: 'invalid.jwt' }).expect(HttpStatus.UNAUTHORIZED);
            expect(mockCacheService.set).not.toHaveBeenCalled();
        });

        it('should return 401 for expired token', async () => {
            const token = jwtService.sign({ sub: 'user-id', roles: [], type: 'access' }, { expiresIn: '0s' });
            await new Promise((resolve) => setTimeout(resolve, 100));
            await logout({ token }).expect(HttpStatus.UNAUTHORIZED);
        });
    });

    describe('POST /auth/logout - validation', () => {
        it('should return 400 for empty token', async () => {
            await logout({ token: '' }).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
