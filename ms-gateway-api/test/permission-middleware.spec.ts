import { PermissionMiddleware } from '../src/app/infrastructure/middleware/permission.middleware';
import { PermissionCacheService } from '../src/app/infrastructure/services/permission-cache.service';
import { ServicesConfigService } from '../src/configuration/services/services-config.service';
import { RedisConfigService } from '../src/configuration/redis/redis-config.service';

// Mock de dependencias
const mockLogger = { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
const mockPermissionCache = {
    getPermissions: jest.fn(),
    setPermissions: jest.fn().mockResolvedValue(undefined),
};
const mockServicesConfig = { userApiUrl: 'http://ms-user-api:3001' };
const mockRedisConfig = { permissionTtl: 300 };
const mockAppConfig = { rbacBypassRoles: ['admin'] };

// Mock de axios para fetch
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

function buildMiddleware() {
    return new PermissionMiddleware(
        mockLogger as any,
        mockPermissionCache as unknown as PermissionCacheService,
        mockServicesConfig as unknown as ServicesConfigService,
        mockRedisConfig as unknown as RedisConfigService,
        mockAppConfig as any,
    );
}

function buildReq(method: string, path: string, roles: string[]) {
    return { method, path, originalUrl: path, user: { userId: 'user-1', roles } } as any;
}

function buildRes() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { status, json } as any;
}

describe('PermissionMiddleware', () => {
    let middleware: PermissionMiddleware;
    let next: jest.Mock;

    beforeEach(() => {
        middleware = buildMiddleware();
        next = jest.fn();
        jest.clearAllMocks();
        mockPermissionCache.setPermissions.mockResolvedValue(undefined);
    });

    it('should bypass for admin role', async () => {
        const req = buildReq('GET', '/users', ['admin']);
        const res = buildRes();
        await middleware.use(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow when permission matches (cache hit)', async () => {
        mockPermissionCache.getPermissions.mockResolvedValue([{ method: 'GET', path: '/users' }]);
        const req = buildReq('GET', '/users', ['supervisor']);
        const res = buildRes();
        await middleware.use(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should deny when permission does not match (cache hit)', async () => {
        mockPermissionCache.getPermissions.mockResolvedValue([{ method: 'GET', path: '/predictions' }]);
        const req = buildReq('POST', '/users', ['supervisor']);
        const res = buildRes();
        await middleware.use(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('should fetch from user-api on cache miss and cache result', async () => {
        mockPermissionCache.getPermissions.mockResolvedValue(null);
        mockedAxios.get = jest.fn().mockResolvedValue({
            data: { permissions: [{ method: 'GET', path: '/users/{id}' }] },
        });

        const req = buildReq('GET', '/users/abc-123', ['editor']);
        const res = buildRes();
        await middleware.use(req, res, next);

        expect(mockedAxios.get).toHaveBeenCalledWith(
            'http://ms-user-api:3001/roles/permissions/bulk',
            expect.objectContaining({ params: { roles: 'editor' } }),
        );
        expect(mockPermissionCache.setPermissions).toHaveBeenCalledWith(
            'editor',
            [{ method: 'GET', path: '/users/{id}' }],
            300,
        );
        expect(next).toHaveBeenCalled();
    });

    it('should match path with {id} parameter', async () => {
        mockPermissionCache.getPermissions.mockResolvedValue([{ method: 'GET', path: '/users/{id}' }]);
        const req = buildReq('GET', '/users/550e8400-e29b-41d4-a716-446655440000', ['viewer']);
        const res = buildRes();
        await middleware.use(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should deny on exact path mismatch', async () => {
        mockPermissionCache.getPermissions.mockResolvedValue([{ method: 'GET', path: '/users' }]);
        const req = buildReq('GET', '/roles', ['viewer']);
        const res = buildRes();
        await middleware.use(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should deny when user has no roles', async () => {
        const req = buildReq('GET', '/users', []);
        mockPermissionCache.getPermissions.mockResolvedValue([]);
        const res = buildRes();
        await middleware.use(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should fail safe when user-api fetch fails', async () => {
        mockPermissionCache.getPermissions.mockResolvedValue(null);
        mockedAxios.get = jest.fn().mockRejectedValue(new Error('Connection refused'));
        const req = buildReq('GET', '/users', ['supervisor']);
        const res = buildRes();
        await middleware.use(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('should union permissions from multiple roles', async () => {
        mockPermissionCache.getPermissions
            .mockResolvedValueOnce([{ method: 'GET', path: '/users' }])
            .mockResolvedValueOnce([{ method: 'GET', path: '/predictions' }]);
        const req = buildReq('GET', '/predictions', ['role-a', 'role-b']);
        const res = buildRes();
        await middleware.use(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
