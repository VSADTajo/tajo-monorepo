import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import {
    ISimulationRepository,
    PaginatedResult,
    SimulationFilters,
    SIMULATION_SORT_FIELDS,
} from '@domain/ports/simulation-repository.port';
import { Simulation, SimulationStatus, SimulationType } from '@domain/entities/simulation.entity';
import { Maneuver } from '@domain/entities/maneuver.entity';
import { Prediction } from '@domain/entities/prediction.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class SimulationRepository implements ISimulationRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(Simulation)
        private readonly simulationRepository: Repository<Simulation>,
    ) {}

    async create(data: Simulation): Promise<Simulation> {
        try {
            const simulation = this.simulationRepository.create(data);
            return await this.simulationRepository.save(simulation);
        } catch (error) {
            this.logger.error({ msg: 'Error creating simulation', entity: 'Simulations', error: String(error) });
            throw new RepositoryError('Error creating simulation', error);
        }
    }

    async findById(id: string): Promise<Simulation> {
        try {
            return await this.simulationRepository.findOneOrFail({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding simulation by id', entity: 'Simulations', error: String(error) });
            throw new RepositoryError('Simulation not found', error);
        }
    }

    async update(data: Simulation): Promise<Simulation> {
        try {
            return await this.simulationRepository.save(data);
        } catch (error) {
            this.logger.error({ msg: 'Error updating simulation', entity: 'Simulations', error: String(error) });
            throw new RepositoryError('Error updating simulation', error);
        }
    }

    async softDelete(id: string): Promise<number> {
        try {
            return await this.simulationRepository.manager.transaction(async (manager) => {
                // Maneuvers exclusive to this simulation: linked to it, and not linked to any
                // OTHER non-deleted simulation. Shared maneuvers are intentionally kept alive.
                const exclusive: Array<{ id: string }> = await manager.query(
                    `SELECT m.id
                       FROM maneuvers m
                      WHERE m."deletedAt" IS NULL
                        AND EXISTS (
                            SELECT 1 FROM simulation_maneuvers sm
                             WHERE sm."maneuverId" = m.id AND sm."simulationId" = $1
                        )
                        AND NOT EXISTS (
                            SELECT 1 FROM simulation_maneuvers sm2
                              JOIN simulations s2 ON s2.id = sm2."simulationId"
                             WHERE sm2."maneuverId" = m.id
                               AND sm2."simulationId" <> $1
                               AND s2."deletedAt" IS NULL
                        )`,
                    [id],
                );

                const maneuverIds = exclusive.map((row) => row.id);
                if (maneuverIds.length > 0) {
                    await manager.getRepository(Maneuver).softDelete(maneuverIds);
                }
                await manager.getRepository(Simulation).softDelete(id);

                return maneuverIds.length;
            });
        } catch (error) {
            this.logger.error({ msg: 'Error soft-deleting simulation', entity: 'Simulations', error: String(error) });
            throw new RepositoryError('Error soft-deleting simulation', error);
        }
    }

    async findByDate(simulationDate: string): Promise<Simulation | null> {
        try {
            return await this.simulationRepository.findOne({ where: { simulationDate } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding simulation by date', entity: 'Simulations', error: String(error) });
            throw new RepositoryError('Error finding simulation by date', error);
        }
    }

    async findByDateAndEnvAndModmeteo(
        simulationDate: string,
        environment: string | null,
        modmeteo: string | null,
    ): Promise<Simulation | null> {
        try {
            const qb = this.simulationRepository.createQueryBuilder('simulation');
            qb.where('simulation.simulationDate = :simulationDate', { simulationDate });

            if (environment !== null && environment !== undefined) {
                qb.andWhere('simulation.environment = :environment', { environment });
            } else {
                qb.andWhere('simulation.environment IS NULL');
            }

            if (modmeteo !== null && modmeteo !== undefined) {
                qb.andWhere('simulation.modmeteo = :modmeteo', { modmeteo });
            } else {
                qb.andWhere('simulation.modmeteo IS NULL');
            }

            return await qb.getOne();
        } catch (error) {
            this.logger.error({
                msg: 'Error finding simulation by date, env and modmeteo',
                entity: 'Simulations',
                error: String(error),
            });
            throw new RepositoryError('Error finding simulation by date, env and modmeteo', error);
        }
    }

    async findLatestFinalized(): Promise<Simulation | null> {
        try {
            return await this.simulationRepository.findOne({
                where: { status: SimulationStatus.FINALIZED },
                order: { createdAt: 'DESC' },
            });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding latest finalized simulation',
                entity: 'Simulations',
                error: String(error),
            });
            throw new RepositoryError('Error finding latest finalized simulation', error);
        }
    }

    async findAll(filters: SimulationFilters, page: number, limit: number): Promise<PaginatedResult<Simulation>> {
        try {
            const qb = this.simulationRepository.createQueryBuilder('simulation');

            if (filters.status) {
                qb.andWhere('simulation.status = :status', { status: filters.status });
            }

            if (filters.modmeteo) {
                qb.andWhere('simulation.modmeteo = :modmeteo', { modmeteo: filters.modmeteo });
            }

            if (filters.environment) {
                qb.andWhere('simulation.environment = :environment', { environment: filters.environment });
            }

            if (filters.startDate) {
                qb.andWhere('simulation.simulationDate >= :startDate', { startDate: filters.startDate });
            }

            if (filters.endDate) {
                qb.andWhere('simulation.simulationDate <= :endDate', { endDate: filters.endDate });
            }

            if (filters.dataOrigin) {
                qb.andWhere('simulation.dataOrigin = :dataOrigin', { dataOrigin: filters.dataOrigin });
            }

            // Filter by station code via a correlated EXISTS subquery instead of a JOIN:
            // a simulation has many predictions, so a JOIN would duplicate rows and break
            // both the count and pagination. EXISTS keeps one row per simulation.
            if (filters.stationCode) {
                qb.andWhere(
                    (subQb) =>
                        'EXISTS ' +
                        subQb
                            .subQuery()
                            .select('1')
                            .from(Prediction, 'prediction')
                            .where('prediction.simulationId = simulation.id')
                            .andWhere('prediction.stationId = :stationCode')
                            .getQuery(),
                ).setParameter('stationCode', filters.stationCode);
            }

            const total = await qb.getCount();

            // Defence in depth against SQL injection: only ever order by a whitelisted field
            // (the DTO already enforces this; the repository never trusts raw input).
            const sortField =
                filters.sortBy && SIMULATION_SORT_FIELDS.includes(filters.sortBy) ? filters.sortBy : 'createdAt';
            const sortColumn = `simulation.${sortField}`;
            const sortOrder = filters.sortOrder === 'ASC' ? 'ASC' : 'DESC';

            const data = await qb
                .orderBy(sortColumn, sortOrder)
                // Stable tie-break so pagination is deterministic when the sort column ties.
                .addOrderBy('simulation.id', 'ASC')
                .skip((page - 1) * limit)
                .take(limit)
                .getMany();

            return { data, total, page, limit };
        } catch (error) {
            this.logger.error({ msg: 'Error finding all simulations', entity: 'Simulations', error: String(error) });
            throw new RepositoryError('Error finding all simulations', error);
        }
    }

    async findHistorical(page: number, limit: number): Promise<PaginatedResult<Simulation>> {
        try {
            const qb = this.simulationRepository.createQueryBuilder('simulation');

            const total = await qb.getCount();

            const data = await qb
                .orderBy('simulation.simulationDate', 'DESC')
                .skip((page - 1) * limit)
                .take(limit)
                .getMany();

            return { data, total, page, limit };
        } catch (error) {
            this.logger.error({
                msg: 'Error finding historical simulations',
                entity: 'Simulations',
                error: String(error),
            });
            throw new RepositoryError('Error finding historical simulations', error);
        }
    }

    async deleteOlderThan(date: Date): Promise<number> {
        try {
            const result = await this.simulationRepository
                .createQueryBuilder()
                .delete()
                .from(Simulation)
                .where('"createdAt" < :date', { date })
                .execute();

            return result.affected ?? 0;
        } catch (error) {
            this.logger.error({ msg: 'Error purging old simulations', entity: 'Simulations', error: String(error) });
            throw new RepositoryError('Error purging old simulations', error);
        }
    }

    async findManual(status?: SimulationStatus, page = 1, limit = 20): Promise<PaginatedResult<Simulation>> {
        try {
            const qb = this.simulationRepository.createQueryBuilder('simulation');
            qb.where('simulation.type = :type', { type: SimulationType.MANUAL });

            if (status) {
                qb.andWhere('simulation.status = :status', { status });
            }

            const total = await qb.getCount();

            const data = await qb
                .skip((page - 1) * limit)
                .take(limit)
                .orderBy('simulation.createdAt', 'DESC')
                .getMany();

            return { data, total, page, limit };
        } catch (error) {
            this.logger.error({ msg: 'Error finding manual simulations', entity: 'Simulations', error: String(error) });
            throw new RepositoryError('Error finding manual simulations', error);
        }
    }

    async findAvailableDates(dataOrigin?: string, predictionTypes?: string[]): Promise<string[]> {
        try {
            const qb = this.simulationRepository
                .createQueryBuilder('simulation')
                .select('DISTINCT simulation.simulationDate', 'simulationDate');

            if (predictionTypes?.length) {
                qb.innerJoin('simulation.predictions', 'prediction')
                    .innerJoin('prediction.predictionType', 'predictionType')
                    .andWhere('predictionType.name IN (:...predictionTypes)', { predictionTypes });
            }

            if (dataOrigin) {
                qb.andWhere('simulation.dataOrigin = :dataOrigin', { dataOrigin });
            }

            const results = await qb.orderBy('simulation.simulationDate', 'DESC').getRawMany();

            return results.map((r) => r.simulationDate);
        } catch (error) {
            this.logger.error({ msg: 'Error finding available dates', entity: 'Simulations', error: String(error) });
            throw new RepositoryError('Error finding available dates', error);
        }
    }
}
