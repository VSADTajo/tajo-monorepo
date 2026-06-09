import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IPermissionRepository } from '@domain/ports/permission-repository.port';
import { ListPermissionsResult } from '@domain/results/permission.result';

// ─────────────────────────────────────────────────────────────
// ListPermissions
// ─────────────────────────────────────────────────────────────

export class ListPermissionsQuery {}

@QueryHandler(ListPermissionsQuery)
export class ListPermissionsHandler implements IQueryHandler<ListPermissionsQuery, ListPermissionsResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly permissionRepository: IPermissionRepository,
    ) {}

    async execute(): Promise<ListPermissionsResult> {
        this.logger.debug('Listing all permissions');
        const permissions = await this.permissionRepository.findAll();
        return new ListPermissionsResult({
            permissions: permissions.map((p) => ({
                id: p.id,
                name: p.name,
                method: p.method,
                path: p.path,
                tag: p.tag,
            })),
        });
    }
}
