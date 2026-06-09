import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';

import { AuthProxyController } from '../../../src/app/api/controllers/auth-proxy.controller';
import { ProxyService } from '../../../src/app/infrastructure/services/proxy.service';
import { ServicesConfigService } from '../../../src/configuration/services/services-config.service';
import { createTestApp, TestContext } from '../../helpers/test-app.helper';

describe('Auth Proxy (e2e)', () => {
    let app: INestApplication;

    const mockProxyService = {
        forward: jest.fn(),
    };

    const mockServicesConfig = {
        authApiUrl: 'http://auth-api:3002',
        userApiUrl: 'http://user-api:3001',
        sftpApiUrl: 'http://sftp-api:3003',
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            controllers: [AuthProxyController],
            providers: [
                { provide: ProxyService, useValue: mockProxyService },
                { provide: ServicesConfigService, useValue: mockServicesConfig },
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

    describe('POST /auth/login', () => {
        it('should proxy login request to auth-api', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 200,
                data: {
                    accessToken: 'jwt-token',
                    expiresIn: '15m',
                    tokenType: 'Bearer',
                    refreshToken: 'refresh-token',
                    refreshExpiresIn: '15d',
                },
            });

            const { body } = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'test@example.com', password: 'pass' })
                .expect(HttpStatus.OK);

            expect(body.accessToken).toBe('jwt-token');
            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    baseUrl: 'http://auth-api:3002',
                    path: '/auth/login',
                }),
            );
        });

        it('should forward x-correlation-id to auth-api when present', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 200,
                data: { accessToken: 'jwt', expiresIn: '15m', tokenType: 'Bearer' },
            });

            await request(app.getHttpServer())
                .post('/auth/login')
                .set('x-correlation-id', 'correlation-123')
                .send({ email: 'a@b.com', password: 'pwd' })
                .expect(HttpStatus.OK);

            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    headers: { 'x-correlation-id': 'correlation-123' },
                }),
            );
        });
    });

    describe('POST /auth/register', () => {
        it('should proxy register request to auth-api', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 201,
                data: { userId: '550e8400-e29b-41d4-a716-446655440000' },
            });

            const { body } = await request(app.getHttpServer())
                .post('/auth/register')
                .send({
                    name: 'John Doe',
                    email: 'john.doe@example.com',
                    password: 'MyP@ssw0rd',
                })
                .expect(HttpStatus.CREATED);

            expect(body.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    baseUrl: 'http://auth-api:3002',
                    path: '/auth/register',
                }),
            );
        });

        it('should forward x-correlation-id on register when present', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 201,
                data: { userId: 'uuid' },
            });

            await request(app.getHttpServer())
                .post('/auth/register')
                .set('x-correlation-id', 'req-id-456')
                .send({ name: 'Jane', email: 'j@e.com', password: 'Secret8' })
                .expect(HttpStatus.CREATED);

            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    headers: { 'x-correlation-id': 'req-id-456' },
                }),
            );
        });
    });

    describe('POST /auth/logout', () => {
        it('should proxy logout request to auth-api', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 200,
                data: { success: true },
            });

            const { body } = await request(app.getHttpServer())
                .post('/auth/logout')
                .send({ token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
                .expect(HttpStatus.OK);

            expect(body.success).toBe(true);
            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    baseUrl: 'http://auth-api:3002',
                    path: '/auth/logout',
                    body: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                }),
            );
        });
    });

    describe('POST /auth/refresh', () => {
        it('should proxy refresh request to auth-api', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 200,
                data: {
                    accessToken: 'new-access',
                    expiresIn: '15m',
                    tokenType: 'Bearer',
                    refreshToken: 'new-refresh',
                    refreshExpiresIn: '15d',
                },
            });

            const { body } = await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refreshToken: 'eyJ...' })
                .expect(HttpStatus.OK);

            expect(body.accessToken).toBe('new-access');
            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    baseUrl: 'http://auth-api:3002',
                    path: '/auth/refresh',
                    body: { refreshToken: 'eyJ...' },
                }),
            );
        });
    });

    describe('POST /auth/validate', () => {
        it('should proxy validate request to auth-api', async () => {
            mockProxyService.forward.mockResolvedValue({
                status: 200,
                data: {
                    valid: true,
                    userId: '550e8400-e29b-41d4-a716-446655440000',
                    roles: ['admin', 'editor'],
                },
            });

            const { body } = await request(app.getHttpServer())
                .post('/auth/validate')
                .send({ token: 'eyJ...' })
                .expect(HttpStatus.OK);

            expect(body.valid).toBe(true);
            expect(body.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(body.roles).toEqual(['admin', 'editor']);
            expect(mockProxyService.forward).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    baseUrl: 'http://auth-api:3002',
                    path: '/auth/validate',
                    body: { token: 'eyJ...' },
                }),
            );
        });
    });
});
