import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IGroupRepository } from '@domain/ports/group-repository.port';
import { Group } from '@domain/entities/group.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class GroupRepository implements IGroupRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(Group) private readonly repo: Repository<Group>,
    ) {}

    async create(data: Group): Promise<Group> {
        try {
            const entity = this.repo.create(data);
            return await this.repo.save(entity);
        } catch (error) {
            this.logger.error({ msg: 'Error creating group', entity: 'Groups', error: String(error) });
            throw new RepositoryError('Error creating group', error);
        }
    }

    async findAll(): Promise<Group[]> {
        try {
            return await this.repo.find({
                relations: ['groupRoles', 'groupRoles.role'],
                order: { name: 'ASC' },
            });
        } catch (error) {
            this.logger.error({ msg: 'Error listing groups', entity: 'Groups', error: String(error) });
            throw new RepositoryError('Error listing groups', error);
        }
    }

    async findById(id: string): Promise<Group> {
        try {
            return await this.repo.findOneOrFail({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding group by id', entity: 'Groups', error: String(error) });
            throw new RepositoryError('Group not found', error);
        }
    }

    async findByName(name: string): Promise<Group | null> {
        try {
            return await this.repo.findOne({ where: { name } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding group by name', entity: 'Groups', error: String(error) });
            throw new RepositoryError('Error finding group by name', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.repo.delete(id);
        } catch (error) {
            this.logger.error({ msg: 'Error deleting group', entity: 'Groups', error: String(error) });
            throw new RepositoryError('Error deleting group', error);
        }
    }
}
