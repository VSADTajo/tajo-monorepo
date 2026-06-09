import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

import { ServicesConfigService } from '@config/services/services-config.service';
import { PermissionCacheService, PermissionEntry } from '@infrastructure/services/permission-cache.service';
import { RedisConfigService } from '@config/redis/redis-config.service';
import { AppConfigService } from '@config/app/app-config.service';
import { RequestUser } from '@infrastructure/middleware/auth.middleware';

@Injectable()
export class PermissionMiddleware implements NestMiddleware {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly permissionCache: PermissionCacheService,
        private readonly servicesConfig: ServicesConfigService,
        private readonly redisConfig: RedisConfigService,
        private readonly appConfig: AppConfigService,
    ) {}

    async use(req: Request, res: Response, next: NextFunction): Promise<void> {
        const user = (req as Request & { user: RequestUser }).user;

        // AuthMiddleware should have already set req.user; if not, deny
        if (!user || !user.roles) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        // Admin (or configured bypass roles) bypass permission check
        if (user.roles.some((r) => this.appConfig.rbacBypassRoles.includes(r))) {
            return next();
        }

        const method = req.method.toUpperCase();
        const path = req.originalUrl.split('?')[0];

        // Collect all permissions for all user roles (union)
        const allPermissions: PermissionEntry[] = [];
        for (const roleName of user.roles) {
            const cached = await this.permissionCache.getPermissions(roleName);
            if (cached !== null) {
                allPermissions.push(...cached);
            } else {
                // Cache miss — fetch from ms-user-api
                const fetched = await this.fetchPermissions(roleName);
                // Only cache non-empty results to avoid stale deny state when permissions are later added
                if (fetched.length > 0) {
                    await this.permissionCache.setPermissions(roleName, fetched, this.redisConfig.permissionTtl);
                }
                allPermissions.push(...fetched);
            }
        }

        // Check if any permission matches
        const allowed = allPermissions.some((p) => this.pathMatches(p, method, path));
        if (!allowed) {
            this.logger.warn({ msg: 'Permission denied', entity: 'Permissions', userId: user.userId, method, path });
            res.status(403).json({ message: 'Insufficient permissions for this route' });
            return;
        }

        next();
    }

    private async fetchPermissions(roleName: string): Promise<PermissionEntry[]> {
        try {
            const response = await axios.get(`${this.servicesConfig.userApiUrl}/roles/permissions/bulk`, {
                params: { roles: roleName },
                headers: { 'x-internal-caller': 'ms-gateway-api' },
                timeout: 10_000,
            });
            const permissions = (response.data?.permissions ?? []) as PermissionEntry[];
            this.logger.debug(`Fetched ${permissions.length} permissions for role "${roleName}" from ms-user-api`);
            return permissions;
        } catch (error) {
            this.logger.error({
                msg: 'Failed to fetch permissions',
                entity: 'Permissions',
                roleName,
                error: String(error),
            });
            return []; // fail safe — deny access
        }
    }

    private pathMatches(permission: PermissionEntry, method: string, actualPath: string): boolean {
        if (permission.method !== method) return false;

        // Convert OpenAPI path params {id} to regex [^/]+
        const regexStr = permission.path
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape regex special chars
            .replace(/\\\{[^}]+\\\}/g, '[^/]+'); // then unescape {param} → [^/]+

        try {
            const regex = new RegExp(`^${regexStr}$`);
            return regex.test(actualPath);
        } catch {
            return false;
        }
    }
}
