import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Domain
import { User } from '../../../src/app/domain/entities/user.entity';
import { Role } from '../../../src/app/domain/entities/role.entity';
import { UserRole } from '../../../src/app/domain/entities/user-role.entity';
import { IRoleRepository } from '../../../src/app/domain/ports/role-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

// Infrastructure
import { RoleRepository } from '../../../src/app/infrastructure/persistence/role.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

// Application
import { CreateRoleHandler } from '../../../src/app/application/commands/role.commands';
import { ListRolesHandler } from '../../../src/app/application/queries/role.queries';
import { RoleController } from '../../../src/app/api/controllers/role.controller';

// Test helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';
import { buildCreateRoleDto } from '../../factories/role.factory';

describe('List Roles (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [User, Role, UserRole],
            controllers: [RoleController],
            providers: [
                CreateRoleHandler,
                ListRolesHandler,
                CachingQueryBus,
                {
                    provide: IRoleRepository,
                    useClass: RoleRepository,
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

    // ─── Helpers ──────────────────────────────────────────────
    function createRole(dto: { name: string; description?: string }) {
        return request(app.getHttpServer()).post('/roles').send(dto);
    }

    function listRoles() {
        return request(app.getHttpServer()).get('/roles');
    }

    // ─── List roles ───────────────────────────────────────────
    describe('GET /roles', () => {
        it('should return empty array when no roles exist', async () => {
            const { body } = await listRoles().expect(HttpStatus.OK);

            expect(body.roles).toEqual([]);
        });

        it('should return all created roles', async () => {
            await createRole(buildCreateRoleDto({ name: 'admin', description: 'Administrator' })).expect(
                HttpStatus.CREATED,
            );
            await createRole(buildCreateRoleDto({ name: 'editor', description: 'Content editor' })).expect(
                HttpStatus.CREATED,
            );

            const { body } = await listRoles().expect(HttpStatus.OK);

            expect(body.roles).toHaveLength(2);
            expect(body.roles).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ name: 'admin', description: 'Administrator' }),
                    expect.objectContaining({ name: 'editor', description: 'Content editor' }),
                ]),
            );
        });

        it('should include role id in each item', async () => {
            await createRole(buildCreateRoleDto({ name: 'viewer' })).expect(HttpStatus.CREATED);

            const { body } = await listRoles().expect(HttpStatus.OK);

            expect(body.roles[0]).toHaveProperty('id');
            expect(body.roles[0].id).toEqual(expect.any(String));
        });
    });
});
