import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IGroupRoleRepository } from '@domain/ports/group-role-repository.port';
import { GroupRole } from '@domain/entities/group-role.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class GroupRoleRepository implements IGroupRoleRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(GroupRole) private readonly repo: Repository<GroupRole>,
    ) {}

    async create(data: GroupRole): Promise<GroupRole> {
        try {
            const entity = this.repo.create(data);
            return await this.repo.save(entity);
        } catch (error) {
            this.logger.error({ msg: 'Error creating group-role assignment', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Error creating group-role assignment', error);
        }
    }

    async findByGroupId(groupId: string): Promise<GroupRole[]> {
        try {
            return await this.repo.find({ where: { groupId }, relations: ['role'] });
        } catch (error) {
            this.logger.error({ msg: 'Error finding group roles', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Error finding group roles', error);
        }
    }

    async findByGroupIdAndRoleId(groupId: string, roleId: string): Promise<GroupRole | null> {
        try {
            return await this.repo.findOne({ where: { groupId, roleId } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding group-role', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Error finding group-role', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.repo.delete(id);
        } catch (error) {
            this.logger.error({ msg: 'Error deleting group-role', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Error deleting group-role', error);
        }
    }

    async deleteByRoleId(roleId: string): Promise<void> {
        try {
            await this.repo.delete({ roleId });
        } catch (error) {
            this.logger.error({ msg: 'Error deleting group-roles by role', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Error deleting group-roles by role', error);
        }
    }
}
