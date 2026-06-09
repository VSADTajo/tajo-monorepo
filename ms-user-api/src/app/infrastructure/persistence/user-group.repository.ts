import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IUserGroupRepository } from '@domain/ports/user-group-repository.port';
import { UserGroup } from '@domain/entities/user-group.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class UserGroupRepository implements IUserGroupRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(UserGroup) private readonly repo: Repository<UserGroup>,
    ) {}

    async create(data: UserGroup): Promise<UserGroup> {
        try {
            const entity = this.repo.create(data);
            return await this.repo.save(entity);
        } catch (error) {
            this.logger.error({ msg: 'Error creating user-group assignment', entity: 'Groups', error: String(error) });
            throw new RepositoryError('Error creating user-group assignment', error);
        }
    }

    async findByUserId(userId: string): Promise<UserGroup[]> {
        try {
            return await this.repo.find({ where: { userId }, relations: ['group'] });
        } catch (error) {
            this.logger.error({ msg: 'Error finding user groups', entity: 'Groups', error: String(error) });
            throw new RepositoryError('Error finding user groups', error);
        }
    }

    async findByUserIdAndGroupId(userId: string, groupId: string): Promise<UserGroup | null> {
        try {
            return await this.repo.findOne({ where: { userId, groupId } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding user-group', entity: 'Groups', error: String(error) });
            throw new RepositoryError('Error finding user-group', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.repo.delete(id);
        } catch (error) {
            this.logger.error({ msg: 'Error deleting user-group', entity: 'Groups', error: String(error) });
            throw new RepositoryError('Error deleting user-group', error);
        }
    }
}
