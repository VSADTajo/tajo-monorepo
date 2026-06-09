import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Application
import {
    CreateSftpUserHandler,
    UpdateSftpUserHandler,
    DeleteSftpUserHandler,
    ToggleSftpUserHandler,
} from '../../../src/app/application/commands/sftp-user.commands';
import { ListSftpUsersHandler, GetSftpUserByIdHandler } from '../../../src/app/application/queries/sftp-user.queries';
import { SftpUserController } from '../../../src/app/api/controllers/sftp-user.controller';

// Domain
import { SftpUser } from '../../../src/app/domain/entities/sftp-user.entity';
import { ISftpUserRepository } from '../../../src/app/domain/ports/sftp-user-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { SftpUserRepository } from '../../../src/app/infrastructure/persistence/sftp-user.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateSftpUserDto } from '../../factories/sftp-user.factory';

const mockCacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
};

describe('SFTP Users CRUD (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [SftpUser],
            controllers: [SftpUserController],
            providers: [
                CreateSftpUserHandler,
                UpdateSftpUserHandler,
                DeleteSftpUserHandler,
                ToggleSftpUserHandler,
                ListSftpUsersHandler,
                GetSftpUserByIdHandler,
                { provide: ISftpUserRepository, useClass: SftpUserRepository },
                { provide: ICacheService, useValue: mockCacheService },
                CachingQueryBus,
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

    // ─── Helpers ───────────────────────────────────────────────────

    function createUser(dto: Record<string, unknown>) {
        return request(app.getHttpServer()).post('/sftp-users').send(dto);
    }

    function listUsers() {
        return request(app.getHttpServer()).get('/sftp-users');
    }

    function getUserById(id: string) {
        return request(app.getHttpServer()).get(`/sftp-users/${id}`);
    }

    function updateUser(id: string, dto: Record<string, unknown>) {
        return request(app.getHttpServer()).put(`/sftp-users/${id}`).send(dto);
    }

    function deleteUser(id: string) {
        return request(app.getHttpServer()).delete(`/sftp-users/${id}`);
    }

    function toggleUser(id: string, isActive: boolean) {
        return request(app.getHttpServer()).patch(`/sftp-users/${id}/toggle`).send({ isActive });
    }

    // ─── Create ──────────────────────────────────────────────────

    describe('POST /sftp-users', () => {
        it('should create a user and retrieve it by ID', async () => {
            const dto = buildCreateSftpUserDto({ username: 'empresa-abc' });

            const { body: created } = await createUser(dto).expect(HttpStatus.CREATED);

            expect(created.id).toBeDefined();
            expect(created.username).toBe('empresa-abc');
            expect(created.rootDirectory).toBe(dto.rootDirectory);
            expect(created.isActive).toBe(true);
            expect(created.password).toBeUndefined();

            const { body: fetched } = await getUserById(created.id).expect(HttpStatus.OK);
            expect(fetched.id).toBe(created.id);
            expect(fetched.username).toBe('empresa-abc');
            expect(fetched.password).toBeUndefined();
        });

        it('should return 409 when username already exists', async () => {
            const dto = buildCreateSftpUserDto({ username: 'duplicate-user' });

            await createUser(dto).expect(HttpStatus.CREATED);
            await createUser(dto).expect(HttpStatus.CONFLICT);
        });

        it('should return 400 when username is empty', async () => {
            const dto = buildCreateSftpUserDto({ username: '' });
            await createUser(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 400 when password is too short', async () => {
            const dto = buildCreateSftpUserDto({ password: '123' });
            await createUser(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('should return 400 when rootDirectory is empty', async () => {
            const dto = buildCreateSftpUserDto({ rootDirectory: '' });
            await createUser(dto).expect(HttpStatus.BAD_REQUEST);
        });

        it('should normalize username to lowercase', async () => {
            const dto = buildCreateSftpUserDto({ username: 'MyUser' });

            const { body } = await createUser(dto).expect(HttpStatus.CREATED);
            expect(body.username).toBe('myuser');
        });

        it('should return 400 for username with invalid characters', async () => {
            const dto = buildCreateSftpUserDto({ username: 'user@invalid!' });
            await createUser(dto).expect(HttpStatus.BAD_REQUEST);
        });
    });

    // ─── List ────────────────────────────────────────────────────

    describe('GET /sftp-users', () => {
        it('should return empty list when no users exist', async () => {
            const { body } = await listUsers().expect(HttpStatus.OK);

            expect(body.users).toEqual([]);
        });

        it('should return all users', async () => {
            await createUser(buildCreateSftpUserDto({ username: 'user-one' })).expect(HttpStatus.CREATED);
            await createUser(buildCreateSftpUserDto({ username: 'user-two' })).expect(HttpStatus.CREATED);

            const { body } = await listUsers().expect(HttpStatus.OK);

            expect(body.users).toHaveLength(2);
            const usernames = body.users.map((u: { username: string }) => u.username);
            expect(usernames).toContain('user-one');
            expect(usernames).toContain('user-two');
        });
    });

    // ─── Get by ID ───────────────────────────────────────────────

    describe('GET /sftp-users/:id', () => {
        it('should return 404 for non-existent user', async () => {
            await getUserById('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
        });
    });

    // ─── Update ──────────────────────────────────────────────────

    describe('PUT /sftp-users/:id', () => {
        it('should update rootDirectory', async () => {
            const dto = buildCreateSftpUserDto({ username: 'update-test' });
            const { body: created } = await createUser(dto).expect(HttpStatus.CREATED);

            const { body: updated } = await updateUser(created.id, {
                rootDirectory: 'new-directory',
            }).expect(HttpStatus.OK);

            expect(updated.rootDirectory).toBe('new-directory');
            expect(updated.username).toBe('update-test');
        });

        it('should update password without exposing it', async () => {
            const dto = buildCreateSftpUserDto({ username: 'password-update' });
            const { body: created } = await createUser(dto).expect(HttpStatus.CREATED);

            const { body: updated } = await updateUser(created.id, {
                password: 'new-password-456',
            }).expect(HttpStatus.OK);

            expect(updated.password).toBeUndefined();
            expect(updated.id).toBe(created.id);
        });

        it('should return 404 for non-existent user', async () => {
            await updateUser('00000000-0000-0000-0000-000000000000', {
                rootDirectory: 'test',
            }).expect(HttpStatus.NOT_FOUND);
        });

        it('should return 400 for password too short', async () => {
            const dto = buildCreateSftpUserDto({ username: 'short-pw' });
            const { body: created } = await createUser(dto).expect(HttpStatus.CREATED);

            await updateUser(created.id, { password: '12' }).expect(HttpStatus.BAD_REQUEST);
        });
    });

    // ─── Toggle ──────────────────────────────────────────────────

    describe('PATCH /sftp-users/:id/toggle', () => {
        it('should deactivate and reactivate a user', async () => {
            const dto = buildCreateSftpUserDto({ username: 'toggle-test' });
            const { body: created } = await createUser(dto).expect(HttpStatus.CREATED);
            expect(created.isActive).toBe(true);

            const { body: deactivated } = await toggleUser(created.id, false).expect(HttpStatus.OK);
            expect(deactivated.isActive).toBe(false);

            const { body: reactivated } = await toggleUser(created.id, true).expect(HttpStatus.OK);
            expect(reactivated.isActive).toBe(true);
        });

        it('should return 404 for non-existent user', async () => {
            await toggleUser('00000000-0000-0000-0000-000000000000', false).expect(HttpStatus.NOT_FOUND);
        });
    });

    // ─── Delete ──────────────────────────────────────────────────

    describe('DELETE /sftp-users/:id', () => {
        it('should delete a user', async () => {
            const dto = buildCreateSftpUserDto({ username: 'delete-test' });
            const { body: created } = await createUser(dto).expect(HttpStatus.CREATED);

            const { body: deleted } = await deleteUser(created.id).expect(HttpStatus.OK);

            expect(deleted.deletedId).toBe(created.id);
            expect(deleted.username).toBe('delete-test');

            await getUserById(created.id).expect(HttpStatus.NOT_FOUND);
        });

        it('should return 404 for non-existent user', async () => {
            await deleteUser('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
        });
    });
});
