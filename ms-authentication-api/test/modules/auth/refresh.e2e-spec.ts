import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';

// Domain
import { IUserApiClient } from '../../../src/app/domain/ports/user-api-client.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Application
import { RefreshTokenHandler } from '../../../src/app/application/commands/auth.commands';
import { AuthController } from '../../../src/app/api/controllers/auth.controller';

// Config
import { JwtConfigService } from '../../../src/configuration/jwt/jwt-config.service';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';

describe('Refresh Token (e2e)', () => {
    let app: INestApplication;
    let jwtService: JwtService;

    const mockUserApiClient = {
        getUserByEmail: jest.fn(),
        registerUser: jest.fn(),
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
                RefreshTokenHandler,
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
        jwtService = app.get(JwtService);
    }, 30_000);

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
    });

    function refresh(dto: { refreshToken: string }) {
        return request(app.getHttpServer()).post('/auth/refresh').send(dto);
    }

    function validRefreshToken() {
        return jwtService.sign(
            {
                sub: '550e8400-e29b-41d4-a716-446655440000',
                roles: ['admin'],
                type: 'refresh',
            },
            { expiresIn: '15d' },
        );
    }

    describe('POST /auth/refresh - successful refresh', () => {
        it('should return new access and refresh tokens for a valid refresh token', async () => {
            const refreshToken = validRefreshToken();
            const { body } = await refresh({ refreshToken }).expect(HttpStatus.OK);

            expect(body).toMatchObject({
                accessToken: expect.any(String),
                expiresIn: '15m',
                tokenType: 'Bearer',
                refreshToken: expect.any(String),
                refreshExpiresIn: '15d',
            });
        });
    });

    describe('POST /auth/refresh - invalid token', () => {
        it('should return 401 for invalid refresh token', async () => {
            await refresh({ refreshToken: 'invalid.jwt' }).expect(HttpStatus.UNAUTHORIZED);
        });

        it('should return 401 when token is access token instead of refresh', async () => {
            const accessToken = jwtService.sign(
                {
                    sub: '550e8400-e29b-41d4-a716-446655440000',
                    roles: ['admin'],
                    type: 'access',
                },
                { expiresIn: '15m' },
            );
            await refresh({ refreshToken: accessToken }).expect(HttpStatus.UNAUTHORIZED);
        });

        it('should return 401 for expired refresh token', async () => {
            const token = jwtService.sign({ sub: 'user-id', roles: [], type: 'refresh' }, { expiresIn: '0s' });
            await new Promise((resolve) => setTimeout(resolve, 100));
            await refresh({ refreshToken: token }).expect(HttpStatus.UNAUTHORIZED);
        });
    });

    describe('POST /auth/refresh - validation', () => {
        it('should return 400 for empty refresh token', async () => {
            await refresh({ refreshToken: '' }).expect(HttpStatus.BAD_REQUEST);
        });
    });
});
