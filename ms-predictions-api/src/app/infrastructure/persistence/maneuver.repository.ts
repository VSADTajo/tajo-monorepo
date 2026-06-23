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

    async findBySimulationIds(simulationIds: string[]): Promise<Record<string, Maneuver[]>> {
        if (simulationIds.length === 0) {
            return {};
        }
        try {
            // Single batched query: join through simulation_maneuvers, hydrate the
            // Maneuver entities and keep the owning simulationId from each raw row.
            // NOTE: getRawAndEntities deduplicates `entities` by PK, so a maneuver
            // shared across simulations appears once in `entities` but once per
            // (simulation, maneuver) pair in `raw`. We therefore group by iterating
            // `raw` (not deduplicated) and resolving each maneuver from a by-id map.
            const { entities, raw } = await this.maneuverRepository
                .createQueryBuilder('maneuver')
                .innerJoin('simulation_maneuvers', 'sm', 'sm."maneuverId" = maneuver.id')
                .addSelect('sm."simulationId"', 'sm_simulationId')
                .where('sm."simulationId" IN (:...simulationIds)', { simulationIds })
                .orderBy('maneuver."reservoirCode"', 'ASC')
                .getRawAndEntities();

            const maneuverById = new Map(entities.map((maneuver) => [maneuver.id, maneuver]));

            return raw.reduce<Record<string, Maneuver[]>>((acc, row) => {
                const maneuver = maneuverById.get(row.maneuver_id);
                if (maneuver) {
                    (acc[row.sm_simulationId as string] ??= []).push(maneuver);
                }
                return acc;
            }, {});
        } catch (error) {
            this.logger.error({
                msg: 'Error finding maneuvers by simulationIds',
                entity: 'Maneuvers',
                error: String(error),
            });
            throw new RepositoryError('Error finding maneuvers by simulationIds', error);
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
