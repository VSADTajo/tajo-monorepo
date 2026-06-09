import axios from 'axios';
import { TOKEN_KEY } from '../../api/auth';

// Gateway client — all admin calls (roles, users, permissions) go through the API gateway
const GATEWAY_URL = import.meta.env.VITE_URL_API_GATEWAY || 'http://65.21.97.113';

const gatewayClient = axios.create({ baseURL: GATEWAY_URL });

gatewayClient.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ── Roles ──────────────────────────────────────────────────────

export async function listRoles() {
    const { data } = await gatewayClient.get('/roles');
    return data.roles as Array<{ id: string; name: string; description?: string | null }>;
}

export async function createRole(name: string, description?: string) {
    const { data } = await gatewayClient.post('/roles', { name, description });
    return data as { id: string; name: string; description?: string | null };
}

export async function getRolePermissions(roleId: string) {
    const { data } = await gatewayClient.get(`/roles/${roleId}/permissions`);
    return data.permissions as Array<{ id: string; method: string; path: string }>;
}

export async function syncRolePermissions(roleId: string, roleName: string, permissionIds: string[]) {
    const { data } = await gatewayClient.put(`/roles/${roleId}/permissions`, { permissionIds }, {
        headers: { 'X-Role-Name': roleName },
    });
    return data as { roleId: string; count: number };
}

export async function deleteRole(roleId: string) {
    await gatewayClient.delete(`/roles/${roleId}`);
}

// ── Gateway Swagger routes ─────────────────────────────────────

export interface AvailableRoute {
    method: string;
    path: string;
    summary: string;
    tag: string;
}

export async function getGatewayRoutes(): Promise<AvailableRoute[]> {
    const { data: spec } = await gatewayClient.get('/docs-json');

    const routes: AvailableRoute[] = [];
    const paths: Record<string, Record<string, { summary?: string; tags?: string[] }>> = spec.paths || {};

    const methodOrder = ['get', 'post', 'put', 'patch', 'delete'];

    // Public routes excluded from auth middleware — not configurable per role
    const PUBLIC_PATH_PREFIXES = ['/auth', '/health'];

    for (const [path, methods] of Object.entries(paths)) {
        if (PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) continue;
        for (const method of methodOrder) {
            if (methods[method]) {
                const op = methods[method];
                // Convert NestJS path /users/:id to OpenAPI /users/{id}
                const normalizedPath = path.replace(/:([^/]+)/g, '{$1}');
                routes.push({
                    method: method.toUpperCase(),
                    path: normalizedPath,
                    summary: op.summary || `${method.toUpperCase()} ${path}`,
                    tag: op.tags?.[0] || 'Other',
                });
            }
        }
    }

    return routes;
}

// ── Users ──────────────────────────────────────────────────────

export async function listUsers() {
    const { data } = await gatewayClient.get('/users');
    return data.users as Array<{ id: string; name: string; email: string; status?: string }>;
}

export async function getUserById(userId: string) {
    const { data } = await gatewayClient.get(`/users/${userId}`);
    return data as { id: string; name: string; email: string; status?: string };
}

export async function getUserRoles(userId: string) {
    const { data } = await gatewayClient.get(`/users/${userId}/roles`);
    return data.roles as Array<{ id: string; name: string; description?: string | null }>;
}

export async function assignRoleToUser(userId: string, roleId: string) {
    const { data } = await gatewayClient.post(`/users/${userId}/roles`, { roleId });
    return data;
}

export async function removeRoleFromUser(userId: string, roleId: string) {
    const { data } = await gatewayClient.delete(`/users/${userId}/roles/${roleId}`);
    return data;
}

export async function registerUser(name: string, email: string, password: string) {
    const { data } = await gatewayClient.post('/auth/register', { name, email, password });
    return data as { userId: string };
}

export async function deleteUser(userId: string) {
    await gatewayClient.delete(`/users/${userId}`);
}

// ── Permissions ───────────────────────────────────────────────

export async function listPermissions() {
    const { data } = await gatewayClient.get('/permissions');
    return data.permissions as Array<{ id: string; name: string | null; method: string; path: string; tag: string | null }>;
}

export async function syncPermissionsFromGateway() {
    // 1. Read gateway swagger to get all protected routes
    const routes = await getGatewayRoutes();
    // 2. Sync to user-api (upsert by method+path)
    const { data } = await gatewayClient.post('/permissions/sync', {
        routes: routes.map((r) => ({ method: r.method, path: r.path, name: r.summary, tag: r.tag })),
    });
    return data.permissions as Array<{ id: string; name: string | null; method: string; path: string; tag: string | null }>;
}

// ── Groups ────────────────────────────────────────────────────

export async function listGroups() {
    const { data } = await gatewayClient.get('/groups');
    return data.groups as Array<{ id: string; name: string; description?: string | null; roles: Array<{ id: string; name: string; description?: string | null }> }>;
}

export async function createGroup(name: string, description?: string) {
    const { data } = await gatewayClient.post('/groups', { name, description });
    return data as { id: string; name: string; description?: string | null };
}

export async function deleteGroup(groupId: string) {
    await gatewayClient.delete(`/groups/${groupId}`);
}

export async function assignRoleToGroup(groupId: string, roleId: string) {
    const { data } = await gatewayClient.post(`/groups/${groupId}/roles`, { roleId });
    return data;
}

export async function removeRoleFromGroup(groupId: string, roleId: string) {
    await gatewayClient.delete(`/groups/${groupId}/roles/${roleId}`);
}

// ── User Groups ───────────────────────────────────────────────

export async function getUserGroups(userId: string) {
    const { data } = await gatewayClient.get(`/users/${userId}/groups`);
    return data.groups as Array<{ id: string; name: string; description?: string | null }>;
}

export async function assignGroupToUser(userId: string, groupId: string) {
    const { data } = await gatewayClient.post(`/users/${userId}/groups`, { groupId });
    return data;
}

export async function removeGroupFromUser(userId: string, groupId: string) {
    await gatewayClient.delete(`/users/${userId}/groups/${groupId}`);
}
