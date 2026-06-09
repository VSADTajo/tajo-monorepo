import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IRolePermissionRepository } from '@domain/ports/role-permission-repository.port';
import { RolePermission } from '@domain/entities/role-permission.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class RolePermissionRepository implements IRolePermissionRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(RolePermission) private readonly repo: Repository<RolePermission>,
    ) {}

    async findByRoleId(roleId: string): Promise<RolePermission[]> {
        try {
            return await this.repo.find({ where: { roleId }, relations: ['permission'] });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding permissions for role',
                entity: 'Permissions',
                error: String(error),
            });
            throw new RepositoryError('Error finding permissions', error);
        }
    }

    async findByRoleNames(roleNames: string[]): Promise<RolePermission[]> {
        try {
            if (roleNames.length === 0) return [];
            return await this.repo
                .createQueryBuilder('rp')
                .innerJoin('rp.role', 'role')
                .innerJoinAndSelect('rp.permission', 'permission')
                .where('role.name IN (:...roleNames)', { roleNames })
                .getMany();
        } catch (error) {
            this.logger.error({ msg: 'Error finding bulk permissions', entity: 'Permissions', error: String(error) });
            throw new RepositoryError('Error finding bulk permissions', error);
        }
    }

    async syncForRole(roleId: string, permissionIds: string[]): Promise<RolePermission[]> {
        try {
            await this.repo.delete({ roleId });
            if (permissionIds.length === 0) return [];
            const entities = permissionIds.map((permissionId) => this.repo.create({ roleId, permissionId }));
            return await this.repo.save(entities);
        } catch (error) {
            this.logger.error({ msg: 'Error syncing permissions', entity: 'Permissions', error: String(error) });
            throw new RepositoryError('Error syncing permissions', error);
        }
    }

    async hasAssignments(permissionId: string): Promise<boolean> {
        try {
            const count = await this.repo.count({ where: { permissionId } });
            return count > 0;
        } catch (error) {
            this.logger.error({
                msg: 'Error checking permission assignments',
                entity: 'Permissions',
                error: String(error),
            });
            throw new RepositoryError('Error checking permission assignments', error);
        }
    }
}
