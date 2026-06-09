import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IBasinRepository } from '@domain/ports/basin-repository.port';
import { Basin } from '@domain/entities/basin.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class BasinRepository implements IBasinRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(Basin)
        private readonly basinRepository: Repository<Basin>,
    ) {}

    async create(data: Basin): Promise<Basin> {
        try {
            const basin = this.basinRepository.create(data);
            return await this.basinRepository.save(basin);
        } catch (error) {
            this.logger.error({ msg: 'Error creating basin', entity: 'Basins', error: String(error) });
            throw new RepositoryError('Error creating basin', error);
        }
    }

    async findById(id: string): Promise<Basin> {
        try {
            return await this.basinRepository.findOneOrFail({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding basin by id', entity: 'Basins', error: String(error) });
            throw new RepositoryError('Basin not found', error);
        }
    }

    async findByIdWithSubBasins(id: string): Promise<Basin> {
        try {
            return await this.basinRepository.findOneOrFail({
                where: { id },
                relations: ['subBasins'],
            });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding basin by id with sub-basins',
                entity: 'Basins',
                error: String(error),
            });
            throw new RepositoryError('Basin not found', error);
        }
    }

    async findByName(name: string): Promise<Basin | null> {
        return this.basinRepository.findOne({ where: { name } });
    }

    async findByCode(code: string): Promise<Basin | null> {
        return this.basinRepository.findOne({ where: { code } });
    }

    async findAll(options: {
        page?: number;
        limit?: number;
        isActive?: boolean;
    }): Promise<{ items: Basin[]; total: number }> {
        try {
            const where: Record<string, unknown> = {};
            if (options.isActive !== undefined) {
                where.isActive = options.isActive;
            }

            const findOptions: Record<string, unknown> = {
                where,
                order: { createdAt: 'DESC' },
            };
            if (options.page && options.limit) {
                findOptions.skip = (options.page - 1) * options.limit;
                findOptions.take = options.limit;
            }

            const [items, total] = await this.basinRepository.findAndCount(findOptions as any);

            return { items, total };
        } catch (error) {
            this.logger.error({ msg: 'Error listing basins', entity: 'Basins', error: String(error) });
            throw new RepositoryError('Error listing basins', error);
        }
    }

    async update(data: Basin): Promise<Basin> {
        try {
            return await this.basinRepository.save(data);
        } catch (error) {
            this.logger.error({ msg: 'Error updating basin', entity: 'Basins', error: String(error) });
            throw new RepositoryError('Error updating basin', error);
        }
    }
}
