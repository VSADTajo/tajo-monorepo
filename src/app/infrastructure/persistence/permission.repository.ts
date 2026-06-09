import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IPermissionRepository } from '@domain/ports/permission-repository.port';
import { Permission } from '@domain/entities/permission.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class PermissionRepository implements IPermissionRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(Permission) private readonly repo: Repository<Permission>,
    ) {}

    async create(data: Permission): Promise<Permission> {
        try {
            const entity = this.repo.create(data);
            return await this.repo.save(entity);
        } catch (error) {
            this.logger.error({ msg: 'Error creating permission', entity: 'Permissions', error: String(error) });
            throw new RepositoryError('Error creating permission', error);
        }
    }

    async findAll(): Promise<Permission[]> {
        try {
            return await this.repo.find({ order: { method: 'ASC', path: 'ASC' } });
        } catch (error) {
            this.logger.error({ msg: 'Error listing permissions', entity: 'Permissions', error: String(error) });
            throw new RepositoryError('Error listing permissions', error);
        }
    }

    async findById(id: string): Promise<Permission> {
        try {
            return await this.repo.findOneOrFail({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding permission by id', entity: 'Permissions', error: String(error) });
            throw new RepositoryError('Permission not found', error);
        }
    }

    async findByMethodAndPath(method: string, path: string): Promise<Permission | null> {
        try {
            return await this.repo.findOne({ where: { method, path } });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding permission by method+path',
                entity: 'Permissions',
                error: String(error),
            });
            throw new RepositoryError('Error finding permission', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.repo.delete(id);
        } catch (error) {
            this.logger.error({ msg: 'Error deleting permission', entity: 'Permissions', error: String(error) });
            throw new RepositoryError('Error deleting permission', error);
        }
    }

    async upsertMany(
        permissions: Array<{ method: string; path: string; name: string | null; tag: string | null }>,
    ): Promise<Permission[]> {
        try {
            const entities = permissions.map((p) => this.repo.create(p));
            await this.repo.upsert(entities, {
                conflictPaths: ['method', 'path'],
                skipUpdateIfNoValuesChanged: true,
            });
            return await this.repo.find({ order: { tag: 'ASC', method: 'ASC', path: 'ASC' } });
        } catch (error) {
            this.logger.error({ msg: 'Error upserting permissions', entity: 'Permissions', error: String(error) });
            throw new RepositoryError('Error upserting permissions', error);
        }
    }
}
