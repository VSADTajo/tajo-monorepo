import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IRoleRepository } from '@domain/ports/role-repository.port';
import { Role } from '@domain/entities/role.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class RoleRepository implements IRoleRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
    ) {}

    async create(data: Role): Promise<Role> {
        try {
            const role = this.roleRepository.create(data);
            return await this.roleRepository.save(role);
        } catch (error) {
            this.logger.error({ msg: 'Error creating role', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Error creating role', error);
        }
    }

    async findById(id: string): Promise<Role> {
        try {
            return await this.roleRepository.findOneOrFail({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding role by id', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Role not found', error);
        }
    }

    async findByName(name: string): Promise<Role | null> {
        try {
            return await this.roleRepository.findOne({ where: { name } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding role by name', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Error finding role by name', error);
        }
    }

    async findAll(): Promise<Role[]> {
        try {
            return await this.roleRepository.find();
        } catch (error) {
            this.logger.error({ msg: 'Error listing roles', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Error listing roles', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.roleRepository.delete(id);
        } catch (error) {
            this.logger.error({ msg: 'Error deleting role', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Error deleting role', error);
        }
    }
}
