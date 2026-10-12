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
    PrecipAccumulationFilters,
    PrecipAccumulationItem,
    ForecastPrecipAccumulation,
    SimulationDateSummaryItem,
    StationPredictionTypeItem,
    TypeCoverageCell,
} from '@domain/ports/prediction-repository.port';
import { Prediction } from '@domain/entities/prediction.entity';
import { IHistoricalTimelinePoint } from '@domain/results/historical-predictions.result';
import { RepositoryError } from '@domain/errors/repository.error';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Observed series are re-ingested every hour, each time with several days of
 * history, so prediction_results holds many copies of every point. Reading only
 * the ingestions of the last OBSERVED_INGESTION_LOOKBACK_HOURS keeps the scan on
 * the (predictionTypeId, createdAt) index; a station silent for longer than that
 * simply has no live accumulation to report.
 */
const OBSERVED_INGESTION_LOOKBACK_HOURS = 48;

/** Points older than this cannot fall inside any window of a station still reported. */
const OBSERVED_DATA_LOOKBACK_HOURS = OBSERVED_INGESTION_LOOKBACK_HOURS + 24;

interface PrecipAccumulationRow {
    stationId: string;
    stationName: string | null;
    accumulated: number | string;
    windowStart: Date;
    windowEnd: Date;
    lastDate: Date;
}

