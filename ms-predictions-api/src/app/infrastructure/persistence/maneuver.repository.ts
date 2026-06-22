import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IManeuverRepository, ManeuverFilters, PaginatedManeuvers } from '@domain/ports/maneuver-repository.port';
import { Maneuver } from '@domain/entities/maneuver.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class ManeuverRepository implements IManeuverRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(Maneuver)
        private readonly maneuverRepository: Repository<Maneuver>,
    ) {}

    async create(maneuver: Maneuver): Promise<Maneuver> {
        try {
            const entity = this.maneuverRepository.create(maneuver);
            return await this.maneuverRepository.save(entity);
        } catch (error) {
            this.logger.error({ msg: 'Error creating maneuver', entity: 'Maneuvers', error: String(error) });
            throw new RepositoryError('Error creating maneuver', error);
        }
    }

    async createMany(maneuvers: Maneuver[]): Promise<Maneuver[]> {
        try {
            const entities = this.maneuverRepository.create(maneuvers);
            return await this.maneuverRepository.save(entities);
        } catch (error) {
            this.logger.error({ msg: 'Error creating maneuvers', entity: 'Maneuvers', error: String(error) });
            throw new RepositoryError('Error creating maneuvers', error);
        }
    }

    async findById(id: string): Promise<Maneuver | null> {
        try {
            return await this.maneuverRepository.findOne({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding maneuver by id', entity: 'Maneuvers', error: String(error) });
            throw new RepositoryError('Error finding maneuver by id', error);
        }
    }

    async findByIds(ids: string[]): Promise<Maneuver[]> {
        if (ids.length === 0) return [];
        try {
            return await this.maneuverRepository.find({ where: { id: In(ids) } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding maneuvers by ids', entity: 'Maneuvers', error: String(error) });
            throw new RepositoryError('Error finding maneuvers by ids', error);
        }
    }

    async findAll(filters: ManeuverFilters, page: number, limit: number): Promise<PaginatedManeuvers> {
        try {
            const qb = this.maneuverRepository.createQueryBuilder('maneuver').orderBy('maneuver.createdAt', 'DESC');

            if (filters.reservoirCode) {
                qb.andWhere('maneuver.reservoirCode = :reservoirCode', { reservoirCode: filters.reservoirCode });
            }

            qb.skip((page - 1) * limit).take(limit);

            const [data, total] = await qb.getManyAndCount();
            return { data, total, page, limit };
        } catch (error) {
            this.logger.error({ msg: 'Error listing maneuvers', entity: 'Maneuvers', error: String(error) });
            throw new RepositoryError('Error listing maneuvers', error);
        }
    }

    async findBySimulationId(simulationId: string): Promise<Maneuver[]> {
        try {
            return await this.maneuverRepository
                .createQueryBuilder('maneuver')
                .innerJoin('simulation_maneuvers', 'sm', 'sm."maneuverId" = maneuver.id')
                .where('sm."simulationId" = :simulationId', { simulationId })
                .orderBy('maneuver."reservoirCode"', 'ASC')
                .getMany();
        } catch (error) {
            this.logger.error({
                msg: 'Error finding maneuvers by simulationId',
                entity: 'Maneuvers',
                error: String(error),
            });
            throw new RepositoryError('Error finding maneuvers by simulationId', error);
        }
    }

    async countBySimulationIds(simulationIds: string[]): Promise<Record<string, number>> {
        if (simulationIds.length === 0) {
            return {};
        }
        try {
            const rows: Array<{ simulationId: string; count: string }> = await this.maneuverRepository
                .createQueryBuilder('maneuver')
                .innerJoin('simulation_maneuvers', 'sm', 'sm."maneuverId" = maneuver.id')
                .select('sm."simulationId"', 'simulationId')
                .addSelect('COUNT(*)', 'count')
                .where('sm."simulationId" IN (:...simulationIds)', { simulationIds })
                .groupBy('sm."simulationId"')
                .getRawMany();

            return rows.reduce<Record<string, number>>((acc, row) => {
                acc[row.simulationId] = Number(row.count);
                return acc;
            }, {});
        } catch (error) {
            this.logger.error({
                msg: 'Error counting maneuvers by simulationIds',
                entity: 'Maneuvers',
                error: String(error),
            });
            throw new RepositoryError('Error counting maneuvers by simulationIds', error);
        }
    }

    async update(maneuver: Maneuver): Promise<Maneuver> {
        try {
            return await this.maneuverRepository.save(maneuver);
        } catch (error) {
            this.logger.error({ msg: 'Error updating maneuver', entity: 'Maneuvers', error: String(error) });
            throw new RepositoryError('Error updating maneuver', error);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.maneuverRepository.delete({ id });
        } catch (error) {
            this.logger.error({ msg: 'Error deleting maneuver', entity: 'Maneuvers', error: String(error) });
            throw new RepositoryError('Error deleting maneuver', error);
        }
    }
}
