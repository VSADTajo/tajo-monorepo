import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IMappingSchemaRepository } from '@domain/ports/mapping-schema-repository.port';
import { MappingSchema } from '@domain/entities/mapping-schema.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class MappingSchemaRepository implements IMappingSchemaRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(MappingSchema)
        private readonly repository: Repository<MappingSchema>,
    ) {}

    async create(schema: MappingSchema): Promise<MappingSchema> {
        try {
            return await this.repository.save(schema);
        } catch (error) {
            this.logger.error({
                msg: 'Failed to create mapping schema',
                entity: 'MappingSchema',
                error: String(error),
            });
            throw new RepositoryError('Failed to create mapping schema', error);
        }
    }

    async findById(id: string): Promise<MappingSchema | null> {
        try {
            return await this.repository.findOne({ where: { id } });
        } catch (error) {
            this.logger.error({
                msg: 'Failed to find mapping schema by ID',
                entity: 'MappingSchema',
                error: String(error),
            });
            throw new RepositoryError('Failed to find mapping schema', error);
        }
    }

    async findByDirectoryPath(directoryPath: string): Promise<MappingSchema | null> {
        try {
            return await this.repository.findOne({ where: { directoryPath } });
        } catch (error) {
            this.logger.error({
                msg: 'Failed to find mapping schema by path',
                entity: 'MappingSchema',
                error: String(error),
            });
            throw new RepositoryError('Failed to find mapping schema by path', error);
        }
    }

    async findAll(): Promise<MappingSchema[]> {
        try {
            return await this.repository.find({ order: { createdAt: 'DESC' } });
        } catch (error) {
            this.logger.error({ msg: 'Failed to list mapping schemas', entity: 'MappingSchema', error: String(error) });
            throw new RepositoryError('Failed to list mapping schemas', error);
        }
    }

    async update(schema: MappingSchema): Promise<MappingSchema> {
        try {
            return await this.repository.save(schema);
        } catch (error) {
            this.logger.error({
                msg: 'Failed to update mapping schema',
                entity: 'MappingSchema',
                error: String(error),
            });
            throw new RepositoryError('Failed to update mapping schema', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.repository.delete(id);
        } catch (error) {
            this.logger.error({
                msg: 'Failed to delete mapping schema',
                entity: 'MappingSchema',
                error: String(error),
            });
            throw new RepositoryError('Failed to delete mapping schema', error);
        }
    }
}
