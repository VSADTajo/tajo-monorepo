import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { ISubBasinRepository } from '@domain/ports/sub-basin-repository.port';
import { SubBasin } from '@domain/entities/sub-basin.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class SubBasinRepository implements ISubBasinRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(SubBasin)
        private readonly subBasinRepository: Repository<SubBasin>,
    ) {}

    async create(data: SubBasin): Promise<SubBasin> {
        try {
            const subBasin = this.subBasinRepository.create(data);
            return await this.subBasinRepository.save(subBasin);
        } catch (error) {
            this.logger.error({ msg: 'Error creating sub-basin', entity: 'SubBasins', error: String(error) });
            throw new RepositoryError('Error creating sub-basin', error);
        }
    }

    async findById(id: string): Promise<SubBasin> {
        try {
            return await this.subBasinRepository.findOneOrFail({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding sub-basin by id', entity: 'SubBasins', error: String(error) });
            throw new RepositoryError('Sub-basin not found', error);
        }
    }

    async findByIdWithStations(id: string): Promise<SubBasin> {
        try {
            return await this.subBasinRepository.findOneOrFail({
                where: { id },
                relations: ['stations'],
            });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding sub-basin by id with stations',
                entity: 'SubBasins',
                error: String(error),
            });
            throw new RepositoryError('Sub-basin not found', error);
        }
    }

    async findByCode(code: string): Promise<SubBasin | null> {
        return this.subBasinRepository.findOne({ where: { code } });
    }

    async findByNameAndBasinId(name: string, basinId: string): Promise<SubBasin | null> {
        return this.subBasinRepository.findOne({ where: { name, basinId } });
    }

    async findAll(options: {
        page?: number;
        limit?: number;
        basinId?: string;
        isActive?: boolean;
    }): Promise<{ items: SubBasin[]; total: number }> {
        try {
            const where: Record<string, unknown> = {};
            if (options.basinId !== undefined) {
                where.basinId = options.basinId;
            }
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

            const [items, total] = await this.subBasinRepository.findAndCount(findOptions as any);

            return { items, total };
        } catch (error) {
            this.logger.error({ msg: 'Error listing sub-basins', entity: 'SubBasins', error: String(error) });
            throw new RepositoryError('Error listing sub-basins', error);
        }
    }

    async update(data: SubBasin): Promise<SubBasin> {
        try {
            return await this.subBasinRepository.save(data);
        } catch (error) {
            this.logger.error({ msg: 'Error updating sub-basin', entity: 'SubBasins', error: String(error) });
            throw new RepositoryError('Error updating sub-basin', error);
        }
    }
}
