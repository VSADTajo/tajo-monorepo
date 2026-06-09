import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IProviderConfigRepository } from '@domain/ports/provider-config-repository.port';
import { ProviderConfig } from '@domain/entities/provider-config.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class ProviderConfigRepository implements IProviderConfigRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(ProviderConfig)
        private readonly providerConfigRepository: Repository<ProviderConfig>,
    ) {}

    async create(data: ProviderConfig): Promise<ProviderConfig> {
        try {
            const entity = this.providerConfigRepository.create(data);
            return await this.providerConfigRepository.save(entity);
        } catch (error) {
            this.logger.error({
                msg: 'Error creating provider config',
                entity: 'ProviderConfig',
                error: String(error),
            });
            throw new RepositoryError('Error creating provider config', error);
        }
    }

    async findAll(): Promise<ProviderConfig[]> {
        try {
            return await this.providerConfigRepository.find({ order: { createdAt: 'DESC' } });
        } catch (error) {
            this.logger.error({
                msg: 'Error listing provider configs',
                entity: 'ProviderConfig',
                error: String(error),
            });
            throw new RepositoryError('Error listing provider configs', error);
        }
    }

    async findById(id: string): Promise<ProviderConfig | null> {
        try {
            return await this.providerConfigRepository.findOne({ where: { id } });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding provider config by id',
                entity: 'ProviderConfig',
                error: String(error),
            });
            throw new RepositoryError('Error finding provider config', error);
        }
    }

    async findByName(name: string): Promise<ProviderConfig | null> {
        return this.providerConfigRepository.findOne({ where: { name } });
    }

    async findActive(): Promise<ProviderConfig[]> {
        try {
            return await this.providerConfigRepository.find({ where: { isActive: true } });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding active provider configs',
                entity: 'ProviderConfig',
                error: String(error),
            });
            throw new RepositoryError('Error finding active provider configs', error);
        }
    }

    async update(data: ProviderConfig): Promise<ProviderConfig> {
        try {
            return await this.providerConfigRepository.save(data);
        } catch (error) {
            this.logger.error({
                msg: 'Error updating provider config',
                entity: 'ProviderConfig',
                error: String(error),
            });
            throw new RepositoryError('Error updating provider config', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.providerConfigRepository.delete(id);
        } catch (error) {
            this.logger.error({
                msg: 'Error deleting provider config',
                entity: 'ProviderConfig',
                error: String(error),
            });
            throw new RepositoryError('Error deleting provider config', error);
        }
    }
}
