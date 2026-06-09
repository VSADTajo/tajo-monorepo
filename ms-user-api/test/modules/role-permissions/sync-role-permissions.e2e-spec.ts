import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { User } from '../../../src/app/domain/entities/user.entity';
import { Role } from '../../../src/app/domain/entities/role.entity';
import { UserRole } from '../../../src/app/domain/entities/user-role.entity';
import { RolePermission } from '../../../src/app/domain/entities/role-permission.entity';

import { IUserRepository } from '../../../src/app/domain/ports/user-repository.port';
import { IRoleRepository } from '../../../src/app/domain/ports/role-repository.port';
import { IUserRoleRepository } from '../../../src/app/domain/ports/user-role-repository.port';
import { IRolePermissionRepository } from '../../../src/app/domain/ports/role-permission-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';

import { UserRepository } from '../../../src/app/infrastructure/persistence/user.repository';
import { RoleRepository } from '../../../src/app/infrastructure/persistence/role.repository';
import { UserRoleRepository } from '../../../src/app/infrastructure/persistence/user-role.repository';
import { RolePermissionRepository } from '../../../src/app/infrastructure/persistence/role-permission.repository';
import { CachingQueryBus } from '../../../src/app/infrastructure/cache/caching-query-bus.service';

import { CreateRoleHandler } from '../../../src/app/application/commands/role.commands';
import { SyncRolePermissionsHandler } from '../../../src/app/application/commands/role-permission.commands';
import {
    GetRolePermissionsHandler,
    GetBulkPermissionsHandler,
} from '../../../src/app/application/queries/role-permission.queries';

import { RoleController } from '../../../src/app/api/controllers/role.controller';
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';

describe('Role Permissions (e2e)', () => {
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
            entities: [User, Role, UserRole, RolePermission],
            controllers: [RoleController],
            providers: [
                CreateRoleHandler,
                SyncRolePermissionsHandler,
                GetRolePermissionsHandler,
                GetBulkPermissionsHandler,
                { provide: IUserRepository, useClass: UserRepository },
                { provide: IRoleRepository, useClass: RoleRepository },
                { provide: IUserRoleRepository, useClass: UserRoleRepository },
                { provide: IRolePermissionRepository, useClass: RolePermissionRepository },
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

    function createRole(name: string) {
        return request(app.getHttpServer()).post('/roles').send({ name });
    }

    function syncPermissions(roleId: string, permissions: Array<{ method: string; path: string }>) {
        return request(app.getHttpServer()).put(`/roles/${roleId}/permissions`).send({ permissions });
    }

    function getPermissions(roleId: string) {
        return request(app.getHttpServer()).get(`/roles/${roleId}/permissions`);
    }

    function getBulkPermissions(roles: string) {
        return request(app.getHttpServer()).get(`/roles/permissions/bulk?roles=${roles}`);
    }

    it('should sync permissions for a role', async () => {
        const { body: role } = await createRole('supervisor').expect(HttpStatus.CREATED);

        const permissions = [
            { method: 'GET', path: '/users' },
            { method: 'GET', path: '/users/{id}' },
            { method: 'GET', path: '/predictions' },
        ];

        const { body } = await syncPermissions(role.id, permissions).expect(HttpStatus.OK);
        expect(body.roleId).toBe(role.id);
        expect(body.count).toBe(3);
    });

    it('should replace permissions on second sync', async () => {
        const { body: role } = await createRole('editor').expect(HttpStatus.CREATED);

        await syncPermissions(role.id, [
            { method: 'GET', path: '/users' },
            { method: 'POST', path: '/users' },
        ]).expect(HttpStatus.OK);
        await syncPermissions(role.id, [{ method: 'GET', path: '/predictions' }]).expect(HttpStatus.OK);

        const { body } = await getPermissions(role.id).expect(HttpStatus.OK);
        expect(body.permissions).toHaveLength(1);
        expect(body.permissions[0].path).toBe('/predictions');
    });

    it('should sync with empty permissions (removes all)', async () => {
        const { body: role } = await createRole('viewer').expect(HttpStatus.CREATED);

        await syncPermissions(role.id, [{ method: 'GET', path: '/users' }]).expect(HttpStatus.OK);
        await syncPermissions(role.id, []).expect(HttpStatus.OK);

        const { body } = await getPermissions(role.id).expect(HttpStatus.OK);
        expect(body.permissions).toHaveLength(0);
    });

    it('should get bulk permissions for multiple roles (union)', async () => {
        const { body: role1 } = await createRole('role-a').expect(HttpStatus.CREATED);
        const { body: role2 } = await createRole('role-b').expect(HttpStatus.CREATED);

        await syncPermissions(role1.id, [{ method: 'GET', path: '/users' }]);
        await syncPermissions(role2.id, [{ method: 'GET', path: '/predictions' }]);

        const { body } = await getBulkPermissions('role-a,role-b').expect(HttpStatus.OK);
        expect(body.permissions).toHaveLength(2);
        const methods = body.permissions.map((p: any) => `${p.method}:${p.path}`);
        expect(methods).toContain('GET:/users');
        expect(methods).toContain('GET:/predictions');
    });

    it('should deduplicate permissions in bulk query', async () => {
        const { body: role1 } = await createRole('dup-role-1').expect(HttpStatus.CREATED);
        const { body: role2 } = await createRole('dup-role-2').expect(HttpStatus.CREATED);

        const shared = { method: 'GET', path: '/users' };
        await syncPermissions(role1.id, [shared]);
        await syncPermissions(role2.id, [shared]);

        const { body } = await getBulkPermissions('dup-role-1,dup-role-2').expect(HttpStatus.OK);
        expect(body.permissions).toHaveLength(1);
    });

    it('should return 404 when role not found', async () => {
        await syncPermissions('00000000-0000-0000-0000-000000000000', []).expect(HttpStatus.NOT_FOUND);
        await getPermissions('00000000-0000-0000-0000-000000000000').expect(HttpStatus.NOT_FOUND);
    });

    it('should invalidate cache when syncing permissions', async () => {
        const { body: role } = await createRole('cached-role').expect(HttpStatus.CREATED);
        await syncPermissions(role.id, [{ method: 'GET', path: '/users' }]).expect(HttpStatus.OK);
        expect(mockCacheService.del).toHaveBeenCalledWith(expect.stringContaining('permissions:role:cached-role'));
    });
});
