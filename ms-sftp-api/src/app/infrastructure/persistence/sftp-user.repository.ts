import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { ISftpUserRepository } from '@domain/ports/sftp-user-repository.port';
import { SftpUser } from '@domain/entities/sftp-user.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class SftpUserRepository implements ISftpUserRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(SftpUser)
        private readonly repository: Repository<SftpUser>,
    ) {}

    async create(user: SftpUser): Promise<SftpUser> {
        try {
            return await this.repository.save(user);
        } catch (error) {
            this.logger.error({ msg: 'Failed to create SFTP user', entity: 'SFTPUser', error: String(error) });
            throw new RepositoryError('Failed to create SFTP user', error);
        }
    }

    async findById(id: string): Promise<SftpUser | null> {
        try {
            return await this.repository.findOne({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Failed to find SFTP user by ID', entity: 'SFTPUser', error: String(error) });
            throw new RepositoryError('Failed to find SFTP user', error);
        }
    }

    async findByUsername(username: string): Promise<SftpUser | null> {
        try {
            return await this.repository.findOne({ where: { username } });
        } catch (error) {
            this.logger.error({
                msg: 'Failed to find SFTP user by username',
                entity: 'SFTPUser',
                error: String(error),
            });
            throw new RepositoryError('Failed to find SFTP user by username', error);
        }
    }

    async findAll(): Promise<SftpUser[]> {
        try {
            return await this.repository.find({ order: { createdAt: 'DESC' } });
        } catch (error) {
            this.logger.error({ msg: 'Failed to list SFTP users', entity: 'SFTPUser', error: String(error) });
            throw new RepositoryError('Failed to list SFTP users', error);
        }
    }

    async findAllActive(): Promise<SftpUser[]> {
        try {
            return await this.repository.find({
                where: { isActive: true },
                order: { createdAt: 'DESC' },
            });
        } catch (error) {
            this.logger.error({ msg: 'Failed to list active SFTP users', entity: 'SFTPUser', error: String(error) });
            throw new RepositoryError('Failed to list active SFTP users', error);
        }
    }

    async update(user: SftpUser): Promise<SftpUser> {
        try {
            return await this.repository.save(user);
        } catch (error) {
            this.logger.error({ msg: 'Failed to update SFTP user', entity: 'SFTPUser', error: String(error) });
            throw new RepositoryError('Failed to update SFTP user', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.repository.delete(id);
        } catch (error) {
            this.logger.error({ msg: 'Failed to delete SFTP user', entity: 'SFTPUser', error: String(error) });
            throw new RepositoryError('Failed to delete SFTP user', error);
        }
    }
}
