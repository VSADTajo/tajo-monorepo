import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IUserRepository } from '@domain/ports/user-repository.port';
import { User } from '@domain/entities/user.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class UserRepository implements IUserRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    async create(data: User): Promise<User> {
        try {
            const user = this.userRepository.create(data);
            return await this.userRepository.save(user);
        } catch (error) {
            this.logger.error({ msg: 'Error creating user', entity: 'Users', error: String(error) });
            throw new RepositoryError('Error creating user', error);
        }
    }

    async update(data: User): Promise<User> {
        try {
            return await this.userRepository.save(data);
        } catch (error) {
            this.logger.error({ msg: 'Error updating user', entity: 'Users', error: String(error) });
            throw new RepositoryError('Error updating user', error);
        }
    }

    async findById(id: string): Promise<User> {
        try {
            return await this.userRepository.findOneOrFail({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding user by id', entity: 'Users', error: String(error) });
            throw new RepositoryError('User not found', error);
        }
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userRepository.findOne({ where: { email } });
    }

    async findAll(): Promise<User[]> {
        try {
            return await this.userRepository.find();
        } catch (error) {
            this.logger.error({ msg: 'Error listing users', entity: 'Users', error: String(error) });
            throw new RepositoryError('Error listing users', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.userRepository.delete(id);
        } catch (error) {
            this.logger.error({ msg: 'Error deleting user', entity: 'Users', error: String(error) });
            throw new RepositoryError('User not found', error);
        }
    }
}