function toPrecipAccumulationItem(row: PrecipAccumulationRow): PrecipAccumulationItem {
    return {
        stationId: row.stationId,
        stationName: row.stationName,
        accumulated: typeof row.accumulated === 'string' ? Number(row.accumulated) : row.accumulated,
        windowStart: row.windowStart,
        windowEnd: row.windowEnd,
        lastDate: row.lastDate,
    };
}

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

    async findObservedPrecipAccumulation(filters: PrecipAccumulationFilters): Promise<PrecipAccumulationItem[]> {
        const reference = filters.referenceDate.getTime();
        const ingestedSince = new Date(reference - OBSERVED_INGESTION_LOOKBACK_HOURS * HOUR_MS).toISOString();
        const dataSince = new Date(reference - OBSERVED_DATA_LOOKBACK_HOURS * HOUR_MS).toISOString();

        try {
            // Each point is the rain of the hour ending at its timestamp, so the
            // window (lastDate - hours, lastDate] holds exactly `hours` hourly points.
            const rows: PrecipAccumulationRow[] = await this.predictionRepository.manager.query(
                `
                WITH points AS (
                    SELECT DISTINCT ON (p."stationId", r.date)
                        p."stationId"   AS "stationId",
                        p."stationName" AS "stationName",
                        r.date          AS "date",
                        r.value::float8 AS "value"
                    FROM predictions p
                    INNER JOIN prediction_types pt  ON pt.id = p."predictionTypeId"
                    INNER JOIN prediction_results r ON r."predictionId" = p.id
                    WHERE pt.name        = $1
                      AND p."createdAt" >= $3
                      AND r.date        >= $4
                      AND r.date        <= $5
                    ORDER BY p."stationId", r.date, r."createdAt" DESC, r.id DESC
                ),
                stations AS (
                    SELECT
                        "stationId",
                        MAX("date") AS "lastDate",
                        (array_agg("stationName" ORDER BY "date" DESC))[1] AS "stationName"
                    FROM points
                    GROUP BY "stationId"
                )
                SELECT
                    s."stationId",
                    s."stationName",
                    ROUND(SUM(pts."value")::numeric, 2)::float8  AS "accumulated",
                    s."lastDate" - make_interval(hours => $2)    AS "windowStart",
                    s."lastDate"                                 AS "windowEnd",
                    s."lastDate"                                 AS "lastDate"
                FROM stations s
                INNER JOIN points pts
                        ON pts."stationId" = s."stationId"
                       AND pts."date"      > s."lastDate" - make_interval(hours => $2)
                GROUP BY s."stationId", s."stationName", s."lastDate"
                ORDER BY s."stationId"
                `,
                [filters.predictionType, filters.hours, ingestedSince, dataSince, filters.referenceDate.toISOString()],
            );

            return rows.map(toPrecipAccumulationItem);
        } catch (error) {
            this.logger.error({
                msg: 'Error computing observed precipitation accumulation',
                entity: 'Predictions',
                error: String(error),
            });
            throw new RepositoryError('Error computing observed precipitation accumulation', error);
        }
    }

    async findForecastPrecipAccumulation(filters: PrecipAccumulationFilters): Promise<ForecastPrecipAccumulation> {
        try {
            const latest: Array<{ id: string; simulationDate: string }> = await this.predictionRepository.manager.query(
                `
                SELECT s.id, s."simulationDate"
                FROM simulations s
                WHERE s.status = 'FINALIZED'
                  AND EXISTS (
                      SELECT 1
                      FROM predictions p
                      INNER JOIN prediction_types pt ON pt.id = p."predictionTypeId"
                      WHERE p."simulationId" = s.id
                        AND pt.name = $1
                        AND p.percentile IS NULL
                  )
                ORDER BY s."simulationDate" DESC, s."createdAt" DESC
                LIMIT 1
                `,
                [filters.predictionType],
            );

            if (latest.length === 0) {
                return { simulationDate: null, items: [] };
            }

            // Forecast steps are not always hourly (EPS moves to 3h and 6h further
            // out). Every value is the rain of the step ending at its timestamp, so
            // it is spread evenly over the hours of that step before summing; a
            // `hours` window then always adds up whole hours. The first point has no
            // previous one, so it takes the length of the step that follows it.
            const rows: PrecipAccumulationRow[] = await this.predictionRepository.manager.query(
                `
                WITH points AS (
                    SELECT DISTINCT ON (p."stationId", r.date)
                        p."stationId"   AS "stationId",
                        p."stationName" AS "stationName",
                        r.date          AS "date",
                        r.value::float8 AS "value"
                    FROM predictions p
                    INNER JOIN prediction_types pt  ON pt.id = p."predictionTypeId"
                    INNER JOIN prediction_results r ON r."predictionId" = p.id
                    WHERE p."simulationId" = $1
                      AND pt.name          = $2
                      AND p.percentile IS NULL
                    ORDER BY p."stationId", r.date, r."createdAt" DESC, r.id DESC
                ),
                steps AS (
                    SELECT
                        "stationId",
                        "stationName",
                        "date",
                        "value",
                        GREATEST(1, ROUND(COALESCE(
                            EXTRACT(EPOCH FROM "date" - LAG("date") OVER w),
                            EXTRACT(EPOCH FROM LEAD("date") OVER w - "date"),
                            3600
                        ) / 3600))::int AS "stepHours"
                    FROM points
                    WINDOW w AS (PARTITION BY "stationId" ORDER BY "date")
                ),
                hourly AS (
                    SELECT
                        st."stationId",
                        st."stationName",
                        st."date" - make_interval(hours => h.i) AS "hour",
                        st."value" / st."stepHours"              AS "value",
                        MAX(st."date") OVER (PARTITION BY st."stationId") AS "lastDate"
                    FROM steps st
                    CROSS JOIN LATERAL generate_series(0, st."stepHours" - 1) AS h(i)
                ),
                rolling AS (
                    SELECT
                        "stationId",
                        "stationName",
                        "hour",
                        "lastDate",
                        SUM("value") OVER (
                            PARTITION BY "stationId"
                            ORDER BY "hour"
                            RANGE BETWEEN make_interval(hours => $3 - 1) PRECEDING AND CURRENT ROW
                        ) AS "accumulated"
                    FROM hourly
                )
                SELECT DISTINCT ON ("stationId")
                    "stationId",
                    "stationName",
                    ROUND("accumulated"::numeric, 2)::float8 AS "accumulated",
                    "hour" - make_interval(hours => $3)    AS "windowStart",
                    "hour"                                  AS "windowEnd",
                    "lastDate"
                FROM rolling
                ORDER BY "stationId", "accumulated" DESC, "hour" ASC
                `,
                [latest[0].id, filters.predictionType, filters.hours],
            );

            return { simulationDate: latest[0].simulationDate, items: rows.map(toPrecipAccumulationItem) };
        } catch (error) {
            this.logger.error({
                msg: 'Error computing forecast precipitation accumulation',
                entity: 'Predictions',
                error: String(error),
            });
            throw new RepositoryError('Error computing forecast precipitation accumulation', error);
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

    async findTypeCoverageByStation(stationId: string): Promise<StationPredictionTypeItem[]> {
        try {
            // Start from the FULL prediction_types catalog and LEFT JOIN towards the station's
            // ingested results. Types the station never received come back with lastEntered = NULL.
            // Only FINALIZED, non-deleted simulations count as "data" (same semantics as the panel).
            const rows: Array<{ id: string; name: string; unit: string; lastEntered: Date | null }> =
                await this.predictionRepository.manager.query(
                    `
                    SELECT pt.id AS "id", pt.name AS "name", pt.unit AS "unit",
                           MAX(pr."createdAt") AS "lastEntered"
                    FROM prediction_types pt
                    LEFT JOIN predictions p ON p."predictionTypeId" = pt.id AND p."stationId" = $1
                    LEFT JOIN simulations s ON s.id = p."simulationId"
                        AND s.status = 'FINALIZED' AND s."deletedAt" IS NULL
                    LEFT JOIN prediction_results pr ON pr."predictionId" = p.id AND s.id IS NOT NULL
                    GROUP BY pt.id, pt.name, pt.unit
                    ORDER BY pt.name ASC
                    `,
                    [stationId],
                );

            return rows.map((r) => ({
                id: r.id,
                name: r.name,
                unit: r.unit,
                lastEntered: r.lastEntered ? new Date(r.lastEntered).toISOString() : null,
            }));
        } catch (error) {
            this.logger.error({
                msg: 'Error finding prediction type coverage by station',
                entity: 'Predictions',
                error: String(error),
            });
            throw new RepositoryError('Error finding prediction type coverage by station', error);
        }
    }

    async findTypeCoverageMatrix(): Promise<TypeCoverageCell[]> {
        try {
            const rows: Array<{ stationId: string; predictionTypeId: string; lastEntered: Date }> =
                await this.predictionRepository.manager.query(
                    `
                    SELECT p."stationId" AS "stationId",
                           p."predictionTypeId" AS "predictionTypeId",
                           MAX(pr."createdAt") AS "lastEntered"
                    FROM predictions p
                    INNER JOIN simulations s ON s.id = p."simulationId"
                    INNER JOIN prediction_results pr ON pr."predictionId" = p.id
                    WHERE s.status = 'FINALIZED' AND s."deletedAt" IS NULL
                    GROUP BY p."stationId", p."predictionTypeId"
                    `,
                );

            return rows.map((r) => ({
                stationId: r.stationId,
                predictionTypeId: r.predictionTypeId,
                lastEntered: new Date(r.lastEntered).toISOString(),
            }));
        } catch (error) {
            this.logger.error({
                msg: 'Error building prediction type coverage matrix',
                entity: 'Predictions',
                error: String(error),
            });
            throw new RepositoryError('Error building prediction type coverage matrix', error);
        }
    }

    async findWithResultsBySimulationId(
        simulationId: string,
        filters?: { stationCode?: string; typeName?: string },
    ): Promise<Prediction[]> {
        try {
            const qb = this.predictionRepository.createQueryBuilder('prediction');
            qb.innerJoin('prediction.simulation', 'simulation');
            qb.leftJoinAndSelect('prediction.predictionType', 'predictionType');
            qb.leftJoinAndSelect('prediction.results', 'result');
            qb.where('prediction.simulationId = :id', { id: simulationId });
            const stationCode = filters?.stationCode?.trim();
            if (stationCode) {
                qb.andWhere('LOWER(prediction.stationId) = LOWER(:stationCode)', { stationCode });
            }
            const typeName = filters?.typeName?.trim();
            if (typeName) {
                qb.andWhere('LOWER(predictionType.name) = LOWER(:typeName)', { typeName });
            }
            qb.orderBy('prediction.stationId', 'ASC');
            qb.addOrderBy('prediction.predictionTypeId', 'ASC');
            qb.addOrderBy('result.date', 'ASC');
            return await qb.getMany();
        } catch (error) {
            this.logger.error({
                event: 'repo.prediction.findWithResultsBySimulationId.error',
                msg: 'Error finding predictions with results by simulation id',
                entity: 'Predictions',
                error: String(error),
            });
            throw new RepositoryError('Error finding predictions with results by simulation id', error);
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
