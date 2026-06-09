import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IUserRoleRepository } from '@domain/ports/user-role-repository.port';
import { UserRole } from '@domain/entities/user-role.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class UserRoleRepository implements IUserRoleRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(UserRole)
        private readonly userRoleRepository: Repository<UserRole>,
    ) {}

    async create(data: UserRole): Promise<UserRole> {
        try {
            const userRole = this.userRoleRepository.create(data);
            return await this.userRoleRepository.save(userRole);
        } catch (error) {
            this.logger.error({ msg: 'Error creating user-role assignment', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Error creating user-role assignment', error);
        }
    }

    async findByUserIdAndRoleId(userId: string, roleId: string): Promise<UserRole | null> {
        try {
            return await this.userRoleRepository.findOne({ where: { userId, roleId } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding user-role assignment', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Error finding user-role assignment', error);
        }
    }

    async findByUserId(userId: string): Promise<UserRole[]> {
        try {
            return await this.userRoleRepository.find({ where: { userId } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding user-role assignments', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Error finding user-role assignments', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.userRoleRepository.delete(id);
        } catch (error) {
            this.logger.error({ msg: 'Error deleting user-role assignment', entity: 'Roles', error: String(error) });
            throw new RepositoryError('Error deleting user-role assignment', error);
        }
    }

    async deleteByRoleId(roleId: string): Promise<void> {
        try {
            await this.userRoleRepository.delete({ roleId });
        } catch (error) {
            this.logger.error({
                msg: 'Error deleting user-role assignments by role',
                entity: 'Roles',
                error: String(error),
            });
            throw new RepositoryError('Error deleting user-role assignments by role', error);
        }
    }
}
