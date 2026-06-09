import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

// Domain
import { IUserApiClient } from '../../../src/app/domain/ports/user-api-client.port';

// Application
import { ChangePasswordHandler } from '../../../src/app/application/commands/auth.commands';
import { AuthController } from '../../../src/app/api/controllers/auth.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';

describe('Change password (e2e)', () => {
    let app: INestApplication;

    const mockUserApiClient = {
        getUserByEmail: jest.fn(),
        getUserById: jest.fn(),
        registerUser: jest.fn(),
        updatePassword: jest.fn(),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            controllers: [AuthController],
            providers: [
                ChangePasswordHandler,
                {
                    provide: IUserApiClient,
                    useValue: mockUserApiClient,
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

    function changePassword(
        dto: { email: string; currentPassword: string; newPassword: string },
        correlationId?: string,
    ) {
        const req = request(app.getHttpServer()).post('/auth/change-password').send(dto);
        if (correlationId) {
            req.set('x-correlation-id', correlationId);
        }
        return req;
    }

    describe('POST /auth/change-password - successful change password', () => {
        it('should return 200 and success when user exists and current password is correct', async () => {
            const currentPassword = 'MyP@ssw0rd';
            const hashedCurrent = await bcrypt.hash(currentPassword, 10);
            const userId = '550e8400-e29b-41d4-a716-446655440000';
            mockUserApiClient.getUserByEmail.mockResolvedValue({
                id: userId,
                password: hashedCurrent,
                roles: [],
                status: 'active',
            });
            mockUserApiClient.updatePassword.mockResolvedValue(undefined);

            const dto = {
                email: 'john@example.com',
                currentPassword,
                newPassword: 'NewP@ssw0rd123',
            };
            const { body } = await changePassword(dto).expect(HttpStatus.OK);

            expect(body).toEqual({ success: true });
            expect(mockUserApiClient.getUserByEmail).toHaveBeenCalledWith('john@example.com', expect.any(String));
            expect(mockUserApiClient.updatePassword).toHaveBeenCalledTimes(1);
            const [id, hashedNewPassword, correlationId] = mockUserApiClient.updatePassword.mock.calls[0];
            expect(id).toBe(userId);
            expect(bcrypt.compareSync(dto.newPassword, hashedNewPassword)).toBe(true);
            expect(typeof correlationId === 'string' || correlationId === undefined).toBe(true);
        });

        it('should forward x-correlation-id to user-api when provided', async () => {
            const currentPassword = 'MyP@ssw0rd';
            const hashedCurrent = await bcrypt.hash(currentPassword, 10);
            mockUserApiClient.getUserByEmail.mockResolvedValue({
                id: 'user-id',
                password: hashedCurrent,
                roles: [],
                status: 'active',
            });
            mockUserApiClient.updatePassword.mockResolvedValue(undefined);

            await changePassword(
                {
                    email: 'jane@example.com',
                    currentPassword,
                    newPassword: 'NewSecret123!',
                },
                'trace-456',
            ).expect(HttpStatus.OK);

            expect(mockUserApiClient.getUserByEmail).toHaveBeenCalledWith('jane@example.com', 'trace-456');
            const [, , correlationId] = mockUserApiClient.updatePassword.mock.calls[0];
            expect(correlationId).toBe('trace-456');
        });
    });

    describe('POST /auth/change-password - user not found', () => {
        it('should return 404 when user does not exist', async () => {
            mockUserApiClient.getUserByEmail.mockResolvedValue(null);

            await changePassword({
                email: 'unknown@example.com',
                currentPassword: 'AnyPass1',
                newPassword: 'NewPass123!',
            }).expect(HttpStatus.NOT_FOUND);

            expect(mockUserApiClient.getUserByEmail).toHaveBeenCalledWith('unknown@example.com', expect.any(String));
            expect(mockUserApiClient.updatePassword).not.toHaveBeenCalled();
        });
    });

    describe('POST /auth/change-password - wrong current password', () => {
        it('should return 401 when current password is incorrect', async () => {
            const hashedCurrent = await bcrypt.hash('RealPassword1', 10);
            mockUserApiClient.getUserByEmail.mockResolvedValue({
                id: 'user-id',
                password: hashedCurrent,
                roles: [],
                status: 'active',
            });

            await changePassword({
                email: 'john@example.com',
                currentPassword: 'WrongPassword1',
                newPassword: 'NewPass123!',
            }).expect(HttpStatus.UNAUTHORIZED);

            expect(mockUserApiClient.getUserByEmail).toHaveBeenCalledWith('john@example.com', expect.any(String));
            expect(mockUserApiClient.updatePassword).not.toHaveBeenCalled();
        });
    });

    describe('POST /auth/change-password - validation', () => {
        it('should return 400 for invalid email format', async () => {
            await changePassword({
                email: 'not-an-email',
                currentPassword: 'Pass1234!',
                newPassword: 'NewPass123!',
            }).expect(HttpStatus.BAD_REQUEST);
            expect(mockUserApiClient.getUserByEmail).not.toHaveBeenCalled();
        });

        it('should return 400 for new password shorter than 8 characters', async () => {
            await changePassword({
                email: 'john@example.com',
                currentPassword: 'Pass1234!',
                newPassword: 'Short1',
            }).expect(HttpStatus.BAD_REQUEST);
            expect(mockUserApiClient.getUserByEmail).not.toHaveBeenCalled();
        });

        it('should return 400 for empty email', async () => {
            await changePassword({
                email: '',
                currentPassword: 'Pass1234!',
                newPassword: 'NewPass123!',
            }).expect(HttpStatus.BAD_REQUEST);
            expect(mockUserApiClient.getUserByEmail).not.toHaveBeenCalled();
        });
    });
});
