import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import {
    IPredictionRepository,
    ForecastFilters,
    HistoricalTimelineFilters,
    MaxAndLatestFilters,
    MaxAndLatestValueItem,
    SimulationDateSummaryItem,
    StationPredictionTypeItem,
} from '@domain/ports/prediction-repository.port';
import { Prediction } from '@domain/entities/prediction.entity';
import { IHistoricalTimelinePoint } from '@domain/results/historical-predictions.result';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class PredictionRepository implements IPredictionRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(Prediction)
        private readonly predictionRepository: Repository<Prediction>,
    ) {}

    async create(data: Prediction): Promise<Prediction> {
        try {
            const prediction = this.predictionRepository.create(data);
            return await this.predictionRepository.save(prediction);
        } catch (error) {
            this.logger.error({ msg: 'Error creating prediction', entity: 'Predictions', error: String(error) });
            throw new RepositoryError('Error creating prediction', error);
        }
    }

    async findById(id: string): Promise<Prediction> {
        try {
            return await this.predictionRepository.findOneOrFail({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding prediction by id', entity: 'Predictions', error: String(error) });
            throw new RepositoryError('Prediction not found', error);
        }
    }

    async findHistorical(filters: HistoricalTimelineFilters): Promise<IHistoricalTimelinePoint[]> {
        try {
            const rows: Array<{ date: Date; value: number | string; flag: number }> =
                await this.predictionRepository.manager.query(
                    `
                    SELECT DISTINCT ON (r.date)
                        r.date  AS "date",
                        r.value AS "value",
                        r.flag  AS "flag"
                    FROM prediction_results r
                    INNER JOIN predictions p       ON p.id  = r."predictionId"
                    INNER JOIN prediction_types pt ON pt.id = p."predictionTypeId"
                    WHERE p."stationId" = $1
                      AND pt.name       = $2
                      AND r.date >= $3
                      AND r.date <= $4
                    ORDER BY r.date ASC, r."createdAt" DESC, r.id DESC
                    `,
                    [filters.stationId, filters.predictionType, filters.startDate, filters.endDate],
                );

            return rows.map((r) => ({
                date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
                value: typeof r.value === 'string' ? Number(r.value) : r.value,
                flag: r.flag,
            }));
        } catch (error) {
            this.logger.error({
                msg: 'Error reconstructing historical timeline',
                entity: 'Predictions',
                error: String(error),
            });
            throw new RepositoryError('Error reconstructing historical timeline', error);
        }
    }

    async findBySimulationId(simulationId: string): Promise<Prediction[]> {
        try {
            return await this.predictionRepository.find({
                where: { simulationId },
                relations: ['results'],
            });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding predictions by simulation id',
                entity: 'Predictions',
                error: String(error),
            });
            throw new RepositoryError('Error finding predictions by simulation id', error);
        }
    }

    async findByProviderAndDate(provider: string, simulationDate: string): Promise<Prediction[]> {
        try {
            const qb = this.predictionRepository.createQueryBuilder('prediction');
            qb.innerJoinAndSelect('prediction.simulation', 'simulation');
            qb.leftJoinAndSelect('prediction.predictionType', 'predictionType');
            qb.leftJoinAndSelect('prediction.results', 'result');
            qb.where('prediction.predictionProvider = :provider', { provider });
            qb.andWhere('simulation.simulationDate = :simulationDate', { simulationDate });

            return await qb.getMany();
        } catch (error) {
            this.logger.error({
                msg: 'Error finding predictions by provider and date',
                entity: 'Predictions',
                error: String(error),
            });
            throw new RepositoryError('Error finding predictions by provider and date', error);
        }
    }

    async findForecast(filters: ForecastFilters): Promise<Prediction[]> {
        try {
            const qb = this.predictionRepository.createQueryBuilder('prediction');
            qb.innerJoinAndSelect('prediction.simulation', 'simulation');
            qb.innerJoinAndSelect('prediction.predictionType', 'predictionType');
            qb.leftJoinAndSelect('prediction.results', 'result');

            // 1. Filter by prediction type
            if (filters.predictionType) {
                qb.where('predictionType.name = :predictionType', { predictionType: filters.predictionType });
            } else {
                qb.where(
                    '(predictionType.name LIKE :forecastPattern OR predictionType.name LIKE :qPattern OR predictionType.name LIKE :iPattern)',
                    { forecastPattern: '%forecast%', qPattern: 'Q.NAM.%', iPattern: 'I.NAM.%' },
                );
            }

            // 2. Filter by station
            if (filters.stationId) {
                qb.andWhere('prediction.stationId = :stationId', { stationId: filters.stationId });
            }

            // 3. Filter by simulation date — if not provided, find the latest finalized simulation that has the requested type
            if (filters.simulationDate) {
                qb.andWhere('simulation.simulationDate = :simulationDate', { simulationDate: filters.simulationDate });
            } else {
                const subQb = this.predictionRepository.manager
                    .createQueryBuilder()
                    .select('s2."simulationDate"')
                    .from('simulations', 's2')
                    .innerJoin('predictions', 'p2', 'p2."simulationId" = s2.id')
                    .innerJoin('prediction_types', 'pt2', 'pt2.id = p2."predictionTypeId"')
                    .where('s2.status = :latestStatus');

                if (filters.predictionType) {
                    subQb.andWhere('pt2.name = :latestType');
                } else {
                    subQb.andWhere(
                        '(pt2.name LIKE :latestForecast OR pt2.name LIKE :latestQ OR pt2.name LIKE :latestI)',
                    );
                }

                subQb.orderBy('s2."simulationDate"', 'DESC').limit(1);

                qb.andWhere(`simulation."simulationDate" = (${subQb.getQuery()})`);

                // Set subquery parameters — must be a single call; setParameters replaces, does not merge
                if (filters.predictionType) {
                    qb.setParameters({ latestStatus: 'FINALIZED', latestType: filters.predictionType });
                } else {
                    qb.setParameters({
                        latestStatus: 'FINALIZED',
                        latestForecast: '%forecast%',
                        latestQ: 'Q.NAM.%',
                        latestI: 'I.NAM.%',
                    });
                }
            }

            // 4. Filter by percentile
            if (filters.percentile !== undefined) {
                qb.andWhere('prediction.percentile = :percentile', { percentile: filters.percentile });
            } else {
                qb.andWhere('prediction.percentile IS NULL');
            }

            // 5. Filter the result timeline by date window (inclusive). Predictions
            // with no result point inside the window are excluded from the response.
            // NOTE: result.date is `timestamp without time zone`; the driver stores/reads
            // Date objects through the session timezone. Bind Date objects (not raw ISO
            // strings) so the comparison uses the same timezone conversion as the stored
            // values — passing a bare ISO string with a 'Z' offset yields wrong matches.
            if (filters.startDate) {
                qb.andWhere('result.date >= :startDate', { startDate: new Date(filters.startDate) });
            }
            if (filters.endDate) {
                qb.andWhere('result.date <= :endDate', { endDate: new Date(filters.endDate) });
            }

            qb.orderBy('prediction.stationId', 'ASC');
            // Guarantee a deterministic, chronologically ordered result timeline
            // for consumers (charts) and for stable assertions in tests.
            qb.addOrderBy('result.date', 'ASC');

            return await qb.getMany();
        } catch (error) {
            this.logger.error({
                msg: 'Error finding forecast predictions',
                entity: 'Predictions',
                error: String(error),
            });
            throw new RepositoryError('Error finding forecast predictions', error);
        }
    }

    async findMaxAndLatestValues(filters: MaxAndLatestFilters): Promise<MaxAndLatestValueItem[]> {
        try {
            const qb = this.predictionRepository.createQueryBuilder('prediction');
            qb.innerJoin('prediction.simulation', 'simulation');
            qb.innerJoin('prediction.predictionType', 'predictionType');
            qb.innerJoin('prediction.results', 'result');
            qb.andWhere('simulation.status = :status', { status: 'FINALIZED' });

            qb.select('prediction.stationId', 'stationId');
            qb.addSelect('prediction.stationName', 'stationName');
            qb.addSelect('MAX(result.value)', 'maxValue');
            qb.addSelect('(array_agg(result.date ORDER BY result.value DESC, result.date ASC))[1]', 'maxDate');
            qb.addSelect('(array_agg(result.value ORDER BY result.date DESC))[1]', 'latestValue');
            qb.addSelect('MAX(result.date)', 'latestDate');
            qb.addSelect('predictionType.name', 'predictionTypeName');
            qb.addSelect('simulation.simulationDate', 'simulationDate');

            if (filters.typeName) {
                qb.andWhere('predictionType.name = :typeName', { typeName: filters.typeName });
            }

            // Align with findForecast: default to deterministic forecast (no percentile) when not specified,
            // so the aggregated max corresponds to the same prediction set the forecast endpoint returns.
            if (filters.percentile !== null && filters.percentile !== undefined) {
                qb.andWhere('prediction.percentile = :percentile', { percentile: filters.percentile });
            } else {
                qb.andWhere('prediction.percentile IS NULL');
            }

            if (filters.simulationDate) {
                qb.andWhere('simulation.simulationDate = :simulationDate', { simulationDate: filters.simulationDate });
            } else {
                const subQb = this.predictionRepository.manager
                    .createQueryBuilder()
                    .select('s2."simulationDate"')
                    .from('simulations', 's2')
                    .innerJoin('predictions', 'p2', 'p2."simulationId" = s2.id')
                    .innerJoin('prediction_types', 'pt2', 'pt2.id = p2."predictionTypeId"')
                    .where('s2.status = :latestStatus');

                if (filters.typeName) {
                    subQb.andWhere('pt2.name = :latestType');
                }

                if (filters.modmeteo) {
                    subQb.andWhere('s2.modmeteo = :latestModmeteo');
                }

                subQb.orderBy('s2."simulationDate"', 'DESC').limit(1);

                qb.andWhere(`simulation."simulationDate" = (${subQb.getQuery()})`);

                qb.setParameter('latestStatus', 'FINALIZED');
                if (filters.typeName) {
                    qb.setParameter('latestType', filters.typeName);
                }
                if (filters.modmeteo) {
                    qb.setParameter('latestModmeteo', filters.modmeteo);
                }
            }

            if (filters.modmeteo) {
                qb.andWhere('simulation.modmeteo = :modmeteo', { modmeteo: filters.modmeteo });
            }

            qb.groupBy('prediction.stationId');
            qb.addGroupBy('prediction.stationName');
            qb.addGroupBy('predictionType.name');
            qb.addGroupBy('simulation.simulationDate');
            qb.addGroupBy('prediction.percentile');

            return await qb.getRawMany();
        } catch (error) {
            this.logger.error({
                msg: 'Error finding max and latest values',
                entity: 'Predictions',
                error: String(error),
            });
            throw new RepositoryError('Error finding max and latest values', error);
        }
    }

    async findSimulationDatesByStation(
        stationId: string,
        predictionTypes?: string[],
    ): Promise<SimulationDateSummaryItem[]> {
        try {
            const params: unknown[] = [stationId];
            let predictionTypeFilter = '';

            if (predictionTypes?.length) {
                const placeholders = predictionTypes.map((_, i) => `$${i + 2}`).join(', ');
                predictionTypeFilter = `AND pt.name IN (${placeholders})`;
                params.push(...predictionTypes);
            }

            const rows: Array<{
                simulationDate: string;
                modmeteos: string;
                predictionTypes: string;
                totalResults: string;
            }> = await this.predictionRepository.manager.query(
                `
                SELECT
                    s."simulationDate",
                    string_agg(DISTINCT s.modmeteo, ',' ORDER BY s.modmeteo) AS "modmeteos",
                    string_agg(DISTINCT pt.name, ',' ORDER BY pt.name) AS "predictionTypes",
                    COUNT(pr.id)::text AS "totalResults"
                FROM predictions p
                INNER JOIN simulations s ON s.id = p."simulationId"
                INNER JOIN prediction_types pt ON pt.id = p."predictionTypeId"
                LEFT JOIN prediction_results pr ON pr."predictionId" = p.id
                WHERE p."stationId" = $1
                ${predictionTypeFilter}
                GROUP BY s."simulationDate"
                ORDER BY s."simulationDate" DESC
                `,
                params,
            );

            return rows.map((r) => ({
                simulationDate: r.simulationDate,
                modmeteo: r.modmeteos ?? null,
                status: 'FINALIZED',
                predictionTypes: r.predictionTypes ? r.predictionTypes.split(',') : [],
                totalResults: parseInt(r.totalResults, 10),
            }));
        } catch (error) {
            this.logger.error({
                msg: 'Error finding simulation dates by station',
                entity: 'Predictions',
                error: String(error),
            });
            throw new RepositoryError('Error finding simulation dates by station', error);
        }
    }

    async findTypesWithDataByStation(stationId: string): Promise<StationPredictionTypeItem[]> {
        try {
            const rows: Array<{ id: string; name: string; unit: string }> =
                await this.predictionRepository.manager.query(
                    `
                    SELECT DISTINCT pt.id AS "id", pt.name AS "name", pt.unit AS "unit"
                    FROM prediction_types pt
                    INNER JOIN predictions p        ON p."predictionTypeId" = pt.id
                    INNER JOIN prediction_results pr ON pr."predictionId"     = p.id
                    INNER JOIN simulations s         ON s.id                  = p."simulationId"
                    WHERE p."stationId" = $1
                      AND s.status      = 'FINALIZED'
                      AND s."deletedAt" IS NULL
                    ORDER BY pt.name ASC
                    `,
                    [stationId],
                );

            return rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit }));
        } catch (error) {
            this.logger.error({
                msg: 'Error finding prediction types with data by station',
                entity: 'Predictions',
                error: String(error),
            });
            throw new RepositoryError('Error finding prediction types with data by station', error);
        }
    }

    async findByUniqueConstraint(
        simulationId: string,
        stationId: string,
        predictionTypeId: string,
        percentile: number | null,
    ): Promise<Prediction | null> {
        try {
            const qb = this.predictionRepository.createQueryBuilder('prediction');
            qb.where('prediction.simulationId = :simulationId', { simulationId });
            qb.andWhere('prediction.stationId = :stationId', { stationId });
            qb.andWhere('prediction.predictionTypeId = :predictionTypeId', { predictionTypeId });

            if (percentile !== null && percentile !== undefined) {
                qb.andWhere('prediction.percentile = :percentile', { percentile });
            } else {
                qb.andWhere('prediction.percentile IS NULL');
            }

            return await qb.getOne();
        } catch (error) {
            this.logger.error({
                msg: 'Error finding prediction by unique constraint',
                entity: 'Predictions',
                error: String(error),
            });
            throw new RepositoryError('Error finding prediction by unique constraint', error);
        }
    }
}
